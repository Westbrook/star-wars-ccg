import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8794',owner='proof-weapon-owner',guest='proof-weapon-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8794','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
const choice=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const actorFor=cp=>cp.mode==='shared'&&cp.game.prompt?.side==='light'?guest:owner;
async function acting(cp){const actor=actorFor(cp);return {actor,cp:await request('/'+cp.id,actor)}}
async function advance(cp,id){const a=await acting(cp);await request('/'+cp.id,a.actor,command(a.cp,id));return request('/'+cp.id)}
const sideOther=s=>s==='dark'?'light':'dark';
async function until(cp,done,select=cp=>choice(cp,'pass')?.id||cp.game.prompt.choices[0].id){
 for(let n=0;n<160;n++){const a=await acting(cp);cp=a.cp;if(done(cp))return cp;assert.equal(cp.game.complete,false);cp=await advance(cp,select(cp))}throw Error('Checkpoint not reached.');
}
async function ready(scenario,mode='solo'){
 let cp=await request('',owner,{id:randomUUID(),scenario,mode},201);if(mode==='shared')await request('/'+cp.id,guest,{operation:'join'});
 for(const rifle of [false,true]){
  cp=await until(cp,x=>x.game.prompt.title==='Arm your troopers'&&x.game.prompt.side===x.game.active);
  const g=cp.game,w=g.players[g.active].hand.find(c=>c.name.includes('Rifle')===rifle);cp=await advance(cp,'equip:'+w.id+':'+g.battle.participants[g.active][0]);
 }
 cp=await until(cp,x=>x.game.prompt.title==='Initiate battle');cp=await advance(cp,'battle');return until(cp,x=>x.game.prompt.title==='Weapons opportunity'&&x.game.prompt.side===x.game.active);
}
const rifleShot=cp=>cp.game.prompt.choices.find(c=>c.weaponPreview?.cost===2);
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
try{
 await start();
 for(const scenario of ['weapons','rebel-weapons']){
  let cp=await ready(scenario),path='/'+cp.id,s=cp.game.active,o=sideOther(s),body=command(cp,rifleShot(cp).id);
  const raced=await Promise.all(Array.from({length:8},()=>request(path,owner,body)));assert.equal(raced.filter(r=>!r.duplicate).length,1);
  for(const r of raced){assert.equal(r.game.revision,body.version+1);assert.equal(r.game.players[s].counts.force,2);assert.equal(r.game.battle.shots.length,1);assert.equal(r.game.battle.shots[0].status,'pending');assert.equal(r.game.weaponStudy.hits[o].length,0)}
  cp=await restartAt(cp);const retry=await request(path,owner,body);assert.equal(retry.duplicate,true);assert.equal(retry.game.players[s].counts.force,2);
  cp=await advance(cp,'pass');cp=await advance(cp,'pass');assert.equal(cp.game.battle.shots[0].status,'drawn');assert.equal(cp.game.players[s].destiny.length,1);assert.equal(cp.game.weaponStudy.hits[o].length,0);
  cp=await restartAt(cp);cp=await advance(cp,'pass');cp=await advance(cp,'pass');assert.equal(cp.game.battle.shots[0].status,'resolved');assert.equal(cp.game.weaponStudy.hits[o].length,1);
  cp=await until(cp,x=>x.game.prompt.title==='Weapons opportunity'&&x.game.prompt.side===o);cp=await advance(cp,rifleShot(cp).id);
  // Hit return fire, skip battle destiny: hit obligation remains with zero totals.
  cp=await until(cp,x=>x.game.prompt.title==='Satisfy battle losses',x=>choice(x,'skip-destiny')?.id||choice(x,'pass')?.id||x.game.prompt.choices[0].id);
  assert.deepEqual(cp.game.battle.attrition,{light:0,dark:0});assert.deepEqual(cp.game.battle.damage,{light:0,dark:0});assert.equal(cp.game.prompt.choices.length,1);
  cp=await advance(cp,cp.game.prompt.choices[0].id);assert.equal(cp.game.weaponStudy.lostOrder.remaining.length,3);
  cp=await restartAt(cp);const chosen=cp.game.weaponStudy.lostOrder.remaining[0].id,place=command(cp,'place-lost:'+chosen);
  const orders=await Promise.all(Array.from({length:8},()=>request(path,owner,place)));assert.equal(orders.filter(r=>!r.duplicate).length,1);
  cp=await request(path);assert.equal(cp.game.weaponStudy.lostOrder.remaining.length,2);assert.equal(cp.game.players[s].counts.lost,1);
  cp=await restartAt(cp);assert.equal((await request(path,owner,place)).duplicate,true);
  const selections=cp.game.prompt.choices.slice(0,2).map(c=>c.id);const conflict=await Promise.all(selections.map(id=>call(path,owner,command(cp,id))));assert.deepEqual(conflict.map(r=>r.status).sort(),[200,409]);
  cp=await request(path);assert.equal(cp.game.weaponStudy.lostOrder,null);assert.equal(cp.game.players[s].counts.lost,3);
  cp=await until(cp,x=>x.game.complete,x=>choice(x,'pass')?.id||x.game.prompt.choices[0].id);assert.equal(cp.game.weaponStudy.hits.light.length+cp.game.weaponStudy.hits.dark.length,0);
  const late=await request(path,owner,body);assert.equal(late.duplicate,true);assert.equal(late.game.battle.shots.length,2);
  // A competing pass cannot spend Force alongside the winning firing command.
  cp=await ready(scenario);path='/'+cp.id;const fireRace=await Promise.all([rifleShot(cp).id,'pass'].map(id=>call(path,owner,command(cp,id))));assert.deepEqual(fireRace.map(r=>r.status).sort(),[200,409]);
  // New shared room: inspect hidden hand before its first deployment, then paid shot.
  cp=await request('',owner,{id:randomUUID(),scenario,mode:'shared'},201);await request('/'+cp.id,guest,{operation:'join'});const actor=cp.game.active==='dark'?owner:guest,opponent=actor===owner?guest:owner;
  const own=await request('/'+cp.id,actor),hidden=own.game.players[own.game.active].hand.map(c=>c.id),other=await request('/'+cp.id,opponent);
  for(const id of hidden)assert.equal(JSON.stringify(other.game).includes(id),false);assert.deepEqual(other.game.prompt.choices,[]);
  await request('/'+cp.id,opponent,command(own,own.game.prompt.choices[0].id),403);await request('/'+cp.id,'proof-weapon-outsider',undefined,403);await request('/'+cp.id,null,undefined,401);
  cp=await ready(scenario,'shared');path='/'+cp.id;const player=actorFor(cp);await request(path,player,command(cp,rifleShot(cp).id));
  const pending=await request(path,player===owner?guest:owner);assert.equal(pending.game.battle.shots[0].status,'pending');assert.equal(pending.game.players[pending.game.active].hand.length,0);
 }
 console.log('Weapon API checks passed: '+calls+' requests; mirrored 8-way firing/order retries, conflicting actions, paid/revealed shots and partial Lost-order process restarts, completed recovery and separate-seat privacy.');
}finally{await stop()}
