import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const module=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=module('runtime'),state=module('state'),stats=module('ability'),board=module('board'),combat=module('battle'),effects=module('battle-effects'),destiny=module('battle-destiny'),cancel=module('cancellation');
const totals=module('location-ability'),table=module('table');
const {premiereRules}=module('premiere-rules');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/location-ability-results.json',import.meta.url)));
const reference=name=>{const row=oracle.find(r=>r.name===name);assert.ok(row,'missing reference '+name);return row};
const snapshot=(f,m,name)=>({name,total:board.abilityAt(m,'dark',f.site),ordinaryPresent:board.atSite(m,f.site).filter(c=>c.owner==='dark').reduce((n,c)=>n+stats.ability(m,c.id),0),individual:stats.ability(m,f.troops[0]),lightControls:board.controls(m,'light',f.site),presence:board.presence(m,'dark',f.site)});
// Explicit component-only fixtures. Public full-match admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x)),other=s=>s==='light'?'dark':'light';
const fresh=()=>runtime.createMatch('ability-test',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_43','1_43','1_53','1_53','4_37','4_37','1_71','1_109','1_11','1_21','4_2','1_129','1_124','1_115','1_6','1_28','1_28','1_28','1_28']:['1_201','1_225','1_225','1_234','1_267','101_5','1_317','1_168','1_172','1_262','101_4','1_194','1_194','1_194','1_194']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m){const id=pull(m,'light','1_129');m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='battle',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.side===side&&x.turn.phase===p&&x.stack.length===1)}
const settled=m=>seek(m,x=>x.stack.length===1),priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
function basic(){let m=fresh();const site=location(m),light=Array.from({length:4},()=>pull(m,'light','1_28','table',site)),dark=Array.from({length:4},()=>pull(m,'dark','1_194','table',site));force(m,'dark',8);force(m,'light',8);return{m,site,light,dark}}
function start(f){let m=phase(f.m);return boundary(step(m,'battle:'+f.site),'battle-weapons')}
function fixture(count=4){const m=fresh(),site=location(m),host=pull(m,'light','1_21','table',site),effect=pull(m,'light','1_43','hand'),troops=Array.from({length:count},()=>pull(m,'dark','1_194','table',site));force(m,'light',8);force(m,'dark',8);return{m,site,host,effect,troops}}
function attach(f){state.moveCard(f.m,f.effect,'table');f.m.cards[f.effect].attachedTo=f.host;f.m.cards[f.effect].location=f.site;return f}
const deploy=f=>settled(step(phase(f.m,'deploy','light'),'ability-effect:deploy:'+f.effect+':'+f.host));
for(const count of [1,2,3,4])test('Affect Mind changes total ability, control and battle initiation with '+count+' opposing ability',()=>{
 const f=fixture(count);let m=deploy(f);assert.equal(m.cards[f.effect].attachedTo,f.host);assert.equal(m.players.light.force.length,7);assert.deepEqual({...snapshot(f,m,'deploy-'+count),spent:1,attached:m.cards[f.effect].attachedTo===f.host},reference('deploy-'+count));assert.equal(board.abilityAt(m,'dark',f.site),Math.max(0,count-2));assert.equal(board.presence(m,'dark',f.site),count>=3);assert.equal(board.controls(m,'light',f.site),count<3);assert.equal(stats.ability(m,f.troops[0]),1);assert.equal(cancel.highestAbilityCharacters(m,'dark').length,count);m=phase(m,'battle','light');assert.equal(ids(m).includes('battle:'+f.site),count>=3);if(count<3)return;m=boundary(step(m,'battle:'+f.site),'battle-weapons');assert.equal(combat.participatingAbility(m,'dark'),count);assert.equal(effects.battleAbility(m,'dark'),count-2);assert.equal(destiny.battleDrawPolicy(m,'dark').count,0);
});
test('a Dark Jedi present suppresses Affect Mind and current ability determines that classification',()=>{
 const f=attach(fixture()),vader=pull(f.m,'dark','101_5','table',f.site);assert.equal(board.abilityAt(f.m,'dark',f.site),10);assert.deepEqual(snapshot(f,f.m,'vader'),reference('vader'));stats.addAbilityModifier(f.m,f.site,vader,'reset',5);assert.equal(board.abilityAt(f.m,'dark',f.site),7);assert.equal(stats.ability(f.m,vader),5);assert.deepEqual(snapshot(f,f.m,'reduced'),reference('reduced'));const adjacent=pull(f.m,'light','1_124');f.m.locations.push(adjacent);board.moveWithAttachments(f.m,vader,adjacent);assert.equal(board.abilityAt(f.m,'dark',f.site),2);assert.deepEqual(snapshot(f,f.m,'moved'),reference('moved'));
});
test('moving the bearer moves its Effect and changes which location is affected',()=>{
 const f=attach(fixture()),adjacent=pull(f.m,'light','1_124');f.m.locations.push(adjacent);const target=pull(f.m,'dark','1_194','table',adjacent);assert.equal(board.abilityAt(f.m,'dark',adjacent),1);board.moveWithAttachments(f.m,f.host,adjacent);assert.equal(f.m.cards[f.effect].location,adjacent);assert.equal(board.abilityAt(f.m,'dark',f.site),4);assert.equal(board.abilityAt(f.m,'dark',adjacent),0);assert.equal(stats.ability(f.m,target),1);
});
test('losing the host removes the Effect simultaneously before Lost ordering',()=>{
 const f=attach(fixture());table.loseFromTable(f.m,[f.host]);assert.equal(f.m.cards[f.effect].zone,'leaving');assert.equal(f.m.cards[f.host].zone,'leaving');assert.equal(board.abilityAt(f.m,'dark',f.site),4);state.assertState(f.m);
});
test('ordinary ability present remains available for Molator, after the location total was reduced',()=>{
 const f=attach(fixture()),molator=pull(f.m,'dark','1_225');let m=start(f);assert.ok(ids(m).includes('battle-effect:trade:'+molator+':4'));m=boundary(step(m,'battle-effect:trade:'+molator+':4'),'battle-weapons');assert.equal(board.abilityAt(m,'dark',f.site),2);assert.equal(effects.battleAbility(m,'dark'),0);assert.equal(combat.participatingAbility(m,'dark'),4);assert.ok(!ids(m).includes('battle-premature-end'));m=boundary(m,'battle-damage');assert.equal(combat.battle(m).power.dark,8);assert.deepEqual({...snapshot(f,m,'molator-after-mind'),spent:4,power:combat.battle(m).power.dark,draws:destiny.battleDrawPolicy(m,'dark').count},reference('molator-after-mind'));
});
test('a reduction that removes presence before damage ends the battle',()=>{
 const f=fixture(2);let m=start(f);state.moveCard(m,f.effect,'table');m.cards[f.effect].attachedTo=f.host;m.cards[f.effect].location=f.site;assert.ok(ids(m).includes('battle-premature-end'));m=step(m,'battle-premature-end');m=seek(m,x=>combat.battle(x)?.stage==='complete');assert.equal(combat.battle(m).premature,true);
});
test('Affect Mind deployment requires an affordable own Light-side Jedi',()=>{
 const f=fixture(),troop=pull(f.m,'light','1_28','table',f.site),vader=pull(f.m,'dark','101_5','table',f.site);let m=phase(f.m,'deploy','light');assert.ok(ids(m).includes('ability-effect:deploy:'+f.effect+':'+f.host));assert.ok(!ids(m).includes('ability-effect:deploy:'+f.effect+':'+troop));assert.ok(!ids(m).includes('ability-effect:deploy:'+f.effect+':'+vader));while(m.players.light.force.length)state.moveCard(m,m.players.light.force[0],'used');assert.ok(!ids(m).some(id=>id.startsWith('ability-effect:deploy:')));
});
test('a Jedi target whose ability changes during deployment remains the selected host',()=>{
 const f=fixture();let m=step(phase(f.m,'deploy','light'),'ability-effect:deploy:'+f.effect+':'+f.host);stats.addAbilityModifier(m,f.site,f.host,'reset',5);m=settled(m);assert.equal(m.cards[f.effect].zone,'table');assert.equal(board.abilityAt(m,'dark',f.site),2);assert.deepEqual({...snapshot(f,m,'target-lowered'),attached:m.cards[f.effect].attachedTo===f.host,hostAbility:stats.ability(m,f.host)},reference('target-lowered'));
});
test('losing or returning the original target before attachment does not retarget a new instance',()=>{
 for(const returnIt of [false,true]){const f=fixture();let m=step(phase(f.m,'deploy','light'),'ability-effect:deploy:'+f.effect+':'+f.host);state.moveCard(m,f.host,'hand');if(returnIt){state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site}m=settled(m);assert.equal(m.cards[f.effect].zone,'lost');assert.equal(m.players.light.force.length,7)}
});
test('Alter can cancel pending Affect Mind without refunding deployment Force',()=>{
 const f=fixture(),alter=pull(f.m,'dark','1_234','hand');let m=phase(f.m,'deploy','light');const zero=pull(m,'dark','101_4','hand');state.moveCard(m,zero,'reserve');m=step(m,'ability-effect:deploy:'+f.effect+':'+f.host);assert.equal(board.abilityAt(m,'dark',f.site),4);m=step(m,'cancel:play:'+alter+':'+f.effect+':'+f.troops[0]);m=settled(m);assert.equal(m.cards[f.effect].zone,'lost');assert.equal(m.players.light.force.length,7);assert.equal(m.cards[alter].zone,'used');assert.equal(board.abilityAt(m,'dark',f.site),4);
});
test('total ability changes never change a highest-ability target or character value',()=>{
 const f=fixture();totals.addLocationAbilityModifier(f.m,f.effect,f.site,'dark','reset',0);assert.equal(board.abilityAt(f.m,'dark',f.site),0);assert.equal(cancel.highestAbilityCharacters(f.m,'dark').length,4);assert.equal(stats.ability(f.m,f.troops[0]),1);
});
const modes={add:6,subtract:2,zero:0,reset:1,'minimum-reset':0.5,protect:4,'protect-low-reset':4,'protect-high-reset':6,'protect-battle':4,'reset-battle':2};
function configure(m,site,source,mode){const add=(kind,amount,fn)=>totals.addLocationAbilityModifier(m,source,site,'dark',kind,amount,{function:fn??kind});
 if(mode==='add')add('add',2);if(mode==='subtract'||mode==='protect')add('add',-2);if(mode==='zero')add('add',-9);
 if(mode==='reset'){add('add',5);add('reset',1)}if(mode==='minimum-reset'){add('reset',2);add('reset',0.5,'other-reset')}
 if(mode.startsWith('protect'))add('prevent-reduction',1);if(mode==='protect-low-reset')add('reset',1);if(mode==='protect-high-reset')add('reset',6);
 if(mode==='protect-battle'||mode==='reset-battle')add('battle-add',-3);if(mode==='reset-battle')add('reset',2);
}
for(const [mode,value] of Object.entries(modes))test('location ability provider '+mode,()=>{
 const f=fixture();const m=start(f);configure(m,f.site,f.effect,mode);assert.equal(board.abilityAt(m,'dark',f.site),value);assert.equal(totals.locationAbility(m,'dark',f.site,4,0),mode==='protect-battle'?1:value);assert.equal(board.abilityAt(m,'light',f.site),6);totals.assertLocationAbility(clone(m));assert.deepEqual({...snapshot(f,m,'query-'+mode),battleAbility:effects.battleAbility(m,'dark'),draws:destiny.battleDrawPolicy(m,'dark').count},reference('query-'+mode));
});
test('total modifier lifetime follows original source/site and current turn',()=>{
 const f=fixture();state.moveCard(f.m,f.effect,'table');f.m.cards[f.effect].attachedTo=f.host;f.m.cards[f.effect].location=f.site;
 totals.addLocationAbilityModifier(f.m,f.effect,f.site,'dark','add',3,{duration:'source'});assert.equal(board.abilityAt(f.m,'dark',f.site),5);state.moveCard(f.m,f.effect,'lost');assert.equal(board.abilityAt(f.m,'dark',f.site),4);totals.addLocationAbilityModifier(f.m,f.host,f.site,'dark','add',-3);assert.equal(board.abilityAt(f.m,'dark',f.site),1);f.m.turn.number++;assert.equal(board.abilityAt(f.m,'dark',f.site),4);
});
test('corrupt aggregate modifiers and pending attachment snapshots are rejected',()=>{
 const f=fixture();totals.addLocationAbilityModifier(f.m,f.host,f.site,'dark','add',-1);
 for(const patch of [{amount:null},{side:'nobody'},{kind:'power'},{turn:999},{site:{id:f.host,zone:'table',version:0}}]){const bad=clone(f.m);Object.assign(bad.data.locationAbilityModifiers[0],patch);assert.throws(()=>totals.assertLocationAbility(bad),/location ability|reference/)}
 const m=step(phase(f.m,'deploy','light'),'ability-effect:deploy:'+f.effect+':'+f.host),r=m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='ability-effect:deploy');r.action.payload.attachment.hostRef.version=999;assert.throws(()=>prompt(m),/reference/);
});

test('identical total modifiers are noncumulative; independent functions and explicitly cumulative providers combine',()=>{
 const f=fixture(),copy=pull(f.m,'light','1_43','hand');totals.addLocationAbilityModifier(f.m,f.effect,f.site,'dark','add',-1);totals.addLocationAbilityModifier(f.m,copy,f.site,'dark','add',-1);assert.equal(board.abilityAt(f.m,'dark',f.site),3);totals.addLocationAbilityModifier(f.m,f.host,f.site,'dark','add',1);assert.equal(board.abilityAt(f.m,'dark',f.site),4);totals.addLocationAbilityModifier(f.m,copy,f.site,'dark','add',-1,{cumulative:true});assert.equal(board.abilityAt(f.m,'dark',f.site),3);
});
test('the ability total reset is applied after a paid Molator trade',()=>{
 const f=fixture(),source=pull(f.m,'dark','1_225');let m=start(f);totals.addLocationAbilityModifier(m,f.host,f.site,'dark','reset',4);m=boundary(step(m,'battle-effect:trade:'+source+':4'),'battle-weapons');assert.equal(effects.battleAbility(m,'dark'),4);assert.equal(destiny.battleDrawPolicy(m,'dark').count,1);assert.equal(effects.tradedPower(m,'dark'),4);
});
test('Affect Mind is unique and does not add a transfer action',()=>{
 const f=fixture(),copy=pull(f.m,'light','1_43','hand'),second=pull(f.m,'light','4_2','table',f.site);let m=priority(deploy(f),'light');assert.ok(!ids(m).some(id=>id.startsWith('ability-effect:deploy:'+copy)));assert.ok(!ids(m).some(id=>id.includes(f.effect)&&id.includes(second)));
});
test('Affect Mind keeps a drain active after a Comlink react with insufficient total ability',()=>{
 const f=attach(fixture(1)),comlink=pull(f.m,'dark','1_201','table',f.site),arriving=pull(f.m,'dark','1_194','hand');f.m.cards[comlink].attachedTo=f.troops[0];let m=phase(f.m,'control','light');m=step(m,'drain:'+f.site);m=step(m,'react-deploy:'+arriving+':'+f.site+':via:'+comlink);m=boundary(m,'deployed');const drain=m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='ground:drain');assert.ok(drain);assert.equal(drain.cancelled,false);assert.equal(board.abilityAt(m,'dark',f.site),0);m=settled(m);assert.equal(m.cards[arriving].zone,'table');
});

test('successive Comlink arrivals cancel the drain only once they restore presence',()=>{
 const f=attach(fixture(1)),comlink=pull(f.m,'dark','1_201','table',f.site),a=pull(f.m,'dark','1_194','hand'),b=pull(f.m,'dark','1_194','hand');f.m.cards[comlink].attachedTo=f.troops[0];let m=step(phase(f.m,'control','light'),'drain:'+f.site);m=step(m,'react-deploy:'+a+':'+f.site+':via:'+comlink);m=seek(m,x=>x.stack.length===3&&x.stack.at(-2)?.action.handler==='ground:drain');m=priority(m,'dark');assert.equal(board.abilityAt(m,'dark',f.site),0);m=step(m,'react-deploy:'+b+':'+f.site+':via:'+comlink);m=boundary(m,'deployed');const drain=m.stack.find(r=>r.kind==='resolution'&&r.action.handler==='ground:drain');assert.equal(drain.cancelled,true);assert.equal(board.abilityAt(m,'dark',f.site),1);m=settled(m);assert.equal(m.cards[a].zone,'table');assert.equal(m.cards[b].zone,'table');
});
test('deployment follows its original host to a new site during responses',()=>{
 const f=fixture(),adjacent=pull(f.m,'light','1_124');f.m.locations.push(adjacent);const target=pull(f.m,'dark','1_194','table',adjacent);let m=step(phase(f.m,'deploy','light'),'ability-effect:deploy:'+f.effect+':'+f.host);board.moveWithAttachments(m,f.host,adjacent);m=settled(m);assert.equal(m.cards[f.effect].location,adjacent);assert.equal(board.abilityAt(m,'dark',f.site),4);assert.equal(board.abilityAt(m,'dark',adjacent),0);assert.equal(stats.ability(m,target),1);
});
