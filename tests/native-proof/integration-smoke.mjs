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
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
async function next(cp,choice){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);await request('/'+cp.id,actor,command(view,choice));return request('/'+cp.id)}
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,choice){const body=command(cp,choice);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,owner,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body}}

const pick=(cp,prefix)=>cp.game.prompt?.choices.find(c=>c.id.startsWith(prefix));
const fallback=cp=>pick(cp,'pass')?.id||pick(cp,'recirculate')?.id||pick(cp,'forfeit:')?.id||cp.game.prompt.choices[0].id;
async function until(cp,done,select=fallback){for(let n=0;n<250;n++){if(done(cp))return cp;assert.equal(cp.game.complete,false);if(cp.mode==='shared'&&cp.game.prompt.side!==cp.game.seat)cp=await request('/'+cp.id,cp.game.prompt.side==='light'?guest:owner);cp=await next(cp,select(cp))}throw Error('Checkpoint target not reached')}
const phase=(cp,stage,number=cp.game.turn?.number||1)=>until(cp,c=>c.game.turn?.number===number&&c.game.turn.stage===stage&&c.game.prompt?.side===c.game.active&&(!['deploy','move','battle'].includes(stage)||c.game.prompt.title.endsWith(stage+' opportunity')));


const {observe,runPath,project,scenarioFor,paths}=await import('./integration-paths.mjs');let decisions=0,recovered=0;
try{
 await start();
 for(const path of paths){
  const trace=[];observe((before,choice,next)=>trace.push({choice,next}));runPath(path);observe(undefined);let cp=await request('',owner,{id:randomUUID(),scenario:scenarioFor(path),mode:'solo'},201);const receipts=[];const restarted=new Set();
  for(const {choice,next:expected} of trace){
   const checkpointKind=choice.startsWith('play:')?'barrier':choice.startsWith('react:')?'react':choice==='lose:reserve'?'loss':null;
   if(checkpointKind&&!restarted.has(checkpointKind)){const r=await duplicate(cp,choice);cp=r.cp;receipts.push(r.body);cp=await restartAt(cp);recovered++;restarted.add(checkpointKind);}else cp=await next(cp,choice);
   assert.deepEqual(cp.game,JSON.parse(JSON.stringify(project(expected,cp.game.seat,true))));decisions++;
  }
  assert.equal(cp.game.complete,true);
  await request('/'+cp.id,owner,{commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.engine+':'+cp.game.revision,choice:'pass'},422);
  for(const body of receipts){const r=await request('/'+cp.id,owner,body);assert.equal(r.duplicate,true);assert.equal(r.game.revision,cp.game.revision)}
 }
 for(const scenario of ['react-drain-deploy','react-barrier','last-force']){
  let cp=await request('',owner,{id:randomUUID(),scenario,mode:'shared'},201);await request('/'+cp.id,guest,{operation:'join'});
  for(const [actor,side,other] of [[owner,'dark','light'],[guest,'light','dark']]){const v=await request('/'+cp.id,actor);assert.equal(v.game.seat,side);assert.deepEqual(v.game.players[other].hand,[]);await request('/'+cp.id,actor,{...command(v,'pass'),seat:other},403)}
  const v=await request('/'+cp.id,owner),a=command(v,v.game.prompt.choices[0].id),b=command(v,v.game.prompt.choices[0].id);const result=await Promise.all([call('/'+cp.id,owner,a),call('/'+cp.id,owner,b)]);assert.deepEqual(result.map(x=>x.status).sort(),[200,409]);cp=await restartAt(cp);recovered++;await request('/'+cp.id,'uninvited-integration-pilot',undefined,403);await request('/'+cp.id,null,undefined,401);
 }
 console.log(JSON.stringify({requests:calls,decisions,recovered,verified:'Twelve complete paths match direct engine projections after every HTTP choice. Paid deployment, nested Barrier and final Life Force decisions survive process restarts. Eight-way duplicate and late receipts, all three shared seats, stale concurrency and 401/403 pass.'}));
}finally{observe(undefined);await stop()}
