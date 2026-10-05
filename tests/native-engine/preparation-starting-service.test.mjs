import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {rules,decks} from './preparation-starting-fixture.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
for(const side of ['light','dark'])for(const effects of [true,false])test(side+' human: saved CPU starting '+(effects?'deployment':'verification'),async t=>{
 const db=new SqliteD1();t.after(()=>db.close());const ds=decks({effects}),other=side==='light'?'dark':'light',fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,now:()=>1800000000000,entropy:()=>42});
 let v=await fresh().create('owner',{id:randomUUID(),mode:'cpu',side,deckSize:60,deck:ds.find(d=>d.side===side).cards,computerDeck:ds.find(d=>d.side===other).cards});
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state),seen=new Set();
 for(let n=0;n<100&&v.game.status==='setup';n++){
  const saved=read();v=await fresh().read(v.id,'owner');assert.deepEqual(read(),saved);assert.deepEqual(v.game.players[other].hand,[]);
  if(v.game.rules.startingSearch){const q=v.game.rules.startingSearch;seen.add(q.stage);if(v.game.prompt.side!==side)assert.deepEqual(q.cards,[]);}
  if(v.game.prompt?.choices.length){const choice=chooseComputerAction(v.game,side);const body={commandId:randomUUID(),revision:v.revision,choice};v=await fresh().command(v.id,'owner',body);const after=read();await fresh().command(v.id,'owner',body);assert.deepEqual(read(),after,'Duplicate request cannot deploy or verify twice');}
  v=await fresh().advanceComputer(v.id,'owner',{});
 }
 assert.equal(v.game.status,'playing');assert.deepEqual(read().data.preparationStarts,['dark-2','light-2']);assert.ok(seen.has('search'));if(!effects)assert.ok(seen.has('verify'));
 for(const s of ['light','dark']){assert.equal(read().cards[s+'-2'].zone,'lost');if(effects)assert.equal(read().cards[s+'-3'].zone,'table');assert.equal(read().players[s].hand.length,8);}
 await assert.rejects(fresh().read(v.id,'outsider'),e=>e.status===404);assert.deepEqual((await fresh().read(v.id,'owner')).game,v.game);
});
