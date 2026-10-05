import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,rules,state,clone,pull,phase,step,seek,ids} from './prisoner-fixture.mjs';
import {bayFixture,deployBay,captureAtBay} from './ship-sites-fixture.mjs';

const refresh=m=>{for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));};
const settleLoss=m=>seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order'));

test('Launch Bay deployments consume the restricted-title per-turn allowance even after leaving play',()=>{
 const f=bayFixture();let m=f.m;
 for(let n=0;n<3;n++){
  m=deployBay(m,f.bay,f.host);
  mod('table').loseFromTable(m,[f.bay]);m=settleLoss(m);
  state.moveCard(m,f.bay,'hand');m=phase(m,'dark','deploy');
 }
 assert.equal(mod('persona').canPlayThisTurn(m,f.bay),false);
 assert.ok(!ids(m).some(id=>id.startsWith('ship-site:deploy:'+f.bay+':')));
 refresh(m);
});

for(const cause of ['lose','return','used','out'])test('a departing ship loses buried bay cards and attached residents: '+cause,()=>{
 const f=bayFixture();let m=deployBay(f.m,f.bay,f.host);
 const buried=pull(m,'dark','1_194','buried');m.cards[buried].location=f.bay;
 const resident=pull(m,'light','1_28','table',f.bay),weapon=f.gun;
 m.cards[weapon].attachedTo=resident;m.cards[weapon].location=f.bay;
 refresh(m);
 const table=mod('table');
 if(cause==='lose')table.loseFromTable(m,[f.host]);
 if(cause==='return')table.returnToHand(m,[f.host]);
 if(cause==='used')table.placeInUsedFromTable(m,f.host);
 if(cause==='out')table.placeOutFromTable(m,f.host);
 refresh(m);m=settleLoss(m);
 for(const id of [buried,resident,weapon,f.bay])assert.equal(m.cards[id].zone,'lost');
 assert.equal(m.cards[f.host].zone,{lose:'lost',return:'hand',used:'used',out:'out'}[cause]);
 refresh(m);
});

test('allowing buried bay dependents does not allow arbitrary buried roots in table losses',()=>{
 const f=bayFixture(),buried=pull(f.m,'dark','1_194','buried');f.m.cards[buried].location=f.site;
 const before=clone(f.m);assert.throws(()=>mod('table').loseFromTable(f.m,[buried]),/Invalid table loss/);assert.deepEqual(f.m,before);
});

test('three deployed bays enforce the on-table title limit across distinct ship groups',()=>{
 const f=bayFixture(),other=pull(f.m,'dark','1_302','table',f.site);
 let m=deployBay(f.m,f.bay,f.host);
 for(const host of [other,f.host]){const bay=pull(m,'dark','4_165','hand');m=phase(m,'dark','deploy');m=deployBay(m,bay,host);}
 const fourth=pull(m,'dark','1_194','hand');m.cards[fourth].blueprint='4_165';m=phase(m,'dark','deploy');
 assert.ok(!ids(m).some(id=>id.startsWith('ship-site:deploy:'+fourth+':')));refresh(m);
});

test('custody choices reject forged seats, stale targets, and choices at another host',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);
 const second=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');f.m=deployBay(f.m,second,f.host);
 const other=pull(f.m,'dark','1_302','table',f.site),third=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');f.m=deployBay(f.m,third,other);
 const m=captureAtBay(f);assert.equal(m.stack.at(-1).handler,'tractor:custody');
 assert.ok(!ids(m).includes('tractor:custody:'+third));assert.throws(()=>step(m,'tractor:custody:'+third));
 for(const corrupt of [x=>x.stack.at(-1).side='light',x=>x.stack.at(-1).payload.target.version=0,x=>x.stack.at(-1).payload.host.id=other]){const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.project(bad,rules,'dark'));}
 refresh(m);
});
