-- Fémini warehouse system: schema, ledger, business functions.
-- Design rules
--   * Stock is an immutable ledger of moves between locations. Balances are derived (view), never typed.
--   * Browser clients can only READ tables and CALL the functions below. No direct INSERT/UPDATE/DELETE,
--     so the ledger cannot be edited and every change is validated inside one transaction.
--   * Permissions are intentionally open during the testing phase (anon can read and call the functions).
--     Before going live: switch the policies to `authenticated` and add the two roles (see README).

create extension if not exists pgcrypto;

-- ---------- locations ----------
create type loc as enum (
  'READY',        -- WH/Stock: sellable
  'DIRTY',        -- WH/Cleaning: needs washing, recoverable
  'FACTORY',      -- Transit/Factory: sent for washing, pending return
  'SCRAP',        -- Virtual/Scrap: final damage
  'LOST',         -- Virtual/Inventory loss
  'EXT_OPEN',     -- opening balance source
  'EXT_FACTORY',  -- supplier (factory)
  'EXT_CH',       -- sales channel / customer
  'EXT_SHOP',     -- retail shop
  'EXT_ADJ',      -- count adjustment
  'EXT_OFF'       -- write-off
);

-- ---------- catalog ----------
create table models (
  code   text primary key,
  name   text not null,
  active boolean not null default true
);
create table colors (
  code text primary key,
  ar   text not null unique
);
create table skus (
  id        text primary key,
  model     text not null references models(code),
  color     text not null,
  size      text not null,
  min_alert int  not null default 0,
  active    boolean not null default true,
  unique (model, color, size)
);
create index skus_model_idx on skus(model);

-- ---------- ledger ----------
create table moves (
  id        bigserial primary key,
  ts        timestamptz not null default now(),
  move_date date not null,
  sku       text not null references skus(id),
  qty       integer not null check (qty > 0),
  from_loc  loc not null,
  to_loc    loc not null,
  type      text not null,
  doc       text not null,
  by        text not null,
  note      text not null default '',
  check (from_loc <> to_loc)
);
create index moves_sku_idx on moves(sku);
create index moves_doc_idx on moves(doc);

create view stock_balances as
  select sku, loc, sum(q)::int as qty
  from (
    select sku, to_loc as loc, qty as q from moves
    union all
    select sku, from_loc as loc, -qty as q from moves
  ) t
  where loc in ('READY','DIRTY','FACTORY','SCRAP','LOST')
  group by sku, loc;

-- nightly integrity check: every SKU must sum to zero across ALL locations
create view ledger_check as
  select sku, sum(q)::int as drift
  from (
    select sku, qty as q from moves
    union all
    select sku, -qty as q from moves
  ) t
  group by sku
  having sum(q) <> 0;

-- ---------- orders ----------
create table pickups (
  id          text primary key,
  label       text not null,
  pickup_date date not null,
  channel     text not null default 'VENDOOR',
  source      text not null default '',
  created_at  timestamptz not null default now()
);
create table orders (
  ref        text primary key,                 -- random order code (the QR holds this)
  waybill    text not null default '',         -- shipping number
  type       text not null default 'new' check (type in ('new','exchange')),
  gov        text not null default '',
  total      numeric not null default 0,
  lines      text[] not null,                  -- sku id per piece
  unmapped   jsonb not null default '[]'::jsonb,
  pickup_id  text not null references pickups(id) on delete cascade,
  status     text not null default 'open' check (status in ('open','shipped','cancelled')),
  shipped_by text,
  shipped_at timestamptz,
  ship_doc   text,
  cancel     jsonb
);
create unique index orders_waybill_uq on orders(waybill) where waybill <> '';
create index orders_status_idx on orders(status);
create index orders_pickup_idx on orders(pickup_id);

-- ---------- documents (receipts, status changes, ...) ----------
create table doc_seq (type text primary key, n integer not null default 0);
create table docs (
  id         bigserial primary key,
  no         text not null unique,
  type       text not null,
  doc_date   date not null,
  by         text not null,
  status     text not null default 'done' check (status in ('done','reversed')),
  hdr        jsonb not null default '{}'::jsonb,
  lines      jsonb not null default '[]'::jsonb,
  attachment text,                              -- storage path of the signed paper photo
  created_at timestamptz not null default now()
);

-- ---------- supplies ----------
create table supplies (
  id        text primary key,
  name      text not null,
  unit      text not null default 'قطعة',
  pack      int  not null default 1,
  pack_name text not null default '',
  min_alert int  not null default 0,
  note      text not null default '',
  archived  boolean not null default false,
  rule      jsonb not null default '{"kind":"none"}'::jsonb   -- none | order | pieces | range
);
create table supply_log (
  id       bigserial primary key,
  ts       timestamptz not null default now(),
  log_date date not null,
  item     text not null references supplies(id),
  qty      int not null,
  kind     text not null check (kind in ('open','rcv','issue','count','auto','rev')),
  why      text not null default '',
  doc      text,
  by       text not null default '',
  of_id    bigint,
  reversed boolean not null default false
);
create view supply_balances as
  select s.id as item, coalesce(sum(l.qty),0)::int as qty
  from supplies s left join supply_log l on l.item = s.id
  group by s.id;

create table settings (key text primary key, value jsonb not null);

-- ---------- helpers ----------
create or replace function next_doc_no(p_type text) returns text
language plpgsql as $$
declare v int;
begin
  insert into doc_seq(type, n) values (p_type, 1)
  on conflict (type) do update set n = doc_seq.n + 1
  returning n into v;
  return p_type || '-' || lpad(v::text, 4, '0');
end $$;

create or replace function cairo_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;

create or replace function ready_qty(p_sku text) returns int
language sql stable as $$
  select coalesce(sum(case when to_loc='READY' then qty else 0 end) - sum(case when from_loc='READY' then qty else 0 end), 0)::int
  from moves where sku = p_sku
$$;

create or replace function loc_qty(p_sku text, p_loc loc) returns int
language sql stable as $$
  select coalesce(sum(case when to_loc=p_loc then qty else 0 end) - sum(case when from_loc=p_loc then qty else 0 end), 0)::int
  from moves where sku = p_sku
$$;

-- supplies consumed by one order, as (item, qty) rows. Rules live in supplies.rule:
--   {"kind":"order","qty":1} | {"kind":"pieces","qty":2,"model":"BR1"} | {"kind":"range","qty":1,"from":1,"to":2}
create or replace function order_consumption(p_lines text[])
returns table(item text, qty int)
language plpgsql stable as $$
declare
  s record; n int := coalesce(array_length(p_lines,1),0); q int; cnt int;
begin
  for s in select id, rule from supplies where not archived and (rule->>'kind') <> 'none' loop
    q := 0;
    if s.rule->>'kind' = 'order' then
      q := (s.rule->>'qty')::int;
    elsif s.rule->>'kind' = 'pieces' then
      select count(*) into cnt from unnest(p_lines) l(sku) join skus k on k.id = l.sku
       where coalesce(s.rule->>'model','') = '' or k.model = s.rule->>'model';
      q := (s.rule->>'qty')::int * cnt;
    elsif s.rule->>'kind' = 'range' then
      if n >= (s.rule->>'from')::int and (coalesce((s.rule->>'to')::int,0) = 0 or n <= (s.rule->>'to')::int) then
        q := (s.rule->>'qty')::int;
      end if;
    end if;
    if q > 0 then item := s.id; qty := q; return next; end if;
  end loop;
end $$;

-- ---------- business functions (the only write path) ----------

-- Import a pickup (the DEMAND). Does not touch stock. Duplicate order codes are skipped.
create or replace function import_pickup(
  p_label text, p_date date, p_channel text, p_source text, p_orders jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text; v_new int := 0; v_dup int := 0; o jsonb;
begin
  v_id := 'P' || (coalesce((select max(substr(id,2)::int) from pickups where id ~ '^P[0-9]+$'),0) + 1);
  insert into pickups(id,label,pickup_date,channel,source) values (v_id,p_label,p_date,p_channel,p_source);
  for o in select * from jsonb_array_elements(p_orders) loop
    if exists (select 1 from orders where ref = o->>'ref' or (o->>'waybill' <> '' and waybill = o->>'waybill')) then
      v_dup := v_dup + 1; continue;
    end if;
    insert into orders(ref,waybill,type,gov,total,lines,unmapped,pickup_id)
    values (o->>'ref', coalesce(o->>'waybill',''), coalesce(o->>'type','new'), coalesce(o->>'gov',''),
            coalesce((o->>'total')::numeric,0),
            array(select jsonb_array_elements_text(o->'lines')),
            coalesce(o->'unmapped','[]'::jsonb), v_id);
    v_new := v_new + 1;
  end loop;
  return jsonb_build_object('pickup', v_id, 'imported', v_new, 'duplicates', v_dup);
end $$;

-- Ship orders (the ACTUAL outgoing, from a scanner file). Deducts READY stock per order.
-- Never blocked by stock: if the system balance is short the scan is still accepted and the SKU goes negative.
create or replace function ship_orders(
  p_refs text[], p_employee text, p_source text, p_date date default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_date date := coalesce(p_date, cairo_today());
  v_doc text; v_n int := 0; v_pcs int := 0; v_neg jsonb;
  r record; c record;
begin
  if coalesce(btrim(p_employee),'') = '' then raise exception 'employee name is required'; end if;
  if coalesce(array_length(p_refs,1),0) = 0 then raise exception 'no orders to ship'; end if;

  perform 1 from orders where ref = any(p_refs) and status = 'open' for update;
  v_doc := next_doc_no('SCN');

  insert into moves(move_date, sku, qty, from_loc, to_loc, type, doc, by, note)
  select v_date, l.sku, count(*)::int, 'READY', 'EXT_CH', 'SCN', v_doc, btrim(p_employee), 'scan: ' || btrim(p_employee)
  from orders o, unnest(o.lines) l(sku)
  where o.ref = any(p_refs) and o.status = 'open'
  group by l.sku;

  update orders set status='shipped', shipped_by=btrim(p_employee), shipped_at=now(), ship_doc=v_doc
   where ref = any(p_refs) and status = 'open';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'none of the orders is open'; end if;

  select coalesce(sum(array_length(lines,1)),0) into v_pcs from orders where ship_doc = v_doc;
  insert into docs(no,type,doc_date,by,hdr,lines)
  values (v_doc,'SCN',v_date,btrim(p_employee),jsonb_build_object('employee',btrim(p_employee),'source',coalesce(p_source,''),'orders',v_n,'pieces',v_pcs),'[]'::jsonb);

  -- supplies: one aggregated entry per item for the whole file
  insert into supply_log(log_date,item,qty,kind,why,doc,by)
  select v_date, x.item, -sum(x.qty)::int, 'auto', 'scan ' || btrim(p_employee) || ': ' || v_n || ' orders', v_doc, btrim(p_employee)
  from orders o, lateral order_consumption(o.lines) x
  where o.ship_doc = v_doc
  group by x.item;

  select coalesce(jsonb_agg(jsonb_build_object('sku', sku, 'ready', rq)), '[]'::jsonb) into v_neg
  from (select m.sku, ready_qty(m.sku) rq from moves m where m.doc = v_doc group by m.sku) t where rq < 0;

  return jsonb_build_object('doc', v_doc, 'shipped', v_n, 'pieces', v_pcs, 'negative', v_neg);
end $$;

-- Reverse a whole scan document: orders become open again, stock and supplies come back.
create or replace function reverse_shipment(p_doc text, p_by text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rev text := p_doc || ' (rev)'; v_n int;
begin
  if exists (select 1 from moves where doc = v_rev) then raise exception 'already reversed'; end if;
  insert into moves(move_date, sku, qty, from_loc, to_loc, type, doc, by, note)
  select cairo_today(), sku, qty, to_loc, from_loc, 'SCN', v_rev, p_by, 'reverse ' || p_doc
  from moves where doc = p_doc and type = 'SCN';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'unknown shipment document'; end if;
  update orders set status='open', shipped_by=null, shipped_at=null, ship_doc=null where ship_doc = p_doc;
  update docs set status = 'reversed' where no = p_doc and type = 'SCN';
  insert into supply_log(log_date,item,qty,kind,why,doc,by,of_id)
  select cairo_today(), item, -qty, 'rev', 'reverse ' || p_doc, v_rev, p_by, id
  from supply_log where doc = p_doc and kind = 'auto' and not reversed;
  update supply_log set reversed = true where doc = p_doc and kind = 'auto';
  return jsonb_build_object('doc', v_rev, 'moves', v_n);
end $$;

-- Receipt from the factory. Needs the signed-paper photo path and the total written on the paper.
create or replace function receive_stock(
  p_lines jsonb, p_date date, p_by text, p_ref text, p_declared int, p_attachment text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_total int; v_doc text;
begin
  select coalesce(sum((l->>'qty')::int),0) into v_total from jsonb_array_elements(p_lines) l;
  if v_total <= 0 then raise exception 'no pieces'; end if;
  if coalesce(p_attachment,'') = '' then raise exception 'photo of the signed paper is required'; end if;
  if p_declared is null or p_declared <> v_total then
    raise exception 'declared total % does not match lines total %', p_declared, v_total;
  end if;
  if p_date > cairo_today() or p_date < cairo_today() - 3 then raise exception 'date must be within the last 3 days'; end if;
  v_doc := next_doc_no('RCV');
  insert into moves(move_date, sku, qty, from_loc, to_loc, type, doc, by, note)
  select p_date, l->>'sku', (l->>'qty')::int, 'EXT_FACTORY', 'READY', 'RCV', v_doc, p_by, 'receipt ' || coalesce(p_ref,'')
  from jsonb_array_elements(p_lines) l where (l->>'qty')::int > 0;
  insert into docs(no,type,doc_date,by,hdr,lines,attachment)
  values (v_doc,'RCV',p_date,p_by,jsonb_build_object('ref',p_ref,'declared',p_declared),p_lines,p_attachment);
  return jsonb_build_object('doc', v_doc, 'pieces', v_total);
end $$;

-- Move pieces between internal states (READY -> DIRTY / SCRAP, DIRTY -> SCRAP, DIRTY -> FACTORY, FACTORY -> READY ...).
-- Refuses to move more than the source location holds.
create or replace function move_state(
  p_lines jsonb, p_from loc, p_to loc, p_by text, p_reason text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare l jsonb; v_doc text; v_pcs int := 0;
begin
  if p_from = p_to then raise exception 'source and destination are the same'; end if;
  if p_from::text like 'EXT_%' then raise exception 'use the dedicated function for external sources'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if loc_qty(l->>'sku', p_from) < (l->>'qty')::int then
      raise exception 'not enough in % for %: have %, need %', p_from, l->>'sku', loc_qty(l->>'sku', p_from), l->>'qty';
    end if;
  end loop;
  v_doc := next_doc_no('MOV');
  insert into moves(move_date, sku, qty, from_loc, to_loc, type, doc, by, note)
  select cairo_today(), x->>'sku', (x->>'qty')::int, p_from, p_to, 'MOV', v_doc, p_by, coalesce(p_reason,'')
  from jsonb_array_elements(p_lines) x where (x->>'qty')::int > 0;
  select coalesce(sum((x->>'qty')::int),0) into v_pcs from jsonb_array_elements(p_lines) x;
  insert into docs(no,type,doc_date,by,hdr,lines) values (v_doc,'MOV',cairo_today(),p_by,jsonb_build_object('from',p_from,'to',p_to,'reason',p_reason),p_lines);
  return jsonb_build_object('doc', v_doc, 'pieces', v_pcs);
end $$;

-- Cancel an order (the warehouse was told to). Code can be the order code or the waybill number.
-- If the order was already shipped, p_return puts its pieces and supplies back.
create or replace function cancel_order(
  p_code text, p_reason text, p_by text, p_return boolean, p_attachment text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; v_code text := lower(regexp_replace(coalesce(p_code,''), '[#\s]', '', 'g')); v_doc text; v_was text;
begin
  if coalesce(p_attachment,'') = '' then raise exception 'photo of the crossed-out waybill is required'; end if;
  select * into o from orders where lower(ref) = v_code or waybill = v_code for update;
  if not found then raise exception 'no order with this code'; end if;
  if o.status = 'cancelled' then raise exception 'order is already cancelled'; end if;
  v_was := o.status;
  if v_was = 'shipped' and p_return then
    v_doc := next_doc_no('CXL');
    insert into moves(move_date, sku, qty, from_loc, to_loc, type, doc, by, note)
    select cairo_today(), l.sku, count(*)::int, 'EXT_CH', 'READY', 'CXL', v_doc, p_by, 'cancel order ' || o.ref
    from unnest(o.lines) l(sku) group by l.sku;
    insert into supply_log(log_date,item,qty,kind,why,doc,by)
    select cairo_today(), x.item, x.qty, 'rev', 'cancel order ' || o.ref, v_doc, p_by from order_consumption(o.lines) x;
  end if;
  update orders set status='cancelled',
    cancel = jsonb_build_object('at', now(), 'by', p_by, 'reason', coalesce(p_reason,''), 'was', v_was,
                                'returned', (v_was='shipped' and p_return), 'doc', v_doc, 'attachment', p_attachment)
  where ref = o.ref;
  return jsonb_build_object('ref', o.ref, 'was', v_was, 'returned', (v_was='shipped' and p_return), 'doc', v_doc);
end $$;

create or replace function restore_order(p_ref text, p_by text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where ref = p_ref and status = 'cancelled' for update;
  if not found then raise exception 'order is not cancelled'; end if;
  update orders set
    status = case when o.cancel->>'was' = 'shipped' and not (o.cancel->>'returned')::boolean then 'shipped' else 'open' end,
    cancel = null
  where ref = p_ref;
end $$;

-- Supplies: receive (+), issue (-, never below zero), count (set the balance).
create or replace function supply_move(
  p_item text, p_kind text, p_qty int, p_why text, p_by text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal int; v_delta int; v_id bigint;
begin
  if p_kind not in ('rcv','issue','count') then raise exception 'bad kind'; end if;
  select qty into v_bal from supply_balances where item = p_item;
  if not found then raise exception 'unknown supply'; end if;
  if p_kind = 'rcv' then
    if p_qty <= 0 then raise exception 'quantity must be positive'; end if; v_delta := p_qty;
  elsif p_kind = 'issue' then
    if p_qty <= 0 then raise exception 'quantity must be positive'; end if;
    if p_qty > v_bal then raise exception 'cannot issue % (balance %)', p_qty, v_bal; end if; v_delta := -p_qty;
  else
    if p_qty < 0 then raise exception 'count cannot be negative'; end if; v_delta := p_qty - v_bal;
    if v_delta = 0 then raise exception 'count equals the balance'; end if;
  end if;
  insert into supply_log(log_date,item,qty,kind,why,by) values (cairo_today(), p_item, v_delta, p_kind, coalesce(p_why,''), p_by) returning id into v_id;
  return jsonb_build_object('id', v_id, 'delta', v_delta, 'balance', v_bal + v_delta);
end $$;

create or replace function undo_supply_move(p_id bigint, p_by text) returns void
language plpgsql security definer set search_path = public as $$
declare e supply_log;
begin
  select * into e from supply_log where id = p_id and kind in ('rcv','issue','count','open') and not reversed for update;
  if not found then raise exception 'nothing to undo'; end if;
  insert into supply_log(log_date,item,qty,kind,why,by,of_id) values (cairo_today(), e.item, -e.qty, 'rev', 'undo: ' || e.why, p_by, e.id);
  update supply_log set reversed = true where id = p_id;
end $$;

-- ---------- row level security ----------
-- Read everything, write nothing directly. All writes go through the security-definer functions above.
do $$
declare t text;
begin
  for t in select unnest(array['models','colors','skus','moves','pickups','orders','docs','doc_seq','supplies','supply_log','settings']) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "open read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant execute on function
  import_pickup(text,date,text,text,jsonb), ship_orders(text[],text,text,date), reverse_shipment(text,text),
  receive_stock(jsonb,date,text,text,int,text), move_state(jsonb,loc,loc,text,text),
  cancel_order(text,text,text,boolean,text), restore_order(text,text),
  supply_move(text,text,int,text,text), undo_supply_move(bigint,text)
to anon, authenticated;
