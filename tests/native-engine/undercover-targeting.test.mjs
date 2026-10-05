import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,pull,phase,step,ids,seek,boundary,priority,clone} from './prisoner-fixture.mjs';
const coverState=mod('undercover-state');
function fixture({side='dark',phaseName='control',cloud=false,mobile=false,luke=false}={}){
 const decks=['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_129','1_41','5_79','1_17','101_2','2_40','2_40','1_152','1_153','1_101','5_59','1_109','1_109','2_57','1_40','1_40','1_105']:['1_295','1_293','1_283','1_284','101_5','1_268','1_247','1_267','1_234','6_138','101_6','2_113']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
 let m=runtime.createMatch('undercover-targeting',60,decks,rules);
 const site=pull(m,cloud?'light':'dark',mobile?'1_283':cloud?'5_79':'1_295');m.locations.push(site);
 const spy=pull(m,'light',luke?'101_2':'1_17','table',site),effect=pull(m,'light','2_40','table',site);m.cards[effect].attachedTo=spy;
 if(luke)mod('characteristics').changeCharacteristic(m,effect,spy,'SPY','give');
 for(const seat of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[seat].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),side,phaseName);coverState.setUndercover(m,spy,effect);refresh(m);return {m,site,spy,effect};
}
function refresh(m){state.assertState(m);rules.validate(m);for(const side of ['dark','light'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));return m;}
function top(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id;}
test('Set For Stun targets an inactive spy outside battle and returns her attachments',()=>{
 const f=fixture(),card=pull(f.m,'dark','1_268','hand');top(f.m,'dark','1_234');let m=step(f.m,'stun:play:'+card+':'+f.spy);refresh(m);
 m=seek(m,x=>x.cards[f.spy].zone==='hand');assert.equal(m.cards[f.effect].zone,'hand');refresh(m);assert.equal(coverState.activeUndercoverSpy(m,f.spy),false);
});
test('Gravel Storm can lose an inactive spy and preserves authentic inactive target references',()=>{
 const f=fixture(),card=pull(f.m,'dark','1_247','hand');top(f.m,'dark','1_234');let m=step(f.m,'gravel:play:'+card+':'+f.spy);refresh(m);
 m=seek(m,x=>x.cards[f.spy].zone==='lost');m=seek(m,x=>x.cards[card].zone==='lost');refresh(m);assert.equal(m.cards[f.effect].zone,'lost');
});
test('On The Edge and Off The Edge can risk an undercover character',()=>{
 for(const cloud of [false,true]){
  const f=fixture({side:'light',cloud}),card=pull(f.m,'light',cloud?'5_59':'1_101','hand');top(f.m,'light','1_28');
  let m=step(f.m,(cloud?'off-edge':'edge')+':play:'+card+':'+f.spy);if(!cloud)m=step(m,'edge:number:6');refresh(m);
  m=seek(m,x=>x.cards[f.spy].zone==='lost');m=seek(m,x=>x.cards[card].zone==='lost');refresh(m);
 }
});
test('an undercover spy remains unavailable to Interrupts during an ordinary battle',()=>{
 const f=fixture({phaseName:'battle'}),target=pull(f.m,'light','1_28','table',f.site);pull(f.m,'dark','1_194','table',f.site);const stun=pull(f.m,'dark','1_268','hand'),gravel=pull(f.m,'dark','1_247','hand');
 let m=priority(boundary(step(f.m,'battle:'+f.site),'battle-weapons'),'dark');refresh(m);assert.ok(ids(m).includes('stun:play:'+stun+':'+target));assert.ok(!ids(m).includes('stun:play:'+stun+':'+f.spy));assert.ok(!ids(m).includes('gravel:play:'+gravel+':'+f.spy));
});
test('Undercover is immune to Alter and the spy may supply Sense ability outside battle',()=>{
 const f=fixture(),alter=pull(f.m,'dark','1_234','hand');pull(f.m,'dark','101_5','table',f.site);
 assert.ok(!ids(f.m).some(id=>id.startsWith('cancel:play:'+alter+':'+f.effect+':')));assert.deepEqual(mod('cancellation').highestAbilityCharacters(f.m,'light'),[f.spy]);
 const card=pull(f.m,'dark','1_268','hand'),sense=pull(f.m,'light','1_109','hand');let m=priority(step(f.m,'stun:play:'+card+':'+f.spy),'light');
 assert.ok(ids(m).includes('cancel:play:'+sense+':'+card+':'+f.spy));m=step(m,'cancel:play:'+sense+':'+card+':'+f.spy);refresh(m);
});
test('a creature hunts an inactive spy, who can fire her weapon while remaining inactive',()=>{
 const f=fixture({phaseName:'battle'}),creature=pull(f.m,'dark','6_138','table',f.site),gun=pull(f.m,'light','1_153','table',f.site);f.m.cards[gun].attachedTo=f.spy;top(f.m,'light','2_40');
 assert.ok(!mod('creature-attack').creatureActions(f.m,f.m.stack.at(-1),'light').some(a=>a.id.includes(':assault:')));
 let m=step(f.m,'creature:begin:'+creature+':'+f.site+':hunt:light');refresh(m);m=priority(boundary(m,'attack-weapons'),'light');assert.equal(m.cards[f.spy].zone,'inactive');
 const fire=ids(m).find(id=>id.startsWith('creature-weapon:fire:'));assert.ok(fire);m=step(m,fire);refresh(m);m=seek(m,x=>x.data.creatureAttack.stage==='complete');refresh(m);assert.equal(m.cards[f.spy].zone,'lost');assert.equal(m.cards[creature].zone,'lost');
});
test('Sorry About The Mess allows an undercover weapon bearer to fire at a Laser Gate',()=>{
 const f=fixture({side:'light',mobile:true}),end=pull(f.m,'dark','1_284');f.m.locations.push(end);const gate=pull(f.m,'dark','2_113','table'),gun=pull(f.m,'light','1_153','table',f.site),card=pull(f.m,'light','2_57','hand');f.m.cards[gun].attachedTo=f.spy;mod('laser-gate').bindLaserGate(f.m,gate,f.site,end);top(f.m,'light','1_105');
 let m=step(f.m,'sniping:play:'+card+':'+gun);m=seek(m,x=>x.stack.at(-1)?.handler==='sniping:target');m=step(m,'sniping:target:'+gate);refresh(m);m=seek(m,x=>x.cards[card].zone==='lost');refresh(m);assert.equal(m.cards[gate].zone,'lost');assert.equal(m.cards[f.spy].zone,'inactive');
});
test('Vaders Obsession activates an undercover Luke only for his duel and restores him afterward',()=>{
 const f=fixture({phaseName:'move',luke:true}),from=pull(f.m,'dark','1_293');f.m.locations.push(from);const vader=pull(f.m,'dark','101_5','table',from),card=pull(f.m,'dark','101_6','hand');top(f.m,'light','1_17');top(f.m,'light','1_28');top(f.m,'dark','1_283');top(f.m,'dark','1_284');
 let m=priority(boundary(step(f.m,'move:'+vader+':'+f.site),'moved'),'dark');assert.ok(ids(m).includes('duel:obsession:'+card));m=step(m,'duel:obsession:'+card);refresh(m);assert.equal(m.cards[f.spy].zone,'inactive');
 m=boundary(m,'duel-initiated');refresh(m);const bad=clone(m);delete bad.data.duel.undercoverParticipants;assert.throws(()=>rules.validate(bad),/restoration/);assert.equal(m.cards[f.spy].zone,'table');assert.equal(coverState.activeUndercoverSpy(m,f.spy),true);
 m=seek(m,x=>x.data.duel?.stage==='complete');refresh(m);assert.equal(m.data.duel.winner,null);assert.equal(m.cards[f.spy].zone,'inactive');
});

test('Vaporator protects the otherwise targetable undercover spy from Gravel Storm',()=>{
 const f=fixture(),storm=pull(f.m,'dark','1_247','hand'),vaporator=pull(f.m,'light','1_41','table');f.m.cards[vaporator].attachedTo=f.site;refresh(f.m);assert.ok(!ids(f.m).includes('gravel:play:'+storm+':'+f.spy));
});

test('breaking cover during a pending Interrupt preserves its original physical target',()=>{
 const f=fixture(),card=pull(f.m,'dark','1_268','hand');top(f.m,'dark','1_234');let m=step(f.m,'stun:play:'+card+':'+f.spy);mod('undercover').breakCover(m,f.spy);refresh(m);m=seek(m,x=>x.cards[f.spy].zone==='hand');refresh(m);assert.equal(m.cards[f.effect].zone,'lost');
});
