import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deploySector,pull,seek,priority,step,load} from './sectors-fixture.mjs';
import {rules,deploy,state,clone,location} from './vessels-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const settle=m=>seek(m,x=>x.stack.length===1);
test('Tatooine Utility Belt follows on-world status through orbit, clouds, surface and asteroids',()=>{
 const f=fixture({light:['1_40']});let m=seek(f.m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');
 const belt=pull(m,'light','1_40','hand'),cloud=pull(m,'light','5_85','hand'),asteroid=pull(m,'light','4_81','hand');
 m=deploySector(m,cloud);m=deploySector(m,asteroid);m=deploy(m,f.ywing,f.planet);m=deploy(m,f.lightPilot,f.ywing,'pilot');
 m=settle(step(m,'attach:'+belt+':'+f.lightPilot));
 const base={power:board.power(m,f.lightPilot),forfeit:board.forfeit(m,f.lightPilot)};
 assert.deepEqual(base,{power:3,forfeit:6});
 for(const [at,bonus]of [[cloud,2],[f.site,2],[f.planet,0],[asteroid,0]]){
  board.moveWithAttachments(m,f.ywing,at);rules.validate(m);
  for(const restored of [m,clone(m)]){assert.equal(board.power(restored,f.lightPilot),base.power+bonus);assert.equal(board.forfeit(restored,f.lightPilot),base.forfeit+bonus);}
 }
});
test('Death Star Utility Belt retains its basic bonus away from the station and doubles on its sites',()=>{
 const f=fixture({dark:['1_207']});let m=f.m;const belt=pull(m,'dark','1_207','hand');
 m=deploy(m,f.scout,f.planet);m=deploy(m,f.pilot,f.scout,'pilot');
 const base={power:board.power(m,f.pilot),forfeit:board.forfeit(m,f.pilot)};
 m=settle(step(m,'attach:'+belt+':'+f.pilot));
 assert.equal(board.power(m,f.pilot),base.power+1);assert.equal(board.forfeit(m,f.pilot),base.forfeit+1);
 // Component boundary: place the same equipped character at a station site.
 delete m.cards[f.pilot].attachedTo;delete m.cards[f.pilot].aboardRole;board.moveWithAttachments(m,f.pilot,f.remote);rules.validate(m);
 assert.equal(board.power(m,f.pilot),base.power+2);assert.equal(board.forfeit(m,f.pilot),base.forfeit+2);
});
