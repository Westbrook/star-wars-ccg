import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8795',owner='proof-turn-owner',guest='proof-turn-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8795','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
const choice=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const actorFor=cp=>cp.mode==='shared'&&cp.game.prompt?.side==='light'?guest:owner;
async function acting(cp){const actor=actorFor(cp);return {actor,cp:await request('/'+cp.id,actor)}}
async function advance(cp,id){const a=await acting(cp);await request('/'+cp.id,a.actor,command(a.cp,id));return request('/'+cp.id)}
const select=cp=>choice(cp,'recirculate')?.id||choice(cp,'pass')?.id||choice(cp,'lose:reserve')?.id||cp.game.prompt.choices[0].id;
async function until(cp,done,pick=select){for(let n=0;n<250;n++){cp=(await acting(cp)).cp;if(done(cp))return cp;assert.equal(cp.game.complete,false);cp=await advance(cp,pick(cp))}throw Error('Checkpoint not reached.')}
const phase=(cp,stage,number=cp.game.turn.number)=>until(cp,x=>x.game.turn.stage===stage&&x.game.turn.number===number);
const activate=cp=>until(cp,x=>x.game.turn.stage==='control',x=>choice(x,'activate')?.id||select(x));
const ready=cp=>until(cp,x=>x.game.prompt.title.endsWith('opportunity')&&x.game.prompt.side===x.game.active);
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,id){const a=await acting(cp),body=command(a.cp,id);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,a.actor,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body,actor:a.actor}}
async function deployBarrier(cp,site){cp=await ready(await phase(cp,'deploy'));const card=cp.game.players[cp.game.active].hand.find(c=>c.type==='Character');cp=await advance(cp,'deploy:'+card.id+':'+site);cp=(await acting(cp)).cp;assert.equal(cp.game.prompt.automatic,false);cp=await advance(cp,choice(cp,'play:').id);return cp}
try{
 await start();
 let cp=await request('',owner,{id:randomUUID(),scenario:'next-turn',mode:'solo'},201);const path='/'+cp.id,bay=cp.game.locations[0].id,corridor=cp.game.locations[1].id,darkOriginal=cp.game.table.find(c=>c.side==='dark').id;
 cp=await phase(cp,'activate');const activation=await duplicate(cp,'activate');cp=activation.cp;assert.equal(cp.game.cycle.activated,1);assert.equal(cp.game.players.dark.counts.force,2);cp=await restartAt(cp);assert.equal((await request(path,owner,activation.body)).duplicate,true);
 cp=await activate(cp);cp=await advance(cp,'drain:'+bay);cp=await until(cp,x=>x.game.prompt.title==='Choose Force to lose');cp=await advance(cp,'lose:reserve');
 cp=await deployBarrier(cp,bay);assert.equal(cp.game.turn.restrictions.length,0);assert.equal(cp.game.playing.length,1);cp=await restartAt(cp);cp=await advance(cp,'pass');cp=await advance(cp,'pass');assert.equal(cp.game.turn.restrictions.length,1);
 cp=await ready(await phase(cp,'move'));cp=await advance(cp,'move:'+darkOriginal+':'+corridor);cp=await phase(cp,'end');const before=cp.game.players;
 cp=await advance(cp,'recirculate');assert.equal(cp.game.active,'dark');assert.equal(cp.game.players.dark.counts.used,0);assert.equal(cp.game.turn.restrictions.length,1);cp=await restartAt(cp);
 cp=await advance(cp,'recirculate');assert.equal(cp.game.active,'dark');assert.equal(cp.game.turn.restrictions.length,0);assert.equal(cp.game.turn.moved.length,1);assert.equal(cp.game.turn.number,1);
 for(const side of ['dark','light'])assert.equal(cp.game.players[side].counts.force,before[side].counts.force);
 cp=await restartAt(cp);cp=await advance(cp,'pass');const handoff=await duplicate(cp,'pass');cp=handoff.cp;
 assert.equal(cp.game.active,'light');assert.equal(cp.game.turn.stage,'start');assert.equal(cp.game.cycle.generation,0);assert.equal(cp.game.cycle.history.length,1);assert.deepEqual(cp.game.turn.moved,[]);cp=await restartAt(cp);
 const oldRetry=await request(path,owner,activation.body);assert.equal(oldRetry.duplicate,true);assert.equal(oldRetry.game.revision,cp.game.revision);assert.equal((await request(path,owner,handoff.body)).duplicate,true);
 cp=await activate(cp);assert.equal(cp.game.cycle.generation,2);cp=await deployBarrier(cp,corridor);cp=await advance(cp,'pass');cp=await advance(cp,'pass');assert.equal(cp.game.turn.restrictions[0].expiresTurn,2);
 cp=await ready(await phase(cp,'battle'));cp=await advance(cp,'battle:'+corridor);cp=await until(cp,x=>x.game.battle?.resolved);assert.deepEqual(cp.game.battle.power,{dark:1,light:1});cp=await phase(cp,'end');cp=await restartAt(cp);
 cp=await until(cp,x=>x.game.complete);assert.equal(cp.game.turn.number,3);assert.equal(cp.game.phase,'Activate');assert.equal(cp.game.cycle.history.length,2);assert.equal(cp.game.cycle.activated,0);assert.equal(cp.game.battle,null);assert.equal(cp.game.players.dark.counts.force,1);assert.equal(cp.game.players.light.counts.force,0);cp=await restartAt(cp);
 // Competing activation/pass may only commit one branch of the same saved prompt.
 let race=await request('',owner,{id:randomUUID(),scenario:'next-turn',mode:'solo'},201);race=await phase(race,'activate');const results=await Promise.all(['activate','pass'].map(id=>call('/'+race.id,owner,command(race,id))));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 // Separate seats remain private before and after changing active player.
 let shared=await request('',owner,{id:randomUUID(),scenario:'next-turn',mode:'shared'},201);await request('/'+shared.id,guest,{operation:'join'});
 const own=await request('/'+shared.id,owner),opp=await request('/'+shared.id,guest);for(const card of own.game.players.dark.hand)assert.equal(JSON.stringify(opp.game).includes(card.id),false);assert.deepEqual(opp.game.prompt.choices,[]);
 await request('/'+shared.id,guest,command(own,'pass'),403);await request('/'+shared.id,'outsider-turn-pilot',undefined,403);await request('/'+shared.id,null,undefined,401);
 shared=await phase(shared,'activate',2);const light=await request('/'+shared.id,guest),dark=await request('/'+shared.id,owner);assert.equal(light.game.active,'light');assert.equal(light.game.seat,'light');assert.equal(light.game.prompt.side,'light');assert.equal(light.game.prompt.automatic,false);assert.deepEqual(dark.game.prompt.choices,[]);
 for(const card of light.game.players.light.hand)assert.equal(JSON.stringify(dark.game).includes(card.id),false);
 await request('/'+shared.id,owner,command(light,'activate'),403);const lightAct=await duplicate(light,'activate');assert.equal(lightAct.cp.game.players.light.counts.force,2);shared=await until(lightAct.cp,x=>x.game.complete);assert.equal(shared.game.cycle.history.length,2);
 console.log('Turn API checks passed: '+calls+' requests; 8-way activation/handoff retries, conflicting choices, paid Barrier/partial recirculation/end/start/completed process recovery and separate-seat privacy across handoff.');
}finally{await stop()}
