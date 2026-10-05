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

const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const text=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const response=load(new URL('../../lib/native-engine/destiny-response.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/character-destiny-results.json',import.meta.url)));
const event=m=>m.stack.at(-1)?.event;
const next={id:'observed',label:'Record result',handler:'probe:done',payload:{}};
function base(){let m=fresh({light:['1_11','1_5','2_14','1_106','1_153','1_115','1_84'],dark:['1_167','1_179','1_168','1_194']});const site=location(m,'light','1_129'),remote=location(m,'dark','1_284'),han=pull(m,'light','1_11','table',site),luke=pull(m,'light','101_2','table',site),rebel=pull(m,'light','1_28','table',site),vader=pull(m,'dark','1_168','table',site),tarkin=pull(m,'dark','1_179','table',site),praji=pull(m,'dark','1_167','table',site),trooper=pull(m,'dark','1_194','table',site);force(m,'dark',12);force(m,'light',12);m=phase(m,'deploy');return {m,site,remote,han,luke,rebel,vader,tarkin,praji,trooper};}
function drawing(kind='battle',substituted=false){
 let f=base(),{m,site,han,trooper}=f;const gun=pull(m,'light','1_153','table',site);m.cards[gun].attachedTo=f.luke;const reinforce=pull(m,'light','1_106','hand');pull(m,'light','1_28','lost');topDestiny(m,'light','1_115');const original=topDestiny(m,'light','1_28');m=phase(m,'battle');m=step(m,'battle:'+site);
 if(kind==='battle'){m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');
  if(substituted){
   m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny'&&event(x)?.category==='battle'&&event(x)?.side==='light');
   const pending=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw'&&f.actor==='light');
   assert.ok(pending);assert.equal(destiny.substituteDestiny(m,pending,han,3),true);
  }
 }
 else{m=seek(m,x=>event(x)?.kind==='battle-weapons');m=priority(m,'light');m=step(m,kind==='weapon'?'fire:'+gun+':'+trooper:'reinforce:'+reinforce);}
 m=seek(m,x=>['destiny-drawn','battle-destiny-drawn','weapon-destiny-drawn'].includes(event(x)?.kind));return {...f,m,gun,reinforce,original};
}
const options=m=>ids(m).filter(id=>id.startsWith('character-destiny:'));
function act(m,id,mode){m=priority(m,m.cards[id].owner);return step(m,'character-destiny:'+id+':'+mode)}
function trace(f,who){let {m,original}=f;const events=[],seen=new Set(),drawn=new Set();let used=false;
 for(let i=0;i<400;i++){
  const w=m.stack.at(-1),e=event(m);if(w?.kind==='window'&&e&&!seen.has(w.serial)){
   seen.add(w.serial);const d=response.destinyInWindow(m,w),stage=d?'drawn':e.kind==='destiny-draw-complete'?'complete':e.kind==='destiny-total'?'total':null;
   if(stage){if(d&&e.card)drawn.add(e.card);events.push({stage,side:d?.side??e.side,value:d?.value??(stage==='total'?e.total:e.value),unresolved:[...drawn].filter(id=>m.cards[id].zone==='destiny').length,used:[...drawn].filter(id=>m.cards[id].zone==='used').length});}
  }
  if((who==='tarkin'&&used&&m.cards[original].zone==='used')||(who==='han'&&events.some(e=>e.stage==='total')))return {m,events};
  const p=prompt(m);if(!used&&p.choices.some(c=>c.id==='character-destiny:'+f[who]+':'+(who==='han'?'redraw':'cancel'))){m=step(m,'character-destiny:'+f[who]+':'+(who==='han'?'redraw':'cancel'));used=true;}
  else m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id);
 }throw Error('draw not finished');
}
for(const who of ['han','tarkin'])for(const kind of ['battle','weapon','general'])test(who+' acts on actual '+kind+' destiny with correct cost and cleanup',()=>{
 const f=drawing(kind),force=f.m.players.light.force.length,{m,events}=trace(f,who);assert.deepEqual(events.map(e=>[e.stage,e.value]),who==='han'?[['drawn',1],['drawn',5],['complete',5],['total',5]]:[['drawn',1]]);assert.equal(force-m.players.light.force.length,who==='han'?1:0);assert.equal(m.cards[f.original].zone,'used');assert.equal(m.data.battle.characterDestinyUses.length,1);assert.deepEqual({name:who+'-'+kind,events,uses:1,cost:force-m.players.light.force.length},oracle.find(r=>r.name===who+'-'+kind));
});
test('Tarkin cancellation removes Han and Dice options on the canceled draw',()=>{
 let f=drawing(),m=f.m;const dice=pull(m,'light','1_84','hand');m=act(m,f.tarkin,'cancel');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');assert.equal(options(m).length,0);assert.ok(!ids(m).some(id=>id.startsWith('dice:'+dice)));
});
for(const member of ['han','tarkin','vader'])for(const mode of ['remote','barred','hand'])test(member+' '+mode+' disables its participation-dependent action',()=>{
 let f=drawing(),m=f.m;if(mode==='remote')m.cards[f[member]].location=f.remote;else if(mode==='hand')state.moveCard(m,f[member],'hand');else ground.record(m).barriers[f[member]]=m.turn.number;combat.syncBattle(m);const actor=member==='han'?'han':'tarkin';m=priority(m,m.cards[f[actor]].owner);assert.ok(!options(m).some(id=>id.includes(f[actor])));
});
test('Han needs one Force; Tarkin needs none',()=>{
 let f=drawing(),m=f.m;for(const side of ['light','dark'])for(const id of [...m.players[side].force])state.moveCard(m,id,'used');assert.ok(options(m).some(id=>id.includes(f.tarkin)));m=priority(m,'light');assert.equal(options(m).length,0);
});
for(const who of ['han','tarkin'])test(who+' cannot affect substituted destiny',()=>{
 let f=drawing('battle',true),m=f.m;assert.equal(m.cards[f.original].zone,'reserve');assert.equal(m.data.battle.destinyCards.light,null);assert.equal(m.data.battle.destinyDraws.light.substitution.value,3);m=priority(clone(m),m.cards[f[who]].owner);assert.equal(options(m).length,0);
});
for(const who of ['han','tarkin'])test(who+' effect survives source departure after initiation and refresh',()=>{
 let f=drawing(),m=act(f.m,f[who],who==='han'?'redraw':'cancel');state.moveCard(m,f[who],'hand');m=clone(m);m=seek(m,x=>x.cards[f.original].zone==='used');assert.equal(m.data.battle.characterDestinyUses.length,1);if(who==='han'){m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,5);}
});
for(const who of ['han','tarkin'])test('canceling '+who+' action keeps paid usage for this battle',()=>{
 let f=drawing(),m=act(f.m,f[who],who==='han'?'redraw':'cancel');m.stack.find(q=>q.kind==='resolution'&&q.action.handler==='character-destiny:respond').cancelled=true;m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,m.cards[f[who]].owner);assert.ok(!options(m).some(id=>id.includes(f[who])));m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,1);
});
function settleText(m){return seek(m,x=>!ids(x).some(id=>id.startsWith('game-text:'))&&!['game-text-canceled','game-text-restored'].includes(event(x)?.kind)&&!x.stack.some(q=>q.kind==='resolution'&&q.action.handler==='game-text:change'));}
function droids(mode='present'){
 const f=base(),{m,site,remote,han,praji}=f;state.moveCard(m,han,'hand');const c3po=pull(m,'light','1_5','table',site),r2=pull(m,'light','2_14','table',site);
 if(mode==='absent'||mode==='hand')state.moveCard(m,praji,'hand');if(mode==='remote')m.cards[praji].location=remote;if(mode==='return'){state.moveCard(m,praji,'hand');state.moveCard(m,praji,'table');m.cards[praji].location=site;}return {...f,m:settleText(m),c3po,r2};
}
for(const mode of ['absent','present','remote','hand','return'])test('Praji '+mode+' updates both droids and continuous attributes',()=>{
 const f=droids(mode),cancel=['present','return'].includes(mode);assert.equal(text.gameTextActive(f.m,f.c3po),!cancel);assert.equal(text.gameTextActive(f.m,f.r2),!cancel);assert.equal(board.totalPower(f.m,'light',f.site),cancel?5:9);assert.equal(board.forfeit(f.m,f.r2),cancel?4:6);assert.equal(board.printed(f.m,f.r2,'power'),1);assert.equal(board.cardDefinition(f.m,f.praji).icons.includes('Warrior'),true);assert.deepEqual({name:'praji-'+mode,power:board.totalPower(f.m,'light',f.site),forfeit:board.forfeit(f.m,f.r2),c3poCanceled:!text.gameTextActive(f.m,f.c3po),r2Canceled:!text.gameTextActive(f.m,f.r2)},oracle.find(r=>r.name==='praji-'+mode));
});
test('Praji suppresses R2 Scomp actions; departure restores the same opportunity',()=>{
 let f=droids(),{m}=f;topDestiny(m,'dark','1_194');destiny.drawDestiny(m,'dark',f.praji,'probe',next);m=seek(m,x=>event(x)?.kind==='destiny-drawn');assert.ok(!ids(m).some(id=>id.startsWith('r2:')));state.moveCard(m,f.praji,'hand');m=settleText(m);assert.ok(ids(m).some(id=>id.startsWith('r2:')));
});
test('excluded Praji does not suppress droids during battle; ordinary text returns afterward',()=>{
 const f=droids();let m=phase(f.m,'battle');ground.record(m).barriers[f.praji]=m.turn.number;m=step(m,'battle:'+f.site);m=seek(m,x=>event(x)?.kind==='battle-weapons');m=settleText(m);assert.equal(text.gameTextActive(m,f.c3po),true);assert.equal(board.forfeit(m,f.r2),6);m.data.battle.stage='complete';m=settleText(m);assert.equal(text.gameTextActive(m,f.c3po),false);assert.equal(board.forfeit(m,f.r2),4);
});
for(const bp of ['1_11','1_167','1_179'])test('ordinary deployment pays printed cost for '+bp+' without opening full admission',()=>{
 const f=base();let m=f.m;const card=Object.values(m.cards).find(c=>c.blueprint===bp),side=card.owner;state.moveCard(m,card.id,'hand');m=seek(m,x=>x.turn.side===side&&x.turn.phase==='deploy'&&x.stack.length===1);const force=m.players[side].force.length;m=priority(m,side);m=step(m,'deploy:'+card.id+':'+f.site);m=seek(m,x=>x.cards[card.id].zone==='table');assert.equal(force-m.players[side].force.length,board.printed(m,card.id,'deploy'));assert.equal(premiereRules.supports(bp),false);
});
for(const change of [p=>p.mode='unknown',p=>p.pendingIndex++,p=>p.pendingId='wrong',p=>p.window++,p=>p.source.version++])test('character response rejects forged saved binding: '+change,()=>{
 const f=drawing();let m=act(f.m,f.han,'redraw');change(m.stack.find(q=>q.kind==='resolution'&&q.action.handler==='character-destiny:respond').action.payload);assert.throws(()=>prompt(m));
});
test('Praji cancellation can resolve in either mandatory order and survives refresh',()=>{
 const f=base();let m=f.m;const c3po=pull(m,'light','1_5','table',f.site),r2=pull(m,'light','2_14','table',f.site);const choices=ids(m);assert.equal(choices.length,2);assert.ok(choices.every(id=>id.startsWith('game-text:')));assert.equal(text.gameTextActive(m,c3po),true);assert.equal(text.gameTextActive(m,r2),true);
 for(const first of choices){let n=step(clone(m),first);assert.equal(event(n).kind,'game-text-canceled');assert.equal([c3po,r2].filter(id=>text.gameTextActive(n,id)).length,1);n=settleText(clone(n));assert.equal(board.forfeit(n,r2),4);assert.equal(board.totalPower(n,'light',f.site),8);}
});
test('text cancellation leaves R2 printed destiny values intact',()=>{
 let f=droids(),m=f.m;assert.equal(text.gameTextActive(m,f.r2),false);state.moveCard(m,f.r2,'reserve');destiny.drawDestiny(m,'light',f.praji,'probe',next);m=seek(m,x=>x.stack.at(-1)?.handler==='destiny:value');m=step(m,'value:5');m=seek(m,x=>!!x.data.observed);assert.equal(m.data.observed.total,5);
});
test('restoration and recancellation remain available in the same original opportunity',()=>{
 const f=droids();let m=f.m;for(let i=0;i<3;i++){state.moveCard(m,f.praji,'hand');m=settleText(m);assert.equal(board.forfeit(m,f.r2),6);state.moveCard(m,f.praji,'table');m.cards[f.praji].location=f.site;m=settleText(m);assert.equal(board.forfeit(m,f.r2),4);}
});
test('a Praji arriving after R2 initiated a response does not undo its effect',()=>{
 const f=droids('hand');let m=f.m;topDestiny(m,'dark','1_194');destiny.drawDestiny(m,'dark',f.praji,'probe',next);m=seek(m,x=>event(x)?.kind==='destiny-drawn');const force=m.players.light.force.length;m=step(m,'r2:'+f.r2+':activate');state.moveCard(m,f.praji,'table');m.cards[f.praji].location=f.site;m=seek(m,x=>!!x.data.observed);assert.equal(m.players.light.force.length,force+1);assert.equal(text.gameTextActive(m,f.r2),false);
});
test('Han redraw preserves the exact single-draw weapon scope and replaces its count',()=>{
 const f=drawing('weapon');let m=f.m;const p=m.stack.at(-2).action.payload,scope=p.flow.scope;load(new URL('../../lib/native-engine/destiny-limits.ts',import.meta.url)).setDestinyLimit(m,scope,1);m=act(m,f.han,'redraw');m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,5);assert.equal(m.data.destinySequences[scope].physical,1);assert.equal(Object.values(m.data.destinySequences).filter(s=>s.source===f.gun&&s.category==='weapon').length,1);
});
test('Tarkin plain cancellation consumes rather than releases the original weapon draw count',()=>{
 const f=drawing('weapon');let m=f.m;const scope=m.stack.at(-2).action.payload.flow.scope;m=act(m,f.tarkin,'cancel');m=seek(m,x=>x.cards[f.original].zone==='used');assert.equal(m.data.destinySequences[scope].physical,1);
});
test('Han may use his redraw again in the next actual battle',()=>{
 const f=drawing();let m=trace(f,'han').m;for(let i=0;i<300&&m.data.battle?.stage!=='complete';i++){const choices=ids(m);m=step(m,choices.includes('battle-lose:reserve')?'battle-lose:reserve':choices.includes('pass')?'pass':choices.find(id=>id.startsWith('forfeit:')&&id!=='forfeit:'+f.han)??choices[0]);}assert.equal(m.data.battle.stage,'complete');assert.equal(m.data.battle.characterDestinyUses.length,1);m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='battle'&&x.stack.length===1);assert.equal(m.cards[f.han].zone,'table');topDestiny(m,'light','1_28');m=step(m,'battle:'+f.site);assert.equal(m.data.battle.characterDestinyUses,undefined);m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');m=seek(m,x=>event(x)?.kind==='battle-destiny-drawn');m=priority(m,'light');assert.ok(options(m).includes('character-destiny:'+f.han+':redraw'));
});
test('empty Reserve after Han cancels leaves a failed replacement with no completed draw',()=>{
 const f=drawing('weapon');let m=f.m;for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');m=act(m,f.han,'redraw');m=seek(m,x=>event(x)?.kind==='weapon-fired');assert.equal(m.data.battle.shots[0].total,null);assert.equal(m.data.battle.shots[0].hit,false);assert.equal(m.cards[f.original].zone,'used');
});

test('legacy saved weapon adapter recovers its original limited destiny sequence',()=>{
 const f=drawing('weapon');let m=f.m;const p=m.stack.at(-2).action.payload,scope=p.flow.scope;load(new URL('../../lib/native-engine/destiny-limits.ts',import.meta.url)).setDestinyLimit(m,scope,1);delete p.flow;m=act(clone(m),f.han,'redraw');m=seek(m,x=>event(x)?.kind==='destiny-total');assert.equal(event(m).total,5);assert.equal(m.data.destinySequences[scope].physical,1);assert.equal(Object.values(m.data.destinySequences).filter(s=>s.source===f.gun&&s.category==='weapon').length,1);
});
