import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8798',owner='proof-garrison-owner',guest='proof-garrison-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8798','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
async function next(cp,choice){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);await request('/'+cp.id,actor,command(view,choice));return request('/'+cp.id)}
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,choice){const body=command(cp,choice);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,owner,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body}}

const pick=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const fallback=cp=>pick(cp,'pass')?.id||pick(cp,'recirculate')?.id||pick(cp,'forfeit:')?.id||cp.game.prompt.choices[0].id;
async function until(cp,done,select=fallback){for(let n=0;n<250;n++){if(done(cp))return cp;assert.equal(cp.game.complete,false);cp=await next(cp,select(cp))}throw Error('Checkpoint target not reached')}
const phase=(cp,stage,number=cp.game.turn?.number||1)=>until(cp,c=>c.game.turn?.number===number&&c.game.turn.stage===stage&&c.game.prompt?.side===c.game.active&&(!['deploy','move','battle'].includes(stage)||c.game.prompt.title.endsWith(stage+' opportunity')));
try{
 await start();
 for(const scenario of ['guard-post','rebel-post']){
  let cp=await request('',owner,{id:randomUUID(),scenario,mode:'solo'},201);const side=cp.game.active,guard=side==='dark'?'1_181':'1_26';const id=cp.game.players[side].hand.find(c=>c.blueprint===guard).id;
  const deployed=await duplicate(cp,'deploy:'+id+':'+cp.game.locations[0].id);cp=await restartAt(deployed.cp);assert.equal(cp.game.players[side].counts.force,4);
  const played=await duplicate(cp,pick(cp,'play:').id);cp=await restartAt(played.cp);assert.equal(cp.game.playing.length,1);cp=await until(cp,c=>c.game.complete);cp=await restartAt(cp);assert.equal(cp.game.turn.restrictions.length,0);assert.equal(cp.game.table.find(c=>c.id===id).rulesView.canMove,false);
  for(const body of [deployed.body,played.body]){const r=await request('/'+cp.id,owner,body);assert.equal(r.duplicate,true);assert.equal(r.game.revision,cp.game.revision)}
  cp=await request('',owner,{id:randomUUID(),scenario,mode:'solo'},201);const own=cp.game.players[side].hand.find(c=>c.blueprint===guard).id;cp=await next(cp,'deploy:'+own+':'+cp.game.locations[0].id);cp=await phase(cp,'battle');cp=await next(cp,pick(cp,'battle:').id);cp=await until(cp,c=>!!pick(c,'forfeit:'));cp=await restartAt(cp);assert.equal(cp.game.losses[side].damage,4);cp=(await duplicate(cp,pick(cp,'forfeit:').id)).cp;cp=await restartAt(cp);assert.equal(cp.game.losses[side].damage,3);cp=await until(cp,c=>c.game.complete);
 }
 let cp=await request('',owner,{id:randomUUID(),scenario:'corridor-crossfire',mode:'solo'},201);const blaster=cp.game.players.dark.hand.find(c=>c.blueprint==='1_317').id;cp=(await duplicate(cp,pick(cp,'equip:'+blaster+':').id)).cp;cp=await until(cp,c=>!!pick(c,'battle'));cp=await next(cp,'battle');cp=await until(cp,c=>!!pick(c,'fire:'));assert.equal(pick(cp,'fire:').weaponPreview.bonus,1);const fire=await duplicate(cp,pick(cp,'fire:').id);cp=await restartAt(fire.cp);cp=await until(cp,c=>c.game.battle.shots[0].status==='drawn');cp=await restartAt(cp);assert.equal(cp.game.battle.shots[0].destiny,1);assert.equal(cp.game.battle.shots[0].bonus,1);cp=await until(cp,c=>c.game.complete);cp=await restartAt(cp);assert.equal(cp.game.battle.shots[0].hit,true);assert.equal((await request('/'+cp.id,owner,fire.body)).duplicate,true);
 for(const scenario of ['guard-post','rebel-post','corridor-crossfire']){
  const room=await request('',owner,{id:randomUUID(),scenario,mode:'shared'},201);await request('/'+room.id,guest,{operation:'join'});
  for(const [actor,side,other] of [[owner,'dark','light'],[guest,'light','dark']]){const v=await request('/'+room.id,actor);assert.deepEqual(v.game.players[other].hand,[]);assert.equal(v.game.seat,side);await request('/'+room.id,actor,{...command(v,'pass'),seat:other},403)}
  const actor=scenario==='rebel-post'?guest:owner,v=await request('/'+room.id,actor);const first=command(v,v.game.prompt.choices[0].id),second=command(v,'pass');const r=await Promise.all([call('/'+room.id,actor,first),call('/'+room.id,actor,second)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);
  const before=await request('/'+room.id,owner);await restartAt(room);assert.deepEqual(await request('/'+room.id,owner),before);await request('/'+room.id,'uninvited-garrison-pilot',undefined,403);await request('/'+room.id,null,undefined,401);
 }
 console.log(JSON.stringify({requests:calls,verified:'All three scenarios: paid deployment, paid Barrier, printed immobility after expiry, battle totals, forfeit balance, Corridor paid/revealed shot and completion survive Worker restart. Eight-way retries, late receipts, concurrent conflict and paired authorization/privacy pass.'}));
}finally{await stop()}
