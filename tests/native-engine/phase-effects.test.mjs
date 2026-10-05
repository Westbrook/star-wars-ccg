import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const module=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=module('runtime'),state=module('state'),stats=module('ability'),totals=module('location-ability'),deployment=module('deployment');
const {premiereRules}=module('premiere-rules');
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/phase-effects-results.json',import.meta.url)));
const reference=name=>{const row=oracle.find(r=>r.name===name);assert.ok(row,'missing GEMP record '+name);return row};
function fixture(){let m=runtime.createMatch('phase-test',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_129','1_132','1_6','1_90','1_71','1_28','1_28','1_28','1_28']:['5_110','5_110','1_267','1_194','1_194','1_194']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);const site=pull(m,'light','1_129');m.locations.push(site);const light=pull(m,'light','1_28','table',site),dark=[pull(m,'dark','1_194','table',site),pull(m,'dark','1_194','table',site)],effect=pull(m,'dark','5_110','hand');for(const side of ['light','dark'])for(let n=0;n<8;n++)state.moveCard(m,m.players[side].reserve.at(-1),'force');return{m,site,light,dark,effect}}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function prompt(m,r=rules){const p=runtime.prompt(m,r,'dark');return p&&runtime.prompt(m,r,p.side)}
const ids=(m,r=rules)=>prompt(m,r).choices.map(c=>c.id);
function step(m,id,r=rules){const before=clone(m);assert.ok(ids(m,r).includes(id),id+' absent from '+ids(m,r).join(','));const next=runtime.applyCommand(clone(m),r,prompt(m,r).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const side of ['light','dark'])assert.deepEqual(runtime.project(next,r,side),runtime.project(clone(next),r,side));return next}
function seek(m,predicate,r=rules){for(let n=0;n<1000;n++){if(predicate(m))return m;const p=prompt(m,r);assert.ok(p);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id,r)}throw Error('boundary not reached')}
const ordinary=(m,p,side)=>m.turn.side===side&&m.turn.phase===p&&m.stack.length===1&&m.stack[0].timing==='phase';
function phase(m,p='deploy',side='light'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>ordinary(x,p,side))}
const settled=m=>seek(m,x=>x.stack.length===1&&x.stack[0].timing==='phase');
const priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
function ready(){const f=fixture();f.m=phase(f.m,'deploy','dark');f.m=settled(step(f.m,'phase-effect:deploy:'+f.effect));f.m=phase(f.m);return f}
function deploy(f,bp='1_28'){const card=pull(f.m,'light',bp,'hand');f.m=priority(f.m,'light');f.m=settled(step(f.m,'deploy:'+card+':'+f.site));return card}
function finish(f){f.m=seek(f.m,m=>ordinary(m,'battle','light')||m.stack.at(-1)?.handler==='ground:force-loss');return{loss:f.m.stack.at(-1)?.handler==='ground:force-loss'?f.m.stack.at(-1).payload.remaining:0,effectLost:f.m.cards[f.effect].zone==='lost',phase:f.m.turn.phase}}
for(const mode of ['none','character','droid','departed','ability-reduced','outnumbered','total-zero','next-turn'])test('Ability, Ability, Ability phase outcome: '+mode,()=>{
 const f=ready();let card;if(mode!=='none'&&mode!=='next-turn'){if(mode==='total-zero')totals.addLocationAbilityModifier(f.m,f.site,f.site,'light','reset',0);card=deploy(f,mode==='droid'?'1_6':'1_28')}
 if(mode==='departed')state.moveCard(f.m,card,'hand');if(mode==='ability-reduced')stats.addAbilityModifier(f.m,f.site,card,'reset',0);if(mode==='outnumbered')deploy(f);
 if(mode==='next-turn'){deploy(f);assert.equal(finish(f).loss,0);f.m=phase(f.m,'deploy','dark');f.m=phase(f.m)}
 const result=finish(f);assert.equal(result.loss,['none','droid','next-turn'].includes(mode)?2:0);assert.equal(result.effectLost,mode==='outnumbered');assert.equal(result.phase,result.loss?'deploy':'battle');
 const row=reference(mode);assert.deepEqual({...result,phase:result.phase.toUpperCase()},{loss:row.loss,effectLost:row.effectLost,phase:row.phase});
});
test('Force losses finish before Battle and do not repeat on reload',()=>{const f=ready();const before=state.lifeForce(f.m,'light');assert.equal(finish(f).loss,2);f.m=phase(f.m,'battle');assert.equal(state.lifeForce(f.m,'light'),before-2);assert.equal(f.m.players.light.lost.length,2);assert.ok(!f.m.stack.some(f=>f.action?.handler==='core:phase'))});
test('mandatory phase loss offers the ordinary reduction response',()=>{const f=ready();const card=pull(f.m,'light','1_90','hand');f.m=seek(f.m,m=>m.stack.at(-1)?.event?.kind==='force-loss');const choice=ids(f.m).find(id=>id.includes(card));assert.ok(choice);const before=state.lifeForce(f.m,'light');f.m=step(f.m,choice);f.m=phase(f.m,'battle');assert.equal(state.lifeForce(f.m,'light'),before);assert.equal(f.m.cards[card].zone,'used')});
test('the Effect is unique and immune to Alter while pending and on table',()=>{const f=fixture();const alter=pull(f.m,'light','1_71','hand'),copy=pull(f.m,'dark','5_110','hand');f.m=step(phase(f.m,'deploy','dark'),'phase-effect:deploy:'+f.effect);assert.ok(!ids(f.m).some(id=>id.startsWith('cancel:play:'+alter+':'+f.effect)));f.m=settled(f.m);f.m=priority(f.m,'dark');assert.ok(!ids(f.m).includes('phase-effect:deploy:'+copy));f.m=priority(f.m,'light');assert.ok(!ids(f.m).some(id=>id.startsWith('cancel:play:'+alter+':'+f.effect)));assert.equal(reference('immune').alterAvailable,false)});
test('outnumbered counts cards rather than sums of ability',()=>{const f=ready();stats.addAbilityModifier(f.m,f.site,f.light,'reset',20);assert.ok(!prompt(f.m).mandatory);const b=pull(f.m,'light','1_28','table',f.site),c=pull(f.m,'light','1_28','table',f.site);stats.addAbilityModifier(f.m,f.site,b,'reset',0.25);stats.addAbilityModifier(f.m,f.site,c,'reset',0.25);assert.ok(ids(f.m).some(id=>id.startsWith('phase-effect:lost:')));f.m=settled(step(f.m,ids(f.m)[0]));assert.equal(f.m.cards[f.effect].zone,'lost')});
test('cards with zero ability are excluded from the count',()=>{const f=ready();pull(f.m,'light','1_28','table',f.site);const c=pull(f.m,'light','1_28','table',f.site);stats.addAbilityModifier(f.m,f.site,c,'reset',0);assert.equal(prompt(f.m).mandatory,false)});
test('only successful deployment records history, at its completion',()=>{const f=ready(),card=pull(f.m,'light','1_28','hand');f.m=step(f.m,'deploy:'+card+':'+f.site);assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),false);f.m=seek(f.m,m=>m.stack.at(-1)?.event?.kind==='deployed');assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),true);assert.equal(f.m.data.deployments.filter(d=>d.card.id===card).length,1);assert.throws(()=>deployment.deployed(f.m,card),/already recorded/)});
test('failed entry after a unique duplicate appears records no deployment',()=>{const f=ready();const effect=pull(f.m,'dark','5_110','hand');state.moveCard(f.m,f.effect,'hand');f.m=phase(f.m,'deploy','dark');f.m=step(f.m,'phase-effect:deploy:'+effect);state.moveCard(f.m,f.effect,'table');f.m=settled(f.m);assert.equal(f.m.cards[effect].zone,'lost');assert.ok(!f.m.data.deployments?.some(d=>d.card.id===effect))});
test('arrival modifiers cannot rewrite the successful-deployment snapshot',()=>{const f=ready(),card=pull(f.m,'light','1_28','hand');f.m=step(f.m,'deploy:'+card+':'+f.site);f.m=seek(f.m,m=>m.stack.at(-1)?.event?.kind==='deployed');stats.addAbilityModifier(f.m,f.site,card,'reset',0);assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),true)});
test('returning a source creates a new observer instance',()=>{const f=ready();deploy(f);assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),true);state.moveCard(f.m,f.effect,'hand');state.moveCard(f.m,f.effect,'table');assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),false);assert.equal(finish(f).loss,2)});
test('an Effect entering after a deployment does not retroactively observe it',()=>{const f=ready();state.moveCard(f.m,f.effect,'hand');deploy(f);state.moveCard(f.m,f.effect,'table');assert.equal(finish(f).loss,2)});
test('a generic return to table and starting setup do not count as deployment',()=>{const f=ready();const c=pull(f.m,'light','1_28','table',f.site);state.moveCard(f.m,c,'hand');state.moveCard(f.m,c,'table');f.m.cards[c].location=f.site;assert.equal(finish(f).loss,2)});
test('an initiated phase loss survives source removal',()=>{const f=ready();f.m=seek(f.m,m=>ids(m).some(id=>id.startsWith('phase-effect:loss:')));f.m=step(f.m,ids(f.m)[0]);state.moveCard(f.m,f.effect,'lost');assert.equal(finish(f).loss,2)});
test('concession is available during phase-end Force losses',()=>{const f=ready();finish(f);f.m=runtime.applyCommand(f.m,rules,'light',{revision:f.m.revision,choice:'concede'});assert.equal(f.m.result.winner,'dark');assert.equal(f.m.status,'finished')});
test('invalid deployment history is rejected before commands',()=>{const f=ready();deploy(f);for(const patch of [{ability:-1},{ability:'1'},{turn:999},{phase:'recirculate'},{serial:999999},{observers:[]}]){const bad=clone(f.m);Object.assign(bad.data.deployments.at(-1),patch);assert.throws(()=>prompt(bad),/deployment/)}const bad=clone(f.m);bad.data.deployments.push(bad.data.deployments.at(-1));assert.throws(()=>prompt(bad),/deployment/)});
test('invalid phase continuation cannot skip the held phase',()=>{const f=ready();finish(f);const r=f.m.stack.find(f=>f.action?.handler==='core:phase');assert.ok(r);r.action.payload.phase='battle';assert.throws(()=>prompt(f.m),/phase continuation/)});

test('both players receive applicable phase responses before the transition',()=>{
 const f=fixture();let r;const act={id:'observe-boundary',handler:'observe-boundary',label:'Observe boundary',payload:null};
 r={...rules,actions:(m,w,side)=>[...rules.actions(m,w,side),...(w.event?.kind==='phase-end'&&side==='light'&&!m.data.boundarySeen?[act]:[])],initiate:(m,a,c)=>a.action.handler==='observe-boundary'?undefined:rules.initiate(m,a,c),resolve:(m,a,c)=>{if(a.action.handler==='observe-boundary')m.data.boundarySeen=true;else rules.resolve(m,a,c)}};
 let m=runtime.startTurns(f.m,r);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='phase-end',r);assert.equal(m.turn.phase,'activate');assert.equal(prompt(m,r).side,'dark');m=step(m,'pass',r);assert.ok(ids(m,r).includes(act.id));m=step(m,act.id,r);assert.equal(m.turn.phase,'activate');m=seek(m,x=>ordinary(x,'control','dark'),r);assert.equal(m.data.boundarySeen,true);
});
test('all phase starts and ends occur once, including Draw before recirculation',()=>{
 const f=fixture(),seen=[];let r;
 r={...rules,automatic:(m,w)=>w.event?.kind?.startsWith('phase-')?[{id:'boundary',handler:'boundary',label:'Boundary',payload:w.event,actor:m.turn.side,unrespondable:true}]:rules.automatic(m,w),initiate:(m,a,c)=>a.action.handler==='boundary'?undefined:rules.initiate(m,a,c),resolve:(m,a,c)=>{if(a.action.handler==='boundary'){const e=a.action.payload;seen.push([e.kind,e.phase,m.turn.number]);if(e.kind==='phase-end'&&e.phase==='draw')assert.ok(m.players.dark.used.length>0)}else rules.resolve(m,a,c)}};
 state.moveCard(f.m,f.m.players.dark.force[0],'used');let m=runtime.startTurns(f.m,r);m=seek(m,x=>x.turn.number===2,r);
 assert.deepEqual(seen,['activate','control','deploy','battle','move','draw'].flatMap(p=>[['phase-start',p,1],['phase-end',p,1]]));assert.equal(m.players.dark.used.length,0);
});
test('phase source snapshot excludes an Effect entering after the boundary',()=>{
 const f=ready();state.moveCard(f.m,f.effect,'hand');const r={...rules,actions:(m,w,side)=>[...rules.actions(m,w,side),...(w.event?.kind==='phase-end'&&w.event.phase==='deploy'?[{id:'hold',handler:'hold',label:'Hold',payload:null}]:[])]};
 let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='phase-end',r);state.moveCard(m,f.effect,'table');assert.ok(!ids(m,r).some(id=>id.startsWith('phase-effect:loss:')));
});
test('corrupt phase boundary snapshot and phase side are rejected',()=>{
 const f=ready();finish(f);for(const patch of [{phase:'battle'},{side:'dark'},{turn:9}]){const bad=clone(f.m);const w=bad.stack.find(f=>f.event?.kind==='phase-end');Object.assign(w.event,patch);assert.throws(()=>prompt(bad),/phase boundary/)}
 const bad=clone(f.m),w=bad.stack.find(f=>f.event?.kind==='phase-end');w.event.sources[0].version=999;assert.throws(()=>prompt(bad),/reference/);
});
test('deployment history is bounded to the latest turn and does not expose hidden piles',()=>{
 const f=ready();deploy(f);const previous=f.m.turn.number;f.m=phase(f.m,'deploy','dark');f.m=phase(f.m);const c=pull(f.m,'light','1_28','hand');state.moveCard(f.m,f.light,'hand');deploy(f);assert.ok(f.m.data.deployments.every(d=>d.turn>previous));const projected=runtime.project(f.m,rules,'dark');assert.ok(!JSON.stringify(projected).includes('observers'));assert.ok(f.m.players.light.hand.includes(c));
});
test('a real Sense-canceled deploy react consumes Force but never records successful deployment',()=>{
 const f=ready(),adjacent=pull(f.m,'light','1_132');f.m.locations.push(adjacent);f.m.cards[f.light].location=adjacent;pull(f.m,'light','1_6','table',adjacent);const troop=pull(f.m,'light','1_28','hand'),sense=pull(f.m,'dark','1_267','hand');f.m=phase(f.m,'control','dark');stats.addAbilityModifier(f.m,f.site,f.dark[0],'reset',9);const before=f.m.players.light.force.length;f.m=step(f.m,'drain:'+f.site);f.m=step(f.m,'react-deploy:'+troop+':'+f.site);f.m=step(f.m,'cancel:play:'+sense+':'+troop+':'+f.dark[0]);f.m=seek(f.m,m=>m.cards[sense].zone==='used');assert.equal(f.m.cards[troop].zone,'hand');assert.equal(f.m.players.light.force.length,before-1);assert.ok(!f.m.data.deployments?.some(d=>d.card.id===troop));
});
for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/phase-text-results.json',import.meta.url))))test('GEMP canceled phase text: '+row.name,()=>{
 const f=ready();module('game-text').suppressGameText(f.m,f.site,f.effect);
 if(row.name==='suppressed-outnumbered'){deploy(f);deploy(f);}
 if(row.name==='restore-after-deploy'){deploy(f);assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),false);}
 if(row.name.startsWith('restore'))f.m.data.gameTextSuppressions=[];
 const actual=finish(f);assert.deepEqual({...actual,phase:actual.phase.toUpperCase()},{loss:row.loss,effectLost:row.effectLost,phase:row.phase});
});
test('restoring text after an ignored deployment cannot retroactively count it across refresh',()=>{const f=ready();module('game-text').suppressGameText(f.m,f.site,f.effect);deploy(f);f.m=clone(f.m);f.m.data.gameTextSuppressions=[];assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),false);assert.equal(finish(f).loss,2);});
test('a deployment observed before text cancellation remains observed when text returns',()=>{const f=ready();deploy(f);module('game-text').suppressGameText(f.m,f.site,f.effect);f.m.data.gameTextSuppressions=[];assert.equal(finish(f).loss,0);});
test('canceled text stops new triggers but not an already initiated phase loss',()=>{const f=ready();f.m=seek(f.m,m=>ids(m).some(id=>id.startsWith('phase-effect:loss:')));f.m=step(f.m,ids(f.m)[0]);module('game-text').suppressGameText(f.m,f.site,f.effect);assert.equal(finish(f).loss,2);});
test('outnumbered Effect is lost after its text returns',()=>{const f=ready();module('game-text').suppressGameText(f.m,f.site,f.effect);deploy(f);deploy(f);assert.equal(f.m.cards[f.effect].zone,'table');f.m.data.gameTextSuppressions=[];assert.ok(ids(f.m).some(id=>id.startsWith('phase-effect:lost:')));f.m=settled(step(f.m,ids(f.m)[0]));assert.equal(f.m.cards[f.effect].zone,'lost');});
for(const mode of ['missing-observer','duplicate','not-array'])test('inactive deployment observation rejects '+mode,()=>{const f=ready();module('game-text').suppressGameText(f.m,f.site,f.effect);deploy(f);const d=f.m.data.deployments.at(-1);assert.equal(d.inactiveObservers[0].id,f.effect);if(mode==='missing-observer')d.inactiveObservers[0]=module('identity').referenceCard(f.m,f.m.players.light.hand[0]??f.m.players.light.reserve[0]);if(mode==='duplicate')d.inactiveObservers.push(d.inactiveObservers[0]);if(mode==='not-array')d.inactiveObservers='forged';assert.throws(()=>prompt(f.m),/deployment/);});

for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/phase-carry-results.json',import.meta.url))))test('previous-turn deployment never waives current penalty: '+row.name,()=>{
 const f=ready();deploy(f);assert.equal(finish(f).loss,0);
 const canceled=row.name==='canceled-at-start';if(canceled)module('game-text').suppressGameText(f.m,f.site,f.effect,'source');
 f.m=phase(f.m,'deploy','dark');f.m=phase(f.m);f.m=clone(f.m);f.m.data.gameTextSuppressions=[];
 assert.equal(deployment.deployedAbilityDuringPhase(f.m,f.effect,'light','deploy'),false);assert.equal(finish(f).loss,2);
 // Pinned GEMP only resets its internal marker while game text is active.
 // Keep this disagreement explicit; do not reuse a prior turn's deployment.
 assert.equal(row.observedAfterStart,canceled);assert.equal(row.loss,canceled?0:2);
});
