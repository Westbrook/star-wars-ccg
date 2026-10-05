import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,deployed,mod,state,rules,pull,phase,step,ids,seek,priority} from './undercover-fixture.mjs';
const root=new URL('./gemp/',import.meta.url),observed=JSON.parse(fs.readFileSync(new URL('undercover-results.json',root)));
const undercover=mod('undercover-state'),board=mod('board');
for(const oracle of observed)test('native Undercover matches executed GEMP cycle: '+oracle.mode,()=>{
 const side=oracle.mode==='dark'?'dark':'light',opponent=side==='light'?'dark':'light',f=fixture({side,aboard:oracle.mode==='light-aboard'});
 const device=pull(f.m,side,side==='light'?'1_40':'1_207','table',f.site);f.m.cards[device].attachedTo=f.spy;
 const before=f.m.players[side].force.length;let m=deployed(f);
 const actual={deployCost:before-m.players[side].force.length,ownerUnchanged:m.cards[f.spy].owner===side,detached:!m.cards[f.spy].attachedTo,atSite:m.cards[f.spy].location===f.site,activeDefault:m.cards[f.spy].zone==='table',ownerOccupies:board.presence(m,side,f.site),deviceAttached:m.cards[device].attachedTo===f.spy};
 m=phase(m,opponent,'control');actual.opponentCanDrain=ids(m).includes('drain:'+f.site);
 m=priority(phase(m,opponent,'move'),side);const force=m.players[side].force.length,opposingForce=m.players[opponent].force.length;
 m=step(m,'undercover:move:'+f.spy+':'+f.to);m=seek(m,x=>x.cards[f.spy].location===f.to);
 Object.assign(actual,{moveOwnerCost:force-m.players[side].force.length,moveOpponentCost:opposingForce-m.players[opponent].force.length,regularMove:mod('ground').record(m).moved.includes(f.spy),undercoverAfterMove:undercover.activeUndercoverSpy(m,f.spy)});
 m=phase(m,side,'deploy');m=step(m,'undercover:break:'+f.spy);m=seek(m,x=>x.cards[f.effect].zone==='lost');state.assertState(m);rules.validate(m);
 Object.assign(actual,{coverBroken:!undercover.activeUndercoverSpy(m,f.spy),effectLost:m.cards[f.effect].zone==='lost',ownerSideRestored:m.cards[f.spy].owner===side&&m.cards[f.spy].zone==='table',deviceRetained:m.cards[device].zone==='table'&&m.cards[device].attachedTo===f.spy});
 for(const [key,value]of Object.entries(actual))assert.equal(value,oracle[key],key);
 // GEMP's physical side-crossing display and private drain-control flags have
 // no equivalent field in native state; compare public behavior above.
});
test('Undercover oracle receipt binds executed harness, results and unchanged production',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('undercover-provenance.json',root)));
 for(const [file,key]of [[receipt.harness,'harnessSha256'],[receipt.results,'resultsSha256'],[receipt.log,'logSha256']])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),receipt[key]);
 assert.equal(receipt.referenceCommit,'bbd94d183b29c2e82458293df0327c3b946f3d85');assert.equal(receipt.productionFilesCompared,6820);assert.equal(receipt.productionFilesChanged,0);assert.equal(receipt.execution.exitCode,0);assert.equal(receipt.execution.failures,0);assert.equal(receipt.execution.errors,0);assert.equal(receipt.execution.observedCases,observed.length);assert.equal(observed.length,3);
});
