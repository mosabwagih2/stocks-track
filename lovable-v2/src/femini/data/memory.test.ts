import { beforeEach, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { cairoToday } from '@/femini/domain/dates';
beforeEach(()=>localStorage.clear());
it('archives pickups without destroying their orders and restores them', async()=>{
  const r=createMemoryRepo(); const before=await r.snapshot(); const p=before.pickups[0]; if(!p) throw new Error('seed missing');
  const count=before.orders.filter((o)=>o.pickupId===p.id).length;
  await r.pickupDelete(p.id); const after=await r.snapshot(); expect(after.archivedPickups[0]?.orders.length).toBe(count); expect(after.pickups.some((x)=>x.id===p.id)).toBe(false);
  await r.restoreArchive('pickup',p.id); expect((await r.snapshot()).orders.length).toBe(before.orders.length);
});
it('a closed day blocks shipment and reopening restores access',async()=>{
  const r=createMemoryRepo(); const ref=(await r.snapshot()).orders[0]?.ref; if(!ref)throw new Error('seed missing');
  await r.closeDay(cairoToday()); await expect(r.shipOrders({refs:[ref],employee:'test',source:'test'})).rejects.toThrow('مقفول');
  await r.reopenDay(cairoToday()); expect((await r.shipOrders({refs:[ref],employee:'test',source:'test'})).shipped).toBe(1);
});
it('detects another tab and does not overwrite its state',async()=>{
  const first=createMemoryRepo(); const second=createMemoryRepo(); await first.catalogNewModel({code:'TEST1',name:'test',colors:['اسود'],sizes:['L'],minAlert:0});
  await expect(second.catalogNewModel({code:'TEST2',name:'test',colors:['اسود'],sizes:['L'],minAlert:0})).rejects.toThrow('تبويب آخر');
  const snap=await createMemoryRepo().snapshot(); expect(snap.models.some((m)=>m.code==='TEST1')).toBe(true); expect(snap.models.some((m)=>m.code==='TEST2')).toBe(false);
});
it('preserves archived drafts',async()=>{
  const r=createMemoryRepo(); const id=await r.saveDraft({type:'SHP',date:cairoToday(),hdr:{shop:'test'},lines:[]}); await r.deleteDraft(id);
  expect((await r.snapshot()).archivedDrafts[0]?.id).toBe(id); await r.restoreArchive('draft',id); expect((await r.snapshot()).drafts[0]?.id).toBe(id);
});
it('saves model cost and price without changing stock movements',async()=>{const r=createMemoryRepo();const before=await r.snapshot();await r.setModelCosts('BR2',125,200);const after=await r.snapshot();expect(after.costs.BR2).toEqual({cost:125,price:200});expect(after.moves).toEqual(before.moves);await expect(r.setModelCosts('BR2',-1,200)).rejects.toThrow();});
it('closed days prevent pickup changes and draft writes',async()=>{const r=createMemoryRepo();const p=(await r.snapshot()).pickups[0];if(!p)throw new Error('seed missing');await r.closeDay(p.date);await expect(r.pickupUpdate({...p,label:'changed'})).rejects.toThrow('مقفول');await expect(r.pickupDelete(p.id)).rejects.toThrow('مقفول');await expect(r.saveDraft({date:p.date,type:'SHP',hdr:{},lines:[]})).rejects.toThrow('مقفول');});
it('freezes day-close report and preserves it after reopening another day',async()=>{const r=createMemoryRepo();const ref=(await r.snapshot()).orders[0]?.ref;if(!ref)throw new Error('seed missing');await r.shipOrders({refs:[ref],employee:'tester',source:'test'});await r.closeDay(cairoToday());const c=(await r.snapshot()).closes.find((x)=>x.date===cairoToday());expect(c?.report?.team[0]?.[0]).toBe('tester');expect(c?.summary.shipped).toBeGreaterThan(0);expect((await createMemoryRepo().snapshot()).closes.find((x)=>x.date===cairoToday())?.report).toEqual(c?.report);});