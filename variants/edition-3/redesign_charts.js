/* ---------- v2: modern charts (smooth area, crosshair hover, soft bars) ---------- */
let _gid=0;
function smoothPath(P){
  const n=P.length;if(n<2)return 'M'+P[0][0]+' '+P[0][1];
  const dx=[],m=[],t=new Array(n);
  for(let i=0;i<n-1;i++){dx[i]=P[i+1][0]-P[i][0]||1;m[i]=(P[i+1][1]-P[i][1])/dx[i]}
  t[0]=m[0];t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){if(m[i]===0){t[i]=0;t[i+1]=0;continue}const a=t[i]/m[i],b=t[i+1]/m[i],s=a*a+b*b;if(s>9){const k=3/Math.sqrt(s);t[i]=k*a*m[i];t[i+1]=k*b*m[i]}}
  let d='M'+P[0][0].toFixed(1)+' '+P[0][1].toFixed(1);
  for(let i=0;i<n-1;i++){const h=dx[i]/3;d+=' C'+(P[i][0]+h).toFixed(1)+' '+(P[i][1]+t[i]*h).toFixed(1)+' '+(P[i+1][0]-h).toFixed(1)+' '+(P[i+1][1]-t[i+1]*h).toFixed(1)+' '+P[i+1][0].toFixed(1)+' '+P[i+1][1].toFixed(1)}
  return d;
}
function niceTop(mx,k){const raw=Math.max(mx,1)/k,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p,nf=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;return nf*p}
function lineChart(pts,o){
  const mob=innerWidth<=820,W=mob?400:(o.W||620),Hh=mob?230:230,L=mob?44:52,R=18,T=18,B=28,n=pts.length,vals=pts.map(p=>p.v),vmin=Math.min(0,...vals),vmax=Math.max(1,...vals),K=3,step=niceTop(vmax-vmin,K),mn=vmin<0?-niceTop(-vmin,K):0,mx=mn+step*K;
  const rng=(mx-mn)||1,X=i=>n===1?W-R:L+i*(W-L-R)/(n-1),Y=v=>T+(1-(v-mn)/rng)*(Hh-T-B),id='g'+(++_gid);
  let grid='';for(let k=0;k<=K;k++){const v=mn+rng*k/K,y=Y(v);grid+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--grid)" stroke-width="1"/><text x="'+(L-8)+'" y="'+(y+4).toFixed(1)+'" font-size="10.5" text-anchor="end" fill="var(--muted)" font-family="var(--f-mono)">'+esc(o.fy(v))+'</text>'}
  const P=pts.map((p,i)=>[X(i),Y(p.v)]),line=smoothPath(P),base=Y(Math.max(mn,0)).toFixed(1),area=line+' L'+P[n-1][0].toFixed(1)+' '+base+' L'+P[0][0].toFixed(1)+' '+base+' Z';
  const lab=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>'<text x="'+X(i).toFixed(1)+'" y="'+(Hh-6)+'" font-size="10.5" text-anchor="'+(i===0?'start':i===n-1?'end':'middle')+'" fill="var(--muted)" font-family="var(--f-mono)">'+esc(pts[i].x)+'</text>').join('');
  const hit=pts.map((p,i)=>{const x0=i===0?L:(X(i-1)+X(i))/2,x1=i===n-1?W-R:(X(i)+X(i+1))/2;
    return '<g class="hp"><rect x="'+x0.toFixed(1)+'" y="'+T+'" width="'+Math.max(2,x1-x0).toFixed(1)+'" height="'+(Hh-T-B)+'" fill="transparent" data-tip="'+esc(p.tip)+'"/><line class="xh" x1="'+P[i][0].toFixed(1)+'" x2="'+P[i][0].toFixed(1)+'" y1="'+T+'" y2="'+(Hh-B)+'" stroke="'+o.c+'" stroke-opacity=".35" stroke-width="1"/><circle class="xd" cx="'+P[i][0].toFixed(1)+'" cy="'+P[i][1].toFixed(1)+'" r="5" fill="'+o.c+'" stroke="var(--surface)" stroke-width="2.5"/></g>'}).join('');
  const e=P[n-1],end='<circle cx="'+e[0].toFixed(1)+'" cy="'+e[1].toFixed(1)+'" r="8" fill="'+o.c+'" opacity=".16"/><circle cx="'+e[0].toFixed(1)+'" cy="'+e[1].toFixed(1)+'" r="4.5" fill="'+o.c+'" stroke="var(--surface)" stroke-width="2"/><text x="'+(e[0]-2).toFixed(1)+'" y="'+Math.max(11,e[1]-13).toFixed(1)+'" font-size="11.5" font-weight="600" text-anchor="end" fill="var(--ink)" font-family="var(--f-mono)">'+esc(o.fy(vals[n-1]))+'</text>';
  return '<svg class="lnc" viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="'+esc(o.aria)+'" style="width:100%;height:auto;display:block;direction:ltr;unicode-bidi:isolate"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+o.c+'" stop-opacity=".30"/><stop offset="1" stop-color="'+o.c+'" stop-opacity="0"/></linearGradient></defs>'+grid+'<path d="'+area+'" fill="url(#'+id+')"/><path d="'+line+'" fill="none" stroke="'+o.c+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'+end+hit+lab+'</svg>';
}
function colChart(G,o){
  const mob=innerWidth<=820,W=mob?400:(o.W||620),Hh=230,L=mob?40:48,R=10,T=16,B=26,n=G.length,ns=o.c.length,K=3,mxv=Math.max(1,...G.map(g=>Math.max(...g.v))),step=niceTop(mxv,K),mx=step*K;
  const sw=(W-L-R)/n,Y=v=>T+(1-v/mx)*(Hh-T-B),every=Math.ceil(n/(mob?5:8)),bw=Math.max(3,Math.min(o.max||14,(sw*.74)/ns-2));
  let grid='';for(let k=0;k<=K;k++){const v=step*k,y=Y(v);grid+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--grid)"/><text x="'+(L-8)+'" y="'+(y+4).toFixed(1)+'" font-size="10.5" text-anchor="end" fill="var(--muted)" font-family="var(--f-mono)">'+esc(o.fy?o.fy(v):fmt(v))+'</text>'}
  const base=Y(0);
  const bars=G.map((g,i)=>{const cx=L+sw*i+sw/2,tot=ns*bw+(ns-1)*2,x0=cx-tot/2;
    const rects=g.v.map((v,j)=>{const h=Math.max(v>0?2:0,base-Y(v)),x=x0+j*(bw+2),y=base-h,r=Math.min(4,bw/2,h);
      return h>0?'<path d="M'+x.toFixed(1)+' '+base.toFixed(1)+'V'+(y+r).toFixed(1)+'a'+r+' '+r+' 0 0 1 '+r+' -'+r+'h'+(bw-2*r).toFixed(1)+'a'+r+' '+r+' 0 0 1 '+r+' '+r+'V'+base.toFixed(1)+'Z" fill="'+o.c[j]+'"/>':''}).join('');
    const lab=(i%every===0||i===n-1)?'<text x="'+cx.toFixed(1)+'" y="'+(Hh-7)+'" font-size="10.5" text-anchor="middle" fill="'+(i===n-1?'var(--ink)':'var(--muted)')+'" font-weight="'+(i===n-1?700:400)+'" font-family="var(--f-mono)">'+esc(g.x)+'</text>':'';
    return '<g class="cg"><rect class="cb" x="'+(L+sw*i).toFixed(1)+'" y="'+T+'" width="'+sw.toFixed(1)+'" height="'+(Hh-T-B)+'" rx="8" data-tip="'+esc(g.tip)+'"/>'+rects+lab+'</g>'}).join('');
  return '<svg class="cch" viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="'+esc(o.aria)+'" style="width:100%;height:auto;display:block;direction:ltr;unicode-bidi:isolate">'+grid+bars+'</svg>';
}
function trendChart(A){
  let ds=Object.keys(A.days).sort();if(!ds.length)return '<div class="empty">مفيش بيانات.</div>';
  ds=ds.slice(-14);
  return colChart(ds.map(d=>{const x=A.days[d];return {x:shortDay(d),v:[x.p],tip:d+'\n'+x.o+' أوردر · '+x.p+' قطعة\nاتشحن '+x.done}}),{c:['var(--accent)'],aria:'الطلب اليومي',max:18})+'<div class="legend" style="margin-top:8px"><span>عدد القطع المطلوبة في اليوم</span>'+(ds.length<3?'<span>(عندنا '+ds.length+' يوم بيانات بس)</span>':'')+'</div>';
}
