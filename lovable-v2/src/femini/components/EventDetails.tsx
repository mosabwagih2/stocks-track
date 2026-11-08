import type { Derived } from '@/femini/hooks/data';
import type { Move } from '@/femini/domain/types';
import { Button, Pill, Sheet } from './ui';
import { Thumb } from './Thumb';
import { useNavigate } from '@/femini/router';
import { LOC_AR } from '@/femini/domain/constants';
import { fmt } from '@/femini/cn';
export function EventDetails({ d, moves, title, onClose }: { d: Derived; moves: Move[]; title: string; onClose: () => void }) {
  const nav = useNavigate(); const groups = new Map<string, Move[]>();
  for (const m of moves) { const code = d.skuMap.get(m.sku)?.model ?? m.sku; groups.set(code, [...(groups.get(code) ?? []), m]); }
  return <Sheet title={title} onClose={onClose}><div className="flex flex-wrap gap-2"><Pill>{fmt(moves.reduce((a,m)=>a+m.qty,0))} قطعة</Pill><span className="text-sm text-muted">{moves[0]?.date} · {moves[0]?.by}</span></div>{[...groups].map(([code, rows])=><section key={code} className="rounded-2xl border border-line bg-surface p-4"><div className="mb-3 flex items-center gap-3"><Thumb model={d.modelMap.get(code)} size={60}/><b>{code} · {d.modelMap.get(code)?.name}</b></div><div className="grid gap-2">{rows.map((m)=><div key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm"><span>{d.skuMap.get(m.sku)?.color} · {d.skuMap.get(m.sku)?.size}</span><span className="font-mono">{fmt(m.qty)}</span><span className="text-xs text-muted">{LOC_AR[m.from]} ← {LOC_AR[m.to]}</span></div>)}</div></section>)}{moves[0]?.doc && d.snap.docs.some((x)=>x.no===moves[0]?.doc) && <Button variant="primary" onClick={()=>{nav(`/operations?tab=docs&doc=${encodeURIComponent(moves[0]?.doc ?? '')}`);onClose();}}>فتح المستند</Button>}</Sheet>;
}