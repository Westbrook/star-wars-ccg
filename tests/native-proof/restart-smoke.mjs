import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:8789';
let worker;
const headers={'content-type':'application/json','oai-authenticated-user-id':'proof-restart-test','oai-authenticated-user-email':'restart@example.test'};
async function request(path,body){const response=await fetch(origin+'/api/proof'+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data}
async function start(){
 worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8789','--inspector-port','0'],{cwd:new URL('../..',import.meta.url),detached:true,stdio:'ignore'});
 for(let n=0;n<80;n++){if(worker.exitCode!==null)throw Error('Test Worker failed to start.');try{await request('');return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test Worker did not become ready.');
}
async function stop(){if(!worker)return;const child=worker;worker=null;const exited=new Promise(resolve=>child.once('exit',resolve));process.kill(-child.pid,'SIGTERM');await exited;await new Promise(resolve=>setTimeout(resolve,150))}
async function advance(checkpoint){const game=checkpoint.game;return request('/'+checkpoint.id,{commandId:randomUUID(),version:game.revision,seat:game.seat,prompt:game.prompt.id,choice:game.prompt.choices[0].id})}
try{
 await start();const checkpoints=[];
 for(const scenario of ['activation','drain','battle','recirculation']){const created=await request('',{id:'proof-test-'+randomUUID(),scenario,mode:'solo'});await advance(created);checkpoints.push(await request('/'+created.id))}
 await stop();await start();
 for(const before of checkpoints){const after=await request('/'+before.id);assert.deepEqual(after,before);const next=await advance(after);assert.equal(next.game.revision,before.game.revision+1)}
 console.log('All four pending continuations survived a complete Worker-process restart and accepted their next choice.');
}finally{await stop()}
