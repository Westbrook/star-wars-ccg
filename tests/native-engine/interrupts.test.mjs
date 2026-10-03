import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
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
function reinforcements(side='light',value=2){let m=fresh({dark:['1_251','1_194','1_194','1_194'],light:['1_106','1_28','1_28','1_28']});const site=location(m,'light','1_129'),opponent=side==='light'?'dark':'light';pull(m,opponent,opponent==='dark'?'1_194':'1_28','table',site);const card=pull(m,side,side==='light'?'1_106':'1_251','hand');const lost=[pull(m,side,side==='light'?'1_28':'1_194','lost'),pull(m,side,side==='light'?'1_28':'1_194','lost'),pull(m,side,side==='light'?'1_6':'1_186','lost')];force(m,side,2);const bp=manifest.cards.find(c=>c.side===side&&Number(c.stats.destiny)===value&&Object.values(m.cards).some(k=>k.blueprint===c.gempId&&k.zone==='reserve')).gempId;const destiny=topDestiny(m,side,bp);m=priority(phase(m),side);return{m,card,lost,destiny,site}}

for(const side of ['light','dark'])test(side+' Reinforcements retrieve exact eligible cards, reveal results and preserve Lost order',()=>{
 let {m,card,lost,destiny}=reinforcements(side),before=clone(m.players[side]);m=step(m,'reinforce:'+card);assert.equal(m.players[side].force.length,before.force.length-1);assert.equal(m.cards[card].zone,'playing');m=settle(m);assert.deepEqual(new Set(ids(m)),new Set(lost.slice(0,2).map(id=>'retrieve:'+id)));assert.deepEqual(runtime.prompt(m,rules,side==='light'?'dark':'light').choices,[]);
 m=step(m,'retrieve:'+lost[0]);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='force-retrieved');assert.equal(m.cards[card].zone,'playing');assert.deepEqual(retrieval.retrievalView(m).retrievedCards,[{id:lost[0],blueprint:m.cards[lost[0]].blueprint}]);m=settle(m);m=step(m,'retrieve:'+lost[1]);m=settle(m);assert.deepEqual(m.players[side].lost,[card,lost[2]]);assert.deepEqual(m.players[side].used.slice(0,4),[lost[1],lost[0],destiny,before.force[0]]);assert.equal(m.cards[card].zone,'lost');
});

test('Reinforcements require being outnumbered and Force, but do not require a retrieval target or Reserve card',()=>{
 let {m,card,site}=reinforcements();pull(m,'light','1_28','table',site);assert.ok(!ids(m).includes('reinforce:'+card));let f=reinforcements();m=f.m;card=f.card;for(const id of [...m.players.light.force])state.moveCard(m,id,'used');assert.ok(!ids(m).includes('reinforce:'+card));f=reinforcements();m=f.m;card=f.card;for(const id of [...m.players.light.lost,...m.players.light.reserve])state.moveCard(m,id,'hand');assert.ok(ids(m).includes('reinforce:'+card));m=settle(step(m,'reinforce:'+card));assert.equal(m.cards[card].zone,'lost');assert.deepEqual(m.players.light.destiny,[]);
});

test('zero destiny and too few eligible Lost cards finish without inventing retrieval',()=>{
 for(const value of [0,5]){let {m,card,lost}=reinforcements('light',value);state.moveCard(m,lost[0],'hand');m=settle(step(m,'reinforce:'+card));if(value){assert.deepEqual(ids(m),['retrieve:'+lost[1]]);m=settle(step(m,ids(m)[0]));}assert.equal(m.cards[card].zone,'lost');assert.equal(m.cards[lost[1]].zone,value?'used':'lost');assert.equal(m.cards[lost[2]].zone,'lost');}
});

test('canceled Reinforcements keep payment and do not draw or retrieve',()=>{
 let {m,card,lost}=reinforcements();const reserve=[...m.players.light.reserve];m=step(m,'reinforce:'+card);m.stack.at(-2).cancelled=true;m=settle(m);assert.deepEqual(m.players.light.reserve,reserve);assert.equal(m.players.light.force.length,1);assert.deepEqual(m.players.light.lost,[card,...lost.slice().reverse()]);
});

test('ordinary retrieval uses top Lost first and reverses only the retrieved group on Used',()=>{
 let {m,card,lost}=reinforcements();retrieval.retrieve(m,'light',card,2);m=settle(m);assert.deepEqual(m.players.light.used.slice(0,2),[lost[1],lost[2]]);assert.deepEqual(m.players.light.lost,[lost[0]]);assert.throws(()=>retrieval.retrieve(m,'light',card,NaN),/Invalid retrieval/);
});

test('retrieval rechecks a chosen card after about-to-retrieve responses',()=>{
 let {m,card,lost}=reinforcements();m=settle(step(m,'reinforce:'+card));m=step(m,'retrieve:'+lost[0]);assert.equal(m.stack.at(-1).event.kind,'about-to-retrieve');state.moveCard(m,lost[0],'hand');m=settle(m);assert.deepEqual(ids(m),['retrieve:'+lost[1]]);m=settle(step(m,ids(m)[0]));assert.equal(m.cards[lost[0]].zone,'hand');assert.equal(m.cards[lost[1]].zone,'used');
});

function battleBoard(extra={}){let m=fresh({light:['1_84','1_84','1_106','1_115',...(extra.light??[])],dark:['1_269',...(extra.dark??[])]});const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site),vader=pull(m,'dark','101_5','table',site),dice=pull(m,'light','1_84','hand'),second=pull(m,'light','1_84','hand'),shuffle=pull(m,'light','1_115','hand'),takeel=pull(m,'dark','1_269','hand');pull(m,'light','1_28','table',site);force(m,'light',4);force(m,'dark',4);const next=topDestiny(m,'light','1_115'),first=topDestiny(m,'light','1_28');m=phase(m,'battle');m=step(m,'battle:'+site);return {m,site,luke,vader,dice,second,shuffle,takeel,first,next}}
function lightDraw(m){m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='light');m=step(m,'draw-destiny');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-drawn');return priority(m,'light')}

test("Han's Dice redraw waits for the first draw's responses, and preserves exact Used order",()=>{
 let {m,luke,dice,first,next}=battleBoard();m=lightDraw(m);assert.equal(combat.battle(m).destiny.light,1);m=step(m,'dice:'+dice+':'+luke);assert.equal(m.players.light.force.length,3);m=seek(m,x=>x.cards[dice].zone==='used');assert.equal(m.cards[first].zone,'destiny');assert.equal(combat.battle(m).destiny.light,null);assert.ok(!ids(priority(m,'light')).some(id=>id.startsWith('dice:')));m=seek(m,x=>combat.battle(x).destinyCards.light===next);assert.equal(m.cards[first].zone,'used');assert.equal(m.cards[next].zone,'destiny');assert.equal(combat.battle(m).destiny.light,5);assert.deepEqual(m.players.light.used.slice(0,2),[first,dice]);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-complete');assert.deepEqual(m.players.light.used.slice(0,3),[next,first,dice]);
});

test('successive Dice redraws still count as one battle destiny for Takeel',()=>{
 let {m,luke,dice,second,takeel}=battleBoard();m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&prompt(x).side==='dark');m=step(m,'draw-destiny');m=lightDraw(m);for(const card of [dice,second]){const before=combat.battle(m).destinyCards.light;m=step(m,'dice:'+card+':'+luke);m=seek(m,x=>combat.battle(x).destinyCards.light!==before);m=priority(m,'light');}m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-complete');m=priority(m,'dark');assert.ok(ids(m).includes('takeel:'+takeel));const before=clone(combat.battle(m).destiny);m=step(m,'takeel:'+takeel);m=seek(m,x=>x.cards[takeel].zone==='lost');assert.deepEqual(combat.battle(m).destiny,{dark:before.light,light:before.dark});
});

test('Dice may cancel the final Reserve draw; failed redraw supplies no destiny',()=>{
 let {m,luke,dice,first}=battleBoard();m=lightDraw(m);for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');assert.ok(ids(m).includes('dice:'+dice+':'+luke));m=step(m,'dice:'+dice+':'+luke);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-complete');assert.equal(combat.battle(m).destiny.light,null);assert.equal(combat.battle(m).destinyCards.light,null);assert.equal(m.cards[first].zone,'used');
});

test('canceled Dice loses the Interrupt but preserves original destiny and paid cost',()=>{
 let {m,luke,dice,first}=battleBoard();m=lightDraw(m);m=step(m,'dice:'+dice+':'+luke);m.stack.at(-2).cancelled=true;m=seek(m,x=>x.cards[dice].zone==='lost');assert.equal(combat.battle(m).destiny.light,1);assert.equal(combat.battle(m).destinyCards.light,first);assert.equal(m.players.light.force.length,3);
});

test('ordinary Interrupts are legal for either side and in weapons, not unrelated response/power/start windows',()=>{
 let {m,shuffle}=battleBoard();assert.ok(!ids(m).some(id=>id.startsWith('shuffle:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');m=priority(m,'light');assert.ok(ids(m).includes('shuffle:'+shuffle+':dark:reserve'));m=lightDraw(m);assert.ok(!ids(m).some(id=>id.startsWith('shuffle:')));m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-power');m=priority(m,'light');assert.ok(!ids(m).some(id=>id.startsWith('shuffle:')));
});

for(const side of ['light','dark'])test(side+' pile shuffle supports both players and all three nonempty piles without leaking order',()=>{
 for(const target of ['dark','light'])for(const pile of ['reserve','lost','used']){let m=fresh({light:['1_115'],dark:['1_262']});const card=pull(m,side,side==='light'?'1_115':'1_262','hand');for(let n=0;n<3;n++)state.moveCard(m,m.players[target].reserve.at(-1),pile);const before=[...m.players[target][pile]];m=priority(phase(m),side);const choice='shuffle:'+card+':'+target+':'+pile;assert.ok(ids(m).includes(choice));m=step(m,choice);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='pile-shuffled');assert.deepEqual(new Set(m.players[target][pile]),new Set(before));assert.notDeepEqual(m.players[target][pile],before);assert.equal(m.cards[card].zone,'playing');for(const s of ['light','dark'])if(pile!=='lost'){const view=state.publicState(m,s);assert.equal(view.players[target][pile],undefined);}m=settle(m);assert.equal(m.cards[card].zone,'used');if(target===side&&pile==='used')assert.equal(m.players[side].used[0],card);}
});

test('shuffle cancellation and entropy failure do not mutate the targeted pile',()=>{
 let m=fresh({light:['1_115']});const card=pull(m,'light','1_115','hand');m=priority(phase(m),'light');m=step(m,'shuffle:'+card+':dark:reserve');const before=[...m.players.dark.reserve];let canceled=clone(m);canceled.stack.at(-2).cancelled=true;canceled=settle(canceled);assert.deepEqual(canceled.players.dark.reserve,before);assert.equal(canceled.cards[card].zone,'lost');m=step(m,'pass');const saved=clone(m);assert.throws(()=>runtime.applyCommand(m,rules,prompt(m).side,{revision:m.revision,choice:'pass'},()=>{throw Error('entropy unavailable')}),/entropy unavailable/);assert.deepEqual(m,saved);
});

test('private retrieval decisions reject an opposing seat and stale retries without mutation',()=>{
 let {m,card,lost}=reinforcements();m=settle(step(m,'reinforce:'+card));const before=clone(m);assert.throws(()=>runtime.applyCommand(m,rules,'dark',{revision:m.revision,choice:'retrieve:'+lost[0]}));assert.deepEqual(m,before);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:'retrieve:'+lost[0]}));assert.deepEqual(m,before);assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision,choice:'retrieve:'+lost[2]}));assert.deepEqual(m,before);
});

test('saved retrieval and Interrupt continuations reject impossible state',()=>{
 let {m,card}=reinforcements();m=step(m,'reinforce:'+card);let invalid=clone(m);invalid.cards[card].zone='out';assert.throws(()=>runtime.prompt(invalid,rules,'light'),/Invalid pending Interrupt/);m=settle(m);invalid=clone(m);invalid.stack.at(-1).payload.remaining=-1;assert.throws(()=>runtime.prompt(invalid,rules,'light'),/Invalid pending retrieval/);invalid=clone(m);invalid.stack.at(-1).side='dark';assert.throws(()=>runtime.prompt(invalid,rules,'dark'),/Invalid retrieval choice/);
});

test('Dice needs a participating high-ability character, sufficient Force and its own battle draw',()=>{
 let {m,luke,dice}=battleBoard();m=lightDraw(m);let noForce=clone(m);for(const id of [...noForce.players.light.force])state.moveCard(noForce,id,'used');assert.ok(!ids(noForce).some(id=>id.startsWith('dice:')));let noLuke=clone(m);state.moveCard(noLuke,luke,'lost');assert.ok(!ids(noLuke).some(id=>id.startsWith('dice:')));let wrong=clone(m);wrong.stack.at(-1).event.side='dark';assert.ok(!ids(wrong).some(id=>id.startsWith('dice:')));assert.ok(ids(m).includes('dice:'+dice+':'+luke));
});

test('native retrieval and redraw agree with seven fresh GEMP observations',()=>{
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/interrupt-results.json',import.meta.url)));
 for(const side of ['light','dark'])for(const value of [0,2,5]){let {m,card,lost}=reinforcements(side,value);m=settle(step(m,'reinforce:'+card));for(const id of [lost[1],lost[0]])if(value)m=settle(step(m,'retrieve:'+id));const used=m.players[side].used,labels=new Map([[lost[0],'a'],[lost[1],'b']]),name=side+'-reinforce-'+value;assert.deepEqual({name,retrieved:lost.slice(0,2).filter(id=>used.includes(id)).length,unmatchedLost:m.cards[lost[2]].zone==='lost',interruptLost:m.cards[card].zone==='lost',selectedOrder:used.filter(id=>labels.has(id)).map(id=>labels.get(id))},observed.find(o=>o.name===name));}
 let {m,luke,dice,first,next}=battleBoard();m=lightDraw(m);const originalValue=combat.battle(m).destiny.light;m=step(m,'dice:'+dice+':'+luke);m=seek(m,x=>x.cards[next].zone==='used');const labels=new Map([[next,'replacement'],[first,'original'],[dice,'dice']]);assert.deepEqual({name:'dice-redraw',originalValue,replacementValue:combat.battle(m).destiny.light,usedOrder:m.players.light.used.filter(id=>labels.has(id)).map(id=>labels.get(id))},observed.find(o=>o.name==='dice-redraw'));
});

const abilityRules=load(new URL('../../lib/native-engine/ability.ts',import.meta.url));
const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
for(const mode of ['stay','depart','return','ability-two','destiny-depart'])test('Dice keeps its initiated redraw after character '+mode+' (actual GEMP)',()=>{
 let {m,site,luke,dice,first,next}=battleBoard();m=lightDraw(m);const before=m.players.light.force.length;m=step(m,'dice:'+dice+':'+luke);
 const old=clone(m.stack.at(-2).action.payload.dice.character);
 if(mode==='depart'||mode==='return')state.moveCard(m,luke,'hand');
 if(mode==='return'){state.moveCard(m,luke,'table');m.cards[luke].location=site;assert.equal(identity.sameCard(m,old),false);}
 if(mode==='ability-two')abilityRules.addAbilityModifier(m,luke,luke,'reset',2);
 if(mode==='destiny-depart')state.moveCard(m,first,'hand');
 m=seek(clone(m),x=>x.cards[next].zone==='used');
 const observed=JSON.parse(fs.readFileSync(new URL('./gemp/dice-identity-results.json',import.meta.url)));
 assert.deepEqual({mode,redrawn:m.cards[next].zone==='used',diceUsed:m.cards[dice].zone==='used',diceLost:m.cards[dice].zone==='lost',paid:before-m.players.light.force.length,originalUsed:m.cards[first].zone==='used'},observed.find(x=>x.mode===mode));
});

test('Dice recovery binds the original draw and window, rejecting forged continuations atomically',()=>{
 let {m,luke,dice}=battleBoard();m=step(lightDraw(m),'dice:'+dice+':'+luke);
 for(const mutate of [p=>delete p.dice,p=>p.dice.index=-1,p=>p.dice.index+=1,p=>p.dice.actionId='other-draw',p=>p.dice.window+=1,p=>p.dice.destiny.version+=10,p=>p.dice.destiny.zone='hand',p=>p.dice.character.zone='hand',p=>p.dice.character.version+=10,p=>p.drawn=p.target,p=>delete p.target]){
  const bad=clone(m);mutate(bad.stack.at(-2).action.payload);const before=clone(bad);
  assert.throws(()=>runtime.applyCommand(bad,rules,prompt(m).side,{revision:bad.revision,choice:'pass'}),/redraw|reference/);assert.deepEqual(bad,before);
 }
 for(const side of ['light','dark'])assert.ok(!JSON.stringify(runtime.project(m,rules,side)).includes('actionId'));
});

for(const cancelSense of [false,true])test('actual nested Sense '+(cancelSense?'countered by Alter':'cancels Dice')+' preserves original draw binding and cost',()=>{
 let {m,luke,vader,dice,first,next}=battleBoard({dark:['1_267'],light:['1_71']});
 const sense=pull(m,'dark','1_267','hand'),alter=pull(m,'light','1_71','hand');topDestiny(m,'dark','101_4');
 m=step(lightDraw(m),'dice:'+dice+':'+luke);m=step(m,'cancel:play:'+sense+':'+dice+':'+vader);
 if(cancelSense)m=step(m,'cancel:play:'+alter+':'+sense+':direct');
 m=seek(m,x=>x.cards[dice].zone===(cancelSense?'used':'lost'));
 assert.equal(m.players.light.force.length,3);assert.equal(m.cards[first].zone,'destiny');
 assert.equal(combat.battle(m).destiny.light,cancelSense?null:1);
 m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-complete');
 assert.equal(m.cards[first].zone,'used');assert.equal(m.cards[next].zone,cancelSense?'used':'reserve');
});
