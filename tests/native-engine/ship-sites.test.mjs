import test from 'node:test';import assert from 'node:assert/strict';
import {mod,runtime,rules,state,clone,pull,phase,step,seek,ids} from './prisoner-fixture.mjs';
import {bayFixture,deployBay,captureAtBay} from './ship-sites-fixture.mjs';
const refresh=m=>{for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));};
test('nonunique Launch Bay deploys against one concrete Star Destroyer and stays separate from its system',()=>{
 const f=bayFixture(),other=pull(f.m,'dark','1_302','table',f.site);assert.equal(ids(f.m).filter(id=>id.startsWith('ship-site:deploy:')).length,2);
 let m=step(f.m,ids(f.m).find(id=>id.startsWith('ship-site:deploy:'+f.bay+':'+f.host+':')));refresh(m);m=seek(m,x=>x.cards[f.bay].zone==='table');assert.equal(mod('ship-sites').relatedShip(m,f.bay),f.host);assert.equal(mod('board').system(m,f.bay),undefined);assert.equal(mod('location-icons').forceIcons(m,f.bay,'dark'),1);assert.equal(mod('board').adjacent(m,f.bay,f.site),false);refresh(m);
});
test('departure during pending bay deployment does not attach to a returned ship instance',()=>{
 const f=bayFixture();let m=step(f.m,ids(f.m).find(id=>id.startsWith('ship-site:deploy:')));mod('table').returnToHand(m,[f.host]);state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;m=seek(m,x=>x.cards[f.bay].zone==='lost');assert.equal(mod('ship-sites').relatedShip(m,f.bay),undefined);refresh(m);
});
test('real tractor beam capture redirects to a deployed related bay',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);let m=captureAtBay(f);assert.equal(m.cards[f.ship].capturedShip.host,f.bay);assert.equal(m.cards[f.ship].location,f.bay);assert.equal(m.cards[f.beam].attachedTo,f.host);assert.equal(m.cards[f.ship].capturedShip.pending,undefined);refresh(m);
 mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');m=step(m,'captured-ship:launch:'+f.site);assert.equal(m.cards[f.ship].location,f.site);refresh(m);
});
test('multiple bays create a durable custody choice and only the selected bay holds the ship',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);const second=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');f.m=deployBay(f.m,second,f.host);let m=captureAtBay(f);assert.equal(m.stack.at(-1)?.handler,'tractor:custody');assert.deepEqual(ids(m).sort(),[f.bay,second].map(id=>'tractor:custody:'+id).sort());refresh(m);m=step(m,'tractor:custody:'+second);assert.equal(m.cards[f.ship].capturedShip.host,second);assert.equal(mod('board').adjacent(m,f.bay,second),true);refresh(m);
});
test('deploying a bay after capture never relocates an existing captured ship',()=>{
 const f=bayFixture();mod('captured-ships').captureStarship(f.m,f.ship,f.host);let m=phase(f.m,'dark','deploy');m=deployBay(m,f.bay,f.host);assert.equal(m.cards[f.ship].capturedShip.host,f.host);refresh(m);
});
for(const cause of ['lose','return','used','out'])test('related nonunique bay, occupants and captured group are lost when host departs: '+cause,()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);let m=captureAtBay(f);const guard=pull(m,'dark','1_194','table',f.bay);const table=mod('table');
 if(cause==='lose')table.loseFromTable(m,[f.host]);if(cause==='return')table.returnToHand(m,[f.host]);if(cause==='used')table.placeInUsedFromTable(m,f.host);if(cause==='out')table.placeOutFromTable(m,f.host);
 assert.ok(!m.locations.includes(f.bay));m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order'));for(const id of [f.bay,f.ship,...f.characters,f.gun,guard])assert.equal(m.cards[id].zone,'lost');assert.equal(m.cards[f.host].zone,{lose:'lost',return:'hand',used:'used',out:'out'}[cause]);refresh(m);
});
test('bay residents do not count as characters aboard the captured cockpit for stealing',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);const hero=pull(f.m,'light','1_13','table',f.bay);let m=captureAtBay(f);assert.deepEqual(mod('captured-ship-state').trappedCharacters(m,f.ship).map(c=>c.id).sort(),f.characters.slice().sort());assert.ok(!mod('occupancy').unitsAt(m,f.site).some(c=>c.id===hero));refresh(m);
});
test('ship-site state rejects forged relationship, host or pending deploy bindings',()=>{
 const f=bayFixture();let m=deployBay(f.m,f.bay,f.host);for(const corrupt of [x=>x.data.shipSites[f.bay].host.id=f.ship,x=>x.data.shipSites[f.bay].host.version=999,x=>delete x.data.shipSites]){const bad=clone(m);corrupt(bad);assert.throws(()=>runtime.project(bad,rules,'light'));}
});

test('actual hyperspace movement carries the relationship but keeps bay occupants below decks',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);let m=captureAtBay(f);const yavin=pull(m,'light','1_135');m.locations.push(yavin);const resident=pull(m,'dark','1_194','table',f.bay);m=phase(m,'dark','move');m=step(m,'voyage:hyperspace:'+f.host+':'+yavin);refresh(m);m=seek(m,x=>x.cards[f.host].location===yavin);
 assert.equal(m.cards[resident].location,f.bay);assert.equal(m.cards[f.ship].location,f.bay);assert.ok(!mod('occupancy').unitsAt(m,yavin).some(c=>c.id===resident));mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');assert.ok(ids(m).includes('captured-ship:launch:'+yavin));assert.ok(!ids(m).includes('captured-ship:launch:'+f.site));m=step(m,'captured-ship:launch:'+yavin);assert.equal(m.cards[f.ship].location,yavin);refresh(m);
});
test('a suppressed Launch Bay does not redirect new capture; its relationship still exists',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);mod('game-text').suppressGameText(f.m,f.host,f.bay);const m=captureAtBay(f);assert.equal(m.cards[f.ship].capturedShip.host,f.host);assert.equal(mod('ship-sites').relatedShip(m,f.bay),f.host);refresh(m);
});
test('a different Star Destroyer cannot hold the ship at an unrelated bay',()=>{
 const f=bayFixture();f.m=deployBay(f.m,f.bay,f.host);const other=pull(f.m,'dark','1_302','table',f.site);f.m.cards[f.beam].attachedTo=other;assert.throws(()=>mod('captured-ships').captureStarship(f.m,f.ship,f.bay));
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observed=JSON.parse(fs.readFileSync(new URL('./gemp/ship-sites-results.json',import.meta.url)));
for(const row of observed)test('matches executed GEMP ship-site custody: '+row.name,()=>{
 const f=bayFixture();let extra;
 if(row.name!=='late-bay')f.m=deployBay(f.m,f.bay,f.host);
 if(row.name==='two-bays'){extra=pull(f.m,'dark','4_165','hand');f.m=phase(f.m,'dark','deploy');f.m=deployBay(f.m,extra,f.host);}
 let m=captureAtBay(f);const choseBay=m.stack.at(-1)?.handler==='tractor:custody';if(choseBay)m=step(m,'tractor:custody:'+extra);
 const result={name:row.name,heldAtBay:[f.bay,extra].includes(m.cards[f.ship].capturedShip.host),choseBay,beamOnShip:m.cards[f.beam].attachedTo===f.host};
 if(row.name==='late-bay'){m=phase(m,'dark','deploy');m=deployBay(m,f.bay,f.host);result.retainedOriginalCustody=m.cards[f.ship].capturedShip.host===f.host;}
 if(row.name==='host-loss'){mod('table').loseFromTable(m,[f.host]);m=seek(m,x=>!x.stack.some(f=>f.kind==='decision'&&f.handler==='table:lost-order'));result.bayLost=m.cards[f.bay].zone==='lost';result.shipLost=m.cards[f.ship].zone==='lost';result.gunLost=m.cards[f.gun].zone==='lost';}
 if(row.name==='release'){mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');m=step(m,'captured-ship:launch:'+f.site);result.releasedAtSystem=!m.cards[f.ship].capturedShip&&m.cards[f.ship].location===f.site;}
 assert.deepEqual(result,row);refresh(m);
});
test('ship-site receipt binds executed outcomes and unchanged reference production files',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/ship-sites-provenance.json',import.meta.url)));assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(observed.length,4);
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
});
