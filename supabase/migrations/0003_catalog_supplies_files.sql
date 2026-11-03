-- Catalog editing, product images, supplies administration, pickup/shipment file management.
-- Same rule as 0001: browser roles can only call functions, never write tables directly.

alter table models add column if not exists image text;   -- storage path of the square product photo

-- ---------- helpers ----------
create or replace function owned_qty(p_sku text) returns int
language sql stable as $$
  select coalesce(sum(case when to_loc in ('READY','DIRTY','FACTORY','SCRAP','LOST') then qty else 0 end)
                - sum(case when from_loc in ('READY','DIRTY','FACTORY','SCRAP','LOST') then qty else 0 end), 0)::int
  from moves where sku = p_sku
$$;
create or replace function open_demand(p_sku text) returns int
language sql stable as $$
  select coalesce(sum((select count(*) from unnest(o.lines) l(s) where l.s = p_sku)), 0)::int
  from orders o where o.status = 'open'
$$;
create or replace function color_code(p_ar text) returns text
language plpgsql as $$
declare v text; n int;
begin
  select code into v from colors where ar = p_ar;
  if v is not null then return v; end if;
  select coalesce(max(substr(code,2)::int),0) + 1 into n from colors where code ~ '^X[0-9]+$';
  v := 'X' || n; insert into colors(code, ar) values (v, p_ar); return v;
end $$;

-- ---------- product image ----------
create or replace function set_model_image(p_code text, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update models set image = nullif(p_path, '') where code = p_code;
  if not found then raise exception 'unknown model'; end if;
end $$;

-- ---------- catalog ----------
create or replace function catalog_new_model(p_code text, p_name text, p_colors text[], p_sizes text[], p_min int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text := upper(btrim(p_code)); c text; z text; n int := 0;
begin
  if v_code !~ '^[A-Z][A-Z0-9]{0,9}$' then raise exception 'bad model code'; end if;
  if exists (select 1 from models where code = v_code) then raise exception 'model already exists'; end if;
  if coalesce(btrim(p_name),'') = '' then raise exception 'model name is required'; end if;
  if coalesce(array_length(p_colors,1),0) = 0 or coalesce(array_length(p_sizes,1),0) = 0 then raise exception 'pick at least one color and one size'; end if;
  insert into models(code, name) values (v_code, btrim(p_name));
  foreach c in array p_colors loop
    foreach z in array p_sizes loop
      insert into skus(id, model, color, size, min_alert) values (v_code || '-' || color_code(c) || '-' || z, v_code, c, z, coalesce(p_min,0));
      n := n + 1;
    end loop;
  end loop;
  return jsonb_build_object('model', v_code, 'skus', n);
end $$;

-- p_add: [{"color":"..","size":".."}], p_remove: sku ids. Removing is refused while a variant has stock or open demand.
create or replace function catalog_edit_model(p_code text, p_name text, p_add jsonb, p_remove text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare a jsonb; r text; v_id text; n_add int := 0; n_rm int := 0;
begin
  if not exists (select 1 from models where code = p_code) then raise exception 'unknown model'; end if;
  if coalesce(btrim(p_name),'') <> '' then update models set name = btrim(p_name), active = true where code = p_code; end if;
  for a in select * from jsonb_array_elements(coalesce(p_add,'[]'::jsonb)) loop
    v_id := p_code || '-' || color_code(a->>'color') || '-' || (a->>'size');
    if exists (select 1 from skus where model = p_code and color = a->>'color' and size = a->>'size') then
      update skus set active = true where model = p_code and color = a->>'color' and size = a->>'size' and not active;
      if found then n_add := n_add + 1; end if;
    else
      insert into skus(id, model, color, size) values (v_id, p_code, a->>'color', a->>'size'); n_add := n_add + 1;
    end if;
  end loop;
  foreach r in array coalesce(p_remove, '{}') loop
    if owned_qty(r) <> 0 then raise exception 'cannot remove %: it has stock', r; end if;
    if open_demand(r) <> 0 then raise exception 'cannot remove %: it has open demand', r; end if;
    update skus set active = false where id = r and model = p_code; n_rm := n_rm + 1;
  end loop;
  return jsonb_build_object('added', n_add, 'removed', n_rm);
end $$;

create or replace function catalog_remove_model(p_code text) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from skus where model = p_code and active loop
    if owned_qty(r.id) <> 0 then raise exception 'cannot remove %: it has stock', r.id; end if;
    if open_demand(r.id) <> 0 then raise exception 'cannot remove %: it has open demand', r.id; end if;
  end loop;
  update skus set active = false where model = p_code and active; get diagnostics n = row_count;
  update models set active = false where code = p_code;
  return n;
end $$;

create or replace function catalog_restore(p_model text, p_sku text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update skus set active = true where model = p_model and (p_sku is null or id = p_sku) and not active; get diagnostics n = row_count;
  update models set active = true where code = p_model;
  return n;
end $$;

-- ---------- supplies administration ----------
create or replace function supply_save(
  p_id text, p_name text, p_unit text, p_pack int, p_pack_name text, p_min int, p_note text, p_rule jsonb, p_open int default 0, p_by text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(btrim(coalesce(p_id,'')), '');
begin
  if coalesce(btrim(p_name),'') = '' then raise exception 'name is required'; end if;
  if (p_rule->>'kind') not in ('none','order','pieces','range') then raise exception 'bad rule'; end if;
  if (p_rule->>'kind') <> 'none' and coalesce((p_rule->>'qty')::int,0) <= 0 then raise exception 'rule quantity must be positive'; end if;
  if v_id is not null and exists (select 1 from supplies where id = v_id) then
    update supplies set name=btrim(p_name), unit=btrim(p_unit), pack=greatest(coalesce(p_pack,1),1), pack_name=coalesce(p_pack_name,''),
      min_alert=coalesce(p_min,0), note=coalesce(p_note,''), rule=p_rule where id = v_id;
  else
    v_id := 'S' || (coalesce((select max(substr(id,2)::int) from supplies where id ~ '^S[0-9]+$'),0) + 1);
    insert into supplies(id,name,unit,pack,pack_name,min_alert,note,rule)
    values (v_id, btrim(p_name), btrim(p_unit), greatest(coalesce(p_pack,1),1), coalesce(p_pack_name,''), coalesce(p_min,0), coalesce(p_note,''), p_rule);
    if coalesce(p_open,0) > 0 then
      insert into supply_log(log_date,item,qty,kind,why,by) values (cairo_today(), v_id, p_open, 'open', 'opening balance', p_by);
    end if;
  end if;
  return v_id;
end $$;

create or replace function supply_archive(p_id text, p_archived boolean) returns void
language sql security definer set search_path = public as $$
  update supplies set archived = p_archived where id = p_id
$$;

-- ---------- pickup / shipment files ----------
create or replace function pickup_update(p_id text, p_label text, p_date date, p_channel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_label),'') = '' then raise exception 'label is required'; end if;
  if p_date > cairo_today() then raise exception 'date cannot be in the future'; end if;
  update pickups set label = btrim(p_label), pickup_date = p_date, channel = p_channel where id = p_id;
  if not found then raise exception 'unknown pickup'; end if;
end $$;

create or replace function pickup_delete(p_id text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if exists (select 1 from orders where pickup_id = p_id and status = 'shipped') then raise exception 'pickup has shipped orders'; end if;
  select count(*) into n from orders where pickup_id = p_id;
  delete from pickups where id = p_id;   -- orders cascade
  return n;
end $$;

create or replace function rename_shipment_employee(p_doc text, p_name text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if coalesce(btrim(p_name),'') = '' then raise exception 'employee name is required'; end if;
  update orders set shipped_by = btrim(p_name) where ship_doc = p_doc; get diagnostics n = row_count;
  update docs set by = btrim(p_name), hdr = jsonb_set(hdr, '{employee}', to_jsonb(btrim(p_name))) where no = p_doc and type = 'SCN';
  if n = 0 then raise exception 'unknown shipment document'; end if;
  return n;
end $$;

grant execute on function
  set_model_image(text,text), catalog_new_model(text,text,text[],text[],int), catalog_edit_model(text,text,jsonb,text[]),
  catalog_remove_model(text), catalog_restore(text,text),
  supply_save(text,text,text,int,text,int,text,jsonb,int,text), supply_archive(text,boolean),
  pickup_update(text,text,date,text), pickup_delete(text), rename_shipment_employee(text,text)
to anon, authenticated;
