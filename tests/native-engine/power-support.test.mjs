import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,attach,enhance,drawing,board,state,support,text,step,seek,priority,clone,ids,prompt,rules,pull,load} from './power-support-fixture.mjs';
for(const side of ['light','dark']){
 test(side+' power droid deploys for one and enhances other droids noncumulatively',()=>{
  const f=fixture(side),base=board.power(f.m,f.target),force=f.m.players[side].force.length;
  let m=step(f.m,'deploy:'+f.power+':'+f.site);m=seek(m,x=>x.stack.length===1);assert.equal(m.players[side].force.length,force-1);assert.equal(board.power(m,f.target),base+1);assert.equal(board.power(m,f.power),0);
  state.moveCard(m,f.second,'table');m.cards[f.second].location=f.site;assert.equal(board.power(m,f.target),base+1);text.suppressGameText(m,f.site,f.power);assert.equal(board.power(m,f.target),base+1);text.suppressGameText(m,f.site,f.second);assert.equal(board.power(m,f.target),base);
 });
 test(side+' generator deploys free and selects, stops and switches a droid',()=>{
  const f=fixture(side),base=board.power(f.m,f.target),n=f.m.players[side].force.length;attach(f);assert.equal(f.m.players[side].force.length,n);enhance(f);assert.equal(board.power(f.m,f.target),base+1);assert.equal(f.m.stack.length,1);f.m=priority(f.m,side);assert.deepEqual(ids(f.m).filter(x=>x.startsWith('fusion:')),['fusion:'+f.fusion+':off']);f.m=step(f.m,'fusion:'+f.fusion+':off');assert.equal(board.power(f.m,f.target),base);
 });
 test(side+' generator text cancellation suspends enhancement; departure permanently clears it',()=>{
  const f=enhance(attach(fixture(side))),base=board.power(f.m,f.target);text.suppressGameText(f.m,f.site,f.fusion);assert.equal(board.power(f.m,f.target),base-1);f.m.data.gameTextSuppressions=[];assert.equal(board.power(f.m,f.target),base);f.m.cards[f.target].location=f.remote;assert.equal(support.expireFusionLinks(f.m),true);f.m.cards[f.target].location=f.site;assert.equal(board.power(f.m,f.target),base-1);rules.validate(clone(f.m));
 });
 test(side+' lower-power battle destiny triggers a lasting bonus before just responses',()=>{
  const f=drawing(side),before=board.presentPower(f.m,side,f.site,side!==f.m.data.battle.initiator,id=>f.m.data.battle.participants[side].includes(id));assert.equal(prompt(f.m).mandatory,true);let m=step(f.m,ids(f.m)[0]);m=seek(m,x=>x.data.battle.powerDroidBoosts?.length===1);assert.equal(m.data.battle.powerDroidBoosts[0].amount,before);assert.equal(m.data.battle.destiny[side],side==='dark'?1:0);assert.equal(prompt(m).mandatory,false);state.moveCard(m,f.power,'hand');assert.equal(board.totalPower(m,side,f.site),2*before);rules.validate(clone(m));
 });
}
test('greater power does not trigger the power droid destiny',()=>{const f=drawing('dark',false);assert.equal(prompt(f.m).mandatory,false);assert.ok(!ids(f.m).some(x=>x.startsWith('power-droid:')));});
test('enhancement can target an opposing droid and does not grant power to both sides',()=>{
 const f=attach(fixture()),target=pull(f.m,'light','1_18','table',f.site),before=board.power(f.m,target);f.m=step(f.m,'fusion:'+f.fusion+':'+target);assert.equal(board.power(f.m,target),before+1);assert.equal(support.supportPowerBonus(f.m,f.target),0);
});
test('device allowance applies to optional enhancement, not continuous firing bonuses',()=>{
 const f=attach(fixture('light')),device=pull(f.m,'light','1_35','table',f.site);f.m.cards[device].attachedTo=f.warrior;
 const usage=load(new URL('../../lib/native-engine/equipment-state.ts',import.meta.url));usage.useDevice(f.m,device);assert.ok(!ids(f.m).some(x=>x.startsWith('fusion:')));
 const rifle=pull(f.m,'light','1_153','table',f.site);f.m.cards[rifle].attachedTo=f.warrior;assert.equal(board.weaponDrawBonus(f.m,rifle),1);
});
for(const which of ['source','target','host'])test('a departed and returned '+which+' cannot inherit a fusion assignment',()=>{
 const f=enhance(attach(fixture())),id=which==='source'?f.fusion:which==='host'?f.warrior:f.target,host=f.m.cards[id].attachedTo;if(which==='host')state.moveCard(f.m,f.fusion,'hand');state.moveCard(f.m,id,'hand');state.moveCard(f.m,id,'table');f.m.cards[id].location=f.site;if(host)f.m.cards[id].attachedTo=host;assert.equal(support.expireFusionLinks(f.m),true);assert.equal(support.supportPowerBonus(f.m,f.target),0);
});
const heavy=await import('./heavy-fixture.mjs');
for(const carried of [false,true])test('fusion powers artillery and adds destiny only for its actual firing warrior: '+carried,()=>{
 const f=heavy.destiny(heavy.ready(heavy.fixture({artillery:true,source:'fusion'})));
 if(carried)f.m.cards[f.powerSource].attachedTo=f.warrior;
 const m=heavy.done(heavy.fire(f));assert.equal(m.data.heavyShots.at(-1).draw.value,carried?6:5);assert.equal(m.data.heavyShots.at(-1).total,carried?8:7);
});
test('fusion enhancement survives turns but does not stack copies on the same target',()=>{
 const f=enhance(attach(fixture())),other=pull(f.m,'dark','3_96','table',f.site);f.m.cards[other].attachedTo=f.warrior;const before=board.power(f.m,f.target);f.m.data.fusionLinks.push({...clone(f.m.data.fusionLinks[0]),source:load(new URL('../../lib/native-engine/identity.ts',import.meta.url)).referenceCard(f.m,other)});assert.equal(board.power(f.m,f.target),before);f.m.turn.number++;assert.equal(board.power(f.m,f.target),before);rules.validate(clone(f.m));
});
test('battle destiny cancellation after the required trigger does not undo its lasting power',()=>{
 const f=drawing(),initial=board.presentPower(f.m,'light',f.site);let m=step(f.m,ids(f.m)[0]);m=seek(m,x=>x.data.battle.powerDroidBoosts?.length===1);const parent=m.stack.find(x=>x.kind==='resolution'&&x.action.handler==='battle:destiny-finish');parent.cancelled=true;m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-player-complete');assert.equal(m.data.battle.destiny.light,null);assert.equal(m.data.battle.powerDroidBoosts[0].amount,initial);assert.equal(board.totalPower(m,'light',f.site),initial*2);
});
for(const field of ['source','side','amount'])test('malformed power-droid boost rejects '+field,()=>{
 const f=drawing();let m=step(f.m,ids(f.m)[0]);m=seek(m,x=>x.data.battle.powerDroidBoosts?.length===1);const p=m.data.battle.powerDroidBoosts[0];if(field==='source')p.source.id=f.site;if(field==='side')p.side='dark';if(field==='amount')p.amount=-1;assert.throws(()=>rules.validate(m));
});
const fs=await import('node:fs');
for(const row of JSON.parse(fs.readFileSync(new URL('./gemp/power-support-results.json',import.meta.url))))test('executed GEMP power support '+row.kind+' '+row.side+' '+(row.behind??''),()=>{
 let actual;
 if(row.kind==='drawn'){
  const f=drawing(row.side,row.behind),before=board.totalPower(f.m,row.side,f.site,row.side!==f.m.data.battle.initiator);const m=seek(f.m,x=>x.cards[f.power].zone==='used');actual={kind:row.kind,side:row.side,behind:row.behind,before,after:board.totalPower(m,row.side,f.site,row.side!==m.data.battle.initiator)};
 }else if(row.kind==='rifle'){
  const f=attach(fixture(row.side)),opp=row.side==='dark'?'light':'dark',victim=pull(f.m,opp,opp==='dark'?'1_194':'1_28','table',f.site),gun=pull(f.m,row.side,row.side==='dark'?'1_312':'1_153','table',f.site);f.m.cards[gun].attachedTo=f.warrior;const die=pull(f.m,row.side,row.side==='dark'?'1_262':'1_115','hand');state.moveCard(f.m,die,'reserve');let m=seek(f.m,x=>x.turn.phase==='battle'&&x.stack.length===1);m=priority(m,row.side);m=step(m,'battle:'+f.site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');m=priority(m,row.side);m=step(m,'fire:'+gun+':'+victim);m=seek(m,x=>x.data.battle.shots.at(-1)?.hit!==null&&x.stack.at(-1)?.event?.kind==='weapon-fired');const shot=m.data.battle.shots.at(-1);actual={kind:row.kind,side:row.side,total:shot.total,hit:shot.hit};
 }else if(row.kind==='fusion'){
  const f=attach(fixture(row.side)),base=board.power(f.m,f.target);enhance(f);const on=board.power(f.m,f.target);f.m=priority(f.m,row.side);f.m=step(f.m,'fusion:'+f.fusion+':off');actual={kind:row.kind,side:row.side,base,on,off:board.power(f.m,f.target)};
 }else{
  const f=fixture(row.side),m=f.m,base=board.power(m,f.target);state.moveCard(m,f.power,'table');m.cards[f.power].location=f.site;const one=board.power(m,f.target);state.moveCard(m,f.second,'table');m.cards[f.second].location=f.site;const two=board.power(m,f.target);text.suppressGameText(m,f.site,f.power);text.suppressGameText(m,f.site,f.second);actual={kind:row.kind,side:row.side,base,one,two,canceled:board.power(m,f.target),self:board.power(m,f.power)};
 }
 assert.deepEqual(actual,row);
});
test('a carrier that loses its warrior permission cannot initiate generator use',()=>{
 const f=attach(fixture('light'));f.m.cards[f.fusion].attachedTo=f.target;
 assert.ok(!ids(f.m).some(x=>x.startsWith('fusion:')));
});
test('power support evidence fingerprints match the executed reference fixture',async()=>{
 const {createHash}=await import('node:crypto'),receipt=JSON.parse(fs.readFileSync(new URL('./gemp/power-support-provenance.json',import.meta.url)));assert.equal(receipt.observations,10);assert.equal(receipt.exactAgreements,10);
 for(const [name,hash] of Object.entries(receipt.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))).digest('hex'),hash);
});
test('power-droid comparison excludes earlier completed draws in the same unfinished destiny group',()=>{
 const f=drawing('dark',true,{extraDraw:true});assert.notEqual(f.m.data.battle.destinyCards.dark,f.power);assert.equal(f.m.data.battle.destiny.dark,2);
 let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='battle-destiny-drawn'&&x.data.battle.destinyCards.dark===f.power);
 assert.equal(m.data.battle.destinyPlans.dark.draws[0].value,2);assert.equal(m.data.battle.destinyResults?.dark??null,null);assert.equal(prompt(m).mandatory,true);
 m=step(clone(m),ids(m)[0]);m=seek(m,x=>x.data.battle.powerDroidBoosts?.length===1);assert.equal(m.data.battle.powerDroidBoosts[0].amount,7);
 m=seek(m,x=>!!x.data.battle.destinyResults?.dark);assert.equal(m.data.battle.destinyResults.dark.total,3);
});
