import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,clone,pull,ids,step,seek,phase} from './prisoner-fixture.mjs';
import {ending} from './captured-ships-fixture.mjs';
import {siteFixture,deployedSiteBeam,siteBeamEnding,setBeamDestinies,capturedAtSite} from './site-capture-fixture.mjs';
const refresh=m=>{for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));};
for(const lightBay of [false,true])test('Death Star Tractor Beam deploys to either printed bay and captures after two draws '+lightBay,()=>{
 const f=siteFixture(lightBay),before=f.m.players.dark.force.length;f.m=deployedSiteBeam(f);assert.equal(f.m.players.dark.force.length,before-2);assert.equal(f.m.cards[f.beam].location,f.bay);
 let m=ending(f),force=m.players.dark.force.length;const drawn=setBeamDestinies(m);
 m=step(m,'tractor:use:'+f.beam+':'+f.bay);m=seek(m,x=>!!x.cards[f.ship].capturedShip);refresh(m);
 assert.equal(m.players.dark.force.length,force-2);assert.equal(m.cards[f.ship].capturedShip.host,f.bay);assert.equal(m.cards[f.ship].location,f.bay);assert.ok([...f.characters,f.gun].every(id=>m.cards[id].location===f.bay&&m.cards[id].zone==='inactive'));assert.ok(drawn.every(id=>m.players.dark.used.includes(id)));
 m=phase(m,'light','move');for(const id of f.characters)assert.ok(ids(m).includes('vessel:escape:'+id+':'+f.ship));
});
for(const bps of [['1_194','1_194'],['2_142','1_194'],['1_241','1_194']])test('two-destiny sum determines capture '+bps.join(','),()=>{
 const f=siteFixture();let m=siteBeamEnding(f),depth=m.stack.length;const drawn=setBeamDestinies(m,bps);m=step(m,'tractor:use:'+f.beam+':'+f.bay);m=seek(m,x=>!!x.cards[f.ship].capturedShip||x.stack.length===depth);assert.equal(!!m.cards[f.ship].capturedShip,bps[0]==='1_241');assert.ok(drawn.every(id=>m.players.dark.used.includes(id)));refresh(m);
});
test('trapped crew disembark separately for free; last departure steals ship and preserves equipment',()=>{
 const f=siteFixture(true);let m=phase(capturedAtSite(f),'light','move');const force=m.players.light.force.length,versions=f.characters.map(id=>mod('identity').cardVersion(m,id));
 for(const [i,id]of f.characters.entries()){
  const choice='vessel:escape:'+id+':'+f.ship;assert.ok(ids(m).includes(choice));assert.equal(mod('computer').chooseComputerAction(runtime.project(m,rules,'light'),'light').startsWith('vessel:escape:'),true);
  m=step(m,choice);refresh(m);m=seek(m,x=>x.cards[id].zone==='table');assert.equal(m.cards[id].location,f.bay);assert.equal(m.cards[id].attachedTo,undefined);assert.equal(m.cards[id].aboardRole,undefined);assert.equal(mod('identity').cardVersion(m,id),versions[i]);assert.equal(m.players.light.force.length,force);
  if(!i){assert.equal(m.cards[f.ship].owner,'light');assert.equal(m.cards[f.characters[1]].zone,'inactive');assert.equal(m.cards[f.gun].zone,'table');assert.equal(m.cards[f.gun].attachedTo,id);m=seek(m,x=>ids(x).includes('vessel:escape:'+f.characters[1]+':'+f.ship));}
 }
 m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:steal');refresh(m);m=step(m,'captured-ship:launch:'+f.site);assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[f.ship].location,f.site);assert.ok(f.characters.every(id=>m.cards[id].location===f.bay&&m.cards[id].owner==='light'));refresh(m);
});
for(const blocker of ['character','droid','contested'])test('Dark occupation blocks trapped disembarking; '+blocker,()=>{
 const f=siteFixture();let m=phase(capturedAtSite(f),'light','move');pull(m,'dark',blocker==='droid'?'1_175':'1_168','table',f.bay);if(blocker==='contested')pull(m,'light','1_13','table',f.bay);
 assert.equal(mod('board').presence(m,'dark',f.bay),blocker!=='droid');assert.equal(ids(m).some(id=>id.startsWith('vessel:escape:')),blocker==='droid');refresh(m);
});
test('response that occupies bay prevents an initiated disembarkation',()=>{
 const f=siteFixture();let m=phase(capturedAtSite(f),'light','move');m=step(m,'vessel:escape:'+f.characters[0]+':'+f.ship);pull(m,'dark','1_168','table',f.bay);m=seek(m,x=>!x.stack.some(f=>f.kind==='resolution'&&f.action.handler==='vessel:escape'));assert.equal(m.cards[f.characters[0]].zone,'inactive');assert.equal(m.cards[f.characters[0]].attachedTo,f.ship);refresh(m);
});
test('disembarkation is unavailable during deploy, opponent turn and away from a site',()=>{
 const f=siteFixture();let m=capturedAtSite(f);assert.ok(!ids(m).some(id=>id.startsWith('vessel:escape:')));m=phase(m,'light','deploy');assert.ok(!ids(m).some(id=>id.startsWith('vessel:escape:')));
});
test('captured crew continuation rejects forged custody, payment and identity',()=>{
 const f=siteFixture();let m=phase(capturedAtSite(f),'light','move');m=step(m,'vessel:escape:'+f.characters[0]+':'+f.ship);
 for(const corrupt of [r=>r.action.payload.custody.id=f.site,r=>r.action.payload.source.zone='table',r=>r.action.payload.target.zone='table',r=>r.action.payload.previous='bad',r=>r.action.payment={light:1}]){const bad=clone(m),r=bad.stack.find(f=>f.kind==='resolution'&&f.action.handler==='vessel:escape');corrupt(r);assert.throws(()=>runtime.project(bad,rules,'light'));}
});
test('losing site beam offers release to Death Star system or Used',()=>{
 const f=siteFixture();let m=capturedAtSite(f);mod('table').loseFromTable(m,[f.beam]);m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:release');assert.deepEqual(ids(m).sort(),['captured-ship:escape','captured-ship:launch:'+f.site].sort());m=step(m,'captured-ship:launch:'+f.site);assert.equal(m.cards[f.ship].zone,'table');assert.equal(m.cards[f.ship].location,f.site);assert.equal(m.cards[f.gun].location,f.site);refresh(m);
});

for(const remaining of [0,1])test('two-destiny beam handles Reserve exhaustion after '+remaining+' possible draws',()=>{
 const f=siteFixture();let m=siteBeamEnding(f);const [kept]=setBeamDestinies(m);for(const id of [...m.players.dark.reserve])if(!remaining||id!==kept)state.moveCard(m,id,'used');const depth=m.stack.length;
 m=step(m,'tractor:use:'+f.beam+':'+f.bay);m=seek(m,x=>!!x.cards[f.ship].capturedShip||x.stack.length===depth);assert.equal(!!m.cards[f.ship].capturedShip,remaining===1);refresh(m);
});
test('captured crew cannot re-embark on the held ship after disembarking',()=>{
 const f=siteFixture();let m=phase(capturedAtSite(f),'light','move');m=step(m,'vessel:escape:'+f.characters[0]+':'+f.ship);m=seek(m,x=>x.stack.length===1&&x.stack.at(-1)?.priority==='light');assert.equal(m.cards[f.characters[0]].zone,'table');assert.ok(!ids(m).some(id=>id.startsWith('vessel:embark:'+f.characters[0]+':'+f.ship)));
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const observed=JSON.parse(fs.readFileSync(new URL('./gemp/site-capture-results.json',import.meta.url)));
for(const row of observed)test('matches executed GEMP site capture: '+row.name,()=>{
 const f=siteFixture(row.name==='light-bay');
 if(['guard','contested'].includes(row.name))pull(f.m,'dark','1_168','table',f.bay);
 if(row.name==='droid')pull(f.m,'dark','1_175','table',f.bay);
 if(row.name==='contested')pull(f.m,'light','1_13','table',f.bay);
 const deployBefore=f.m.players.dark.force.length;f.m=deployedSiteBeam(f);const deployCost=deployBefore-f.m.players.dark.force.length;
 let m=ending(f),depth=m.stack.length;setBeamDestinies(m,row.name==='miss'?['1_194','1_194']:['1_241','1_194']);const force=m.players.dark.force.length;
 m=step(m,'tractor:use:'+f.beam+':'+f.bay);m=seek(m,x=>!!x.cards[f.ship].capturedShip||x.stack.length===depth);
 const result={name:row.name,deployCost,useCost:force-m.players.dark.force.length,captured:!!m.cards[f.ship].capturedShip,heldAtBay:m.cards[f.ship].attachedTo===f.bay};
 if(result.captured){
  if(row.name==='convert'){const replacement=pull(m,'light','1_124','hand');m=phase(m,'light','deploy');m=step(m,ids(m).find(id=>id.startsWith('site:'+replacement+':')));m=seek(m,x=>x.cards[replacement].zone==='table');f.bay=replacement;result.conversionPreservesCustody=m.cards[f.ship].capturedShip.host===replacement&&m.cards[f.beam].attachedTo===replacement;}
  m=phase(m,'light','move');result.disembark=ids(m).includes('vessel:escape:'+f.characters[0]+':'+f.ship);
  if(result.disembark){
   const force=m.players.light.force.length;m=step(m,'vessel:escape:'+f.characters[0]+':'+f.ship);m=seek(m,x=>x.cards[f.characters[0]].zone==='table');result.firstCost=force-m.players.light.force.length;result.gunAttached=m.cards[f.gun].attachedTo===f.characters[0];result.stillCaptured=!!m.cards[f.ship].capturedShip;
   m=seek(m,x=>ids(x).includes('vessel:escape:'+f.characters[1]+':'+f.ship));m=step(m,'vessel:escape:'+f.characters[1]+':'+f.ship);m=seek(m,x=>x.stack.at(-1)?.kind==='decision'&&x.stack.at(-1)?.handler==='captured-ship:steal');m=step(m,'captured-ship:launch:'+f.site);
   result.stolenAfterLast=m.cards[f.ship].owner==='dark';result.bothAtBay=f.characters.every(id=>m.cards[id].location===f.bay&&!m.cards[id].attachedTo);
  }
 }
 assert.deepEqual(result,row);refresh(m);
});
test('site capture receipt binds unchanged production engine and executed outcomes',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/site-capture-provenance.json',import.meta.url)));assert.equal(p.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);assert.equal(observed.length,7);
 for(const [file,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);
});

test('converting the holding bay retains beam, inactive crew, custody and later disembarkation',()=>{
 const f=siteFixture();let m=capturedAtSite(f);const replacement=pull(m,'light','1_124','hand');m=phase(m,'light','deploy');const deploy=ids(m).find(id=>id.startsWith('site:'+replacement+':'));assert.ok(deploy);m=step(m,deploy);m=seek(m,x=>x.cards[replacement].zone==='table');refresh(m);
 assert.equal(m.cards[f.bay].coveredBy,replacement);assert.equal(m.cards[f.ship].capturedShip.host,replacement);assert.equal(m.cards[f.ship].attachedTo,replacement);assert.equal(m.cards[f.beam].attachedTo,replacement);assert.ok([f.ship,...f.characters,f.gun,f.beam].every(id=>m.cards[id].location===replacement));
 m=phase(m,'light','move');assert.ok(ids(m).includes('vessel:escape:'+f.characters[0]+':'+f.ship));m=step(m,'vessel:escape:'+f.characters[0]+':'+f.ship);m=seek(m,x=>x.cards[f.characters[0]].zone==='table');assert.equal(m.cards[f.characters[0]].location,replacement);refresh(m);
});
