import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8801',owner='proof-integration-owner',guest='proof-integration-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8801','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt?.id||cp.game.engine+':'+cp.game.revision,choice});
async function next(cp,choice){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);await request('/'+cp.id,actor,command(view,choice));return request('/'+cp.id)}
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,choice){const body=command(cp,choice);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,owner,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body}}

const pick=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const fallback=cp=>pick(cp,'pass')?.id||pick(cp,'recirculate')?.id||pick(cp,'forfeit:')?.id||cp.game.prompt.choices[0].id;
async function until(cp,done,select=fallback){for(let n=0;n<250;n++){if(done(cp))return cp;assert.equal(cp.game.complete,false);if(cp.mode==='shared'&&cp.game.prompt.side!==cp.game.seat)cp=await request('/'+cp.id,cp.game.prompt.side==='light'?guest:owner);cp=await next(cp,select(cp))}throw Error('Checkpoint target not reached')}
const phase=(cp,stage,number=cp.game.turn?.number||1)=>until(cp,c=>c.game.turn?.number===number&&c.game.turn.stage===stage&&c.game.prompt?.side===c.game.active&&(!['deploy','move','battle'].includes(stage)||c.game.prompt.title.endsWith(stage+' opportunity')));



let recovered=0;
try{
 await start();
 for(const scenario of ['last-force','opening-table','react-barrier','react-drain-deploy'])for(const side of ['light','dark']){
  let cp=await request('',owner,{id:randomUUID(),scenario,mode:'shared'},201);await request('/'+cp.id,guest,{operation:'join'});
  const actor=side==='dark'?owner:guest;cp=await request('/'+cp.id,actor);const other=side==='light'?'dark':'light';
  const body={...command(cp,'concede-game'),seat:side};
  await request('/'+cp.id,actor,{...body,seat:other},403);
  await request('/'+cp.id,'uninvited-pilot',body,403);await request('/'+cp.id,null,body,401);
  const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,actor,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);
  cp=await request('/'+cp.id,owner);assert.equal(cp.game.winner,other);assert.equal(cp.game.concededBy,side);assert.equal(cp.game.complete,true);assert.equal(cp.game.prompt,null);
  cp=await restartAt(cp);recovered++;
  for(const seatActor of [owner,guest]){const v=await request('/'+cp.id,seatActor);assert.equal(v.game.winner,other);assert.deepEqual(v.game.players[v.game.seat==='light'?'dark':'light'].hand,[]);await request('/'+cp.id,seatActor,{...command(v,'pass'),prompt:v.game.engine+':'+v.game.revision},422);await request('/'+cp.id,seatActor,{...command(v,'concede-game'),prompt:v.game.engine+':'+v.game.revision},422);}
  assert.equal((await request('/'+cp.id,actor,body)).duplicate,true);
 }
 // A normal move racing a concession commits only one revision.
 for(let n=0;n<3;n++){
  let cp=await request('',owner,{id:randomUUID(),scenario:'last-force',mode:'shared'},201);await request('/'+cp.id,guest,{operation:'join'});
  const dark=await request('/'+cp.id,owner),light=await request('/'+cp.id,guest);
  const results=await Promise.all([call('/'+cp.id,owner,command(dark,'drain')),call('/'+cp.id,guest,command(light,'concede-game'))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  cp=await request('/'+cp.id);assert.equal(cp.game.revision,1);
 }
 // Two players conceding concurrently cannot reverse the first committed result.
 let cp=await request('',owner,{id:randomUUID(),scenario:'last-force',mode:'shared'},201);await request('/'+cp.id,guest,{operation:'join'});
 const dark=await request('/'+cp.id,owner),light=await request('/'+cp.id,guest);
 const race=await Promise.all([call('/'+cp.id,owner,command(dark,'concede-game')),call('/'+cp.id,guest,command(light,'concede-game'))]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 // No concession awards a win to an empty seat.
 cp=await request('',owner,{id:randomUUID(),scenario:'last-force',mode:'shared'},201);await request('/'+cp.id,owner,command(cp,'concede-game'),409);
 // The solo author explicitly chooses either side, regardless of the prompt owner.
 for(const side of ['light','dark']){cp=await request('',owner,{id:randomUUID(),scenario:'last-force',mode:'solo'},201);cp=await request('/'+cp.id,owner,{...command(cp,'concede-game'),seat:side});assert.equal(cp.game.winner,side==='light'?'dark':'light');}
 console.log(JSON.stringify({requests:calls,recovered,verified:'Both seats can concede out of turn; eight-way receipts, wrong-seat/uninvited denial, frozen results after restarts, regular-command races, simultaneous concessions, empty-seat restriction and solo-side selection pass.'}));
}finally{await stop()}
