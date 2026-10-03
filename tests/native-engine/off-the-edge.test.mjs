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
function fresh(){const light=['5_79','5_59','5_59','1_31','2_14','1_101','101_2','1_90','1_153','1_115','1_115','1_115','1_100'],dark=['1_284','13_86','8_108','1_168','1_267','1_254'];return runtime.createMatch('off-edge-test',60,[{side:'light',cards:[...light,...Array(60-light.length).fill('1_28')]},{side:'dark',cards:[...dark,...Array(60-dark.length).fill('1_194')]}],rules)}
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

const off=load(new URL('../../lib/native-engine/off-the-edge.ts',import.meta.url));
const restrictions=load(new URL('../../lib/native-engine/retrieval-contributors.ts',import.meta.url));
const stats=load(new URL('../../lib/native-engine/stat-modifiers.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const response=load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url));
const event=m=>m.stack.at(-1)?.event;
const life=m=>m.players.light.reserve.length+m.players.light.force.length+m.players.light.used.length;
function base(r2=false){let m=fresh();const site=location(m,'light','5_79'),remote=location(m,'dark','1_284'),target=pull(m,'light',r2?'2_14':'1_31','table',site),card=pull(m,'light','5_59','hand');const cards=Array.from({length:5},()=>pull(m,'light','1_28','hand'));for(const id of [...cards].reverse())state.moveCard(m,id,'lost');force(m,'light',8);m=phase(m);m=priority(m,'light');return {m,site,remote,target,card,cards};}
const play=(m,card,target)=>step(priority(m,'light'),'off-edge:play:'+card+':'+target);
const finish=(m,card)=>seek(m,x=>x.cards[card].zone==='lost');
function outcome(mode){let f=base(mode.startsWith('r2')),{m,site,remote,target,card,cards}=f;
 if(mode.includes('plans'))pull(m,'dark','13_86','table');if(mode.includes('fenson'))pull(m,'dark','8_108','table',remote);
 if(mode==='target-modifier')stats.addStatModifier(m,remote,target,'destiny','add',2);
 if(mode==='target-blocked')restrictions.preventRetrievalContribution(m,remote,target);
 if(mode.endsWith('failed'))for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');
 const initialLife=life(m);m=play(m,card,target);let changed=false,drawn=false,valueChoices=0,payment=0;
 for(let i=0;i<230&&m.cards[card].zone!=='lost';i++){
  const w=m.stack.at(-1),e=event(m);
  if(!changed&&((mode.endsWith('before')&&w.kind==='window'&&e===undefined)||(mode==='source-blocked'&&e===undefined)||mode==='modifier-after'&&e?.kind==='destiny-drawn'||mode==='late-blocked'&&e?.kind==='retrieval-initiated')){
   if(mode==='source-blocked'||mode==='late-blocked')restrictions.preventRetrievalContribution(m,remote,mode==='source-blocked'?card:target);
   else if(mode==='modifier-after')stats.addStatModifier(m,remote,target,'destiny','add',2);
   else{state.moveCard(m,target,'hand');if(mode==='return-before'){state.moveCard(m,target,'table');m.cards[target].location=site;}}changed=true;
  }
  // Controlled known draws match the reference fixture's PrepareLSDestiny.
  if(!drawn&&e?.kind==='destiny-drawn'){m.stack.at(-2).action.payload.draw.value=mode==='lose'?1:mode==='equal'?3:mode.startsWith('r2')?3:7;drawn=true;}
  if(w.handler==='off-edge:value'){valueChoices++;m=step(m,mode==='r2-five'?'off-edge:value:5':'off-edge:value:2');}
  else if(w.handler==='plans:choose'){payment++;m=step(m,mode==='plans-decline'?'plans:cancel':'plans:pay');}
  else if(w.handler==='ground:force-loss')m=step(m,'lose:reserve');
  else m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);
 }
 assert.equal(m.cards[card].zone,'lost');const retrieved=cards.filter(id=>m.cards[id].zone==='used').length;
 if(mode.endsWith('before')||['source-blocked','late-blocked','modifier-after'].includes(mode))assert.ok(changed);
 return {name:mode,retrieved,lostTarget:m.cards[target].zone==='lost',spent:8-m.players.light.force.length,valueChoices,payment,lostForce:initialLife+retrieved-life(m)};
}
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/off-edge-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP Off The Edge comparison: '+row.name,()=>assert.deepEqual(row.name.startsWith('on-')?onOutcome(row.name):outcome(row.name),row));
test('only own active ground characters at Cloud City sites can be targeted, with no Force cost',()=>{let {m,target,site,remote}=base();const opts=()=>off.offEdgeActions(m,m.stack.at(-1),'light');assert.equal(opts().length,1);m.cards[target].location=remote;assert.equal(opts().length,0);m.cards[target].location=site;for(const id of [...m.players.light.force])state.moveCard(m,id,'used');assert.equal(opts().length,1);state.moveCard(m,target,'hand');assert.equal(opts().length,0);assert.equal(off.offEdgeActions(m,{timing:'response',event:{kind:'destiny-drawn'}},'light').length,0);});
test('a real printed destiny comparison retrieves exactly two cards',()=>{let {m,card,target,cards}=base();const draw=topDestiny(m,'light','1_115');m=play(m,card,target);m=finish(m,card);assert.deepEqual(m.players.light.used.slice(0,3),[cards[1],cards[0],draw]);assert.equal(m.cards[target].zone,'table');assert.equal(m.players.light.force.length,8);});
test('a lower destiny opens ordinary Force-loss mitigation and spends the reduction cost',()=>{let {m,card,target}=base();const reduce=pull(m,'light','1_90','hand');m=play(m,card,target);m=seek(m,x=>event(x)?.kind==='force-loss');m=priority(m,'light');const action=prompt(m).choices.find(c=>c.id.includes(reduce));assert.ok(action);m=step(m,action.id);m=finish(m,card);assert.equal(m.cards[target].zone,'table');assert.equal(m.players.light.force.length,7);});
test('R2 table value choice stays private and does not overwrite its next drawn printed choice',()=>{let {m,card,target}=base(true);m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.handler==='off-edge:value');assert.deepEqual(ids(m),['off-edge:value:2','off-edge:value:5']);assert.equal(runtime.prompt(m,rules,'dark').choices.length,0);const before=clone(m);assert.throws(()=>step(m,'off-edge:value:3'));assert.throws(()=>step(m,'off-edge:value:2','dark'));assert.deepEqual(m,before);m=step(m,'off-edge:value:2');m=finish(m,card);assert.equal(m.data.printedDestinyChoices,undefined);});
test('equal destiny loses attached cards with ordering before the character loss response',()=>{let {m,site,card,target}=base();const weapon=pull(m,'light','1_153','table',site);m.cards[weapon].attachedTo=target;topDestiny(m,'light','1_100');m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(m.cards[target].zone,'leaving');m=step(m,ids(m).find(id=>id.includes(weapon)));m=seek(m,x=>event(x)?.kind==='character-lost');assert.deepEqual(new Set(event(m).cards),new Set([target,weapon]));m=finish(m,card);assert.equal(m.players.light.lost[0],card);});
test('actual Sense cancels the Interrupt before its destiny or character result',()=>{let {m,remote,card,target}=base();const vader=pull(m,'dark','1_168','table',remote),sense=pull(m,'dark','1_267','hand');m=play(m,card,target);m=priority(m,'dark');m=step(m,'cancel:play:'+sense+':'+card+':'+vader);m=seek(m,x=>x.cards[card].zone==='lost'&&x.cards[sense].zone!=='playing');assert.equal(m.cards[target].zone,'table');assert.equal(m.players.light.used.length,0);});
test('canceled destiny loses the character instead of treating it as zero',()=>{let {m,card,target}=base();m=play(m,card,target);m=seek(m,x=>event(x)?.kind==='destiny-drawn');response.cancelPendingDestiny(m,m.stack.at(-2));m=finish(m,card);assert.equal(m.cards[target].zone,'lost');});
test('saved bindings and printed choices reject corruption; concession freezes the choice',()=>{let {m,card,target}=base(true);m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.handler==='off-edge:value');for(const mutate of [x=>x.stack.at(-1).side='dark',x=>x.stack.at(-1).payload.printedValue=5,x=>x.stack.at(-1).payload.target.zone='hand',x=>x.stack.at(-1).payload.draw.value=NaN,x=>x.stack.at(-1).handler='off-edge:unknown']){const bad=clone(m);mutate(bad);assert.throws(()=>prompt(bad));}m=runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'concede'},()=>0);assert.equal(m.status,'finished');assert.equal(m.result.winner,'dark');});
test('unique Off The Edge cannot be played a second time in the same turn',()=>{let {m,card,target}=base();const second=pull(m,'light','5_59','hand');topDestiny(m,'light','1_115');m=finish(play(m,card,target),card);m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('off-edge:play:'+second)));});
test('loss of the final Life Force ends the match while the remaining result stays frozen',()=>{let {m,card,target}=base();const draw=m.players.light.reserve[0];for(const zone of ['reserve','force','used'])for(const id of [...m.players.light[zone]])if(id!==draw)state.moveCard(m,id,'hand');m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');assert.equal(life(m),1);assert.ok(ids(m).includes('lose:used'));m=step(m,'lose:used');assert.equal(m.status,'finished');assert.equal(m.result.winner,'dark');assert.equal(m.cards[card].zone,'playing');assert.equal(m.cards[target].zone,'table');});
for(const duration of ['turn','source'])test('retrieval restriction lifetime: '+duration,()=>{const {m,remote,target}=base();restrictions.preventRetrievalContribution(m,remote,target,duration);assert.equal(restrictions.mayContributeToRetrieval(m,target),false);m.turn.number++;assert.equal(restrictions.mayContributeToRetrieval(m,target),duration==='turn');});
test('continuous restriction expires when its source leaves; turn restriction persists',()=>{for(const duration of ['turn','source']){const {m,remote,target}=base();const provider=pull(m,'dark','8_108','table',remote);restrictions.preventRetrievalContribution(m,provider,target,duration);state.moveCard(m,provider,'hand');assert.equal(restrictions.mayContributeToRetrieval(m,target),duration==='source');}});
test('target-instance restriction does not follow a returned physical card',()=>{const {m,site,remote,target}=base();restrictions.preventRetrievalContribution(m,remote,target);state.moveCard(m,target,'hand');state.moveCard(m,target,'table');m.cards[target].location=site;assert.equal(restrictions.mayContributeToRetrieval(m,target),true);});
test('invalid contributor registrations and corrupt saved restrictions reject atomically',()=>{const {m,remote,target,card}=base();for(const args of [['missing',target],[remote,'missing'],[remote,target,'forever']])assert.throws(()=>restrictions.preventRetrievalContribution(m,...args));restrictions.preventRetrievalContribution(m,remote,target);for(const mutate of [x=>x.data.retrievalRestrictions={},x=>x.data.retrievalRestrictions[0].turn=0,x=>x.data.retrievalRestrictions[0].target.version++,x=>x.data.retrievalRestrictions[0].source.zone='hand']){const bad=clone(m);mutate(bad);if(bad.data.retrievalRestrictions?.[0]?.source.zone==='hand')bad.data.retrievalRestrictions[0].duration='source';assert.throws(()=>prompt(bad));}const before=clone(m);assert.throws(()=>retrieval.retrieve(m,'light',card,1,null,'used',undefined,{contributors:['missing']}));assert.deepEqual(m,before);assert.ok(!JSON.stringify(runtime.project(m,rules,'light')).includes('retrievalRestrictions'));});
test('both Edges respect contributor restrictions at their distinct pre-retrieval boundaries',()=>{let {m,site,remote}=base();const edge=pull(m,'light','1_101','hand'),luke=pull(m,'light','101_2','table',site);restrictions.preventRetrievalContribution(m,remote,luke);topDestiny(m,'light','1_115');m=step(m,'edge:play:'+edge+':'+luke);m=step(m,'edge:number:1');const seen=[];for(let i=0;i<100&&m.cards[edge].zone!=='lost';i++){seen.push(m.stack.at(-1)?.handler,event(m)?.kind);m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);}assert.equal(m.cards[edge].zone,'lost');assert.ok(!seen.includes('edge:retrieve'));assert.ok(!seen.includes('retrieval-initiated'));assert.equal(m.cards[luke].zone,'table');});
test('current character destiny applies live additions, lowest reset, clamping and instance expiry',()=>{const {m,site,remote,target}=base();stats.addStatModifier(m,site,target,'destiny','add',2);assert.equal(stats.characterDestinyValue(m,target,3),5);stats.addStatModifier(m,remote,target,'destiny','reset',1);assert.equal(stats.characterDestinyValue(m,target,3),1);stats.addStatModifier(m,site,target,'destiny','reset',0);assert.equal(stats.characterDestinyValue(m,target,3),0);state.moveCard(m,target,'hand');state.moveCard(m,target,'table');m.cards[target].location=site;assert.equal(stats.characterDestinyValue(m,target,3),3);stats.addStatModifier(m,site,target,'destiny','add',-6);assert.equal(stats.characterDestinyValue(m,target,3),0);});
for(const targetValue of [2.85841,2.51,2.5,3.14159,3.49,3.5])test('Off The Edge preserves comparison and rounds only the Force result: '+targetValue,()=>{
 let {m,remote,card,target,cards}=base();stats.addStatModifier(m,remote,target,'destiny','add',targetValue-3);topDestiny(m,'light','1_100');const initialLife=life(m);m=finish(play(m,card,target),card);
 const retrieved=cards.filter(id=>m.cards[id].zone==='used').length,lost=initialLife+retrieved-life(m);
 assert.equal(retrieved,targetValue<3?Math.round(3-targetValue):0);assert.equal(lost,targetValue>3?Math.round(targetValue-3):0);assert.equal(m.cards[target].zone,'table','a rounded-zero difference is not equal destiny');
 const row=JSON.parse(fs.readFileSync(new URL('./gemp/fractional-force-results.json',import.meta.url))).find(r=>r.kind==='off-edge'&&r.targetValue===targetValue);
 // Executed GEMP rounds all six positive differences up. AR p139 differs below .5.
 assert.deepEqual({retrieved:row.retrieved,lost:row.lost,lostTarget:row.lostTarget},{retrieved:targetValue<3?1:0,lost:targetValue>3?1:0,lostTarget:false});
});

function onOutcome(mode){let {m,site,remote,cards}=base();const card=pull(m,'light','1_101','hand'),target=pull(m,'light','101_2','table',site);if(mode==='on-target-blocked')restrictions.preventRetrievalContribution(m,remote,target);topDestiny(m,'light','1_115');m=step(m,'edge:play:'+card+':'+target);m=step(m,'edge:number:1');if(mode==='on-source-blocked')restrictions.preventRetrievalContribution(m,remote,card);let optional=0;for(let i=0;i<140&&m.cards[card].zone!=='lost';i++){if(m.stack.at(-1)?.handler==='edge:retrieve'){optional++;m=step(m,'edge:retrieve');}else m=step(m,ids(m).includes('pass')?'pass':ids(m)[0]);}assert.equal(m.cards[card].zone,'lost');return {name:mode,optional,retrieved:cards.filter(id=>m.cards[id].zone==='used').length,spent:8-m.players.light.force.length};}
import crypto from 'node:crypto';
test('Off The Edge evidence fingerprints the executed reference and preserves closed admission',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/off-edge-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.junitTests,2);assert.equal(p.unchangedProductionFiles,6820);assert.equal(premiereRules.supports('5_59'),false);assert.equal(premiereRules.supports('5_79'),false);});
