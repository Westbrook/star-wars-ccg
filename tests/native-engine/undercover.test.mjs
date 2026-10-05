import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deployed,movement,mod,runtime,state,rules,pull,phase,step,ids,seek,priority} from './undercover-fixture.mjs';
import {clone} from './prisoner-fixture.mjs';
const undercover=mod('undercover-state'),board=mod('board'),identity=mod('identity');
const refresh=m=>{state.assertState(m);rules.validate(m);for(const s of ['light','dark'])assert.deepEqual(runtime.project(m,rules,s),runtime.project(clone(m),rules,s));return m;};
for(const side of ['dark','light'])test('actual '+side+' Undercover deploys, persists and removes ordinary presence',()=>{
 const f=fixture({side}),before=identity.referenceCard(f.m,f.spy);let m=deployed(f);refresh(m);assert.equal(m.cards[f.spy].zone,'inactive');assert.equal(m.cards[f.spy].owner,side);assert.equal(m.cards[f.effect].zone,'table');assert.equal(identity.cardVersion(m,f.spy),before.version);assert.equal(identity.sameCard(m,before),true);assert.equal(board.presence(m,side,f.site),false);assert.equal(mod('game-text').gameTextActive(m,f.spy),true);assert.equal(mod('participation').battleProhibited(m,f.spy),true);assert.equal(undercover.undercoverPreventsDrain(m,side==='light'?'dark':'light',f.site),true);
 const projection=runtime.project(m,rules,side);assert.ok(projection.rules.undercoverSpies.some(c=>c.id===f.spy));
});
test('opponent Force drain blocked and own deploy phase break-cover loses only Undercover',()=>{
 const f=fixture({side:'light'});let m=deployed(f);const device=pull(m,'light','1_40','table',f.site);m.cards[device].attachedTo=f.spy;refresh(m);m=phase(m,'dark','control');assert.ok(!ids(m).includes('drain:'+f.site));
 m=phase(m,'light','deploy');m=step(m,'undercover:break:'+f.spy);m=seek(m,x=>x.cards[f.effect].zone==='lost');refresh(m);assert.equal(m.cards[f.spy].zone,'table');assert.equal(m.cards[device].zone,'table');assert.equal(m.cards[device].attachedTo,f.spy);assert.equal(undercover.activeUndercoverSpy(m,f.spy),false);
});
for(const side of ['light','dark'])test('landspeed uses owner Force during opponent move phase '+side,()=>{
 const f=fixture({side});let m=deployed(f);m=phase(m,side,'move');assert.ok(!ids(m).some(id=>id==='undercover:move:'+f.spy+':'+f.to));m=priority(phase(m,side==='light'?'dark':'light','move'),side);const force=m.players[side].force.length;m=step(m,'undercover:move:'+f.spy+':'+f.to);m=seek(m,x=>x.cards[f.spy].location===f.to);refresh(m);assert.equal(m.players[side].force.length,force-1);assert.equal(m.cards[f.effect].location,f.to);assert.ok(!ids(m).some(id=>id.startsWith('undercover:move:'+f.spy)));
});
test('docking-bay transit keeps owner-side cost, excludes normal party and survives selection refresh',()=>{
 const f=fixture();let m=movement(f);const cost=mod('travel').transitCost(m,'dark',f.site,f.bay,[f.spy]),force=m.players.dark.force.length;
 m=step(m,'transit:'+f.site+':'+f.bay);refresh(m);assert.ok(ids(m).includes('toggle:'+f.spy));assert.ok(!ids(m).includes('toggle:'+f.enemy));m=step(m,'toggle:'+f.spy);refresh(m);m=step(m,'confirm');m=seek(m,x=>x.cards[f.spy].location===f.bay);refresh(m);assert.equal(m.players.dark.force.length,force-cost);assert.equal(m.cards[f.spy].zone,'inactive');
});
test('spy disembarks when going undercover and cannot board again',()=>{
 const f=fixture({side:'light',aboard:true});let m=deployed(f);refresh(m);assert.equal(m.cards[f.spy].attachedTo,undefined);assert.equal(m.cards[f.spy].aboardRole,undefined);assert.equal(mod('occupancy').roleAvailable(m,f.host,f.spy,'passenger'),false);
});
test('weapon and device really deploy to inactive spy and remain active',()=>{
 const f=fixture({side:'light'});let m=phase(deployed(f),'light','deploy');const gun=pull(m,'light','1_152','hand'),device=pull(m,'light','1_40','hand');
 m=step(m,'equip:'+gun+':'+f.spy);m=seek(m,x=>x.cards[gun].zone==='table');m=phase(m,'light','deploy');m=step(m,'attach:'+device+':'+f.spy);m=seek(m,x=>x.cards[device].zone==='table');refresh(m);assert.equal(m.cards[gun].attachedTo,f.spy);assert.equal(m.cards[device].attachedTo,f.spy);assert.equal(mod('weapon-state').canUseWeapon(m,gun),true);assert.equal(mod('equipment-state').canUseDevice(m,device),true);
});
test('printed Spy removal automatically exposes the spy and loses the Effect',()=>{
 const f=fixture();let m=deployed(f);mod('characteristics').changeCharacteristic(m,f.site,f.spy,'SPY','remove');refresh(m);assert.ok(ids(m).includes('undercover:break:'+f.spy));m=step(m,'undercover:break:'+f.spy);m=seek(m,x=>x.cards[f.effect].zone==='lost');refresh(m);assert.equal(m.cards[f.spy].zone,'table');
});
test('same instance ability and characteristic modifiers survive Undercover then expire on leave and reentry',()=>{
 const f=fixture();mod('ability').addAbilityModifier(f.m,f.site,f.spy,'add',1);const value=mod('ability').ability(f.m,f.spy),ref=identity.referenceCard(f.m,f.spy);let m=deployed(f);assert.equal(mod('ability').ability(m,f.spy),value);assert.equal(identity.sameCard(m,ref),true);
 mod('table').returnToHand(m,[f.spy]);refresh(m);assert.equal(undercover.activeUndercoverSpy(m,f.spy),false);state.moveCard(m,f.spy,'table');m.cards[f.spy].location=f.site;assert.equal(identity.sameCard(m,ref),false);assert.equal(mod('ability').ability(m,f.spy),value-1);refresh(m);
});
test('saved source ownership, inactive state and duel activation tampering rejected',()=>{
 const f=fixture();const m=deployed(f);for(const mutate of [x=>x.data.undercover[0].card.version++,x=>x.data.undercover[0].sources[0]=identity.referenceCard(x,f.enemy),x=>x.cards[f.spy].zone='table',x=>x.cards[f.spy].attachedTo=f.enemy]){const bad=clone(m);mutate(bad);assert.throws(()=>rules.validate(bad));}
});
test('undercover Labria can use his actual reveal text and retains its once-per-turn history',()=>{
 const f=fixture();let m=phase(deployed(f),'dark','control');m=step(m,'labria:reveal:'+f.spy);m=seek(m,x=>x.stack.at(-1)?.handler==='labria:acknowledge');refresh(m);m=step(m,'labria:acknowledge');if(m.stack.at(-1)?.handler==='labria:return')m=step(m,'labria:return:reserve');m=phase(m,'dark','control');refresh(m);assert.ok(!ids(m).includes('labria:reveal:'+f.spy));assert.equal(m.cards[f.spy].zone,'inactive');
});
test('inactive Leia keeps her own Death Star power text without supplying battle presence',()=>{
 const f=fixture({side:'light'});let m=deployed(f);board.moveWithAttachments(m,f.spy,f.bay);const rebel=pull(m,'light','1_28','table',f.bay);refresh(m);assert.equal(board.power(m,rebel,false,id=>id===rebel),board.printed(m,rebel,'power')+1);assert.equal(mod('participation').groundPresent(m,f.spy),false);assert.equal(undercover.activeUndercoverSpy(m,f.spy),true);
});
test('ordinary inactive captivity does not inherit Undercover identity privileges',()=>{
 const f=fixture({side:'light'});let m=deployed(f),inactive=identity.referenceCard(m,f.spy);m=phase(m,'light','deploy');m=step(m,'undercover:break:'+f.spy);m=seek(m,x=>x.cards[f.effect].zone==='lost');assert.equal(identity.sameCard(m,inactive),true);const current=identity.referenceCard(m,f.spy);m.cards[f.spy].zone='inactive';m.cards[f.spy].attachedTo=f.enemy;assert.equal(identity.sameCard(m,current),false);
});
