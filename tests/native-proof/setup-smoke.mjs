import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8796',owner='proof-setup-owner',guest='proof-setup-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const r=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await r.json();calls++;assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8796','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const done=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await done;await new Promise(resolve=>setTimeout(resolve,150))}
const command=(cp,choice)=>({commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice});
const candidate=(cp,blueprint)=>cp.game.setup.candidates.find(c=>c.blueprint===blueprint).id;
async function next(cp,choice){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);await request('/'+cp.id,actor,command(view,choice));return request('/'+cp.id)}
async function finish(cp){for(let n=0;!cp.game.complete&&n<40;n++){const actor=cp.mode==='shared'&&cp.game.prompt.side==='light'?guest:owner;const view=await request('/'+cp.id,actor);cp=await next(cp,view.game.prompt.choices[0].id)}assert.equal(cp.game.complete,true);return cp}
async function restartAt(cp){const before=await request('/'+cp.id);await stop();await start();assert.deepEqual(await request('/'+cp.id),before);return request('/'+cp.id)}
async function duplicate(cp,choice){const body=command(cp,choice);const results=await Promise.all(Array.from({length:8},()=>request('/'+cp.id,owner,body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.game.revision===body.version+1));return {cp:await request('/'+cp.id),body}}
try{
 await start();
 let cp=await request('',owner,{id:randomUUID(),scenario:'opening-table',mode:'solo'},201),path='/'+cp.id;
 const commit=await duplicate(cp,'select:'+candidate(cp,'1_285'));cp=commit.cp;assert.equal(cp.game.seat,'light');assert.equal(cp.game.setup.selected.dark,null);cp=await restartAt(cp);
 cp=await next(cp,'select:'+candidate(cp,'1_124'));assert.equal(cp.game.setup.stage,'reveal');assert.equal(cp.game.setup.selected.light,null);cp=await restartAt(cp);
 cp=await next(cp,'reveal');assert.equal(cp.game.setup.selected.light.blueprint,'1_124');cp=await restartAt(cp);
 cp=await next(cp,'decline-conversion');assert.equal(cp.game.prompt.side,'light');cp=await restartAt(cp);
 cp=await next(cp,'decline-conversion');assert.equal(cp.game.setup.round,2);assert.equal(cp.game.setup.candidates.some(c=>c.blueprint==='1_285'),true);cp=await restartAt(cp);
 cp=await next(cp,'select:'+candidate(cp,'1_285'));cp=await next(cp,'select:'+candidate(cp,'1_132'));cp=await next(cp,'reveal');cp=await next(cp,'place');assert.equal(cp.game.players.dark.counts.reserve,59);cp=await restartAt(cp);
 cp=await next(cp,'prepare');cp=await restartAt(cp);const draw=await duplicate(cp,'draw-opening');cp=draw.cp;
 for(const side of ['dark','light']){assert.equal(cp.game.players[side].counts.hand,8);assert.equal(cp.game.players[side].counts.reserve,51);assert.equal(cp.game.setup.openingHands[side].length,8)}
 cp=await restartAt(cp);cp=await next(cp,'pass');cp=await restartAt(cp);cp=await next(cp,'pass');assert.equal(cp.game.complete,true);assert.equal(cp.game.phase,'Activate');assert.equal(cp.game.setup.generation.dark,3);cp=await restartAt(cp);
 for(const body of [commit.body,draw.body]){const r=await request(path,owner,body);assert.equal(r.duplicate,true);assert.equal(r.game.revision,cp.game.revision);assert.equal(r.game.setup.openingHands.dark.length,8)}
 // Both conversion orders survive a fresh process with supporting copy intact.
 for(const accepting of ['dark','light']){
  let c=await request('',owner,{id:randomUUID(),scenario:'opening-table',mode:'solo'},201);c=await next(c,'select:'+candidate(c,'1_285'));c=await next(c,'select:'+candidate(c,'1_124'));c=await next(c,'reveal');if(accepting==='light')c=await next(c,'decline-conversion');
  const accepted=await duplicate(c,'accept-conversion');c=await next(accepted.cp,'place');c=await restartAt(c);assert.equal(c.game.setup.covered.side,accepting);assert.equal(c.game.locations.length,1);assert.equal(c.game.table.length,0);c=await finish(c);assert.deepEqual(c.game.setup.generation,{dark:2,light:2});
 }
 // Separate pilots can choose in either order, but concurrent updates serialize.
 let room=await request('',owner,{id:randomUUID(),scenario:'opening-table',mode:'shared'},201);const rp='/'+room.id;
 await request(rp,guest,{operation:'join'});const dark=await request(rp,owner),light=await request(rp,guest);
 assert.equal(dark.game.prompt.choices.length,9);assert.equal(light.game.prompt.choices.length,9);assert.equal(light.game.prompt.side,'light');
 const dc=command(dark,'select:'+candidate(dark,'1_285')),lc=command(light,'select:'+candidate(light,'1_124'));
 const results=await Promise.all([call(rp,owner,dc),call(rp,guest,lc)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const loser=results[0].status===409?owner:guest,win=loser===owner?'light':'dark';let view=await request(rp,loser);assert.equal(view.game.setup.selected[win],null);assert.equal(view.game.setup.openingHands,undefined);
 await request(rp,loser,command(view,'select:'+candidate(view,loser===owner?'1_285':'1_124')));
 for(const actor of [owner,guest]){view=await request(rp,actor);assert.equal(view.game.setup.selected[actor===owner?'light':'dark'],null)}
 await request(rp,guest,command(await request(rp,owner),'reveal'),403);room=await request(rp);room=await finish(room);
 const dv=await request(rp,owner),lv=await request(rp,guest);for(const [own,opp,side] of [[dv,lv,'dark'],[lv,dv,'light']]){
  assert.equal(own.game.players[side].hand.length,8);assert.deepEqual(opp.game.players[side].hand,[]);assert.equal(own.game.setup.openingHands,undefined);assert.equal(own.game.setup.shuffleOrder,undefined);
  for(const c of own.game.players[side].hand)assert.equal(JSON.stringify(opp.game).includes('"id":"'+c.id+'"'),false);
 }
 await stop();await start();assert.deepEqual(await request(rp,owner),dv);assert.deepEqual(await request(rp,guest),lv);
 await request(rp,'outside-setup-pilot',undefined,403);await request(rp,null,undefined,401);await request(rp+'?seat=light',owner,undefined,403);
 console.log('Setup API checks passed: '+calls+' requests; private commitments, concurrent seats, 8-way commit/conversion/draw retries, process recovery at every setup boundary and completed separate-seat hand privacy.');
}finally{await stop()}
