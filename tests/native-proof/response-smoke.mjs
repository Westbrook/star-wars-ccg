import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8792';
const owner='proof-response-owner',guest='proof-response-guest';
let worker,calls=0;
async function call(path,actor=owner,body){
 const response=await fetch(origin+'/api/proof'+path,{headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await response.json();calls++;assert.equal(response.headers.get('cache-control'),'no-store');return {status:response.status,data};
}
async function request(path,actor=owner,body,status=200){const r=await call(path,actor,body);assert.equal(r.status,status,path+': '+(r.data.error||r.status));return r.data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8792','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<100;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const exited=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await exited;await new Promise(resolve=>setTimeout(resolve,150))}
function command(cp,choice){return {commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice:choice||cp.game.prompt.choices[0].id}}
const play=cp=>cp.game.prompt?.choices.find(c=>c.id.startsWith('play:'));
async function ready(mode='solo'){
 let cp=await request('',owner,{id:randomUUID(),scenario:'takeel',mode},201);
 if(mode==='shared')await request('/'+cp.id,guest,{operation:'join'});
 for(let steps=0;steps<100;steps++){
  cp=await request('/'+cp.id);
  if(play(cp))return cp;
  let actor=owner;
  if(mode==='shared'&&cp.game.prompt.side==='light'){actor=guest;cp=await request('/'+cp.id,guest)}
  await request('/'+cp.id,actor,command(cp));
 }
 throw Error('No Takeel response reached.');
}
try{
 await start();
 let cp=await ready(),path='/'+cp.id;
 const initial=structuredClone(cp),body=command(cp,play(cp).id);
 assert.equal(cp.game.prompt.automatic,false);
 const raced=await Promise.all(Array.from({length:8},()=>request(path,owner,body)));
 assert.equal(raced.filter(r=>!r.duplicate).length,1);
 for(const r of raced){assert.equal(r.game.revision,body.version+1);assert.equal(r.acceptedVersion,body.version+1);assert.equal(r.game.players.dark.counts.force,0);assert.equal(r.game.playing.length,1);assert.deepEqual(r.game.battle.destiny,{light:3,dark:1})}
 const paid=await request(path);await stop();await start();
 assert.deepEqual(await request(path),paid);
 const retry=await request(path,owner,body);assert.equal(retry.duplicate,true);assert.deepEqual(retry.game.battle.destiny,{light:3,dark:1});assert.equal(retry.game.players.dark.counts.used,initial.game.players.dark.counts.used+1);
 cp=await request(path);await request(path,owner,command(cp,'pass'));cp=await request(path);await request(path,owner,command(cp,'pass'));cp=await request(path);
 assert.deepEqual(cp.game.battle.destiny,{light:1,dark:3});assert.equal(cp.game.playing.length,0);assert.equal(cp.game.players.dark.counts.lost,1);
 const afterResolvedRetry=await request(path,owner,body);assert.equal(afterResolvedRetry.duplicate,true);assert.deepEqual(afterResolvedRetry.game.battle.destiny,{light:1,dark:3});
 let steps=0;while(!cp.game.complete){assert.ok(steps++<70);await request(path,owner,command(cp));cp=await request(path)}
 assert.deepEqual(cp.game.battle.damage,{light:0,dark:0});assert.deepEqual(cp.game.battle.attrition,{light:0,dark:0});
 // Competing valid choices: only one can claim the revision and spend Force.
 cp=await ready();path='/'+cp.id;
 const conflict=await Promise.all([play(cp).id,'pass'].map(choice=>call(path,owner,command(cp,choice))));assert.deepEqual(conflict.map(r=>r.status).sort(),[200,409]);
 const won=await request(path);assert.equal(won.game.revision,cp.game.revision+1);assert.equal(won.game.players.dark.counts.force,won.game.playing.length?0:1);
 // Separate pilots see only their legal choices; the played card becomes public.
 cp=await ready('shared');path='/'+cp.id;const hiddenId=play(cp).card;
 const light=await request(path,guest);assert.equal(JSON.stringify(light.game).includes(hiddenId),false);assert.equal(JSON.stringify(light.game).includes('1_269'),false);assert.deepEqual(light.game.prompt.choices,[]);
 await request(path,guest,command(cp,play(cp).id),403);await request(path,'proof-response-outsider',undefined,403);await request(path,null,undefined,401);
 await request(path,owner,command(cp,play(cp).id));const publicPlay=await request(path,guest);assert.equal(publicPlay.game.playing[0].id,hiddenId);assert.equal(publicPlay.game.seat,'light');
 await request(path,guest,command(publicPlay,'pass'));cp=await request(path);await request(path,owner,command(cp,'pass'));
 assert.deepEqual((await request(path,guest)).game.battle.destiny,{light:1,dark:3});
 console.log('Takeel API checks passed: '+calls+' requests, 8 concurrent retries, play/pass race, paid-frame process restart, no double swap, separate-seat privacy.');
}finally{await stop()}
