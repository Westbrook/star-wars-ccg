import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8797',owner='proof-opening-owner',guest='proof-opening-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8797','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
const candidate=(cp,blueprint)=>cp.game.setup.candidates.find(c=>c.blueprint===blueprint).id;
async function next(cp,choice){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);await request('/'+cp.id,actor,command(view,choice));return request('/'+cp.id)}
async function finish(cp){for(let n=0;!cp.game.complete&&n<40;n++){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);cp=await next(cp,view.game.prompt.choices[0].id)}assert.equal(cp.game.complete,true);return cp}
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,choice){const body=command(cp,choice);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,owner,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body}}

const pick=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const fallback=cp=>pick(cp,'pass')?.id||pick(cp,'recirculate')?.id||pick(cp,'forfeit:')?.id||cp.game.prompt.choices[0].id;
async function until(cp,done,select=fallback){for(let n=0;n<250;n++){if(done(cp))return cp;assert.equal(cp.game.complete,false);cp=await next(cp,select(cp))}throw Error('Checkpoint target not reached')}
const phase=(cp,stage,number=cp.game.turn?.number||1)=>until(cp,c=>c.game.turn?.number===number&&c.game.turn.stage===stage&&c.game.prompt?.side===c.game.active&&(!['deploy','move','battle'].includes(stage)||c.game.prompt.title.endsWith(stage+' opportunity')));
const activate=cp=>until(cp,c=>c.game.turn.stage==='control',c=>pick(c,'activate')?.id||fallback(c));
const ready=cp=>until(cp,c=>c.game.prompt?.title.endsWith('deploy opportunity')&&c.game.prompt.side===c.game.active);
async function deploy(cp){cp=await phase(cp,'deploy');const bay=cp.game.locations.find(c=>c.blueprint==='1_124').id;return next(cp,cp.game.prompt.choices.find(c=>c.id.startsWith('deploy:')&&c.id.endsWith(':'+bay)).id)}
try{
 await start();let cp=await request('',owner,{id:randomUUID(),scenario:'first-contact',mode:'solo'},201);
 cp=await until(cp,c=>c.game.setup?.stage==='draw');const draw=await duplicate(cp,'draw-opening');cp=await next(draw.cp,'pass');cp=await restartAt(cp);
 const transition=await duplicate(cp,'pass');cp=transition.cp;assert.equal(cp.game.setup,undefined);assert.equal(cp.game.turn.number,1);assert.equal(cp.game.players.dark.counts.hand,8);cp=await restartAt(cp);
 const activation=await duplicate(cp,'activate');cp=await activate(activation.cp);cp=await ready(await deploy(cp));cp=await ready(await next(cp,pick(cp,'equip:').id));cp=await restartAt(cp);
 const host=cp.game.table.find(c=>c.side==='dark'&&c.type==='Character');assert.ok(cp.game.table.some(c=>c.attachedTo===host.id));
 cp=await activate(await phase(cp,'activate',2));cp=await ready(await deploy(cp));cp=await phase(cp,'battle');cp=await next(cp,pick(cp,'battle:').id);cp=await until(cp,c=>!!pick(c,'fire:'));
 const shot=await duplicate(cp,pick(cp,'fire:').id);cp=await restartAt(shot.cp);assert.equal(cp.game.battle.shots[0].status,'pending');cp=await until(cp,c=>c.game.battle.shots[0].status==='drawn');cp=await restartAt(cp);
 cp=await until(cp,c=>!!pick(c,'forfeit:'));assert.deepEqual(cp.game.losses.light,{attrition:0,damage:0,initialAttrition:0,initialDamage:0});assert.equal(cp.game.weaponStudy.hits.light.length,1);cp=await next(cp,pick(cp,'forfeit:').id);cp=await restartAt(cp);
 cp=await until(cp,c=>c.game.complete);assert.equal(cp.game.turn.number,3);cp=await restartAt(cp);
 for(const body of [draw.body,transition.body,activation.body,shot.body]){const retry=await request('/'+cp.id,owner,body);assert.equal(retry.duplicate,true);assert.equal(retry.game.revision,cp.game.revision)}
 // Persist a paid Barrier before resolution, then finish its expiry boundary.
 let b=await request('',owner,{id:randomUUID(),scenario:'first-contact',mode:'solo'},201);b=await until(b,c=>!c.game.setup);b=await activate(b);b=await activate(await phase(b,'activate',2));b=await deploy(b);b=await until(b,c=>!!pick(c,'play:'));b=(await duplicate(b,pick(b,'play:').id)).cp;b=await restartAt(b);assert.equal(b.game.playing.length,1);b=await until(b,c=>c.game.complete);assert.equal(b.game.turn.expired.length,1);assert.equal(b.game.turn.restrictions.length,0);
 // Separate actors, concurrent private choices and hand privacy survive setup.
 let room=await request('',owner,{id:randomUUID(),scenario:'first-contact',mode:'shared'},201);await request('/'+room.id,guest,{operation:'join'});const dark=await request('/'+room.id,owner),light=await request('/'+room.id,guest);
 const dc=command(dark,dark.game.prompt.choices[0].id),lc=command(light,light.game.prompt.choices[0].id);const results=await Promise.all([call('/'+room.id,owner,dc),call('/'+room.id,guest,lc)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const actor=results[0].status===409?owner:guest;const view=await request('/'+room.id,actor);assert.equal(view.game.setup.selected[actor===owner?'light':'dark'],null);await request('/'+room.id,actor,command(view,view.game.prompt.choices[0].id));room=await request('/'+room.id);
 for(let n=0;room.game.setup&&n<15;n++){const actor=room.game.prompt.side==='light'?guest:owner,v=await request('/'+room.id,actor);room=await next(room,fallback(v))}assert.equal(room.game.setup,undefined);
 for(const [actor,side,other] of [[owner,'dark','light'],[guest,'light','dark']]){const v=await request('/'+room.id,actor);assert.equal(v.game.players[side].hand.length,8);assert.deepEqual(v.game.players[other].hand,[]);assert.equal(JSON.stringify(v.game).includes('shuffleOrder'),false)}
 const dv=await request('/'+room.id,owner),lv=await request('/'+room.id,guest);await stop();await start();assert.deepEqual(await request('/'+room.id,owner),dv);assert.deepEqual(await request('/'+room.id,guest),lv);await request('/'+room.id,'outside-opening-pilot',undefined,403);await request('/'+room.id,null,undefined,401);
 console.log(JSON.stringify({requests:calls,verified:'Setup transition, activation, weapon deployment, paid/revealed defensive shot, hit forfeit, paid Barrier, completion, eight-way retries, late receipts and paired hand privacy survive process restart.'}));
}finally{await stop()}
