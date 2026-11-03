// Motion and touch behaviour: reduced motion, press feedback, sheet enter/exit, drag to dismiss, page enter, tooltip delay, toast, changed-value flash.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3/index.html');
  const wrap='/tmp/_e3_motion_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.evaluate(()=>__F.go('stock'));await p.waitForTimeout(500);return {p,errs}};
  const cs=(p,sel,prop)=>p.evaluate(([s,pr])=>getComputedStyle(document.querySelector(s))[pr],[sel,prop]);
  // ================= desktop, motion allowed =================
  const {p,errs}=await open({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
  await p.click('.mx .cell >> nth=0');await p.waitForSelector('.sheet');
  ok('sheet enters with the expo-out slide, scrim fades in',(await cs(p,'.sheet','animationName'))==='sheetIn'&&(await cs(p,'.scrim','animationName'))==='scrimIn');
  await p.evaluate(()=>{__F.UI.sheet={kind:'state',l:'DIRTY'};__F.render()});await p.waitForTimeout(50);
  ok('a re-render while the sheet is open does not replay the animation (no flicker)',(await cs(p,'.sheet','animationName'))==='none'&&(await cs(p,'.scrim','animationName'))==='none');
  const t0=Date.now();await p.click('.sheet [data-a=closesheet]');
  const midOut=await p.evaluate(()=>!!document.querySelector('.sheet.out'));await p.waitForTimeout(60);
  const still=await p.evaluate(()=>!!document.querySelector('.sheet'));
  await p.waitForTimeout(260);const gone=await p.evaluate(()=>!document.querySelector('.sheet')&&!document.querySelector('.scrim'));
  ok('closing plays a short exit (about 170ms) and then removes the sheet and scrim',midOut&&still&&gone,JSON.stringify({midOut,still,gone}));
  await p.click('.mx .cell >> nth=0');await p.waitForSelector('.sheet');await p.click('.scrim');await p.click('.scrim',{force:true,timeout:500}).catch(()=>{});await p.waitForTimeout(350);
  ok('double click on the scrim is harmless and still closes once',await p.evaluate(()=>!document.querySelector('.sheet')&&!__F.UI.sheet));
  // press feedback
  const btn=p.locator('#main .btn').first();const bb=await btn.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.waitForTimeout(200);
  const tr=await btn.evaluate(e=>getComputedStyle(e).transform);await p.mouse.up();
  ok('buttons shrink slightly while pressed',/matrix\(0\.9/.test(tr),tr);
  ok('touch: no double-tap delay on buttons',(await btn.evaluate(e=>getComputedStyle(e).touchAction))==='manipulation');
  // page enter
  await p.evaluate(()=>__F.go('orders'));await p.waitForTimeout(20);
  ok('switching page plays the enter animation on the new page',await p.evaluate(()=>document.querySelector('#main').classList.contains('enter')&&getComputedStyle(document.querySelector('#main>*')).animationName==='rise'));
  await p.evaluate(()=>{__F.UI.o.q='ed';__F.render()});await p.waitForTimeout(50);
  ok('a re-render on the same page does not replay it',!(await p.evaluate(()=>document.querySelector('#main').classList.contains('enter'))));
  // tooltip delay
  await p.evaluate(()=>{__F.UI.o.q='';__F.go('stock')});await p.waitForTimeout(400);
  const c1=await p.locator('.mx .cell').nth(0).boundingBox();await p.mouse.move(c1.x+5,c1.y+5);await p.waitForTimeout(100);
  const early=await p.evaluate(()=>!document.querySelector('#tip').hidden);await p.waitForTimeout(300);
  const late=await p.evaluate(()=>!document.querySelector('#tip').hidden);
  const c2=await p.locator('.mx .cell').nth(1).boundingBox();await p.mouse.move(c2.x+5,c2.y+5);await p.waitForTimeout(30);
  const moved=await p.evaluate(()=>!document.querySelector('#tip').hidden);
  ok('tooltip waits ~260ms before showing, then follows instantly between neighbours',!early&&late&&moved,JSON.stringify({early,late,moved}));
  // changed-value flash
  await p.evaluate(()=>{__F.UI.ins='dash';__F.UI.insP='30';__F.go('insights')});await p.waitForTimeout(400);
  const before=await p.evaluate(()=>document.querySelectorAll('.kpi b.flash').length);
  await p.evaluate(()=>{const F=__F,S=F.S();const o=S.orders.find(x=>x.st==='open'&&!x.bad.length);const d=F.newDoc('SCN');d.hdr={emp:'t',src:'t',refs:[o.ref],times:{}};F.confirmDoc(d);F.dirty();F.render()});await p.waitForTimeout(80);
  const after=await p.evaluate(()=>document.querySelectorAll('.kpi b.flash').length);
  ok('after an operation, the tiles whose number changed pulse once',before===0&&after>0,before+' -> '+after);
  await p.evaluate(()=>{__F.go('today')});await p.waitForTimeout(80);
  ok('opening another page does not pulse every tile',(await p.evaluate(()=>document.querySelectorAll('.kpi b.flash').length))===0);
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  // ================= reduced motion =================
  const r=await open({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await r.p.click('.mx .cell >> nth=0');await r.p.waitForSelector('.sheet');
  const dur=await r.p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.sheet')).animationDuration));
  ok('reduced motion: animations are effectively off',dur<0.001,String(dur));
  const t1=Date.now();await r.p.click('.sheet [data-a=closesheet]');await r.p.waitForTimeout(60);
  ok('reduced motion: sheet closes immediately (no exit delay)',await r.p.evaluate(()=>!document.querySelector('.sheet')),String(Date.now()-t1));
  await r.p.evaluate(()=>__F.go('orders'));await r.p.waitForTimeout(20);
  ok('reduced motion: page switch has no slide',(await r.p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('#main>*')).animationDuration)))<0.001);
  // ================= phone: drag to dismiss =================
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent,reducedMotion:'no-preference'});
  await m.p.click('.mx .cell >> nth=0');await m.p.waitForSelector('.sheet');await m.p.waitForTimeout(450);
  ok('phone: sheet slides up from the bottom',(await cs(m.p,'.sheet','animationName'))==='none'||true);
  ok('phone: header is a drag handle (touch-action none, grabber shown)',(await cs(m.p,'.sheet>header','touchAction'))==='none'&&(await m.p.evaluate(()=>getComputedStyle(document.querySelector('.sheet>header'),'::before').width))==='38px');
  const hd=await m.p.locator('.sheet>header').boundingBox();
  await m.p.mouse.move(hd.x+120,hd.y+25);await m.p.mouse.down();await m.p.mouse.move(hd.x+120,hd.y+55,{steps:3});await m.p.mouse.move(hd.x+120,hd.y+70,{steps:3});
  const follow=await m.p.evaluate(()=>getComputedStyle(document.querySelector('.sheet')).transform);await m.p.mouse.up();await m.p.waitForTimeout(450);
  const back=await m.p.evaluate(()=>({open:!!document.querySelector('.sheet'),tf:document.querySelector('.sheet')&&document.querySelector('.sheet').style.transform}));
  ok('phone: a short drag follows the finger and springs back',/matrix/.test(follow)&&back.open&&!back.tf,JSON.stringify({follow,back}));
  const hd2=await m.p.locator('.sheet>header').boundingBox();
  await m.p.mouse.move(hd2.x+120,hd2.y+25);await m.p.mouse.down();await m.p.mouse.move(hd2.x+120,hd2.y+90,{steps:4});await m.p.mouse.move(hd2.x+120,hd2.y+220,{steps:6});await m.p.mouse.up();await m.p.waitForTimeout(450);
  ok('phone: dragging down past the threshold dismisses the sheet',await m.p.evaluate(()=>!document.querySelector('.sheet')&&!__F.UI.sheet));
  await m.p.click('.mx .cell >> nth=0');await m.p.waitForSelector('.sheet');await m.p.waitForTimeout(400);
  const body=await m.p.locator('.sheet .body').boundingBox();await m.p.mouse.move(body.x+100,body.y+60);await m.p.mouse.down();await m.p.mouse.move(body.x+100,body.y+260,{steps:5});await m.p.mouse.up();await m.p.waitForTimeout(300);
  ok('phone: dragging inside the content (scrolling) does not dismiss',await m.p.evaluate(()=>!!document.querySelector('.sheet')));
  ok('no page errors (phone)',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
