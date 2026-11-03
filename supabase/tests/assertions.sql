\set ON_ERROR_STOP on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function t_fails(sql text, expect text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(expect in sqlerrm) = 0 then raise exception 'wrong error for [%]: %', sql, sqlerrm; end if; return;
  end;
  raise exception 'expected failure but succeeded: %', sql;
end $$;
create or replace function t_ready() returns int language sql as $$ select coalesce(sum(qty),0)::int from stock_balances where loc='READY' $$;
create or replace function t_sup(i text) returns int language sql as $$ select qty from supply_balances where item=i $$;

\echo '-- seed'
select t_assert(t_ready()=43863, 'opening READY total is 43863 (got '||t_ready()||')');
select t_assert((select count(*) from orders where status='open')=92, '92 open orders');
select t_assert((select count(*) from ledger_check)=0, 'ledger sums to zero after seed');

\echo '-- ship the real scan file: 28 orders, 456 pieces, stock -456'
create temp table t_res as select ship_orders(string_to_array(:'refs', ','), 'Abdullah', 'QRbot file') r;
select t_assert((r->>'shipped')::int=28 and (r->>'pieces')::int=456, 'ship result 28/456: '||r::text) from t_res;
select t_assert(t_ready()=43407, 'READY after ship is 43407 (got '||t_ready()||')');
select t_assert((select count(*) from orders where status='shipped')=28, '28 orders shipped');
select t_assert(t_sup('FLY')=2000-28, 'flyers consumed one per order');
select t_assert(t_sup('CUP')<960, 'cups consumed for BR1 pieces');
select t_assert((select count(*) from supply_log where doc=(select r->>'doc' from t_res) and kind='auto')<=5, 'supplies aggregated per item, not per order');
select t_assert((select count(*) from ledger_check)=0, 'ledger still balanced');

\echo '-- idempotency + validation'
select t_fails(format('select ship_orders(%L::text[], %L, %L)', string_to_array(:'refs', ','), 'Abdullah', 'again'), 'none of the orders is open');
select t_fails($$select ship_orders(array['ed4298'], '', 'x')$$, 'employee name is required');

\echo '-- scans are never blocked by stock: negative balance allowed'
update orders set lines = array['BR2-BLK-L'] where ref='ed4298';
select move_state(jsonb_build_array(jsonb_build_object('sku','BR2-BLK-L','qty', ready_qty('BR2-BLK-L'))), 'READY','SCRAP','test');
create temp table t_neg as select ship_orders(array['ed4298'],'Hossam','manual') r;
select t_assert(ready_qty('BR2-BLK-L') = -1, 'sku went to -1');
select t_assert(jsonb_array_length(r->'negative')=1, 'negative reported') from t_neg;

\echo '-- reverse a scan document'
create temp table t_r1 as select (r->>'doc') d from t_res;
select reverse_shipment(d,'test') from t_r1;
select t_assert((select count(*) from orders where status='open')=91, '28 reopened (one stays shipped by Hossam)');
select t_assert(t_sup('FLY')=2000-1, 'flyers restored');
select t_fails(format('select reverse_shipment(%L,%L)', (select d from t_r1), 'test'), 'already reversed');
select t_assert((select count(*) from ledger_check)=0, 'ledger balanced after reverse');

\echo '-- receipt rules'
select t_fails($$select receive_stock('[{"sku":"PAN3-BLK-S","qty":10}]'::jsonb, cairo_today(), 'u', 'R1', 10, '')$$, 'photo');
select t_fails($$select receive_stock('[{"sku":"PAN3-BLK-S","qty":10}]'::jsonb, cairo_today(), 'u', 'R1', 9, 'documents/a.jpg')$$, 'does not match');
select t_fails($$select receive_stock('[{"sku":"PAN3-BLK-S","qty":10}]'::jsonb, cairo_today()-10, 'u', 'R1', 10, 'documents/a.jpg')$$, 'last 3 days');
select t_ready() as before \gset
select receive_stock('[{"sku":"PAN3-BLK-S","qty":10}]'::jsonb, cairo_today(), 'u', 'R1', 10, 'documents/a.jpg');
select t_assert(t_ready()=:before+10, 'receipt adds 10');

\echo '-- state changes cannot exceed the source'
select t_fails($$select move_state('[{"sku":"A1-WHT-S","qty":5}]'::jsonb,'DIRTY','FACTORY','u')$$, 'not enough');
select move_state(jsonb_build_array(jsonb_build_object('sku','PAN3-BLK-S','qty',4)),'READY','DIRTY','u','stain');
select t_assert(loc_qty('PAN3-BLK-S','DIRTY')=4, '4 moved to cleaning');
select move_state(jsonb_build_array(jsonb_build_object('sku','PAN3-BLK-S','qty',4)),'DIRTY','FACTORY','u','wash');
select t_assert(loc_qty('PAN3-BLK-S','FACTORY')=4, '4 at factory');

\echo '-- cancel an order by waybill, shipped one returns stock + supplies'
select t_fails($$select cancel_order('fd8523','x','u',true,'')$$, 'photo');
select cancel_order('23793621','customer cancelled','u',false,'documents/c1.jpg');
select t_assert((select status from orders where ref='fd8523')='cancelled', 'open order cancelled by waybill');
select restore_order('fd8523','u');
select t_assert((select status from orders where ref='fd8523')='open', 'restored to open');
select t_ready() as r_before, t_sup('FLY') as f_before \gset
select cancel_order('ed 4298#','x','u',true,'documents/c2.jpg');
select t_assert(t_ready()=:r_before+1, 'shipped order returned 1 piece');
select t_assert(t_sup('FLY')=:f_before+1, 'flyer returned');
select t_fails($$select cancel_order('ed4298','x','u',true,'documents/c2.jpg')$$, 'already cancelled');

\echo '-- supplies'
select t_fails($$select supply_move('FLY','issue',99999,'x','u')$$, 'cannot issue');
select supply_move('FLY','rcv',100,'delivery','u') ;
select t_fails($$select supply_move('FLY','count',t_sup('FLY'),'x','u')$$, 'equals the balance');

\echo '-- import pickup is idempotent and does not touch stock'
select t_ready() as r1 \gset
select import_pickup('P test', cairo_today(), 'VENDOOR', 'f.xlsx', '[{"ref":"zz0001","waybill":"9000001","type":"new","gov":"x","total":1,"lines":["PAN3-BLK-S","PAN3-BLK-S"]}]'::jsonb);
select t_assert((select imported from (select (import_pickup('P test2', cairo_today(), 'VENDOOR', 'f.xlsx', '[{"ref":"zz0001","waybill":"9000001","lines":["PAN3-BLK-S"]}]'::jsonb)->>'duplicates')::int as imported) q)=1, 'duplicate order code skipped');
select t_assert(t_ready()=:r1, 'pickup import does not move stock');

\echo '-- direct writes are refused for browser roles (ledger is immutable)'
set role anon;
select t_fails($$insert into moves(move_date,sku,qty,from_loc,to_loc,type,doc,by) values (current_date,'PAN3-BLK-S',1,'READY','EXT_CH','X','X','x')$$, 'permission denied');
select t_fails($$update orders set status='open'$$, 'permission denied');
select t_fails($$delete from moves$$, 'permission denied');
select count(*) from moves;
reset role;
select t_assert((select count(*) from ledger_check)=0, 'ledger balanced at the end');
\echo 'all assertions passed'
