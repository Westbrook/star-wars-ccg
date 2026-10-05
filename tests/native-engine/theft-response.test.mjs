import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,shipDecks} from './captured-ships-fixture.mjs';
import {runtime,rules,state,clone,ids,step,seek} from './prisoner-fixture.mjs';
const load=file=>JSON.parse(readFileSync(new URL('./gemp/'+file,import.meta.url)));
const receipt=load('theft-response-provenance.json'),rows=load('theft-response-results.json');

test('theft reference receipt binds executed candidate menus and the ownership discrepancy',()=>{
 assert.equal(receipt.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');
 assert.equal(receipt.productionFilesCompared,6820);assert.equal(receipt.productionFilesChanged,0);
 for(const [file,hash]of Object.entries(receipt.files))assert.equal(createHash('sha256').update(readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
 assert.equal(rows.length,1);assert.equal(receipt.executedCases,1);
 assert.equal(receipt.rules.printedPage,173);assert.match(receipt.rules.source,/SWCCG_2023_AdvancedRulebook\.pdf#page=173$/);
 assert.match(receipt.limitations.join(' '),/No non-empty theft response was executed/);
});

test('four actual theft windows reject generic responses despite a positive later action baseline',()=>{
 const row=rows[0],menus=row.trace.filter(t=>/^(ABOUT_TO_BE_STOLEN|STOLEN) -/.test(t.text));
 assert.equal(menus.length,4);
 assert.deepEqual(menus.map(t=>[t.text,t.side]),[
  ['ABOUT_TO_BE_STOLEN - Optional responses','Light Side Player'],['ABOUT_TO_BE_STOLEN - Optional responses','Dark Side Player'],
  ['STOLEN - Optional responses','Light Side Player'],['STOLEN - Optional responses','Dark Side Player']]);
 for(const menu of menus){assert.deepEqual(menu.parameters.actionId,[]);assert.deepEqual(menu.parameters.actionText,[]);assert.equal(menu.parameters.noPass[0],'false');}
 assert.equal(row.positiveTopLevelBaseline.text,'Choose Battle action or Pass');
 assert.ok(row.positiveTopLevelBaseline.parameters.actionText.includes('Shuffle card pile'));
 assert.ok(row.positiveTopLevelBaseline.parameters.actionText.includes('Add 2 to maneuver and 1 to power'));
});

test('reference retains intermediate attachment and exposes the official Effect ownership divergence',()=>{
 const row=rows[0],before=row.trace.find(t=>t.text.startsWith('ABOUT_TO_BE_STOLEN -')),during=row.trace.find(t=>t.text.startsWith('STOLEN -'));
 assert.equal(before.ship.captured,true);assert.equal(before.effect.owner,'Light Side Player');
 assert.equal(during.ship.captured,false);assert.equal(during.ship.owner,'Dark Side Player');assert.equal(during.ship.attachedTo,'1_302');
 assert.equal(during.effect.owner,'Dark Side Player');assert.equal(row.finalEffect.owner,'Dark Side Player');assert.equal(row.finalEffect.attachedTo,'1_147');
 assert.equal(row.finalShip.zone,'AT_LOCATION');assert.equal(row.finalShip.attachedTo,undefined);
 assert.equal(receipt.outcomes.effectOwnerOfficial,'Light Side Player');assert.notEqual(receipt.outcomes.effectOwnerOfficial,row.finalEffect.owner);
});

test('native supported candidates also remain unavailable during theft responses across refresh',()=>{
 // Foundation-only initial captured-ship state. This checks the same candidate
 // timing, not Special Modifications text or a complete shuffled game.
 const decks=shipDecks();
 for(const deck of decks)deck.cards.splice(-receipt.candidateCardsInHand[deck.side].length,receipt.candidateCardsInHand[deck.side].length,...receipt.candidateCardsInHand[deck.side]);
 const f=fixture(0,{decks});let m=f.m;
 for(const side of ['light','dark'])for(const bp of receipt.candidateCardsInHand[side])if(!m.players[side].hand.some(id=>m.cards[id].blueprint===bp))state.moveCard(m,Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp).id,'hand');
 for(const kind of ['about-to-steal','starship-stolen']){
  m=seek(m,x=>x.stack.at(-1)?.kind==='window'&&x.stack.at(-1).event?.kind===kind);
  const seen=new Set();
  while(m.stack.at(-1)?.kind==='window'&&m.stack.at(-1).event?.kind===kind){
   const view=runtime.project(m,rules,m.stack.at(-1).priority);seen.add(view.prompt.side);
   assert.deepEqual(ids(m),['pass']);assert.deepEqual(runtime.project(clone(m),rules,m.stack.at(-1).priority),view);m=step(m,'pass');
  }
  assert.equal(seen.size,2);
 }
 m=seek(m,x=>x.stack.at(-1)?.timing==='phase');
 assert.ok(ids(m).some(id=>id.startsWith('shuffle:')),'The same candidate becomes legal at a top-level action window');
});
