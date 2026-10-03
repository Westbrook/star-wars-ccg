import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=mod('runtime'),state=mod('state'),board=mod('board'),battle=mod('battle'),stats=mod('stat-modifiers'),protocol=mod('protocol-droid');
const rules={...mod('premiere-rules').premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(){return runtime.createMatch('protocol',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_5','2_14','1_30','3_9','3_9','3_9','1_129','1_132','1_152','3_32']:['1_284','3_86','1_249','1_317']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',location){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);if(location)c.location=location;return c.id}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m);const r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const side of ['light','dark'])assert.deepEqual(runtime.project(r,rules,side),runtime.project(clone(r),rules,side));return r}
function seek(m,f){for(let n=0;n<600;n++){if(f(m))return m;const cs=ids(m);m=step(m,cs.includes('pass')?'pass':cs.includes('skip-destiny')?'skip-destiny':cs[0])}throw Error('unreached boundary')}
const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
const priority=(m,side)=>prompt(m).side===side?m:step(m,'pass');
const phase=(m,side,phase)=>seek(m,x=>x.turn.side===side&&x.turn.phase===phase&&x.stack.length===1&&prompt(x).side===side);

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/protocol-results.json',import.meta.url)));
const observed=name=>{const row=oracle.find(r=>r.name===name);assert.ok(row,name);return row};
function fixture(droids=2,rebels=2){const m=fresh(),site=pull(m,'light','1_129'),other=pull(m,'dark','1_284');m.locations.push(site,other);const c3po=pull(m,'light','1_5','table',site),r2=droids>=2?pull(m,'light','2_14','table',site):null;const troops=[];for(let i=2;i<droids;i++)pull(m,'light','3_9','table',site);for(let i=0;i<rebels;i++)troops.push(pull(m,'light','1_28','table',site));return{m,site,other,c3po,r2,troops};}
for(let d=1;d<=4;d++)for(let r=0;r<=4;r++)test('distinct C-3PO pairs agree with GEMP '+d+'/'+r,()=>{
 const f=fixture(d,r);assert.deepEqual({name:'pairs-'+d+'-'+r,total:board.totalPower(f.m,'light',f.site),individual:board.power(f.m,f.c3po)},observed('pairs-'+d+'-'+r));
});
for(const mode of ['same','source-other','target-other','source-hand','target-hand','opposing-droid','alien','source-return'])test('C-3PO locality '+mode,()=>{
 const f=fixture(),{m,site,c3po,r2,other}=f;
 if(mode==='source-other')m.cards[c3po].location=other;if(mode==='target-other')m.cards[r2].location=other;if(mode==='source-hand')state.moveCard(m,c3po,'hand');if(mode==='target-hand')state.moveCard(m,r2,'hand');if(mode==='opposing-droid'){m.cards[r2].location=other;pull(m,'dark','3_86','table',site);}if(mode==='alien'){state.moveCard(m,f.troops[1],'hand');pull(m,'light','1_30','table',site);}if(mode==='source-return'){state.moveCard(m,c3po,'hand');state.moveCard(m,c3po,'table');m.cards[c3po].location=site;}
 assert.deepEqual({name:mode,total:board.totalPower(m,'light',site),forfeit:board.forfeit(m,r2)},observed(mode));
});
function ready(f,side='dark',p='battle'){for(let i=0;i<18;i++)pull(f.m,'dark','1_194','table',f.site);for(const s of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(f.m,f.m.players[s].reserve.at(-1),'force');return phase(runtime.startTurns(f.m,rules),side,p);}
for(const first of [false,true])test('actual forfeiture uses current bonus after source-first choice '+first,()=>{
 const f=fixture();let m=priority(boundary(step(ready(f),'battle:'+f.site),'battle-damage'),'light');const power=battle.battle(m).power.light;if(first){m=boundary(step(m,'forfeit:'+f.c3po),'forfeited');m=priority(boundary(m,'battle-damage'),'light');}
 const before=battle.battle(m).damage.light,value=board.forfeit(m,f.r2);assert.ok(prompt(m).choices.find(c=>c.id==='forfeit:'+f.r2).label.endsWith(' · '+value));m=boundary(step(m,'forfeit:'+f.r2),'forfeited');assert.deepEqual({name:'forfeit-'+first,power,forfeit:value,paid:before-battle.battle(m).damage.light},observed('forfeit-'+first));assert.equal(battle.battle(m).power.light,power,'completed battle power stays frozen');
});
for(const barrier of [false,true])test('deploying C-3PO and responding with Imperial Barrier '+barrier,()=>{
 const f=fixture();state.moveCard(f.m,f.c3po,'hand');const card=pull(f.m,'dark','1_249','hand');let m=ready(f,'light','deploy');const before=m.players.light.force.length;m=boundary(step(m,'deploy:'+f.c3po+':'+f.site),'deployed');const cost=before-m.players.light.force.length;
 if(barrier){m=priority(m,'dark');assert.ok(ids(m).includes('barrier:'+card+':'+f.c3po));m=step(m,'barrier:'+card+':'+f.c3po);}
 m=phase(m,'light','battle');const outside=board.totalPower(m,'light',f.site);m=boundary(step(m,'battle:'+f.site),'battle-damage');const battlePower=battle.battle(m).power.light,forfeit=board.forfeit(m,f.r2);for(let i=0;i<400&&battle.battle(m).stage!=='complete';i++){const cs=ids(m);m=step(m,cs.includes('battle-lose:reserve')?'battle-lose:reserve':cs.includes('pass')?'pass':cs[0]);}assert.equal(battle.battle(m).stage,'complete');assert.deepEqual({name:'deploy-'+barrier,cost,outside,battlePower,forfeit,afterPower:board.totalPower(m,'light',f.site),afterForfeit:board.forfeit(m,f.r2)},observed('deploy-'+barrier));
});
test('pair bonus is total power only, never an individual character modifier',()=>{const f=fixture(4,3);for(const c of board.atSite(f.m,f.site))assert.equal(board.power(f.m,c.id),board.printed(f.m,c.id,'power'));assert.equal(protocol.protocolPowerBonus(f.m,'light',f.site,()=>true),6);assert.equal(protocol.protocolPowerBonus(f.m,'dark',f.site,()=>true),0)});
test('pair selection honors the active participant predicate for both source and partners',()=>{const f=fixture(3,3);assert.equal(protocol.protocolPowerBonus(f.m,'light',f.site,id=>id!==f.c3po),0);assert.equal(protocol.protocolPowerBonus(f.m,'light',f.site,id=>id!==f.r2),4);assert.equal(protocol.protocolPowerBonus(f.m,'light',f.site,id=>!f.troops.includes(id)),0);assert.equal(board.forfeit(f.m,f.r2,id=>id!==f.c3po),4)});
test('weapon forfeit reset overrides R2 bonus and restoration restores the live modifier',()=>{const f=fixture();const gun=pull(f.m,'dark','1_317');mod('forfeit').resetWeaponForfeit(f.m,gun,f.r2);assert.equal(board.forfeit(f.m,f.r2),0);mod('forfeit').restoreWeaponForfeit(f.m,f.r2);assert.equal(board.forfeit(f.m,f.r2),6);state.moveCard(f.m,f.c3po,'hand');assert.equal(board.forfeit(f.m,f.r2),4)});
test('generic forfeit increase restrictions and caps apply to C-3PO contribution',()=>{for(const [kind,amount,want] of [['prevent-increase',1,4],['increase-limit',1,5],['printed-cap',1,4],['add',1,7]]){const f=fixture();stats.addStatModifier(f.m,f.site,f.r2,'forfeit',kind,amount);assert.equal(board.forfeit(f.m,f.r2),want)}});
test('stacked cards are not ground-present pair members or sources',()=>{for(const who of ['c3po','r2']){const f=fixture(),tank=pull(f.m,'light','3_32');state.moveCard(f.m,f[who],'stacked');f.m.cards[f[who]].stackedOn=tank;assert.equal(board.totalPower(f.m,'light',f.site),who==='c3po'?3:5);assert.equal(board.forfeit(f.m,f.r2),4)}});
test('hit status alone does not remove pairs or forfeit bonus',()=>{const f=fixture();let m=boundary(step(ready(f),'battle:'+f.site),'battle-weapons');battle.battle(m).hits.push(f.c3po,f.r2);assert.equal(board.totalPower(m,'light',f.site,false,id=>battle.members(m,'light').includes(id)),8);assert.equal(board.forfeit(m,f.r2),6)});
test('current source departure and serialized return update live queries without cached bonuses',()=>{const f=fixture();let m=boundary(step(ready(f),'battle:'+f.site),'battle-weapons');state.moveCard(m,f.c3po,'hand');battle.syncBattle(m);assert.equal(board.forfeit(m,f.r2),4);state.moveCard(m,f.c3po,'table');m.cards[f.c3po].location=f.site;battle.syncBattle(m);m=clone(m);assert.equal(board.forfeit(m,f.r2),6);assert.equal(board.totalPower(m,'light',f.site,false,id=>battle.members(m,'light').includes(id)),8)});
test('C-3PO deployment remains private-seat controlled; complete native admission is still closed',()=>{const f=fixture();state.moveCard(f.m,f.c3po,'hand');const m=ready(f,'light','deploy');assert.deepEqual(runtime.prompt(m,rules,'dark').choices,[]);assert.equal(mod('premiere-rules').premiereRules.supports('1_5'),false);assert.equal(mod('definitions').definition('2_14').status,'component-coverage-only')});

test('attached characters cannot provide ground-present source or pair modifiers',()=>{for(const who of ['c3po','r2']){const f=fixture();f.m.cards[f[who]].attachedTo=f.troops[0];assert.equal(board.totalPower(f.m,'light',f.site),who==='c3po'?3:5);assert.equal(board.forfeit(f.m,f.r2),4)}});
