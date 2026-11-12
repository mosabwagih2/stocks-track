import { createPortal } from 'react-dom';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui';
import { LocDetail } from './LocDetail';
import { LOCS, LOC_AR, LOC_HINT } from '@/femini/domain/constants';
import { locTotal } from '@/femini/domain/ledger';
import { addDays } from '@/femini/domain/dates';
import { paretoRows } from '@/femini/domain/pareto';
import { cn, fmt, pct } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import type { Loc } from '@/femini/domain/types';

export const C = { accent: 'var(--chart-primary)', ready: 'var(--chart-secondary)', dirty: 'var(--dirty)', factory: 'var(--factory)', scrap: 'var(--scrap)', lost: 'var(--lostc)', muted: 'var(--chart-previous)', femini: 'var(--chart-femini)', grid: 'var(--chart-grid)', text: 'var(--muted)' };
export const LOC_FILL: Record<Loc,string> = { READY:C.ready, DIRTY:C.dirty, FACTORY:C.factory, SCRAP:C.scrap, LOST:C.lost };
const axis = { tick: { fill:C.text, fontSize:11 }, tickLine:false, axisLine:false, tickMargin:12 };
const numberTick = (n:number) => n >= 1000 ? `${Number((n/1000).toFixed(1))}k` : String(n);
const shortDay = (v:unknown) => new Date(String(v)+'T12:00:00Z').toLocaleDateString('ar-EG-u-nu-latn',{day:'numeric',month:'short',timeZone:'UTC'});
function Fade({id,color}:{id:string;color:string}) { return <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22}/><stop offset="95%" stopColor={color} stopOpacity={0.015}/></linearGradient>; }
export function TipBox({active,payload,label,fmtLabel}:{active?:boolean;payload?:{name?:string;value?:number;color?:string;payload?:Record<string,unknown>}[];label?:ReactNode;fmtLabel?:(l:unknown)=>ReactNode}) {
 if(!active||!payload?.length)return null;
 return <div className="chart-tooltip min-w-44 rounded-lg border border-line bg-surface p-3 text-xs" dir="rtl">{label!==undefined&&<div className="mb-2 border-b border-line pb-2 font-semibold text-ink">{fmtLabel?fmtLabel(label):label}</div>}{payload.map((p,i)=><div key={i} className="flex items-center gap-2 py-1"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={p.color}/></svg><span className="text-muted">{p.name}</span><b className="num ms-auto text-sm text-ink">{fmt(Number(p.value??0))}</b></div>)}</div>;
}
/** Hover position of a chart, reported in a strip ABOVE it instead of a floating box that covers the lines. */
function useHover() {
  const [i, setI] = useState<number | null>(null);
  return [i, { onMouseMove: (st: { activeTooltipIndex?: number | string | null }) => setI(st?.activeTooltipIndex == null ? null : Number(st.activeTooltipIndex)), onMouseLeave: () => setI(null) }] as const;
}
/**
 * The values under the cursor (or the period totals when the cursor is away): the first series as one big number,
 * the others as small chips beside it. Fixed minimum height, so hovering never makes the chart jump.
 */
export function Readout({ title, items }: { title: ReactNode; items: { name: string; value: number; color: string }[] }) {
  const [main, ...rest] = items;
  return (
    <div className="mb-3 flex min-h-12 flex-wrap items-end justify-between gap-x-6 gap-y-2" aria-live="polite">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-[11px] font-medium text-muted">{title}</span>
        {main && <span className="flex items-baseline gap-2"><b className="num text-2xl leading-none font-semibold tracking-tight text-ink">{fmt(main.value)}</b><span className="inline-flex items-center gap-1.5 text-xs text-muted"><i className="inline-block size-2 rounded-full" style={{ background: main.color }} />{main.name}</span></span>}
      </div>
      {rest.length > 0 && <div className="flex flex-wrap gap-2">{rest.map((x) => <span key={x.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-lav/50 px-2.5 py-1 text-xs text-muted"><i className="inline-block size-2 rounded-full" style={{ background: x.color }} />{x.name} <b className="num text-ink">{fmt(x.value)}</b></span>)}</div>}
    </div>
  );
}
const noTip = () => null;
export function Sparkline({data,labels,color=C.accent,height=48}:{data:number[];labels?:string[];color?:string;height?:number}) {
 const id=useId().replace(/:/g,''); const rows=data.map((v,i)=>({i,v})); const [hi,on]=useHover();
 return <div className="chart-surface relative mt-3" style={{height}}>{hi!=null&&<span className="pointer-events-none absolute -top-5 end-0 z-10 rounded-md bg-ink/85 px-1.5 py-0.5 text-[11px] text-surface"><span className="opacity-75">{labels?.[hi]?shortDay(labels[hi]):''}</span> <b className="num">{fmt(data[hi]??0)}</b></span>}<ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{top:6,bottom:2,left:0,right:0}} {...on}><defs><Fade id={id} color={color}/></defs><Tooltip content={noTip} cursor={false}/><Area type="monotone" dataKey="v" name="العدد" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} dot={false} activeDot={{r:4,stroke:'var(--surface)',strokeWidth:2}} animationDuration={450}/></AreaChart></ResponsiveContainer></div>;
}
export function StateDonut({d,compact}:{d:Derived;compact?:boolean}) {
 const [focus,setFocus]=useState<Loc|null>(null);const [detail,setDetail]=useState<Loc|null>(null);
 const rows=LOCS.map(loc=>({loc,name:LOC_AR[loc],value:Math.max(0,locTotal(d.snap.balances,loc))}));const sum=rows.reduce((a,r)=>a+r.value,0);const active=rows.find(r=>r.loc===focus);const visible=rows.filter(r=>r.value>0);
 return <div className={cn('chart-surface grid items-center gap-5',!compact&&'sm:grid-cols-[220px_1fr]')}>{/* the highlight stays on the last segment while the pointer is anywhere on the donut (the gaps between segments and the
   centre included), so moving from one colour to the next never flashes the total; leaving the donut brings it back */}<div className="relative mx-auto size-[220px]" role="img" aria-label={`إجمالي المخزون ${fmt(sum)} قطعة`} onMouseLeave={()=>setFocus(null)}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{value:1}]} dataKey="value" innerRadius={82} outerRadius={100} fill="var(--chart-track)" stroke="none" isAnimationActive={false}/><Pie data={visible} dataKey="value" nameKey="name" innerRadius={82} outerRadius={100} paddingAngle={visible.length>1?1.5:0} minAngle={8} cornerRadius={3} stroke="none" startAngle={90} endAngle={-270} onMouseEnter={(_,i)=>{const l=visible[i]?.loc; if(l) setFocus(l);}} animationDuration={600}>{visible.map(r=><Cell key={r.loc} fill={LOC_FILL[r.loc]} opacity={focus&&focus!==r.loc?0.22:1} style={{transition:'opacity 250ms ease'}}/>)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center gap-1 text-center"><span key={active?.loc??'all'} className="animate-in fade-in duration-200 text-xs text-muted">{active?.name??'إجمالي المخزون'}</span><b className="num text-[28px] font-semibold">{fmt(active?.value??sum)}</b><span className="text-xs text-muted">{active?`${pct(active.value,sum)}% من المخزون`:'قطعة'}</span></div></div><div className="grid" onMouseLeave={()=>setFocus(null)}>{rows.map(r=><Button key={r.loc} variant="ghost" className={cn('h-auto w-full justify-start gap-3 rounded-lg px-2 py-3 text-start transition-colors duration-200',focus===r.loc?'bg-lav':'')} aria-pressed={focus===r.loc} onClick={()=>setDetail(r.loc)} onMouseEnter={()=>setFocus(r.loc)}><svg width="10" height="10" className="shrink-0" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={LOC_FILL[r.loc]}/></svg><span className="min-w-0 flex-1 whitespace-normal"><span className="block text-xs font-medium text-ink">{r.name}</span><span className="block text-[10px] text-muted">{LOC_HINT[r.loc]}</span></span><span className="text-end"><b className="num block text-sm text-ink">{fmt(r.value)}</b><span className="text-[10px] text-muted">{pct(r.value,sum)}%</span></span></Button>)}</div>{detail&&<LocDetail d={d} loc={detail} onClose={()=>setDetail(null)}/>}</div>;
}
/** Daily series for the last N days: requested (pickups), shipped (scans), cancelled. */
export function useDaily(d: Derived | null, days = 14) {
  return useMemo(() => {
    if (!d) return [];
    const start = addDays(d.today, -(days - 1));
    const rows: Record<string, { day: string; req: number; ship: number; pcs: number; shipPcs: number }> = {};
    for (let i = 0; i < days; i++) { const k = addDays(start, i); rows[k] = { day: k, req: 0, ship: 0, pcs: 0, shipPcs: 0 }; }
    for (const o of d.snap.orders) {
      if (o.status === 'cancelled') continue;
      const pd = d.pickupDate.get(o.pickupId); if (pd && rows[pd]) { rows[pd].req++; rows[pd].pcs += o.lines.length; }
      if (o.status === 'shipped' && o.shippedAt) {
        const sd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(o.shippedAt));
        if (rows[sd]) { rows[sd].ship++; rows[sd].shipPcs += o.lines.length; }
      }
    }
    return Object.values(rows);
  }, [d, days]);
}


export function FlowArea({data,metric='orders'}:{data:ReturnType<typeof useDaily>;metric?:'orders'|'pieces'}) {
 const id=useId().replace(/:/g,'');const a=metric==='orders'?'req':'pcs',b=metric==='orders'?'ship':'shipPcs'; const [hi,on]=useHover();
 const row=hi!=null?data[hi]:null; const sum=(k:'req'|'pcs'|'ship'|'shipPcs')=>data.reduce((x,r)=>x+r[k],0);
 return <div className="min-w-0"><Readout title={row?shortDay(row.day):`إجمالي ${data.length} يوم`} items={[{name:'المطلوب (بيك أب)',value:row?row[a]:sum(a),color:C.accent},{name:'تم الشحن (الإسكان)',value:row?row[b]:sum(b),color:C.ready}]}/><div className="chart-surface h-[280px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:12,right:0,left:0,bottom:8}} {...on}><defs><Fade id={`${id}a`} color={C.accent}/><Fade id={`${id}b`} color={C.ready}/></defs><CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false}/><XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={35}/><YAxis {...axis} orientation="right" allowDecimals={false} tickFormatter={numberTick} width={42}/><Tooltip content={noTip} cursor={{stroke:C.muted,strokeDasharray:'3 4'}}/><Area type="monotone" dataKey={a} name="المطلوب (بيك أب)" stroke={C.accent} strokeWidth={2.8} fill={`url(#${id}a)`} activeDot={{r:5,stroke:'var(--surface)',strokeWidth:3}} animationDuration={600}/><Area type="monotone" dataKey={b} name="تم الشحن (الإسكان)" stroke={C.ready} strokeWidth={2.8} fill={`url(#${id}b)`} activeDot={{r:5,stroke:'var(--surface)',strokeWidth:3}} animationDuration={600}/></AreaChart></ResponsiveContainer></div></div>;
}
export function CompareArea({data,curName='الفترة الحالية',prevName='الفترة السابقة'}:{data:{day:string;cur:number;prev:number}[];curName?:string;prevName?:string}) {
 const id=useId().replace(/:/g,''); const [hi,on]=useHover(); const row=hi!=null?data[hi]:null;
 return <div className="min-w-0"><Readout title={row?shortDay(row.day):'إجمالي الفترة'} items={[{name:curName,value:row?row.cur:data.reduce((a,r)=>a+r.cur,0),color:C.accent},{name:prevName,value:row?row.prev:data.reduce((a,r)=>a+r.prev,0),color:C.muted}]}/><div className="chart-surface h-[280px] min-w-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:12,right:0,left:0,bottom:8}} {...on}><defs><Fade id={id} color={C.accent}/></defs><CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false}/><XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={35}/><YAxis {...axis} orientation="right" allowDecimals={false} width={42} tickFormatter={numberTick}/><Tooltip content={noTip} cursor={{stroke:C.muted,strokeDasharray:'3 4'}}/><Line type="monotone" dataKey="prev" name={prevName} stroke={C.muted} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{r:4}} animationDuration={600}/><Area type="monotone" dataKey="cur" name={curName} stroke={C.accent} strokeWidth={3} fill={`url(#${id})`} activeDot={{r:5,stroke:'var(--surface)',strokeWidth:3}} animationDuration={600}/></ComposedChart></ResponsiveContainer></div></div>;
}
/** Pieces in stock at the end of each day of the window (from the ledger): ready for sale and everything owned. */
export function useStockDaily(d: Derived | null, days = 14) {
  return useMemo(() => {
    if (!d) return [];
    const start = addDays(d.today, -(days - 1)); const inside = new Set<string>(LOCS);
    let ready = 0, owned = 0; const dReady: Record<string, number> = {}, dOwned: Record<string, number> = {};
    for (const m of d.snap.moves) {
      const r = (m.to === 'READY' ? m.qty : 0) - (m.from === 'READY' ? m.qty : 0);
      const o = (inside.has(m.to) ? m.qty : 0) - (inside.has(m.from) ? m.qty : 0);
      if (m.date < start) { ready += r; owned += o; } else { dReady[m.date] = (dReady[m.date] ?? 0) + r; dOwned[m.date] = (dOwned[m.date] ?? 0) + o; }
    }
    const rows: { day: string; ready: number; owned: number }[] = [];
    for (let i = 0; i < days; i++) { const k = addDays(start, i); ready += dReady[k] ?? 0; owned += dOwned[k] ?? 0; rows.push({ day: k, ready, owned }); }
    return rows;
  }, [d, days]);
}
export function StockArea({data}:{data:ReturnType<typeof useStockDaily>}) {
 const id=useId().replace(/:/g,''); const [hi,on]=useHover(); const row=hi!=null?data[hi]:data[data.length-1]; const first=data[0];
 const ch=row&&first?row.ready-first.ready:0;
 return <div className="min-w-0"><Readout title={row?(hi!=null?shortDay(row.day):'آخر يوم'):''} items={row?[{name:'جاهز للبيع',value:row.ready,color:C.ready},{name:'إجمالي المملوك',value:row.owned,color:C.accent}]:[]}/><p className="-mt-0.5 mb-1 h-4 truncate text-[11px] leading-4 text-muted">{first&&row?<>الجاهز {ch>=0?'زاد':'قلّ'} <b className="num">{fmt(Math.abs(ch))}</b> قطعة من أول الفترة{hi!=null?' لحد اليوم ده':''}</>:null}</p><div className="chart-surface h-[240px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:12,right:0,left:0,bottom:8}} {...on}><defs><Fade id={`${id}r`} color={C.ready}/></defs><CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false}/><XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={35}/><YAxis {...axis} orientation="right" tickFormatter={numberTick} width={46} domain={['dataMin - 200','dataMax + 200']} allowDecimals={false}/><Tooltip content={noTip} cursor={{stroke:C.muted,strokeDasharray:'3 4'}}/><Line type="monotone" dataKey="owned" name="إجمالي المملوك" stroke={C.accent} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{r:4}} animationDuration={600}/><Area type="monotone" dataKey="ready" name="جاهز للبيع" stroke={C.ready} strokeWidth={2.8} fill={`url(#${id}r)`} activeDot={{r:5,stroke:'var(--surface)',strokeWidth:3}} animationDuration={600}/></AreaChart></ResponsiveContainer></div></div>;
}
/** The 80/20 list: a box per class, then the models ranked with a bar, the pieces and the running share. */
export function Pareto({pull,onPick,limit=20,maxRows}:{pull:Record<string,number>;onPick?:(m:string)=>void;limit?:number;/** rows shown before the list scrolls */maxRows?:number}) {
  const { rows: all, total, classes } = paretoRows(pull); const rows = all.slice(0, limit); const top = rows[0]?.v || 1;
  const fill: Record<string, string> = { A: C.accent, B: C.dirty, C: C.muted }; const nA = classes[0].models;
  const cols = 'grid grid-cols-[1.5rem_3.75rem_minmax(0,1fr)_3.5rem_2.75rem] items-center gap-3 rounded-lg px-2 py-1.5 text-start text-sm';
  return (
    <div className="chart-surface min-w-0">
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {classes.map((c) => <div key={c.k} className="rounded-xl border border-line px-2 py-2.5"><span className="inline-flex items-center gap-1.5 text-[11px] text-muted"><i className="size-2 rounded-full" style={{ background: fill[c.k] }} />فئة {c.k} · <span className="num">{c.models}</span> موديل</span><b className="num mt-0.5 block text-lg font-semibold">{pct(c.pieces, total)}%</b></div>)}
      </div>
      <div className={cn('grid gap-0.5', !!maxRows && 'overflow-y-auto pe-1')} style={maxRows ? { maxHeight: `${maxRows * 2.3}rem` } : undefined}>
        {rows.map((r, i) => {
          const cells = <>
            <span className="num text-xs text-muted">{i + 1}</span>
            <span className="truncate font-mono text-xs font-semibold" title={r.m}>{r.m}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--chart-track)]"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.v / top) * 100}%`, background: fill[r.cls] }} /></span>
            <b className="num text-end">{fmt(r.v)}</b>
            <span className="num text-end text-xs text-muted" title="تراكمي">{r.cum}%</span>
          </>;
          // a dashed line under the last model of class A (only when more models follow it)
          const cut = i === nA - 1 && i < rows.length - 1 && 'mb-1 border-b border-dashed border-line pb-2.5';
          return onPick
            ? <button key={r.m} type="button" onClick={() => onPick(r.m)} className={cn(cols, 'transition-colors hover:bg-lav', cut)}>{cells}</button>
            : <div key={r.m} className={cn(cols, cut)}>{cells}</div>;
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        {nA > 0 && nA < all.length ? <>الخط المتقطع: أول <b className="num text-ink">{nA}</b> موديل بيعملوا 80% من الطلب. </> : null}
        العمود الأخير = النسبة التراكمية{all.length > rows.length ? <> · معروض أعلى <span className="num">{rows.length}</span> من <span className="num">{all.length}</span> موديل</> : null}.
      </p>
    </div>
  );
}
/** Aligned rows: label · bar · value · share. Plain HTML, so the columns line up exactly. */
export function ShareRows({rows,unit='قطعة',onPick}:{rows:{label:string;value:number;color:string}[];unit?:string;onPick?:(label:string)=>void}) {
 const total=rows.reduce((a,r)=>a+Math.max(0,r.value),0)||1; const top=Math.max(1,...rows.map((r)=>r.value));
 return <div className="grid gap-2.5">{rows.map((r)=><div key={r.label} role={onPick?'button':undefined} tabIndex={onPick?0:undefined} onClick={onPick?()=>onPick(r.label):undefined} onKeyDown={onPick?(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(r.label)}}:undefined} className={cn('grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem_3rem] items-center gap-3 text-sm',onPick&&'cursor-pointer rounded-lg px-1 py-1 transition-colors hover:bg-lav focus-visible:ring-2 focus-visible:ring-accent')}><span className="flex min-w-0 items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{background:r.color}}/><span className="truncate">{r.label}</span></span><span className="h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]"><span className="block h-full rounded-full transition-[width] duration-500" style={{width:`${Math.max(0,r.value)/top*100}%`,background:r.color}}/></span><b className="num text-end">{fmt(r.value)}</b><span className="num text-end text-xs text-muted">{pct(Math.max(0,r.value),total)}%</span></div>)}<p className="text-end text-[11px] text-muted">الإجمالي <b className="num">{fmt(total)}</b> {unit}</p></div>;
}
/** Ranked rows: the label and its number with the share on one line, a thin bar under it. Plain HTML, full labels. */
export function HBars({rows,color=C.accent,unit='',onPick,maxRows}:{rows:{label:string;value:number;color?:string}[];color?:string;unit?:string;/** a row opens its details */onPick?:(i:number)=>void;/** rows shown before the list scrolls */maxRows?:number}) {
  const top = Math.max(1, ...rows.map((r) => r.value)); const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0);
  return (
    <div className={cn('chart-surface grid gap-3', !!maxRows && 'overflow-y-auto pe-1')} style={maxRows ? { maxHeight: `${maxRows * 3.1}rem` } : undefined}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(i) : undefined} onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i); } } : undefined}
          className={cn('grid gap-1.5', onPick && 'cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-lav focus-visible:ring-2 focus-visible:ring-accent')}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate text-ink" title={r.label}>{r.label}</span><span className="shrink-0"><b className="num">{fmt(r.value)}</b> <span className="num text-xs text-muted">{pct(Math.max(0, r.value), total || 1)}%</span></span></div>
          <span className="h-1.5 overflow-hidden rounded-full bg-[var(--chart-track)]"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(Math.max(0, r.value) / top) * 100}%`, background: r.color ?? color }} /></span>
        </div>
      ))}
      {unit && <p className="text-end text-[11px] text-muted">بالـ{unit}</p>}
    </div>
  );
}
/** `breakdown`: what a cell holds, shown in a popup on hover (e.g. pieces per color) instead of the browser's tooltip */
export function Heatmap({models,sizes,value,total,onPick,breakdown}:{models:string[];sizes:string[];value:(m:string,z:string)=>number;total:(m:string)=>number;onPick?:(m:string,z:string)=>void;breakdown?:(m:string,z:string)=>{label:string;n:number}[]}) {
 const [hov,setHov]=useState<{m:string;z:string}|null>(null);const [at,setAt]=useState<DOMRect|null>(null);const mx=Math.max(1,...models.flatMap(m=>sizes.map(z=>value(m,z))));
 return <div className="chart-surface grid gap-4"><div className="overflow-x-auto p-1"><table className="w-full border-separate border-spacing-1.5 text-xs"><thead><tr><th/>{sizes.map(z=><th key={z} className={cn('pb-2 text-center font-bold transition-colors',hov?.z===z?'text-ink':'text-muted')}>{z}</th>)}<th className="px-2 pb-2 text-muted">الإجمالي</th></tr></thead><tbody>{models.map(m=><tr key={m}><th className={cn('pe-3 text-start font-mono font-bold transition-colors',hov?.m===m?'text-ink':'text-muted')}>{m}</th>{sizes.map(z=>{const v=value(m,z);const open=!!breakdown&&hov?.m===m&&hov?.z===z&&v!==0;const parts=open?breakdown!(m,z):[];return <td key={z} className="relative">{open&&parts.length>0&&typeof document!=='undefined'&&createPortal(<div role="tooltip" className="pointer-events-none fixed z-50 min-w-36 rounded-lg border border-line bg-surface p-2 text-start shadow-xl" style={at?{left:at.left+at.width/2,top:at.top<150?at.bottom+6:at.top-6,transform:`translate(-50%,${at.top<150?'0':'-100%'})`}:{display:'none'}}><b className="mb-1 block font-mono text-[11px] text-ink">{m} · {z}</b>{parts.map(p=><div key={p.label} className="flex justify-between gap-3 text-[12px]"><span>{p.label}</span><b className="num">{fmt(p.n)}</b></div>)}</div>,document.body)}<Button variant="ghost" aria-label={`${m} · ${z}: ${fmt(v)} قطعة`} title={breakdown?undefined:`${m} · ${z}: ${fmt(v)} قطعة`} data-level={v>0?Math.min(4,Math.ceil(v/mx*4)):0} className={cn('heat-cell h-11 min-w-12 w-full rounded-md border-0 px-1 font-mono text-xs')} onMouseEnter={(e)=>{setHov({m,z});setAt(e.currentTarget.getBoundingClientRect());}} onMouseLeave={()=>setHov(null)} onFocus={(e)=>{setHov({m,z});setAt(e.currentTarget.getBoundingClientRect());}} onBlur={()=>setHov(null)} onClick={()=>{setHov({m,z});onPick?.(m,z);}}>{v||'—'}</Button></td>;})}<td className="px-2 text-center font-mono font-semibold">{fmt(total(m))}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-muted"><span>أقل</span><div className="heat-scale h-1.5 w-24 rounded-full"/><span>أكثر</span><span className="ms-auto min-h-5">{hov?<><b className="font-mono text-sm text-ink">{hov.m}</b> · <b className="text-sm text-ink">{hov.z}</b> · <b className="num text-sm text-ink">{fmt(value(hov.m,hov.z))}</b> قطعة</>:'توزيع القطع حسب الموديل والمقاس'}</span></div></div>;
}
/**
 * A day-by-day trend in the same look as FlowArea: the values under the cursor in a strip above (or the period's
 * sums / last value when the cursor is away), the first series as a soft area, the others as lines (`dash` dashed),
 * or all as bars (`bars`). `total`: 'sum' for flows (orders, money in a day), 'last' for levels (stock at a day's end).
 */
/** "2026-11-05" → "5/11": short enough that every bar can carry its own day */
const numDay = (v: unknown) => { const [, m, d] = String(v).split('-'); return d && m ? `${Number(d)}/${Number(m)}` : String(v); };
/** The day axis of a bar chart: every bar has its date under it (never skipped), slanted when there are many days. */
function barDayAxis(n: number) {
  const slant = n > 16;
  return <XAxis key="x" dataKey="day" interval={0} tickFormatter={numDay} {...axis} tick={{ ...axis.tick, fontSize: n > 24 ? 10 : 11 }} tickMargin={slant ? 4 : 10} angle={slant ? -45 : 0} textAnchor={slant ? 'end' : 'middle'} height={slant ? 44 : 30} />;
}
export type TrendSeries = { key: string; name: string; color: string; dash?: boolean; total?: 'sum' | 'last' };
export function TrendArea<R extends { day: string }>({ data, series, height = 260, bars, money, onPick }: { data: R[]; series: TrendSeries[]; height?: number; bars?: boolean; money?: boolean; /** bars only: a click on a day with anything in it opens that day */ onPick?: (day: string) => void }) {
  const id = useId().replace(/:/g, ''); const [hi, on] = useHover(); const row = hi != null ? data[hi] : null;
  const num = (r: R | undefined | null, k: string) => Number((r as Record<string, unknown> | undefined | null)?.[k] ?? 0);
  const value = (s: TrendSeries) => (row ? num(row, s.key) : s.total === 'last' ? num(data[data.length - 1], s.key) : data.reduce((a, r) => a + num(r, s.key), 0));
  // bar width from the room each day has (recharts' own sizing gave 1px bars here)
  const barW = Math.max(3, Math.min(16, Math.floor(520 / Math.max(1, data.length * series.length))));
  const tick = (n: number) => (money && n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : numberTick(n));
  // an array, not a fragment: recharts only finds its axes among the chart's direct children
  const common = [<CartesianGrid key="g" stroke={C.grid} strokeDasharray="3 6" vertical={false} />, bars ? barDayAxis(data.length) : <XAxis key="x" dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={35} />, <YAxis key="y" {...axis} orientation="right" allowDecimals={false} tickFormatter={tick} width={48} />, <Tooltip key="t" content={noTip} cursor={bars ? { fill: 'var(--chart-track)' } : { stroke: C.muted, strokeDasharray: '3 4' }} />];
  const any = (r: R | null | undefined) => !!r && series.some((s) => num(r, s.key) !== 0);
  const pick = bars && onPick ? (st: { activeTooltipIndex?: number | string | null }) => { const r = st?.activeTooltipIndex == null ? null : data[Number(st.activeTooltipIndex)]; if (r && any(r)) onPick(r.day); } : undefined;
  const can = !!pick && any(row);
  return <div className="min-w-0"><Readout title={row ? <>{shortDay(row.day)}{can ? <span className="text-accent"> · اضغط للتفاصيل</span> : null}</> : series.some((s) => s.total !== 'last') ? `إجمالي ${data.length} يوم` : 'آخر يوم'} items={series.map((s) => ({ name: s.name, value: value(s), color: s.color }))} />
    <div className={cn('chart-surface min-w-0', can && 'cursor-pointer')} style={{ height }}><ResponsiveContainer width="100%" height="100%">
      {bars
        ? <BarChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 8 }} barCategoryGap="22%" {...on} onClick={pick}>{common}{series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} barSize={barW} animationDuration={500} opacity={i ? 0.85 : 1} />)}</BarChart>
        : <ComposedChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 8 }} {...on}><defs><Fade id={id} color={series[0].color} /></defs>{common}
            {series.slice(1).map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dash ? '5 5' : undefined} dot={false} activeDot={{ r: 4 }} animationDuration={600} />)}
            <Area type="monotone" dataKey={series[0].key} name={series[0].name} stroke={series[0].color} strokeWidth={2.8} fill={`url(#${id})`} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} animationDuration={600} /></ComposedChart>}
    </ResponsiveContainer></div></div>;
}

/**
 * One stacked bar per day: the day's total split into its parts. Only for parts of the SAME orders (e.g. the orders that
 * left on a day: collected / returned / still out), so the bar's height is that day's total. The readout leads with the
 * total, then each part.
 */
export function StackedBars<R extends { day: string }>({ data, series, height = 260, totalName = 'الإجمالي', also = [], onPick }: { data: R[]; series: TrendSeries[]; height?: number; totalName?: string; /** a click on a day's column (anywhere in it, not only on the bar) opens that day; empty days do nothing */ onPick?: (day: string) => void; /** numbers shown in the readout only, never drawn (e.g. what was shipped, beside what closed) */ also?: TrendSeries[] }) {
  const [hi, on] = useHover(); const row = hi != null ? data[hi] : null;
  const num = (r: R, k: string) => Number((r as Record<string, unknown>)[k] ?? 0);
  const val = (k: string) => (row ? num(row, k) : data.reduce((a, r) => a + num(r, k), 0));
  const items = [{ name: totalName, value: series.reduce((a, s) => a + val(s.key), 0), color: C.text }, ...series.map((s) => ({ name: s.name, value: val(s.key), color: s.color })), ...also.map((s) => ({ name: s.name, value: val(s.key), color: s.color }))];
  // explicit width from the room each day has (recharts' own sizing can give 1px bars)
  const barW = Math.max(4, Math.min(22, Math.floor(560 / Math.max(1, data.length))));
  const common = [<CartesianGrid key="g" stroke={C.grid} strokeDasharray="3 6" vertical={false} />, barDayAxis(data.length), <YAxis key="y" {...axis} orientation="right" allowDecimals={false} tickFormatter={numberTick} width={48} />, <Tooltip key="t" content={noTip} cursor={{ fill: 'var(--chart-track)' }} />];
  const total = (r: R) => series.reduce((a, s) => a + num(r, s.key), 0);
  const pick = onPick ? (st: { activeTooltipIndex?: number | string | null }) => { const r = st?.activeTooltipIndex == null ? null : data[Number(st.activeTooltipIndex)]; if (r && total(r) > 0) onPick(r.day); } : undefined;
  return <div className="min-w-0"><Readout title={row ? <>{shortDay(row.day)}{onPick && total(row) > 0 ? <span className="text-accent"> · اضغط للتفاصيل</span> : null}</> : `إجمالي ${data.length} يوم`} items={items} />
    <div className={cn('chart-surface min-w-0', onPick && row && total(row) > 0 && 'cursor-pointer')} style={{ height }}><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 8 }} {...on} onClick={pick}>{common}
        {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} stackId="day" fill={s.color} barSize={barW} animationDuration={500} />)}
      </BarChart></ResponsiveContainer></div></div>;
}
