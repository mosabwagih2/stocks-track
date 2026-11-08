import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui';
import { LocDetail } from './LocDetail';
import { LOCS, LOC_AR, LOC_HINT } from '@/femini/domain/constants';
import { locTotal } from '@/femini/domain/ledger';
import { addDays } from '@/femini/domain/dates';
import { cn, fmt, pct } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import type { Loc } from '@/femini/domain/types';

export const C = { accent: 'var(--chart-primary)', ready: 'var(--chart-secondary)', dirty: 'var(--dirty)', factory: 'var(--factory)', scrap: 'var(--scrap)', lost: 'var(--lostc)', muted: 'var(--chart-previous)', grid: 'var(--chart-grid)', text: 'var(--muted)' };
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
/** The values under the cursor (or the period totals when the cursor is away), in one slim line. */
export function Readout({ title, items }: { title: ReactNode; items: { name: string; value: number; color: string }[] }) {
  return <div className="mb-1 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-live="polite"><span className="font-semibold text-ink">{title}</span>{items.map((x) => <span key={x.name} className="inline-flex items-center gap-1.5 text-muted"><i className="inline-block size-2 rounded-full" style={{ background: x.color }} />{x.name} <b className="num text-ink">{fmt(x.value)}</b></span>)}</div>;
}
const noTip = () => null;
export function Sparkline({data,labels,color=C.accent,height=48}:{data:number[];labels?:string[];color?:string;height?:number}) {
 const id=useId().replace(/:/g,''); const rows=data.map((v,i)=>({i,v})); const [hi,on]=useHover();
 return <div className="chart-surface relative mt-3" style={{height}}>{hi!=null&&<span className="pointer-events-none absolute -top-5 end-0 z-10 rounded-md bg-ink/85 px-1.5 py-0.5 text-[11px] text-surface"><span className="opacity-75">{labels?.[hi]?shortDay(labels[hi]):''}</span> <b className="num">{fmt(data[hi]??0)}</b></span>}<ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{top:6,bottom:2,left:0,right:0}} {...on}><defs><Fade id={id} color={color}/></defs><Tooltip content={noTip} cursor={false}/><Area type="monotone" dataKey="v" name="العدد" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} dot={false} activeDot={{r:4,stroke:'var(--surface)',strokeWidth:2}} animationDuration={450}/></AreaChart></ResponsiveContainer></div>;
}
export function StateDonut({d,compact}:{d:Derived;compact?:boolean}) {
 const [focus,setFocus]=useState<Loc|null>(null);const [detail,setDetail]=useState<Loc|null>(null);
 const rows=LOCS.map(loc=>({loc,name:LOC_AR[loc],value:Math.max(0,locTotal(d.snap.balances,loc))}));const sum=rows.reduce((a,r)=>a+r.value,0);const active=rows.find(r=>r.loc===focus);const visible=rows.filter(r=>r.value>0);
 return <div className={cn('chart-surface grid items-center gap-5',!compact&&'sm:grid-cols-[220px_1fr]')}><div className="relative mx-auto size-[220px]" role="img" aria-label={`إجمالي المخزون ${fmt(sum)} قطعة`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{value:1}]} dataKey="value" innerRadius={82} outerRadius={100} fill="var(--chart-track)" stroke="none" isAnimationActive={false}/><Pie data={visible} dataKey="value" nameKey="name" innerRadius={82} outerRadius={100} paddingAngle={visible.length>1?4:0} cornerRadius={5} stroke="none" startAngle={90} endAngle={-270} onMouseEnter={(_,i)=>setFocus(visible[i]?.loc??null)} onMouseLeave={()=>setFocus(null)} animationDuration={600}>{visible.map(r=><Cell key={r.loc} fill={LOC_FILL[r.loc]} opacity={focus&&focus!==r.loc?0.22:1} style={{transition:'opacity 250ms ease'}}/>)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center gap-1 text-center"><span key={active?.loc??'all'} className="animate-in fade-in duration-200 text-xs text-muted">{active?.name??'إجمالي المخزون'}</span><b className="num text-[28px] font-semibold">{fmt(active?.value??sum)}</b><span className="text-xs text-muted">{active?`${pct(active.value,sum)}% من المخزون`:'قطعة'}</span></div></div><div className="grid" onMouseLeave={()=>setFocus(null)}>{rows.map(r=><Button key={r.loc} variant="ghost" className={cn('h-auto w-full justify-start gap-3 rounded-lg px-2 py-3 text-start transition-colors duration-200',focus===r.loc?'bg-lav':'')} aria-pressed={focus===r.loc} onClick={()=>setDetail(r.loc)} onMouseEnter={()=>setFocus(r.loc)}><svg width="10" height="10" className="shrink-0" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={LOC_FILL[r.loc]}/></svg><span className="min-w-0 flex-1 whitespace-normal"><span className="block text-xs font-medium text-ink">{r.name}</span><span className="block text-[10px] text-muted">{LOC_HINT[r.loc]}</span></span><span className="text-end"><b className="num block text-sm text-ink">{fmt(r.value)}</b><span className="text-[10px] text-muted">{pct(r.value,sum)}%</span></span></Button>)}</div>{detail&&<LocDetail d={d} loc={detail} onClose={()=>setDetail(null)}/>}</div>;
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
export function Pareto({pull,onPick,limit=20}:{pull:Record<string,number>;onPick?:(m:string)=>void;limit?:number}) {
 const sorted=Object.entries(pull).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((a,x)=>a+x[1],0)||1;let cum=0; const [hi,on]=useHover();
 const rows=sorted.slice(0,limit).map(([m,v])=>{const before=cum;cum+=v;return {m,v,cum:Math.round(cum/total*1000)/10,cls:before/total<0.8?'A':before/total<0.95?'B':'C'};});const fill:Record<string,string>={A:C.accent,B:C.dirty,C:C.muted};
 const r=hi!=null?rows[hi]:null;
 // right to left: the most requested model is on the right, the cumulative line rises towards the left
 return <div className="min-w-0"><Readout title={r?<span className="font-mono">{r.m} <span className="font-sans font-normal text-muted">فئة {r.cls}</span></span>:`${rows.length} موديل`} items={r?[{name:'قطع مطلوبة',value:r.v,color:fill[r.cls]},{name:'تراكمي %',value:r.cum,color:C.scrap}]:[{name:'إجمالي القطع',value:sorted.reduce((a,x)=>a+x[1],0),color:C.accent}]}/><div className="chart-surface overflow-x-auto" dir="rtl"><div className="h-[300px]" style={{minWidth:Math.max(280,rows.length*44)}}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:16,right:2,left:2,bottom:6}} {...on}><CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false}/><XAxis dataKey="m" {...axis} interval={0} height={35} reversed/><YAxis yAxisId="v" {...axis} orientation="right" width={40} tickFormatter={numberTick}/><YAxis yAxisId="c" {...axis} orientation="left" domain={[0,100]} ticks={[0,40,80,100]} tickFormatter={v=>`${v}%`} width={46}/><ReferenceLine yAxisId="c" y={80} stroke={C.muted} strokeDasharray="4 5"/><Tooltip cursor={{fill:'var(--chart-track)'}} content={noTip}/><Bar yAxisId="v" dataKey="v" name="قطع" radius={[5,5,0,0]} maxBarSize={30} onClick={(x:{m?:string})=>x.m&&onPick?.(x.m)} animationDuration={600}>{rows.map(r=><Cell key={r.m} fill={fill[r.cls]}/>)}</Bar><Line yAxisId="c" type="monotone" dataKey="cum" name="تراكمي" stroke={C.scrap} strokeWidth={2.5} dot={false} activeDot={{r:5,stroke:'var(--surface)',strokeWidth:2}} animationDuration={600}/></ComposedChart></ResponsiveContainer></div></div></div>;
}
/** Aligned rows: label · bar · value · share. Plain HTML, so the columns line up exactly. */
export function ShareRows({rows,unit='قطعة'}:{rows:{label:string;value:number;color:string}[];unit?:string}) {
 const total=rows.reduce((a,r)=>a+Math.max(0,r.value),0)||1; const top=Math.max(1,...rows.map((r)=>r.value));
 return <div className="grid gap-2.5">{rows.map((r)=><div key={r.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem_3rem] items-center gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{background:r.color}}/><span className="truncate">{r.label}</span></span><span className="h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]"><span className="block h-full rounded-full transition-[width] duration-500" style={{width:`${Math.max(0,r.value)/top*100}%`,background:r.color}}/></span><b className="num text-end">{fmt(r.value)}</b><span className="num text-end text-xs text-muted">{pct(Math.max(0,r.value),total)}%</span></div>)}<p className="text-end text-[11px] text-muted">الإجمالي <b className="num">{fmt(total)}</b> {unit}</p></div>;
}
export function HBars({rows,color=C.accent,unit='',height}:{rows:{label:string;value:number;color?:string}[];color?:string;unit?:string;height?:number}) {
 const h=height??Math.max(140,rows.length*44+12);
 return <div className="chart-surface" style={{height:h}}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{top:5,right:0,left:30,bottom:5}} barCategoryGap={16}><XAxis type="number" hide reversed domain={[0,(max:number)=>max*1.2]}/><YAxis type="category" dataKey="label" orientation="right" width={100} {...axis} tick={{fill:'var(--ink)',fontSize:12}} tickFormatter={(l:string)=>l.length>15?l.slice(0,14)+'…':l}/><Tooltip cursor={false} content={<TipBox/>}/><Bar dataKey="value" name={unit||'العدد'} radius={[3,6,6,3]} maxBarSize={14} background={{fill:'var(--chart-track)',radius:5}} animationDuration={600}>{rows.map((r,i)=><Cell key={i} fill={r.color??color}/>)}<LabelList dataKey="value" content={(p:{x?:number|string;y?:number|string;width?:number|string;height?:number|string;value?:unknown})=>{const x=Number(p.x),w=Number(p.width),y=Number(p.y)+Number(p.height)/2;return <text x={Math.min(x,x+w)-6} y={y} dy={4} textAnchor="end" fill="var(--ink)" fontSize={11} className="num">{fmt(Number(p.value))}</text>;}}/></Bar></BarChart></ResponsiveContainer></div>;
}
export function Heatmap({models,sizes,value,total,onPick}:{models:string[];sizes:string[];value:(m:string,z:string)=>number;total:(m:string)=>number;onPick?:(m:string,z:string)=>void}) {
 const [hov,setHov]=useState<{m:string;z:string}|null>(null);const mx=Math.max(1,...models.flatMap(m=>sizes.map(z=>value(m,z))));
 return <div className="chart-surface grid gap-4"><div className="overflow-x-auto p-1"><table className="w-full border-separate border-spacing-1.5 text-xs"><thead><tr><th/>{sizes.map(z=><th key={z} className={cn('pb-2 text-center font-bold transition-colors',hov?.z===z?'text-ink':'text-muted')}>{z}</th>)}<th className="px-2 pb-2 text-muted">الإجمالي</th></tr></thead><tbody>{models.map(m=><tr key={m}><th className={cn('pe-3 text-start font-mono font-bold transition-colors',hov?.m===m?'text-ink':'text-muted')}>{m}</th>{sizes.map(z=>{const v=value(m,z);return <td key={z}><Button variant="ghost" aria-label={`${m} · ${z}: ${fmt(v)} قطعة`} title={`${m} · ${z}: ${fmt(v)} قطعة`} data-level={v>0?Math.min(4,Math.ceil(v/mx*4)):0} className={cn('heat-cell h-11 min-w-12 w-full rounded-md border-0 px-1 font-mono text-xs')} onMouseEnter={()=>setHov({m,z})} onMouseLeave={()=>setHov(null)} onFocus={()=>setHov({m,z})} onBlur={()=>setHov(null)} onClick={()=>{setHov({m,z});onPick?.(m,z);}}>{v||'—'}</Button></td>;})}<td className="px-2 text-center font-mono font-semibold">{fmt(total(m))}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-muted"><span>أقل</span><div className="heat-scale h-1.5 w-24 rounded-full"/><span>أكثر</span><span className="ms-auto min-h-5">{hov?<><b className="font-mono text-sm text-ink">{hov.m}</b> · <b className="text-sm text-ink">{hov.z}</b> · <b className="num text-sm text-ink">{fmt(value(hov.m,hov.z))}</b> قطعة</>:'توزيع القطع حسب الموديل والمقاس'}</span></div></div>;
}
