import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,deploySector,pull,seek,priority,step,load} from './sectors-fixture.mjs';
import {rules,state,location,clone} from './vessels-fixture.mjs';
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const sectors=load(new URL('../../lib/native-engine/sectors.ts',import.meta.url));
for(const planetFirst of [false,true])for(const bayFirst of [false,true])test(`site orientation is independent of planet: planet first ${planetFirst}, bay first ${bayFirst}`,()=>{
 const f=fixture({light:['1_130','1_131']});let m=f.m;const dune=location(m,'light','1_130'),jawa=location(m,'light','1_131');m.locations=m.locations.filter(id=>id!==f.site);state.moveCard(m,f.site,'hand');
 m.locations=[...(planetFirst?[f.planet,dune,jawa]:[dune,jawa,f.planet]),f.remote];rules.validate(m);
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);m=priority(m,'light');
 const sites=bayFirst?[f.site,dune,jawa]:[dune,jawa,f.site];
 const expected=[...(planetFirst?[f.planet,...sites]:[...sites,f.planet]),f.remote];
 const placement=board.sitePlacements(m,f.site).find(p=>{const order=[...m.locations];order.splice(p.index,0,f.site);return JSON.stringify(order)===JSON.stringify(expected)});assert.ok(placement,'Both ends of the exterior row must remain legal');
 m=step(m,'site:'+f.site+':'+placement.id);m=seek(clone(m),x=>x.stack.length===1);assert.deepEqual(m.locations,expected);rules.validate(m);
 // Clouds remain between the whole site row and the planet in either orientation.
 const cloud=pull(m,'light','5_85','hand');m=deploySector(m,cloud);
 const group=m.locations.filter(id=>sectors.locationGroup(m,id)==='Tatooine');assert.deepEqual(group,planetFirst?[f.planet,cloud,...sites]:[...sites,cloud,f.planet]);rules.validate(clone(m));
});
test('independent orientation does not permit systems or buffer sites inside exterior rows',()=>{
 const f=fixture({light:['1_130','1_131']}),m=f.m,dune=location(m,'light','1_130'),jawa=location(m,'light','1_131');
 for(const bad of [[dune,f.planet,jawa,f.site],[dune,f.site,jawa,f.planet]]){
  m.locations=[...bad,f.remote];assert.equal(board.locationOrder(m,bad),false);assert.throws(()=>rules.validate(m),/arrangement/);
 }
});
