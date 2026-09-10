import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.PROOF_TEST_ORIGIN||'http://127.0.0.1:8788';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('This test uses local development identities and may only target localhost.');
const owner='proof-test-owner',guest='proof-test-guest',outsider='proof-test-outsider';
const timings=[];
async function call(path,body,actor=owner){const start=performance.now();const response=await fetch(base+'/api/proof'+path,{headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});timings.push(performance.now()-start);const data=await response.json();return {status:response.status,data,cache:response.headers.get('cache-control')}}
async function create(scenario,mode='solo'){const result=await call('',{id:'proof-test-'+randomUUID(),scenario,mode});assert.equal(result.status,201,JSON.stringify(result.data));return result.data}
function command(game,choice){return {commandId:randomUUID(),version:game.revision,seat:game.seat,prompt:game.prompt.id,choice:choice||game.prompt.choices[0].id}}
for(const scenario of ['activation','drain','battle','recirculation']){
 let state=await create(scenario),steps=0;
 while(!state.game.complete){assert.ok(++steps<120);const body=command(state.game);const action=await call('/'+state.id,body);assert.equal(action.status,200,JSON.stringify(action.data));const fresh=await call('/'+state.id);assert.equal(fresh.status,200);assert.equal(fresh.cache,'no-store');assert.equal(fresh.data.game.revision,state.game.revision+1);const repeated=await call('/'+state.id);assert.deepEqual(repeated.data,fresh.data);state=fresh.data}
 console.log(scenario+': '+steps+' choices saved and recovered');
}
let state=await create('activation');const body=command(state.game,'activate');
const retries=await Promise.all(Array.from({length:8},()=>call('/'+state.id,body)));for(const result of retries){assert.equal(result.status,200);assert.equal(result.data.game.revision,1);assert.equal(result.data.acceptedVersion,1)}assert.equal(retries.filter(r=>!r.data.duplicate).length,1);
assert.equal((await call('/'+state.id,{...body,choice:'pass'})).status,409);
state=await create('activation');const collision=await Promise.all(['activate','pass'].map(choice=>call('/'+state.id,command(state.game,choice))));assert.deepEqual(collision.map(r=>r.status).sort(),[200,409]);assert.equal((await call('/'+state.id)).data.game.revision,1);
state=await create('drain','shared');assert.equal((await call('/'+state.id,command(state.game))).status,409);assert.equal((await call('/'+state.id,undefined,guest)).status,403);assert.equal((await call('/'+state.id,{operation:'join'},guest)).status,200);assert.equal((await call('/'+state.id,{operation:'join'},outsider)).status,403);assert.equal((await call('/'+state.id,undefined,outsider)).status,403);assert.equal((await call('/'+state.id+'?seat=light')).status,403);
assert.equal((await call('/'+state.id,{...command(state.game),seat:'light'})).status,403);assert.equal((await call('/'+state.id,command(state.game),guest)).status,403);assert.equal((await call('/'+state.id,command(state.game))).status,200);
const light=(await call('/'+state.id,undefined,guest)).data.game,dark=(await call('/'+state.id)).data.game;assert.equal(light.seat,'light');assert.equal(light.players.light.hand.length,1);assert.equal(dark.players.light.hand.length,0);assert.equal(dark.prompt.choices.length,0);
assert.equal((await call('',{id:'proof-test-'+randomUUID(),scenario:'full-game',mode:'solo'})).status,400);assert.equal((await call('',{id:'proof-test-'+randomUUID(),scenario:'activation',mode:['solo']})).status,400);
const crossOrigin=await fetch(base+'/api/proof',{method:'POST',headers:{origin:'https://outsider.example','content-type':'application/json','oai-authenticated-user-id':owner,'oai-authenticated-user-email':'owner@example.test'},body:'{}'});assert.equal(crossOrigin.status,403);
assert.equal((await fetch(base+'/api/proof')).status,401);
const page=await fetch(base+'/proof?progress-report');assert.equal(page.status,200);assert.match(await page.text(),/A small step into/);
const sorted=timings.sort((a,b)=>a-b);console.log('D1 retry/concurrency, private seats, hidden hands, invalid input and origin checks passed.');console.log(JSON.stringify({requests:timings.length,p50ms:Math.round(sorted[Math.floor(sorted.length*.5)]),p95ms:Math.round(sorted[Math.floor(sorted.length*.95)])}));
