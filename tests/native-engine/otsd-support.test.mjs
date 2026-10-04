import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,pull,state,rules,runtime,clone,ids,step,seek,priority,settled,load} from './vessels-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const board=mod('board'),chars=mod('otsd-characters'),search=mod('alien-search'),traits=mod('characteristics');
import {setup,deployedSearch} from './otsd-support-fixture.mjs';
const table=(f,side,bp,site=f.site)=>pull(f.m,side,bp,'table',site);
const boundary=(m,event)=>seek(m,x=>x.stack.at(-1)?.event?.kind===event);
const cfg=side=>side==='light'?{source:'106_1',recruit:'106_6',troop:'1_28',leader:'1_8',alien:'1_31',corulag:'106_2',guard:'1_26'}:{source:'106_11',recruit:'106_16',troop:'1_194',leader:'1_179',alien:'1_196',corulag:'106_12',guard:'1_181'};
for(const side of ['light','dark']){
 test(side+' real alien deployment offers one private search, selected reveal, hand delivery and shuffle',()=>{
  const f=deployedSearch(side),begin='alien-search:begin:'+f.source;assert.ok(ids(f.m).includes(begin));
  let m=seek(step(f.m,begin),x=>x.stack.at(-1)?.handler==='alien-search:choose');const own=search.alienSearchView(m,side).alienSearch;assert.equal(own.stage,'search');assert.equal(own.cards.length,m.players[side].reserve.length);assert.equal(search.alienSearchView(m,side==='light'?'dark':'light').alienSearch,null);
  const target=m.players[side].reserve.find(id=>m.cards[id].blueprint===cfg(side).alien);assert.ok(ids(m).includes('alien-search:take:'+target));const before=[...m.players[side].reserve];m=step(clone(m),'alien-search:take:'+target);
  assert.equal(search.alienSearchView(m,'light').alienSearch.cards[0].id,target);assert.equal(search.alienSearchView(m,'dark').alienSearch.cards.length,1);
  m=boundary(m,'card-taken-into-hand');assert.equal(m.cards[target].zone,'hand');m=boundary(m,'reserve-shuffled');assert.deepEqual([...m.players[side].reserve].sort(),before.filter(id=>id!==target).sort());m=settled(m);assert.ok(!ids(m).includes(begin));rules.validate(clone(m));
 });
 test(side+' failed alien search verifies only when no legal card exists and records turn restriction',()=>{
  const f=deployedSearch(side);for(const id of [...f.m.players[side].reserve])if(mod('definitions').cardDefinition(f.m,id).subType==='Alien'&&traits.nonUnique(f.m,id))state.moveCard(f.m,id,'hand');
  let m=seek(step(f.m,'alien-search:begin:'+f.source),x=>x.stack.at(-1)?.handler==='alien-search:choose');assert.deepEqual(ids(m),['alien-search:not-found']);assert.equal(search.alienSearchView(m,side==='light'?'dark':'light').alienSearch,null);
  m=step(m,'alien-search:not-found');assert.equal(search.alienSearchView(m,'dark').alienSearch.stage,'verify');assert.equal(search.alienSearchView(m,'light').alienSearch.stage,'verify');m=settled(step(clone(m),'alien-search:verified'));assert.equal(m.data.failedSearches.length,1);assert.equal(m.data.failedSearches[0].blueprint,cfg(side).source);
 });
 test(side+' declining deployment search does not inspect or change Reserve',()=>{const f=deployedSearch(side),before=[...f.m.players[side].reserve];const m=settled(f.m);assert.deepEqual(m.players[side].reserve,before);assert.equal(m.data.failedSearches,undefined);});
 test(side+' recruit/cadet is not a leader; deploy free only with faction leader',()=>{
  const f=setup(side),c=cfg(side),card=pull(f.m,side,c.recruit,'hand'),second=table(f,side,c.recruit);assert.equal(traits.hasCharacteristic(f.m,second,'LEADER'),false);assert.deepEqual(board.deploymentPayment(f.m,card,f.site),{[side]:1});assert.equal(chars.otsdClearsAttrition(f.m,second),false);
  const leader=side==='dark'?f.pilot:pull(f.m,side,c.leader,'hand');state.moveCard(f.m,leader,'table');f.m.cards[leader].location=f.site;assert.deepEqual(board.deploymentPayment(f.m,card,f.site),{[side]:0});const before=f.m.players[side].force.length;let m=settled(step(f.m,'deploy:'+card+':'+f.site));assert.equal(m.players[side].force.length,before);assert.equal(chars.otsdClearsAttrition(m,card),true);
 });
 test(side+' optional power boost survives source departure, expires with turn and is noncumulative',()=>{
  const f=setup(side),c=cfg(side),source=table(f,side,c.recruit),second=table(f,side,c.recruit),target=table(f,side,c.troop),base=board.power(f.m,target),action='recruit:'+source+':'+target;
  let m=settled(step(f.m,action));assert.equal(board.power(m,target),base+1);m=priority(m,side);assert.ok(!ids(m).includes(action));m=settled(step(m,'recruit:'+second+':'+target));assert.equal(board.power(m,target),base+1);state.moveCard(m,source,'lost');state.moveCard(m,second,'lost');assert.equal(board.power(m,target),base+1);m.turn.number++;assert.equal(board.power(m,target),base);rules.validate(clone(m));
 });
 test(side+' recruit target leaving and returning cannot inherit pending boost',()=>{
  const f=setup(side),c=cfg(side),source=table(f,side,c.recruit),target=table(f,side,c.troop),base=board.power(f.m,target);let m=step(f.m,'recruit:'+source+':'+target);state.moveCard(m,target,'hand');state.moveCard(m,target,'table');m.cards[target].location=f.site;m=settled(m);assert.equal(board.power(m,target),base);
 });
 test(side+' forfeit clears all attrition but credits only printed forfeit to battle damage',()=>{
  const f=setup(side,'battle'),c=cfg(side),source=table(f,side,c.recruit);table(f,side,c.troop);const enemy=side==='light'?'dark':'light';table(f,enemy,cfg(enemy).troop);
  let m=priority(boundary(step(f.m,'battle:'+f.site),'battle-damage'),side);const b=m.data.battle;b.damage[side]=8;b.initialDamage[side]=8;b.damageLedger[side]=mod('loss').lossLedger(8,'battle');b.attrition[side]=7;b.initialAttrition[side]=7;
  assert.ok(ids(m).includes('forfeit:'+source));m=seek(step(clone(m),'forfeit:'+source),x=>x.cards[source].zone==='lost');assert.equal(m.data.battle.attrition[side],0);assert.equal(mod('battle').battleDamage(m,side),7);rules.validate(clone(m));
 });
 test(side+' Corulag increases all nonunique faction power/forfeit and lets guards move only while controlled',()=>{
  const f=setup(side,'move'),c=cfg(side),loc=table(f,side,c.corulag);f.m.locations.push(loc);const target=table(f,side,c.troop),guard=table(f,side,c.guard),bp=board.power(f.m,target),bf=board.forfeit(f.m,target);
  assert.equal(mod('otsd-locations').corulagAllowsGuardMove(f.m,guard),false);const ship=table(f,side,side==='light'?'106_7':'106_13',loc);assert.equal(board.controls(f.m,side,loc),true);assert.equal(board.power(f.m,target),bp+1);assert.equal(board.forfeit(f.m,target),bf+1);assert.equal(mod('otsd-locations').corulagAllowsGuardMove(f.m,guard),true);
  state.moveCard(f.m,ship,'lost');assert.equal(board.power(f.m,target),bp);assert.equal(mod('otsd-locations').corulagAllowsGuardMove(f.m,guard),false);
 });
}
test('alien discounts reduce both Jawa payments, but own Jawa Camp resets deployment to one',()=>{
 const f=setup(),source=table(f,'light','106_1'),jawa=pull(f.m,'light','1_12','hand');assert.deepEqual(board.deploymentPayment(f.m,jawa,f.site),{dark:0,light:0});const camp=table(f,'light','1_131');f.m.locations.unshift(camp);assert.deepEqual(board.deploymentPayment(f.m,jawa,camp),{light:1});mod('game-text').suppressGameText(f.m,source,source);assert.deepEqual(board.deploymentPayment(f.m,jawa,f.site),{dark:1,light:1});
});
test('Moisture Farm and Tusken Camp drain bonuses distinguish controllers and present equipment',()=>{
 const f=setup(),farm=table(f,'light','106_8'),camp=table(f,'dark','106_18');f.m.locations.push(farm,camp);table(f,'light','1_28',farm);table(f,'dark','1_194',camp);const locations=mod('otsd-locations');assert.equal(locations.otsdDrainModifier(f.m,'light',farm),1);assert.equal(locations.otsdDrainModifier(f.m,'dark',camp),1);
 const vapor=table(f,'light','1_41',farm);f.m.cards[vapor].attachedTo=farm;assert.equal(locations.otsdDrainModifier(f.m,'light',farm),2);const stick=table(f,'dark','1_315',camp);assert.equal(locations.otsdDrainModifier(f.m,'dark',camp),2);mod('game-text').suppressGameText(f.m,camp,camp);assert.equal(locations.otsdDrainModifier(f.m,'dark',camp),0);
});
for(const side of ['light','dark']){
 test(side+' canceled boost consumes usage without increasing power',()=>{const f=setup(side),c=cfg(side),source=table(f,side,c.recruit),target=table(f,side,c.troop),base=board.power(f.m,target);let m=step(f.m,'recruit:'+source+':'+target);m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='recruit:boost').cancelled=true;m=priority(settled(m),side);assert.equal(board.power(m,target),base);assert.ok(!ids(m).includes('recruit:'+source+':'+target));});
 test(side+' alien search requires deployment rather than table entry and an eligible timing window',()=>{const f=setup(side),source=table(f,side,cfg(side).source),w=f.m.stack[0];assert.deepEqual(search.alienSearchActions(f.m,w,side),[]);assert.deepEqual(search.alienSearchActions(f.m,{...w,timing:'response',event:{kind:'deployed',card:source}},side),[]);});
 test(side+' search remains optional with no Reserve and cannot expose an opponent pile',()=>{const f=deployedSearch(side);for(const id of [...f.m.players[side].reserve])state.moveCard(f.m,id,'hand');assert.ok(!ids(f.m).some(id=>id.startsWith('alien-search:')));assert.equal(search.alienSearchView(f.m,side).alienSearch,null);});
 test(side+' forfeiture helper excludes another recruit/cadet and respects disabled text',()=>{const f=setup(side),c=cfg(side),source=table(f,side,c.recruit);table(f,side,c.recruit);assert.equal(chars.otsdClearsAttrition(f.m,source),false);const veteran=table(f,side,c.troop);assert.equal(chars.otsdClearsAttrition(f.m,source),true);mod('game-text').suppressGameText(f.m,veteran,source);assert.equal(chars.otsdClearsAttrition(f.m,source),false);});
}
const {default:fs}=await import('node:fs');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/otsd-support-results.json',import.meta.url)));
for(const row of oracle)test('executed GEMP OTSD support comparison '+JSON.stringify(row),()=>{
 const side=row.dark?'dark':'light';
 if(row.kind==='search'){const f=deployedSearch(side),target=f.m.players[side].reserve.find(id=>f.m.cards[id].blueprint===row.target);let m=seek(step(f.m,'alien-search:begin:'+f.source),x=>x.stack.at(-1)?.handler==='alien-search:choose');m=settled(step(m,'alien-search:take:'+target));assert.deepEqual({kind:'search',dark:row.dark,target:row.target,inHand:m.cards[target].zone==='hand'},row);return;}
 const f=setup(side),c=cfg(side),source=pull(f.m,side,c.recruit,'hand'),target=table(f,side,c.troop);if(row.leader){const leader=side==='dark'?f.pilot:pull(f.m,side,c.leader,'hand');state.moveCard(f.m,leader,'table');f.m.cards[leader].location=f.site;}
 const before=f.m.players[side].force.length,base=board.power(f.m,target);let m=priority(settled(step(f.m,'deploy:'+source+':'+f.site)),side);const cost=before-m.players[side].force.length;m=settled(step(m,'recruit:'+source+':'+target));assert.deepEqual({kind:'recruit',dark:row.dark,leader:row.leader,cost,powerBonus:board.power(m,target)-base,clearsAttrition:chars.otsdClearsAttrition(m,source)},row);
});
test('OTSD support reference receipt binds actual source and outcomes',async()=>{const {createHash}=await import('node:crypto');const p=JSON.parse(fs.readFileSync(new URL('./gemp/otsd-support-provenance.json',import.meta.url)));for(const [f,sha] of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+f,import.meta.url))).digest('hex'),sha);assert.equal(oracle.length,p.observations);});
test('saved search cannot be rebound to an unrelated response',()=>{const f=deployedSearch('light');let m=seek(step(f.m,'alien-search:begin:'+f.source),x=>x.stack.at(-1)?.handler==='alien-search:choose');m.stack.find(x=>x.event?.kind==='deployed').event={kind:'card-lost',card:f.source};assert.throws(()=>rules.validate(m),/search origin/);});
for(const side of ['light','dark']){
 test(side+' Corulag guard moves through the paid movement action, then loses permission when control ends',()=>{const f=setup(side,'move'),c=cfg(side),loc=table(f,side,c.corulag),to=table(f,'light','106_8');f.m.locations.push(loc);f.m.locations.splice(1,0,to);const guard=table(f,side,c.guard),ship=table(f,side,side==='light'?'106_7':'106_13',loc),before=f.m.players[side].force.length;assert.ok(ids(f.m).includes('move:'+guard+':'+to));let m=settled(step(f.m,'move:'+guard+':'+to));assert.equal(m.cards[guard].location,to);assert.equal(m.players[side].force.length,before-1);state.moveCard(m,ship,'lost');assert.equal(mod('ground').canMove(m,guard),false);});
 test(side+' alien pilot supplies two power while acting as pilot',()=>{const f=setup(side),id=table(f,side,cfg(side).source,f.planet),ship=table(f,side,side==='light'?'106_7':'106_13',f.planet);Object.assign(f.m.cards[id],{attachedTo:ship,aboardRole:'pilot'});assert.equal(mod('piloting').pilotPowerBonus(f.m,id),2);f.m.cards[id].aboardRole='passenger';assert.equal(mod('piloting').pilotPowerBonus(f.m,id),0);});
 test(side+' Corulag adverse-side text reduces the opposing controller drain',()=>{const f=setup(side),enemy=side==='light'?'dark':'light',loc=table(f,enemy,cfg(enemy).corulag);f.m.locations.push(loc);table(f,side,side==='light'?'106_7':'106_13',loc);assert.equal(mod('otsd-locations').otsdDrainModifier(f.m,side,loc),-1);assert.equal(board.drainAmount(f.m,side,loc),1);});
}
