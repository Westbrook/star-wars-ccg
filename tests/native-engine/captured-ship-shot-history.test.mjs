import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,rules,clone,pull,ids,step,seek,phase,boundary,priority} from './prisoner-fixture.mjs';
import {fixture,shipDecks} from './captured-ships-fixture.mjs';

const weapons=mod('starship-weapons');
function stealAfterCrossfire(){
 const decks=shipDecks();
 decks[0].cards[10]='1_159';
 decks[1].cards[10]='1_323';
 const f=fixture(0,{capture:false,decks});
 const lightWeapon=pull(f.m,'light','1_159','table',f.site),darkWeapon=pull(f.m,'dark','1_323','table',f.site);
 f.m.cards[lightWeapon].attachedTo=f.ship;f.m.cards[darkWeapon].attachedTo=f.host;
 let m=phase(f.m,'dark','battle');m=boundary(step(m,'battle:'+f.site),'battle-weapons');
 for(const [side,weapon,target,count]of [['dark',darkWeapon,f.ship,2],['light',lightWeapon,f.host,1]]){
  // Explicitly arrange low destiny to miss; both ships must survive to the
  // actual Tractor Beam window at the end of this same battle.
  const low=m.players[side].reserve.filter(id=>m.cards[id].blueprint===(side==='dark'?'1_194':'1_28')).slice(0,count);
  assert.equal(low.length,count);
  m.players[side].reserve=[...low,...m.players[side].reserve.filter(id=>!low.includes(id))];
  m=priority(m,side);m=step(m,'space-weapon:fire:'+weapon+':'+target);
  m=boundary(m,'weapon-fired');assert.equal(m.data.battle.starshipShots.at(-1).outcome,'miss');
  m=boundary(m,'battle-weapons');
 }
 const originalShots=clone(m.data.battle.starshipShots);
 for(let i=0;i<500&&!ids(m).includes('tractor:use:'+f.beam+':'+f.host);i++){
  const cs=ids(m);m=step(m,cs.includes('pass')?'pass':cs.includes('skip-destiny')?'skip-destiny':cs.includes('battle-lose:force')?'battle-lose:force':cs[0]);
 }
 assert.equal(m.data.battle.stage,'end');assert.ok(ids(m).includes('tractor:use:'+f.beam+':'+f.host));
 const destiny=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_241');assert.ok(destiny);
 m.players.dark.reserve=[destiny,...m.players.dark.reserve.filter(id=>id!==destiny)];
 m=step(m,'tractor:use:'+f.beam+':'+f.host);
 m=seek(m,x=>x.stack.at(-1)?.handler==='captured-ship:steal');
 assert.equal(m.cards[f.ship].zone,'inactive');
 m=step(m,'captured-ship:launch:'+f.site);
 assert.equal(m.cards[f.ship].owner,'dark');assert.equal(m.cards[lightWeapon].owner,'dark');
 assert.equal(m.cards[lightWeapon].originalOwner,'light');assert.equal(m.cards[lightWeapon].attachedTo,f.ship);
 assert.deepEqual(m.data.battle.starshipShots,originalShots);
 m=seek(m,x=>x.data.battle.stage==='complete');
 return {...f,m,lightWeapon,darkWeapon,originalShots};
}

test('real crossfire, battle-end Tractor Beam and theft preserve both firing sides through refresh',()=>{
 const {m,originalShots}=stealAfterCrossfire();
 for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));
 assert.deepEqual(m.data.battle.starshipShots,originalShots);
});

test('stolen shot history requires original ownership and a departed historical participant',()=>{
 const f=stealAfterCrossfire();
 for(const edit of [
  m=>delete m.cards[f.ship].originalOwner,
  m=>delete m.cards[f.lightWeapon].originalOwner,
  m=>m.data.battle.departed=[],
  m=>m.data.battle.stage='weapons',
  m=>m.data.battle.participants.light=[],
  m=>m.data.battle.starshipShots[0].outcome='pending',
  m=>m.data.battle.starshipShots[1].outcome='pending',
 ]){const bad=clone(f.m);edit(bad);assert.throws(()=>weapons.assertStarshipWeapons(bad),/weapon record/);}
});
