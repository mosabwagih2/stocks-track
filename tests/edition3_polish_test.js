// Ops filter without "reversed", ledger "open document", Today events pop-up, real colour swatches for new colours.
const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1360,height:900}});const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;const ok=(l,x,m)=>{console.log((x?'PASS ':'FAIL ')+l+(x?'':'  -> '+m));x?pass++:fail++};
  await p.goto('file://'+path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await p.waitForSelector('.shell');await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(700);
  await p.evaluate(()=>__F.go('ops'));await p.waitForTimeout(300);
  ok('the operations filter has no "reversed" chip',await p.evaluate(()=>{const t=[...document.querySelectorAll('#main .chip')].map(x=>x.textContent);return t.indexOf('الكل')>=0&&!t.some(x=>/معكوس/.test(x))}));
  // ledger: open document
  await p.evaluate(()=>{__F.UI.led.tab='feed';__F.go('ledger')});await p.waitForTimeout(300);
  await p.click('.lgr[data-a=ldoc] >> nth=0');await p.waitForTimeout(250);
  let hasBtn=await p.locator('.lgd [data-a=opendoc2]').count();
  if(!hasBtn){const n=await p.locator('.lgr[data-a=ldoc]').count();for(let i=1;i<Math.min(n,12)&&!hasBtn;i++){await p.click('.lgr[data-a=ldoc] >> nth='+i);await p.waitForTimeout(150);hasBtn=await p.locator('.lgd [data-a=opendoc2]').count()}}
  ok('an expanded ledger event has the open-document button',hasBtn>0);
  await p.click('.lgd [data-a=opendoc2] >> nth=0');await p.waitForTimeout(400);
  ok('the button actually opens the document (goes to Operations with it open)',await p.evaluate(()=>__F.UI.tab==='ops'&&!!__F.UI.doc&&!!document.querySelector('#main .sum,#main .strip,#main h1')));
  // Today events pop-up
  await p.evaluate(()=>{__F.UI.sheet=null;__F.go('today')});await p.waitForTimeout(400);
  const n=await p.locator('.tli[data-a=tev]').count();
  ok('Today events are clickable',n>0,n);
  if(n){await p.click('.tli[data-a=tev] >> nth=0');await p.waitForSelector('.sheet');
    ok('the event pop-up shows who, when and what was inside',await p.evaluate(()=>{const t=document.querySelector('.sheet').innerText;return t.length>40&&/قطعة|أوردر/.test(t)}));
    const ob=p.locator('.sheet [data-a=opendoc2],.sheet [data-a=order]');
    if(await ob.count()){await ob.first().click();await p.waitForTimeout(400);ok('and has a working button to the document or order',await p.evaluate(()=>__F.UI.tab==='ops'||(__F.UI.sheet&&__F.UI.sheet.kind==='order')))}
    await p.evaluate(()=>{__F.UI.sheet=null;__F.render()})}
  // colours
  await p.evaluate(()=>{__F.UI.sheet=__F.skuAddInit?__F.skuAddInit('__new',false):null;__F.render()}).catch(()=>{});
  if(!await p.locator('#nc').count()){await p.evaluate(()=>{__F.go('stock');__F.ACT.skuadd({dataset:{m:'__new'}})});await p.waitForTimeout(300)}
  ok('the add-colour row has a colour picker',await p.locator('#nhx').count()===1);
  await p.fill('#nc','اخضر');await p.dispatchEvent('#nc','input');await p.waitForTimeout(100);
  ok('typing a known colour name pre-fills a matching shade (not the default lavender)',await p.evaluate(()=>{const v=document.getElementById('nhx').value;return v!=='#cfc2ec'&&v!=='#8a8a8a'}));
  await p.evaluate(()=>{const i=document.getElementById('nhx');i.value='#118833';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))});
  await p.click('[data-a=skuaddc]');await p.waitForTimeout(250);
  ok('the chosen shade is saved and used for the swatch',await p.evaluate(()=>{const S=__F.S();const chip=[...document.querySelectorAll('.sheet .chip')].find(x=>/اخضر/.test(x.textContent));return S.cat.hex&&S.cat.hex['اخضر']==='#118833'&&chip&&/17, 136, 51|#118833/i.test(chip.querySelector('.sw').style.background)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  console.log(pass+' passed, '+fail+' failed');await b.close();process.exit(fail?1:0);
})();
