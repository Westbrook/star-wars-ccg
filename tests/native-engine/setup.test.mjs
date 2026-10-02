import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const {assertState}=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereSetup,premiereSites}=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const oracle=JSON.parse(fs.readFileSync(new URL('../native-proof/gemp/setup-oracle-result.json',import.meta.url)));
const definitions=new Map(manifest.cards.map(c=>[c.gempId,c]));
const {createMatch,applyCommand,prompt,project,startTurns}=runtime;
const clone=x=>JSON.parse(JSON.stringify(x));
// Setup-only adapter. No production deck is admitted: supports=true here lets
// tests compare starting setup independently from unimplemented later effects.
const rules=(changes={})=>({id:'setup-test-1',starting:premiereSetup,definition:id=>definitions.get(id),supports:id=>definitions.has(id),setupComplete:m=>m.setup?.stage==='complete',generation:(m,side)=>1+m.locations.reduce((n,id)=>n+premiereSites[m.cards[id].blueprint].icons[side],0),automatic:()=>[],actions:()=>[],initiate:()=>{},resolve:()=>{throw Error('No later card effects in setup test')},decisions:()=>[],choose:()=>{},validate:()=>{},...changes});
const decks=()=>manifest.decks.map(d=>({side:d.side,cards:[...d.main]}));
const start=(r=rules(),d=decks(),size=60)=>createMatch('setup-game',size,d,r);
function step(m,r,choice,side=prompt(m,r,'dark').side,random=()=>42){const snapshot=clone(m);const n=applyCommand(m,r,side,{revision:m.revision,choice},random);assert.deepEqual(m,snapshot);assert.equal(n.revision,m.revision+1);assertState(n);for(const seat of ['dark','light'])assert.deepEqual(project(n,r,seat),project(clone(n),r,seat));return n}
const candidates=(m,r,side)=>project(m,r,side).setup.candidates;
const pick=(m,r,side,id)=>candidates(m,r,side).find(c=>c.blueprint===id).id;
function select(m,r,dark,light,first='dark'){for(const side of [first,first==='dark'?'light':'dark'])m=step(m,r,'select:'+pick(m,r,side,side==='dark'?dark:light),side);return step(m,r,'reveal')}
function finish(m,r){for(let i=0;i<50&&m.status==='setup';i++){const p=prompt(m,r,'dark'),own=prompt(m,r,p.side);m=step(m,r,own.choices[0].id,p.side)}assert.equal(m.status,'playing');return m}
const activateBoundary=(m,r)=>step(step(m,r,'pass'),r,'pass');
const convertId=id=>(id.startsWith('d')?'dark-':'light-')+Number(id.slice(1));

test('either player can commit first, with all physical choices and Force icons private',()=>{
 const r=rules(),m=start(r);
 for(const side of ['dark','light']){const choices=candidates(m,r,side);assert.equal(choices.length,9);assert.equal(new Set(choices.map(c=>c.id)).size,9);assert.ok(choices.every(c=>c.forceIcons&&Number.isInteger(c.forceIcons.dark)));
  const a=step(m,r,'select:'+choices[0].id,side),b=step(m,r,'select:'+choices.at(-1).id,side),opponent=side==='dark'?'light':'dark';
  assert.deepEqual(project(a,r,opponent),project(b,r,opponent));assert.equal(project(a,r,opponent).setup.selected[side],null);
  assert.throws(()=>step(a,r,'select:'+choices.at(-1).id,side),/Illegal/);assert.equal(a.locations.length,0);
 }
});

test('all 81 starting pairs match recorded GEMP boards, generation and pile counts',()=>{
 const r=rules();assert.equal(oracle.allInitialPairs.length,81);
 for(const branch of oracle.allInitialPairs){let m=start(r);m=step(m,r,'select:'+convertId(branch.chosen.dark),'dark');m=step(m,r,'select:'+convertId(branch.chosen.light),'light');m=step(m,r,'reveal');m=activateBoundary(finish(m,r),r);
  assert.equal(m.turn.side,branch.active);assert.equal(m.turn.phase,branch.phase.toLowerCase());assert.equal(m.turn.generation,branch.generation.dark);
  const board=m.locations.map(id=>({id,blueprint:m.cards[id].blueprint,under:Object.values(m.cards).filter(c=>c.coveredBy===id).map(c=>c.id)})).sort((a,b)=>a.id.localeCompare(b.id));
  const expected=branch.table.map(c=>({...c,id:convertId(c.id),under:c.under.map(convertId)})).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(board,expected);
  for(const side of ['dark','light'])for(const pile of ['hand','reserve'])assert.equal(m.players[side][pile].length,branch.counts[side][pile]);
 }
});

test('both conversion consents work; covered icons do not contribute',()=>{
 const r=rules();for(const consent of ['dark','light']){let m=select(start(r),r,'1_285','1_124');assert.equal(m.setup.stage,'conversion');if(consent==='light')m=step(m,r,'decline');m=step(m,r,'accept');m=activateBoundary(finish(m,r),r);const covered=m.setup.covered;
  assert.equal(m.cards[covered].owner,consent);assert.equal(m.cards[covered].coveredBy,m.locations[0]);assert.equal(m.turn.generation,2);assert.equal(m.locations.length,1);
 }
});

test('both-decline excludes physical copies only and returns them to shuffled Life Force',()=>{
 const r=rules();let m=select(start(r),r,'1_285','1_124');const rejected=[m.setup.selected.dark,m.setup.selected.light];m=step(step(m,r,'decline'),r,'decline');
 assert.deepEqual(m.setup.rejected,[rejected]);assert.equal(candidates(m,r,'dark').some(c=>c.id===rejected[0]),false);const duplicate=pick(m,r,'dark','1_285');assert.notEqual(duplicate,rejected[0]);
 m=select(m,r,'1_285','1_132','light');m=finish(m,r);for(const id of rejected)assert.ok(['hand','reserve'].includes(m.cards[id].zone));assert.equal(m.cards[duplicate].zone,'table');
 assert.equal(oracle.branches.find(b=>b.name==='both-decline-reselect').gempExcludesAllCopiesOfPreviouslyDeclinedTitle,true);
});

test('an unconvertible starting location stays; the converting copy goes out of play',()=>{
 const base=premiereSetup;const r=rules({starting:{...base,location:(m,id)=>{const v=base.location(m,id);return v?{...v,convertible:m.cards[id].owner!=='dark'}:null}}});
 let m=select(start(r),r,'1_285','1_124');const dark=m.setup.selected.dark,light=m.setup.selected.light;m=step(m,r,'accept');m=finish(m,r);
 assert.deepEqual(m.locations,[dark]);assert.equal(m.cards[dark].zone,'table');assert.equal(m.cards[light].zone,'out');assert.equal(m.cards[dark].coveredBy,undefined);assert.equal(m.players.light.reserve.length,51);
});

test('same-system placements belong to Light; separate systems have no fake adjacency decision',()=>{
 const r=rules();let m=select(start(r),r,'1_284','1_124');const p=prompt(m,r,'light');assert.equal(p.side,'light');assert.equal(p.choices.length,2);const left=finish(step(m,r,'place:left','light'),r),right=finish(step(m,r,'place:right','light'),r);assert.deepEqual(left.locations,[...right.locations].reverse());
 m=select(start(r),r,'1_291','1_124');assert.equal(prompt(m,r,'dark').choices.length,1);assert.equal(prompt(m,r,'dark').side,'dark');
});

test('shuffle is an atomic persisted outcome and neither player sees remaining order',()=>{
 const r=rules();let m=select(start(r),r,'1_291','1_124');m=step(m,r,'place:separate');const before=clone(m);let calls=0;
 const end=step(m,r,'begin','dark',()=>{calls++;return calls*733});assert.equal(calls,116);assert.equal(end.status,'playing');assert.equal(end.turn.number,1);assert.equal(end.stack.at(-1).timing,'start');
 for(const side of ['dark','light']){assert.equal(end.players[side].hand.length,8);assert.equal(end.players[side].reserve.length,51);assert.deepEqual([...end.players[side].hand,...end.players[side].reserve].sort(),[...before.players[side].reserve].sort());
  const opponent=side==='dark'?'light':'dark',text=JSON.stringify(project(end,r,opponent));for(const id of end.players[side].hand)assert.equal(text.includes('"'+id+'"'),false);
 }
 assert.throws(()=>step(m,r,'begin','dark',()=>-1),/entropy/);assert.deepEqual(m,before);
 assert.equal('shuffleOrder' in project(end,r,'dark').setup,false);
});

test('80 randomized shuffles preserve both decks and private opening hands through reload',()=>{
 const r=rules();for(let seed=1;seed<=80;seed++){let x=seed;const entropy=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x};let m=select(start(r),r,'1_291','1_124');m=step(m,r,'place:separate');m=step(m,r,'begin','dark',entropy);m=activateBoundary(clone(m),r);assert.equal(m.turn.generation,3);assertState(m);assert.equal(new Set([...m.players.dark.reserve,...m.players.dark.hand]).size,59)}
});

test('ordinary setup supports 40-card format and sides with no eligible starting location',()=>{
 const r=rules();const d=decks().map(deck=>({...deck,cards:Array(40).fill(deck.side==='dark'?'1_194':'1_28')}));let m=start(r,d,40);assert.equal(m.setup.stage,'reveal');m=finish(m,r);
 assert.deepEqual(m.locations,[]);assert.deepEqual([m.players.dark.reserve.length,m.players.light.reserve.length],[32,32]);m=activateBoundary(m,r);assert.equal(m.turn.generation,1);
 const mixed=decks();mixed.find(d=>d.side==='dark').cards.fill('1_194');m=start(r,mixed);assert.equal(m.setup.committed.dark,true);m=step(m,r,'select:'+pick(m,r,'light','1_124'),'light');m=finish(step(m,r,'reveal'),r);assert.equal(m.locations.length,1);assert.equal(m.players.dark.reserve.length,52);
});

test('40-card decks with locations draw eight and continue with all 80 physical cards',()=>{
 const r=rules(),d=decks().map(deck=>({...deck,cards:[...deck.cards.filter(id=>!premiereSites[id]).slice(0,31),...deck.cards.filter(id=>premiereSites[id])]}));
 let m=select(start(r,d,40),r,'1_291','1_124');m=finish(m,r);
 assert.equal(Object.keys(m.cards).length,80);for(const side of ['dark','light']){assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].reserve.length,31)}
});

test('reselection has no fixture round limit and handles exhaustion without reusing a rejected copy',()=>{
 const r=rules(),d=decks().map(deck=>({...deck,cards:Array(60).fill(deck.side==='dark'?'1_285':'1_124')}));
 let m=start(r,d);for(let n=0;n<6;n++){m=select(m,r,'1_285','1_124');m=step(step(m,r,'decline'),r,'decline')}
 assert.equal(m.setup.rejected.length,6);assert.equal(candidates(m,r,'dark').length,54);m=finish(select(m,r,'1_285','1_124'),r);assert.equal(m.status,'playing');
 const single=decks().map(deck=>({...deck,cards:[deck.side==='dark'?'1_285':'1_124',...Array(59).fill(deck.side==='dark'?'1_194':'1_28')]}));
 m=select(start(r,single),r,'1_285','1_124');m=step(step(m,r,'decline'),r,'decline');assert.equal(m.setup.stage,'reveal');m=finish(m,r);assert.deepEqual(m.locations,[]);assert.equal(m.players.dark.reserve.length,52);
});

test('a failure during the second shuffle rolls back both decks and opening hands',()=>{
 const r=rules();let m=select(start(r),r,'1_291','1_124');m=step(m,r,'place:separate');const before=clone(m);let calls=0;
 assert.throws(()=>step(m,r,'begin','dark',()=>++calls===60?-1:42),/entropy/);assert.equal(calls,60);assert.deepEqual(m,before);
});

test('unsupported starting effects and premature gameplay remain gated',()=>{
 const r=rules({starting:{...premiereSetup,ordinarySetup:()=>false}});assert.throws(()=>start(r),/starting-card sequence/);
 const supported=rules(),m=start(supported);assert.throws(()=>startTurns(m,supported),/incomplete/);assert.throws(()=>step(m,supported,'core:activate','dark'),/Illegal/);
 const bad=clone(m);bad.setup.revealed=true;assert.throws(()=>prompt(bad,supported,'dark'),/disclosure/);
 const stale=step(m,supported,prompt(m,supported,'dark').choices[0].id,'dark');assert.throws(()=>applyCommand(stale,supported,'light',{revision:0,choice:prompt(stale,supported,'light').choices[0].id}),/Stale/);
});

test('concession during private starting choices keeps hidden selections private',()=>{
 const r=rules();let m=start(r);m=step(m,r,'select:'+pick(m,r,'dark','1_285'),'dark');m=step(m,r,'concede','light');assert.equal(m.result.winner,'dark');assert.equal(prompt(m,r,'dark'),null);assert.equal(project(m,r,'light').setup.selected.dark,null);
});
