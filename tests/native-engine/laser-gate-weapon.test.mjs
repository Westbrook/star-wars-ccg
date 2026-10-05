import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const runtime=mod('runtime'),state=mod('state'),identity=mod('identity'),snipe=mod('sniping'),base=mod('premiere-rules').premiereRules;
const rules={...base,starting:undefined,supports:()=>true,setupComplete:()=>true,
 actions:(m,w,s)=>[...base.actions(m,w,s).filter(a=>!a.handler.startsWith('sniping:')),...snipe.snipingActions(m,w,s)],
 initiate:(m,r,c)=>r.action.handler.startsWith('sniping:')?snipe.snipingInitiate(m,r):base.initiate(m,r,c),
 resolve:(m,r,c)=>r.action.handler.startsWith('sniping:')?snipe.snipingResolve(m,r):base.resolve(m,r,c),
 decisions:(m,d)=>d.handler.startsWith('sniping:')?snipe.snipingChoices(m,d):base.decisions(m,d),
 choose:(m,d,id,c)=>d.handler.startsWith('sniping:')?snipe.snipingChoose(m,d,id):base.choose(m,d,id,c),
 validate:m=>{base.validate(m);snipe.assertSniping(m)}};
const clone=x=>JSON.parse(JSON.stringify(x));
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id;}
function prompt(m){const p=runtime.prompt(m,rules,'light');assert.ok(p);return runtime.prompt(m,rules,p.side);}
function step(m,id){return runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);}
function seek(m,fn){for(let n=0;n<700;n++){if(fn(m))return m;const p=prompt(m);m=step(m,p.choices.find(c=>c.id==='pass')?.id??p.choices[0].id);}throw Error('unreached boundary');}
const boundary=(m,kind)=>seek(m,x=>x.stack.at(-1)?.event?.kind===kind);
const choices=m=>prompt(m).choices.map(c=>c.id);
function fixture(bp='1_152',endpoint=0){
 let m=runtime.createMatch('laser-gate-weapon',60,['light','dark'].map(side=>({side,cards:[...(side==='light'?['2_57','2_57','1_152','1_153','1_157','1_155','1_11','1_21','1_109','1_105','1_129','5_12']:['2_113','1_283','1_284','1_285']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);
 const a=pull(m,'dark','1_283'),b=pull(m,'dark','1_284'),far=pull(m,'dark','1_285');m.locations.push(a,b,far);
 const gate=pull(m,'dark','2_113'),host=pull(m,'light',bp==='1_157'?'1_21':'1_11','table',[a,b][endpoint]),weapon=pull(m,'light',bp),card=pull(m,'light','2_57','hand');
 m.cards[weapon].attachedTo=host;m.cards[weapon].location=m.cards[host].location;
 m.data.laserGates={[gate]:{card:identity.referenceCard(m,gate),sites:[identity.referenceCard(m,a),identity.referenceCard(m,b)]}};
 for(const s of ['dark','light'])for(let i=0;i<10;i++)state.moveCard(m,m.players[s].reserve.at(-1),'force');
 m=runtime.startTurns(m,rules);m=seek(m,x=>x.stack.length===1&&x.turn.side==='light'&&x.turn.phase==='control');if(prompt(m).side!=='light')m=step(m,'pass');
 return {m,a,b,far,gate,host,weapon,card};
}
function deck(f,values){for(const id of [...f.m.players.light.reserve])state.moveCard(f.m,id,'hand');for(const value of [...values].reverse()){const c=Object.values(f.m.cards).find(c=>c.owner==='light'&&c.zone==='hand'&&c.id!==f.card&&Number(mod('board').cardDefinition(f.m,c.id).stats.destiny)===value);assert.ok(c,'destiny '+value);state.moveCard(f.m,c.id,'reserve');}}
const play=f=>step(f.m,'sniping:play:'+f.card+':'+f.weapon);
function fire(f){let m=seek(play(f),x=>x.stack.at(-1)?.handler==='sniping:target');m=step(m,'sniping:target:'+f.gate);return m;}
const latest=m=>m.data.snipingShots.at(-1);
for(const endpoint of [0,1])for(const [bp,values,hit]of [['1_152',[4],true],['1_152',[3],false],['1_153',[3],true],['1_157',[1,3],true],['1_155',[1,1],false]])test(`explicit control firing from endpoint ${endpoint}, ${bp}, ${values}`,()=>{
 const f=fixture(bp,endpoint);deck(f,values);const cost=bp==='1_153'?2:bp==='1_152'?1:bp==='1_155'?4:0,before=f.m.players.light.force.length;
 let m=boundary(fire(f),'weapon-fired');assert.equal(latest(m).total,values.reduce((a,b)=>a+b,0)+(bp==='1_153'?1:0));assert.equal(latest(m).outcome,hit?'hit':'miss');assert.equal(m.cards[f.gate].zone,hit?'lost':'table');assert.equal(before-m.players.light.force.length,cost);assert.deepEqual(prompt(m),prompt(clone(m)));
 m=seek(m,x=>x.cards[f.card].zone==='lost');assert.equal(m.cards[f.card].zone,'lost');
});
test('Interrupt cancellation precedes target choice, firing cost and weapon use',()=>{const f=fixture();let m=play(f);m.stack.find(x=>x.action?.handler==='sniping:play').cancelled=true;m=seek(m,x=>x.cards[f.card].zone==='lost');assert.equal(m.players.light.force.length,f.m.players.light.force.length);assert.equal(m.data.weaponUse,undefined);assert.equal(m.data.snipingShots,undefined);});
test('weapon cancellation retains paid firing cost but makes no draws or hits',()=>{const f=fixture();deck(f,[4]);let m=fire(f);m.stack.find(x=>x.action?.handler==='sniping:fire').cancelled=true;m=seek(m,x=>x.cards[f.card].zone==='lost');assert.equal(latest(m).outcome,'canceled');assert.deepEqual(latest(m).draws,[]);assert.equal(m.cards[f.gate].zone,'table');assert.equal(m.players.light.force.length,f.m.players.light.force.length-1);});
test('target may leave during Interrupt response; no weapon cost is paid',()=>{const f=fixture();let m=play(f);state.moveCard(m,f.gate,'lost');m=seek(m,x=>x.stack.at(-1)?.handler==='sniping:target');assert.deepEqual(choices(m),['sniping:no-target']);m=step(m,'sniping:no-target');assert.equal(m.players.light.force.length,f.m.players.light.force.length);assert.equal(m.cards[f.card].zone,'lost');});
test('destroying the original Gate and redeploying the physical card does not revive the target',()=>{const f=fixture();deck(f,[4]);let m=fire(f);state.moveCard(m,f.gate,'hand');state.moveCard(m,f.gate,'table');m.data.laserGates[f.gate].card=identity.referenceCard(m,f.gate);m=boundary(m,'weapon-fired');assert.equal(latest(m).outcome,'invalid');assert.equal(m.cards[f.gate].zone,'table');});
test('canceling the hit leaves Gate on table',()=>{const f=fixture();deck(f,[4]);let m=boundary(fire(f),'about-to-hit');m.stack.find(x=>x.action?.handler==='sniping:hit').cancelled=true;m=boundary(m,'weapon-fired');assert.equal(m.cards[f.gate].zone,'table');assert.equal(latest(m).outcome,'canceled');});
test('failed weapon destiny cannot hit defense three',()=>{const f=fixture();deck(f,[]);const m=boundary(fire(f),'weapon-fired');assert.equal(latest(m).total,null);assert.equal(latest(m).outcome,'miss');assert.equal(m.cards[f.gate].zone,'table');});
test('Han bonus is optional per just-drawn destiny and cannot repeat for that draw',()=>{const f=fixture();deck(f,[3]);let m=boundary(fire(f),'destiny-drawn');if(prompt(m).side!=='light')m=step(m,'pass');const id=choices(m).find(id=>id.startsWith('sniping:bonus:'));assert.ok(id);m=step(m,id);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');if(prompt(m).side!=='light')m=step(m,'pass');assert.ok(!choices(m).some(id=>id.startsWith('sniping:bonus:')));m=boundary(m,'weapon-fired');assert.equal(latest(m).total,4);assert.equal(m.cards[f.gate].zone,'lost');});
test('weapon bearer, range, turn, phase and Force restrict the firing offer',()=>{const f=fixture(),id='sniping:play:'+f.card+':'+f.weapon;assert.ok(choices(f.m).includes(id));f.m.cards[f.host].location=f.far;f.m.cards[f.weapon].location=f.far;assert.ok(!choices(f.m).includes(id));f.m.cards[f.host].location=f.a;f.m.cards[f.weapon].location=f.a;f.m.turn.phase='move';assert.ok(!choices(f.m).includes(id));f.m.turn.phase='control';for(const c of [...f.m.players.light.force])state.moveCard(f.m,c,'used');assert.ok(!choices(f.m).includes(id));});
test('tampered target binding and hit arithmetic reject',()=>{const f=fixture();deck(f,[4]);const m=fire(f),bad=clone(m);bad.data.snipingShots[0].target=identity.referenceCard(bad,f.host);assert.throws(()=>prompt(bad),/sniping/);const hit=boundary(m,'weapon-fired'),badHit=clone(hit);badHit.data.snipingShots[0].total=3;assert.throws(()=>prompt(badHit),/sniping/);});
test('removing the weapon after firing initiation does not undo the latched shot',()=>{const f=fixture();deck(f,[4]);let m=fire(f);state.moveCard(m,f.weapon,'lost');m=boundary(m,'weapon-fired');assert.equal(latest(m).outcome,'hit');assert.equal(m.cards[f.gate].zone,'lost');});
test('the Gate has a separate about-to-lose response before immediate loss',()=>{const f=fixture();deck(f,[4]);let m=boundary(fire(f),'about-to-lose');assert.equal(m.cards[f.gate].zone,'table');const w=m.stack.at(-1);mod('loss-prevention').preventLoss(m,w.serial,identity.referenceCard(m,f.gate));m=boundary(m,'weapon-fired');assert.equal(latest(m).outcome,'hit');assert.equal(m.cards[f.gate].zone,'table');});
test('Bionic Hand adds to the original firing user total before the Gate comparison',()=>{const f=fixture();const hand=pull(f.m,'light','5_12');f.m.cards[hand].attachedTo=f.host;f.m.cards[hand].location=f.a;deck(f,[3]);const m=boundary(fire(f),'weapon-fired');assert.equal(latest(m).total,4);assert.equal(m.cards[f.gate].zone,'lost');});
test('saved pending firing rejects forged actor, source, payment, action id and reference',()=>{const f=fixture();deck(f,[4]);const m=fire(f);for(const mutate of [r=>r.actor='dark',r=>r.action.source=f.gate,r=>r.action.payment={light:0},r=>r.action.id='forged',r=>r.action.unrespondable=true,r=>r.action.payload.weaponRef=identity.referenceCard(m,f.host)]){const bad=clone(m);mutate(bad.stack.find(x=>x.action?.handler==='sniping:fire'));assert.throws(()=>prompt(bad));}});
test('saved forwarded destiny cannot replace the weapon or total continuation actor',()=>{const f=fixture();deck(f,[4]);const m=boundary(fire(f),'destiny-drawn');for(const mutate of [p=>p.next.source=f.gate,p=>p.next.id='forged',p=>p.next.payload.weapon=f.host,p=>p.side='dark']){const bad=clone(m);mutate(bad.stack.find(x=>x.action?.handler==='destiny:finish').action.payload);assert.throws(()=>prompt(bad));}});
test('saved optional bonus remains bound to its original pending draw',()=>{const f=fixture();deck(f,[3]);let m=boundary(fire(f),'destiny-drawn');if(prompt(m).side!=='light')m=step(m,'pass');m=step(m,choices(m).find(id=>id.startsWith('sniping:bonus:')));for(const mutate of [p=>p.pendingIndex=-1,p=>p.pendingId='forged',p=>p.window+=1]){const bad=clone(m);mutate(bad.stack.find(x=>x.action?.handler==='sniping:bonus').action.payload);assert.throws(()=>prompt(bad));}});
