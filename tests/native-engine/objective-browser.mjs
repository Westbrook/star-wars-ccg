// Component-only admission; setup and the fourth-agent deployment use real rules.
import assert from 'node:assert/strict';
import {objectiveRules,objectiveStart,objectiveFixture,objectiveSeek,tableCard} from './objective-fixture.mjs';
import {state,mod} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';
const h=await browserHarness('objective',{rules:objectiveRules});
try{for(const [width,height]of widths('OBJECTIVE_WIDTHS')){
 {
  const start=objectiveStart(),objective=Object.values(start.cards).find(c=>c.blueprint==='7_299').id,t=await h.seed(start,width,height);
  try{
   await t.refresh();
   while(t.read().setup.stage==='choose'){
    const p=t.prompt();if(p.side==='dark'){
     assert.equal(p.choices.length,1);assert.equal(p.choices[0].forceIcons,undefined);
     const page=await t.show('dark',true);assert.equal(await page.locator('.native-choices .native-force').count(),0);
    }
    await t.choose(p.choices[0].id);await t.refresh();
   }
   assert.equal(await (await t.show('light')).getByRole('button',{name:'Inspect ISB Operations',exact:true}).count(),0,'The unrevealed Objective remains private.');
   await t.choose('reveal');await t.refresh();
   await t.advance(m=>m.setup.stage==='objective-resolve');await t.refresh();
   assert.equal(t.read().cards[objective].zone,'table');assert.equal(t.read().players.dark.hand.length,0);
   assert.ok(t.ids()[0].startsWith('objective-deploy:'));await t.choose(t.ids()[0]);await t.refresh();
   await t.advance(m=>m.status==='playing');await t.refresh();
   assert.equal(t.read().players.dark.hand.length,8);assert.equal(t.read().cards[objective].face,undefined);
   const page=await t.show('dark'),panel=page.getByRole('region',{name:'Objectives',exact:true});assert.match(await panel.innerText(),/Front face active/);
   if(width===390)await panel.screenshot({path:h.output+'/isb-setup-phone.png'});
  }finally{await t.close();}
 }
 {
  const f=objectiveFixture();for(const bp of ['8_114','106_11','1_166'])tableCard(f.m,f.pick(bp),f.coruscant);
  const agent=f.pick('104_6');state.moveCard(f.m,agent,'hand');for(let i=0;i<12;i++)state.moveCard(f.m,f.m.players.dark.reserve.at(-1),'force');
  f.m=objectiveSeek(f.m,m=>m.turn.side==='dark'&&m.turn.phase==='deploy'&&m.stack.at(-1)?.priority==='dark'&&m.stack.at(-1)?.timing==='phase');
  const t=await h.seed(f.m,width,height),version=mod('identity').cardVersion(f.m,f.objective);
  try{
   await t.refresh();await t.choose('deploy:'+agent+':'+f.coruscant);await t.refresh();
   await t.advance(()=>t.ids().some(id=>id.startsWith('objective:flip:')));await t.refresh();
   assert.equal(t.read().cards[f.objective].face,undefined);assert.equal(t.prompt().mandatory,true);
   await t.choose(t.ids().find(id=>id.startsWith('objective:flip:')));await t.refresh();
   await t.advance(m=>m.stack.at(-1)?.event?.kind==='about-to-flip');await t.refresh();
   await t.advance(m=>m.cards[f.objective].face==='back');await t.refresh();
   assert.equal(t.read().cards[f.objective].blueprint,'7_299');assert.equal(mod('identity').cardVersion(t.read(),f.objective),version);
   for(const side of ['light','dark']){
    const page=await t.show(side),panel=page.getByRole('region',{name:'Objectives',exact:true});assert.match(await panel.innerText(),/Back face active/);
    await panel.getByText('Active face text',{exact:true}).click();assert.match(await panel.innerText(),/ISB agent/i);
    await panel.getByRole('button',{name:"Inspect Empire's Sinister Agents",exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:"Empire's Sinister Agents",exact:true}).waitFor();
    assert.match(await dialog.innerText(),/ISB agent/i);
   }
   if(width===390){const page=await t.show('dark'),panel=page.getByRole('region',{name:'Objectives',exact:true});await panel.getByText('Active face text',{exact:true}).click();await panel.screenshot({path:h.output+'/isb-back-phone.png'});}
  }finally{await t.close();}
 }
 console.log('Passed Objective setup and fourth-agent flip at '+width+' with current face text, private setup and both-seat refresh.');
}}finally{await h.close();}
