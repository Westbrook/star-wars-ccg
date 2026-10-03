import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,resolve:(m,r,c)=>{if(r.action.handler==='probe:done')m.data.observed=r.action.payload;else premiereRules.resolve(m,r,c)}};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}

const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const table=load(new URL('../../lib/native-engine/table.ts',import.meta.url));
const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
const origin=load(new URL('../../lib/native-engine/loss-origin.ts',import.meta.url));
const lars=load(new URL('../../lib/native-engine/lars.ts',import.meta.url));
function base(){const m=fresh({light:['1_2','1_22','1_37','1_41','9_24','3_32'],dark:Array(12).fill('1_194')});const site=location(m,'light','1_132'),remote=location(m,'dark','1_284'),beru=pull(m,'light','1_2','table',site),owen=pull(m,'light','1_22','table',site),luke=pull(m,'light','101_2','table',remote),jedi=pull(m,'light','9_24','hand'),rebel=pull(m,'light','1_28','table',site);for(let i=0;i<12;i++)pull(m,'dark','1_194','table',site);force(m,'light',12);force(m,'dark',12);return {m,site,remote,beru,owen,luke,jedi,rebel};}
function lostWindow(m,cards,kind='cards-lost') {runtime.openWindow(m,'response','dark',kind==='cards-lost'?{kind,cards}:{kind,card:cards[0]});return m;}
function lose(m,ids){table.loseFromTable(m,ids);while(m.stack.at(-1)?.handler==='table:lost-order')m=step(m,prompt(m).choices[0].id);return lostWindow(m,ids);}
function applyLoss(m,id){m=lose(m,[id]);assert.ok(prompt(m).mandatory);const choice=ids(m).find(c=>c.startsWith('lars:loss:'));assert.ok(choice);m=step(m,choice);return seek(m,x=>x.data.larsEffects?.some(e=>e.source.id===id&&e.applied));}
function local(mode){const f=base(),{m,site,remote,beru,owen}=f;
 if(mode==='alone')state.moveCard(m,owen,'hand');
 if(['devices','both','device-remote'].includes(mode)){
  for(const bp of ['1_37','1_41']){const id=pull(m,'light',bp,'table');m.cards[id].attachedTo=mode==='device-remote'?remote:site;}
  if(mode!=='both')m.cards[beru].location=remote;
 }
 if(mode==='remote')m.cards[owen].location=remote;
 if(mode==='source-hand'){state.moveCard(m,beru,'hand');state.moveCard(m,owen,'hand');}
 return {name:mode,beruForfeit:board.forfeit(m,beru),owenPower:board.power(m,owen)};
}
for(const [mode,bf,op] of [['alone',3,1],['paired',5,3],['devices',3,3],['both',5,3],['remote',3,1],['device-remote',5,1],['source-hand',3,1]])test('Lars locality '+mode,()=>assert.deepEqual(local(mode),{name:mode,beruForfeit:bf,owenPower:op}));
for(const [who,bp] of [['beru','1_2'],['owen','1_22']])for(const farm of [false,true])test(who+' deployment pays correct actual Force at '+(farm?'farm':'other site'),()=>{
 let f=base(),m=f.m;state.moveCard(m,f[who],'hand');m=seek(phase(m),x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');const before=m.players.light.force.length,target=farm?f.site:f.remote;assert.deepEqual(board.deploymentPayment(m,f[who],target),{light:farm?0:who==='beru'?1:2});m=step(m,'deploy:'+f[who]+':'+target);m=seek(m,x=>x.cards[f[who]].zone==='table');assert.equal(before-m.players.light.force.length,farm?0:who==='beru'?1:2);assert.equal(m.cards[f[who]].location,target);
});
for(const who of ['beru','owen'])test(who+' loss bonus lasts through next owner turn, survives refresh and follows Luke personas/zones',()=>{
 let f=base(),m=phase(f.m,'control');const printed=board.power(m,f.luke);m=applyLoss(m,f[who]);assert.equal(board.power(m,f.luke),printed+3);
 for(const zone of ['hand','reserve','lost','table']){state.moveCard(m,f.luke,zone);if(zone==='table')m.cards[f.luke].location=f.remote;assert.equal(board.power(m,f.luke),printed+3);}
 assert.equal(board.power(m,f.jedi),9);m=clone(m);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='draw'&&x.stack.length===1);assert.equal(board.power(m,f.luke),printed+3);m=seek(m,x=>x.turn.number===3&&x.stack.length===1);assert.equal(board.power(m,f.luke),printed);assert.equal(board.power(m,f.jedi),6);
});
test('Beru and Owen combine +6 without requiring Luke in play when either is lost',()=>{
 let f=base(),m=phase(f.m,'control');state.moveCard(m,f.luke,'hand');m=applyLoss(m,f.beru);m=applyLoss(m,f.owen);assert.equal(board.power(m,f.luke),8);state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.remote;assert.equal(board.power(m,f.luke),8);assert.equal(board.power(m,f.jedi),12);
});
test('loss on the owner turn, hand discard, buried dud, Used forfeiture and return to hand do not trigger',()=>{
 for(const mode of ['own-turn','hand','buried','used','return','inactive']){
  let f=base(),m=phase(f.m,'control');if(mode==='own-turn')m=seek(m,x=>x.turn.side==='light'&&x.stack.length===1);
  if(mode==='hand'){state.moveCard(m,f.beru,'hand');state.moveCard(m,f.beru,'lost');}
  else if(mode==='buried'){state.moveCard(m,f.beru,'buried');table.loseBuriedCards(m,[f.beru]);}
  else if(mode==='used')table.forfeitToUsed(m,f.beru);
  else if(mode==='return')table.returnToHand(m,[f.beru]);
  else if(mode==='inactive'){const tank=pull(m,'light','3_32','table');state.moveCard(m,f.beru,'stacked');m.cards[f.beru].stackedOn=tank;table.loseFromTable(m,[tank]);while(m.stack.at(-1)?.handler==='table:lost-order')m=step(m,prompt(m).choices[0].id);}
  else table.loseFromTable(m,[f.beru]);
  lostWindow(m,[f.beru]);assert.equal(lars.larsAutomatic(m,m.stack.at(-1)).length,0,mode);assert.equal(board.power(m,f.luke),2,mode);
 }
});
test('a canceled game text restores after loss; local text cancellation removes only own modifiers',()=>{
 let f=base(),m=phase(f.m,'control');m.data.canceledGameText=[identity.referenceCard(m,f.beru),identity.referenceCard(m,f.owen)];assert.equal(board.forfeit(m,f.beru),3);assert.equal(board.power(m,f.owen),1);m=applyLoss(m,f.beru);assert.equal(board.power(m,f.luke),5);
});
test('Lars trigger survives departure after initiation; repeated original window cannot fire twice',()=>{
 let f=base(),m=phase(f.m,'control');m=lose(m,[f.beru]);m=step(m,ids(m).find(c=>c.startsWith('lars:loss:')));state.moveCard(m,f.beru,'hand');m=seek(clone(m),x=>x.data.larsEffects.some(e=>e.applied));assert.equal(board.power(m,f.luke),5);state.moveCard(m,f.beru,'lost');lostWindow(m,[f.beru]);assert.equal(lars.larsAutomatic(m,m.stack.at(-1)).length,0);assert.equal(origin.lostFromActiveTable(m,f.beru),null);
});
test('a new loss instance is a new trigger but repeated same-title modifiers do not add',()=>{
 let f=base(),m=phase(f.m,'control');m=applyLoss(m,f.beru);m=seek(m,x=>x.stack.length===1);state.moveCard(m,f.beru,'table');m.cards[f.beru].location=f.site;m=applyLoss(m,f.beru);assert.equal(m.data.larsEffects.length,2);assert.equal(board.power(m,f.luke),5);
});
test('ordered compound losses retain origin and require each Lars reaction exactly once',()=>{
 let f=base(),m=phase(f.m,'control');m=lose(m,[f.beru,f.owen]);assert.equal(ids(m).filter(c=>c.startsWith('lars:loss:')).length,2);m=seek(m,x=>x.data.larsEffects?.filter(e=>e.applied).length===2);assert.equal(board.power(m,f.luke),8);lostWindow(m,[f.beru,f.owen]);assert.equal(lars.larsAutomatic(m,m.stack.at(-1)).length,0);
});
test('forfeiture retains printed payment and triggers only after actual Lost placement',()=>{
 let f=base(),m=phase(f.m,'battle');m=step(m,'battle:'+f.site);m=seek(m,x=>ids(x).includes('forfeit:'+f.beru));const before=m.data.battle.damage.light;m=step(m,'forfeit:'+f.beru);m=seek(m,x=>x.data.larsEffects?.some(e=>e.applied));assert.equal(before-m.data.battle.damage.light,5);assert.equal(board.power(m,f.luke),5);assert.equal(board.power(m,f.owen),1);
});
test('invalid origins, duplicate claims, duration and source payloads are rejected after save',()=>{
 let f=base(),m=phase(f.m,'control');m=applyLoss(m,f.beru);
 for(const mutate of [x=>x.data.tableLossOrigins[f.beru].source.version++,x=>x.data.tableLossOrigins[f.beru].source.zone='hand',x=>x.data.larsEffects[0].source.id=f.luke,x=>x.data.larsEffects[0].turn=99,x=>x.data.larsEffects.push(x.data.larsEffects[0])]){
  const bad=clone(m);mutate(bad);assert.throws(()=>runtime.project(bad,rules,'light'));
 }
});
test('Lars definitions remain gated; character deploy-cost queries do not claim device costs',()=>{
 for(const bp of ['1_2','1_22','1_37','1_41'])assert.equal(premiereRules.supports(bp),false);
 let f=base(),m=phase(f.m,'deploy');for(const bp of ['1_37','1_41']){const id=pull(m,'light',bp,'hand');assert.equal(board.deploymentPayment(m,id,f.site),null);}
});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/lars-results.json',import.meta.url)));
for(const row of oracle.filter(x=>!x.name.startsWith('deploy-')&&!x.name.startsWith('loss-')&&!x.name.startsWith('battle-device-')))test('GEMP agrees with local attributes '+row.name,()=>assert.deepEqual(local(row.name),row));
for(const row of oracle.filter(x=>x.name.startsWith('deploy-')))test('GEMP agrees with paid deployment '+row.name,()=>{
 const [,who,atFarm]=row.name.split('-'),f=base();let m=f.m;state.moveCard(m,f[who],'hand');m=seek(phase(m),x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');const before=m.players.light.force.length;m=step(m,'deploy:'+f[who]+':'+(atFarm==='true'?f.site:f.remote));m=seek(m,x=>x.cards[f[who]].zone==='table');assert.equal(before-m.players.light.force.length,row.cost);
});
for(const row of oracle.filter(x=>x.name.startsWith('loss-')))test('GEMP agrees with actual forfeiture, global persona effect and duration '+row.name,()=>{
 const mode=row.name.slice(5),f=base();let m=phase(f.m,'battle');if(mode==='late-luke')state.moveCard(m,f.luke,'hand');if(mode==='own-turn')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,m.turn.side);m=step(m,'battle:'+f.site);
 for(const who of ['both','late-luke'].includes(mode)?['beru','owen']:[mode==='owen'?'owen':'beru']){
  m=seek(m,x=>ids(x).includes('forfeit:'+f[who]));m=step(m,'forfeit:'+f[who]);m=seek(m,x=>x.cards[f[who]].zone==='lost'&&(ids(x).includes('battle-lose:reserve')||x.data.battle.stage==='complete'));
 }
 const immediate=board.power(m,f.luke);if(mode==='late-luke'){state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.remote;}const later=board.power(m,f.luke);
 for(let i=0;i<400&&m.data.battle.stage!=='complete';i++){const choices=ids(m);m=step(m,choices.includes('battle-lose:reserve')?'battle-lose:reserve':choices.includes('pass')?'pass':choices.includes('skip-destiny')?'skip-destiny':choices[0]);}
 assert.equal(m.data.battle.stage,'complete');state.moveCard(m,f.luke,'hand');const hand=board.power(m,f.luke);state.moveCard(m,f.jedi,'table');m.cards[f.jedi].location=f.site;const jedi=board.power(m,f.jedi);state.moveCard(m,f.jedi,'hand');state.moveCard(m,f.luke,'table');m.cards[f.luke].location=f.remote;
 let next=-1,expired=-1;if(mode!=='own-turn'){m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='control'&&x.stack.length===1);next=board.power(m,f.luke);m=seek(m,x=>x.turn.number===3&&x.turn.phase==='control'&&x.stack.length===1);expired=board.power(m,f.luke);}
 assert.deepEqual({name:row.name,immediate,later,hand,jedi,next,expired},row);
});
test('GEMP evidence fingerprints cover exactly the executed observations',async()=>{
 const {createHash}=await import('node:crypto'),p=JSON.parse(fs.readFileSync(new URL('./gemp/lars-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(oracle.length,p.observations);assert.equal(p.junitTests,4);
});
test('excluded Lars family members cannot supply local battle modifiers',()=>{
 let f=base(),m=phase(f.m,'battle');m=step(m,'battle:'+f.site);const before=clone(m);ground.record(m).barriers[f.owen]=m.turn.number;assert.equal(board.forfeit(m,f.beru),3);assert.equal(board.power(m,f.owen),1);m=before;ground.record(m).barriers[f.beru]=m.turn.number;assert.equal(board.power(m,f.owen),1);assert.equal(board.forfeit(m,f.beru),3);
});

for(const who of ['beru','owen'])test(who+' counts a site device during battle without treating it as a participant',()=>{
 let f=base(),m=phase(f.m,'battle');state.moveCard(m,f[who==='beru'?'owen':'beru'],'hand');const device=pull(m,'light',who==='beru'?'1_37':'1_41','table');m.cards[device].attachedTo=f.site;m=step(m,'battle:'+f.site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');const active=id=>combat.members(m,'light').includes(id);assert.equal(active(device),false);assert.equal(who==='beru'?board.forfeit(m,f.beru,active):board.power(m,f.owen,false,active),oracle.find(r=>r.name==='battle-device-'+who).value);
});
