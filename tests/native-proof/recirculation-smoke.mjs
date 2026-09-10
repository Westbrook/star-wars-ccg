import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Run against a fresh production build served by local Wrangler, where the
// trusted Sites identity headers can be supplied for separate test identities.
const base=process.env.PROOF_URL||'http://127.0.0.1:8790';
let calls=0;
async function request(path,actor,body,status=200){
 const response=await fetch(base+path,{headers:{'Content-Type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const data=await response.json();calls++;assert.equal(response.status,status,path+': '+(data.error||response.status));return data;
}
const owner='recirculation-owner',guest='recirculation-guest';
for(const mode of ['solo','shared']){
 const id=randomUUID(),path='/api/proof/'+id;
 let cp=await request('/api/proof',owner,{id,scenario:'recirculation',mode,includeStudy:true},201);
 if(mode==='shared'){
  assert.equal('recirculationStudy' in cp.game,false);
  const joined=await request(path,guest,{operation:'join',includeStudy:true});
  assert.equal('recirculationStudy' in joined.game,false);
 }else assert.ok(cp.game.recirculationStudy);
 await request(path,null,undefined,401);
 await request(path,'recirculation-outsider',undefined,403);
 for(let n=0;n<=2;n++){
  const actor=mode==='shared'&&n===1?guest:owner;
  cp=await request(path+'?includeStudy=true&progress-report',actor);
  assert.equal(cp.game.revision,n);
  if(mode==='solo'){
   assert.ok(cp.game.recirculationStudy);
   assert.deepEqual((await request(path,actor)).game,cp.game);
   for(const side of ['dark','light']){
    const p=cp.game.recirculationStudy.players[side];
    assert.equal(p.orderPreserved,n>=(side==='dark'?1:2)?true:null);
    assert.equal(p.forceUnchanged,true);
    if(p.resolved)assert.deepEqual(p.current.reserve,[...p.before.reserve,...p.before.used]);
   }
  }else{
   assert.equal('recirculationStudy' in cp.game,false);
   for(const pilot of [owner,guest])assert.equal('recirculationStudy' in (await request(path,pilot)).game,false);
  }
  if(n<2){
   const result=await request(path,actor,{commandId:randomUUID(),version:cp.game.revision,seat:cp.game.seat,prompt:cp.game.prompt.id,choice:'recirculate',includeStudy:true});
   assert.equal('recirculationStudy' in result.game,mode==='solo');
  }else assert.equal(cp.game.complete,true);
 }
}
console.log('Recirculation saved-order and shared-seat privacy checks passed ('+calls+' API requests).');
