import assert from 'node:assert/strict';
import {fixture as alternatives,besiegedReady} from './alternatives-fixture.mjs';
import {fixture as prisoner,mod,pull,priority} from './prisoner-fixture.mjs';

// Actual weapon and Alternatives choices happen after this fixture is seeded.
export function releaseFixture(){
 const f=alternatives();let m=besiegedReady(f,'dark');
 const blaster=pull(m,'dark','1_317','table',f.site);m.cards[blaster].attachedTo=f.escort;
 const high=m.players.dark.reserve.find(id=>m.cards[id].blueprint==='1_241');assert.ok(high);
 m.players.dark.reserve.splice(m.players.dark.reserve.indexOf(high),1);m.players.dark.reserve.unshift(high);
 m=priority(m,'dark');return {...f,m,blaster,target:f.characters[0],losses:[f.characters[0],f.gun]};
}
// Explicit capture foundation: this does not claim a new legal capture action.
// The browser verifies the generic saved loss and real Lost Pile ordering.
export function capturedFixture(){
 const f=prisoner(false,'battle-weapons');mod('battle').battle(f.m).hits.push(f.target);
 mod('captives').captureCharacter(f.m,f.target,{kind:'escort',id:f.escort});mod('battle').syncBattle(f.m);
 assert.equal(mod('hit-departure').scheduleHitDeparture(f.m),true);
 return {...f,losses:[f.target,f.gun,f.device]};
}
