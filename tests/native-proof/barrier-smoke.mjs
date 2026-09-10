import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8793',owner='proof-barrier-owner',guest='proof-barrier-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8793','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
const choice=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const actorFor=cp=>cp.mode==='shared'&&cp.game.prompt?.side==='light'?guest:owner;
async function acting(cp){const actor=actorFor(cp);return {actor,cp:await request('/'+cp.id,actor)}}
async function advance(cp,id){const a=await acting(cp);await request('/'+cp.id,a.actor,command(a.cp,id));return request('/'+cp.id)}
async function ready(scenario,mode='solo'){
 let cp=await request('',owner,{id:randomUUID(),scenario,mode},201);
 if(mode==='shared')await request('/'+cp.id,guest,{operation:'join'});
 const a=await acting(cp);cp=await advance(cp,choice(a.cp,'deploy:').id);
 return (await acting(cp)).cp;
}
try{
 await start();
 for(const scenario of ['barrier','imperial-barrier']){
  let cp=await ready(scenario),path='/'+cp.id;const side=cp.game.prompt.side,deployer=cp.game.turn.deployer,play=choice(cp,'play:'),body=command(cp,play.id);
  assert.equal(cp.game.prompt.automatic,false);assert.equal(cp.game.players[deployer].counts.force,4);
  const raced=await Promise.all(Array.from({length:8},()=>request(path,owner,body)));
  assert.equal(raced.filter(r=>!r.duplicate).length,1);
  for(const r of raced){assert.equal(r.game.revision,body.version+1);assert.equal(r.game.players[side].counts.force,0);assert.equal(r.game.playing[0].id,play.card);assert.equal(r.game.turn.restrictions.length,0)}
  const paid=await request(path);await stop();await start();assert.deepEqual(await request(path),paid);
  const retry=await request(path,owner,body);assert.equal(retry.duplicate,true);assert.equal(retry.game.players[side].counts.used,1);
  cp=await advance(await request(path),'pass');cp=await advance(cp,'pass');assert.equal(cp.game.turn.restrictions.length,1);assert.equal(cp.game.players[side].counts.used,2);
  await request(path,owner,body);assert.equal((await request(path)).game.turn.restrictions.length,1);
  // Read saved state after every decision, including meaningful deploy/move/draw.
  let deployed=false,moved=false,drawn=false,n=0;
  while(!cp.game.complete){
   assert.ok(n++<130);const a=await acting(cp);let id='pass';
   if(!deployed&&choice(a.cp,'deploy:')){id=choice(a.cp,'deploy:').id;deployed=true}
   else if(choice(a.cp,'battle:'))id=choice(a.cp,'battle:').id;
   else if(!moved&&choice(a.cp,'move:')){id=choice(a.cp,'move:').id;moved=true}
   else if(!drawn&&choice(a.cp,'draw')){id='draw';drawn=true}
   else if(choice(a.cp,'recirculate'))id='recirculate';
   cp=await advance(cp,id);
  }
  assert.ok(deployed&&moved&&drawn);assert.equal(cp.game.turn.expired.length,1);assert.equal(cp.game.turn.restrictions.length,0);assert.deepEqual(cp.game.battle.power,{light:1,dark:1});
  // Only one of Play/Pass can commit this revision.
  cp=await ready(scenario);path='/'+cp.id;
  const conflict=await Promise.all([choice(cp,'play:').id,'pass'].map(id=>call(path,owner,command(cp,id))));assert.deepEqual(conflict.map(r=>r.status).sort(),[200,409]);
  cp=await ready(scenario,'shared');path='/'+cp.id;const player=actorFor(cp),opponent=player===owner?guest:owner,hidden=choice(cp,'play:').card;
  const other=await request(path,opponent);assert.deepEqual(other.game.prompt.choices,[]);assert.equal(JSON.stringify(other.game).includes(hidden),false);
  await request(path,opponent,command(cp,choice(cp,'play:').id),403);await request(path,'proof-barrier-outsider',undefined,403);await request(path,null,undefined,401);
  await request(path,player,command(cp,choice(cp,'play:').id));assert.equal((await request(path,opponent)).game.playing[0].id,hidden);
  cp=await request(path);cp=await advance(cp,'pass');cp=await advance(cp,'pass');assert.equal(cp.game.turn.restrictions.length,1);
 }
 console.log('Barrier API checks passed: '+calls+' requests; both sides, 8-way duplicate plays, Play/Pass races, paid-frame process restarts, full-turn recovery, separate-seat privacy.');
}finally{await stop()}
