import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const traits=load(new URL('../../lib/native-engine/characteristics.ts',import.meta.url));
const retrieval=load(new URL('../../lib/native-engine/retrieval.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const metadata=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/identities.json',import.meta.url)));
// Test-only admission. Metadata and component checks never admit full decks.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('traits-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<500;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settled(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}

for(const trait of ['SPY','THIEF','BOUNTY_HUNTER','SMUGGLER'])test('Mos Eisley applies once for Dark '+trait+' and stops after movement',()=>{
 let m=fresh();const site=location(m,'dark','1_295'),near=location(m,'light','1_129'),c=pull(m,'dark','1_194','table',site),enemy=pull(m,'light','1_28','table',site);m=phase(m);const p=board.power(m,c),f=board.forfeit(m,c);
 traits.changeCharacteristic(m,site,c,trait,'give');traits.changeCharacteristic(m,site,c,'SPY','give');traits.changeCharacteristic(m,site,enemy,trait,'give');
 assert.equal(board.power(m,c),p+1);assert.equal(board.forfeit(m,c),f+1);assert.equal(board.power(m,enemy),1);assert.equal(board.forfeit(m,enemy),2);
 board.moveWithAttachments(m,c,near);assert.equal(board.power(m,c),p);assert.equal(board.forfeit(m,c),f);assert.equal(traits.hasCharacteristic(m,c,trait),true);
});

test('removals override multiple grants regardless of order, while specialized troopers keep their family',()=>{
 for(const order of [['give','remove','give'],['remove','give','give']]){
  let m=fresh({dark:['3_91']});const site=location(m,'dark','1_295'),snow=pull(m,'dark','3_91','table',site);m=phase(m);
  for(const operation of order)traits.changeCharacteristic(m,site,snow,'SPY',operation);
  assert.equal(traits.hasCharacteristic(m,snow,'SPY'),false);traits.changeCharacteristic(m,site,snow,'STORMTROOPER','remove');traits.changeCharacteristic(m,site,snow,'TROOPER','remove');
  assert.equal(traits.hasCharacteristic(m,snow,'STORMTROOPER'),true);assert.equal(traits.hasCharacteristic(m,snow,'TROOPER'),true);
  traits.changeCharacteristic(m,site,snow,'SNOWTROOPER','remove');assert.equal(traits.hasCharacteristic(m,snow,'STORMTROOPER'),false);assert.equal(traits.hasCharacteristic(m,snow,'TROOPER'),false);
 }
});

for(const duration of ['turn','source'])test('characteristic '+duration+' lifetime survives JSON, expires on its bound instance, and remains private',()=>{
 let m=fresh();const site=location(m,'dark','1_295'),source=pull(m,'dark','1_186','table',site),target=pull(m,'dark','1_194','table',site);m=phase(m);
 traits.changeCharacteristic(m,source,target,'SPY','give',duration);m=clone(m);premiereRules.validate(m);assert.equal(traits.hasCharacteristic(m,target,'SPY'),true);
 for(const side of ['dark','light'])assert.ok(!JSON.stringify(runtime.project(m,rules,side)).includes('characteristics'));
 state.moveCard(m,source,'hand');assert.equal(traits.hasCharacteristic(m,target,'SPY'),duration==='turn');state.moveCard(m,source,'table');m.cards[source].location=site;assert.equal(traits.hasCharacteristic(m,target,'SPY'),duration==='turn');
 state.moveCard(m,target,'hand');state.moveCard(m,target,'table');m.cards[target].location=site;assert.equal(traits.hasCharacteristic(m,target,'SPY'),false);
 traits.changeCharacteristic(m,source,target,'SPY','give',duration);m=seek(m,x=>x.turn.number===2&&x.stack.length===1);assert.equal(traits.hasCharacteristic(m,target,'SPY'),duration==='source');
});

test('invalid characteristics and forged saved references fail validation',()=>{
 let m=fresh();const site=location(m,'dark','1_295'),target=pull(m,'dark','1_194','table',site);m=phase(m);
 assert.throws(()=>traits.changeCharacteristic(m,site,target,'invented','give'),/Invalid characteristic/);assert.throws(()=>traits.changeCharacteristic(m,site,site,'SPY','give'),/Invalid characteristic/);
 traits.changeCharacteristic(m,site,target,'SPY','give');for(const mutate of [p=>p.target.version=99,p=>p.source.id='missing',p=>p.operation='replace',p=>p.turn=99,p=>p.duration='forever']){const bad=clone(m);mutate(bad.data.characteristics[0]);assert.throws(()=>premiereRules.validate(bad),/characteristic|reference/)}
});

test('explicit metadata covers every defined card without deriving traits from misleading text',()=>{
 const additional=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/additional-cards.json',import.meta.url)));
 const faces=JSON.parse(fs.readFileSync(new URL('../../data/native-engine/objective-faces.json',import.meta.url))),reverseFaces=new Set(Object.values(faces));
 // A reverse Objective face is definition data for its physical front, not a
 // separately playable card or independent identity.
 assert.deepEqual(Object.keys(metadata).sort(),[...new Set([...manifest.cards,...additional].filter(c=>!reverseFaces.has(c.gempId)).map(c=>c.gempId))].sort());
 const definitions=new Map([...manifest.cards,...additional].map(c=>[c.gempId,c]));
 for(const [front,back] of Object.entries(faces)){
  assert.equal(definitions.get(front)?.type,'Objective');assert.equal(definitions.get(back)?.type,'Objective');assert.equal(definitions.get(front).side,definitions.get(back).side);assert.ok(metadata[front]);assert.equal(metadata[back],undefined);
  assert.throws(()=>fresh({[definitions.get(back).side]:[back]}),/Reverse faces are not separate physical deck cards/);
 }
 let m=fresh({light:['1_4','1_147','3_16']});for(const bp of ['1_4','1_147','3_16']){const id=pull(m,'light',bp,'hand');assert.equal(traits.hasCharacteristic(m,id,'SMUGGLER'),false);assert.equal(traits.hasCharacteristic(m,id,'GAMBLER'),false)}
 const scout=Object.values(m.cards).find(c=>c.blueprint==='3_16');assert.equal(traits.hasCharacteristic(m,scout.id,'SCOUT'),true);assert.equal(traits.hasCharacteristic(m,scout.id,'TROOPER'),false);assert.equal(traits.nonUnique(m,scout.id),true);
});

for(const side of ['light','dark'])test(side+' reinforcement retrieval includes verified variants and spacecraft, excluding unrelated troopers',()=>{
 const wanted=side==='light'?['3_6','1_147']:['3_91','1_304'],unwanted=side==='light'?'3_16':'8_108';let m=fresh({[side]:[...wanted,unwanted]});location(m,'light','1_129');const source=pull(m,side,side==='light'?'1_106':'1_251','hand'),targets=wanted.map(bp=>pull(m,side,bp,'lost')),other=pull(m,side,unwanted,'lost');m=phase(m);retrieval.retrieve(m,side,source,3,null,'used','reinforcements');m=settled(m);
 assert.deepEqual(new Set(ids(m)),new Set(targets.map(id=>'retrieve:'+id)));for(const target of targets){m=step(m,'retrieve:'+target);m=settled(m)}
 assert.deepEqual(m.players[side].lost,[other]);assert.deepEqual(m.players[side].used.slice(0,2),[...targets].reverse());assert.equal(m.stack.length,1);
});

test('unique Tusken identity receives Jundland forfeit and can carry a Gaderffii Stick without counting as a non-unique Raider',()=>{
 let m=fresh({dark:['2_108','1_315']});const site=location(m,'dark','1_293'),leader=pull(m,'dark','2_108','table',site),raider=pull(m,'dark','1_196','table',site),weapon=pull(m,'dark','1_315','hand');force(m,'dark',3);m=phase(m);
 assert.equal(board.forfeit(m,leader),5);assert.equal(board.power(m,raider),1);assert.equal(traits.isSpecies(m,leader,'TUSKEN_RAIDER'),true);assert.equal(traits.nonUnique(m,leader),false);
 assert.ok(ids(m).includes('gaffi:equip:'+weapon+':'+leader));m=settled(step(m,'gaffi:equip:'+weapon+':'+leader));assert.equal(m.cards[weapon].attachedTo,leader);assert.equal(m.players.dark.force.length,1);
});



test('a granted gambler enables Gambler’s Luck and removing it suppresses only that mode',()=>{
 let m=fresh({light:['5_48']});const site=location(m,'light','1_129'),target=pull(m,'light','1_28','table',site),luck=pull(m,'light','5_48','hand');pull(m,'dark','1_194','table',site);force(m,'dark',2);m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');if(prompt(m).side!=='light')m=step(m,'pass');
 assert.ok(!ids(m).some(id=>id.startsWith('gamblers-luck:')));traits.changeCharacteristic(m,site,target,'GAMBLER','give');assert.ok(ids(m).includes('gamblers-luck:'+luck+':1'));traits.changeCharacteristic(m,site,target,'GAMBLER','remove');assert.ok(!ids(m).some(id=>id.startsWith('gamblers-luck:')));
});

test('Tusken Scavengers counts a unique Raider as well as the ordinary one',()=>{
 let m=fresh({dark:['2_108','1_275','1_194']});const site=location(m,'light','1_129');pull(m,'dark','2_108','table',site);pull(m,'dark','1_196','table',site);pull(m,'light','1_28','used');const card=pull(m,'dark','1_275','hand');force(m,'dark',2);const destiny=pull(m,'dark','1_194','hand');state.moveCard(m,destiny,'reserve');m=phase(m);m=step(m,'scavenge:play:'+card);m=seek(m,x=>x.stack.at(-1)?.handler==='scavenge:offer');assert.ok(ids(m).includes('scavenge:search'));assert.equal(m.stack.at(-1).payload.count,2);
});

const reference=JSON.parse(fs.readFileSync(new URL('./gemp/characteristics-results.json',import.meta.url)));
for(const row of reference.filter(r=>r.side))test('GEMP characteristic and location comparison '+row.name,()=>{
 let m=fresh({[row.side]:[row.name]});const site=location(m,'dark','1_295'),near=location(m,'light','1_129'),ship=['1_147','1_304'].includes(row.name),id=pull(m,row.side,row.name,ship?'hand':'table',ship?undefined:site);
 const actual={name:row.name,side:row.side};for(const [key,trait] of [['spy','SPY'],['thief','THIEF'],['smuggler','SMUGGLER'],['bountyHunter','BOUNTY_HUNTER'],['gambler','GAMBLER'],['trooper','TROOPER'],['stormtrooper','STORMTROOPER']])actual[key]=traits.hasCharacteristic(m,id,trait);
 actual.raider=traits.isSpecies(m,id,'TUSKEN_RAIDER');actual.nonUnique=traits.nonUnique(m,id);actual.reinforcement=traits.reinforcementTarget(m,id,row.side);
 if(!ship){const p=board.power(m,id),f=board.forfeit(m,id);board.moveWithAttachments(m,id,near);actual.powerBonus=p-board.power(m,id);actual.forfeitBonus=f-board.forfeit(m,id)}
 assert.deepEqual(actual,row);
});
for(const row of reference.filter(r=>['granted','removed-over-grants'].includes(r.name)))test('GEMP characteristic modifier comparison '+row.name,()=>{
 let m=fresh();const site=location(m,'dark','1_295'),id=pull(m,'dark','1_194','table',site);m=phase(m);traits.changeCharacteristic(m,site,id,'SPY','give');
 if(row.name==='removed-over-grants'){traits.changeCharacteristic(m,site,id,'SPY','remove');traits.changeCharacteristic(m,site,id,'SPY','give')}
 assert.deepEqual({name:row.name,spy:traits.hasCharacteristic(m,id,'SPY'),power:board.power(m,id),forfeit:board.forfeit(m,id)},row);
});

for(const side of ['light','dark'])test('actual GEMP '+side+' Reinforcements retrieves variant trooper and ship',()=>{
 const wanted=side==='light'?['3_6','1_147']:['3_91','1_304'],unwanted=side==='light'?'3_16':'8_108';let m=fresh({[side]:[...wanted,unwanted]});const site=location(m,'light','1_129'),opponent=side==='light'?'dark':'light';pull(m,opponent,opponent==='dark'?'1_194':'1_28','table',site);const source=pull(m,side,side==='light'?'1_106':'1_251','hand'),a=pull(m,side,wanted[0],'lost'),b=pull(m,side,wanted[1],'lost'),other=pull(m,side,unwanted,'lost');force(m,side,2);m=phase(m);if(prompt(m).side!==side)m=step(m,'pass');const d=pull(m,side,side==='light'?'1_105':'1_238','hand');state.moveCard(m,d,'reserve');m=step(m,'reinforce:'+source);m=settled(m);assert.deepEqual(new Set(ids(m)),new Set([a,b].map(id=>'retrieve:'+id)));
 for(const id of [b,a]){m=step(m,'retrieve:'+id);m=settled(m)}
 const actual={name:side+'-reinforcements',retrieved:[a,b].filter(id=>m.cards[id].zone==='used').length,unmatchedLost:m.cards[other].zone==='lost',interruptLost:m.cards[source].zone==='lost',usedOrder:m.players[side].used.filter(id=>id===a||id===b).map(id=>id===a?'trooper':'ship')};assert.deepEqual(actual,reference.find(r=>r.name===actual.name));
});
