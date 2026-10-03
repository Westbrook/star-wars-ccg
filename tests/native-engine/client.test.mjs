import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
const {MatchConnection,MatchRequestError,emptyOpportunity,matchHref}=load(new URL('../../lib/native-engine/client.ts',import.meta.url));
const id='client-match-123',view=(revision=1)=>({id,revision,mode:'pvp',side:'dark',waitingForOpponent:false,game:{status:'playing',prompt:{side:'dark',mandatory:false,choices:[{id:'pass'}]}}});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
test('client rejects invalid links and preserves developer return flag',()=>{assert.throws(()=>new MatchConnection('../escape',()=>{}));assert.equal(matchHref(id,true),'/matches/'+id+'?progress-report');assert.equal(emptyOpportunity(view()),true);assert.equal(emptyOpportunity({...view(),game:{prompt:{side:'light',choices:[{id:'pass'}]}}}),false)});
test('lost response retains the exact command across connection recreation',async()=>{
 const saved=storage(),bodies=[];let revision=1,failed=false;
 const request=async(_,body)=>{if(body){bodies.push(body);if(!failed){failed=true;revision++;throw Error('Lost response')}}return view(revision)};
 let c=new MatchConnection(id,()=>{},request,saved);await c.load();await c.choose('pass');assert.ok(c.state.pending);const command=c.state.pending;c.dispose();c=new MatchConnection(id,()=>{},request,saved);await c.load();assert.deepEqual(c.state.pending,command);await c.retry();assert.deepEqual(bodies,[command,command]);assert.equal(c.state.pending,null);assert.equal(c.state.view.revision,2);
});
test('client serializes work and ignores a timer bound to an older revision',async()=>{
 let release;let calls=0;const request=async()=>{calls++;if(calls===1)return view();await new Promise(r=>release=r);return view(2)};const c=new MatchConnection(id,()=>{},request);await c.load();const writing=c.choose('pass',1);await c.choose('pass',1);assert.equal(calls,2);release();await writing;await c.choose('pass',1);assert.equal(calls,2);
});
test('stale command clears pending receipt and reloads current legal choices',async()=>{
 const c=new MatchConnection(id,()=>{},async(_,body)=>{if(body)throw new MatchRequestError('Stale',409);return view(3)});await c.load();await c.choose('pass');assert.equal(c.state.pending,null);assert.equal(c.state.view.revision,3);assert.equal(c.state.error,'Stale');
});
test('401 preserves an uncertain command for retry after sign-in',async()=>{
 const c=new MatchConnection(id,()=>{},async(_,body)=>{if(body)throw new MatchRequestError('Sign in',401);return view()});await c.load();await c.choose('pass');assert.ok(c.state.pending);assert.equal(c.state.status,401);
});
test('older snapshots never replace a newer view and wrong match IDs are rejected',async()=>{
 let next=view(4);const c=new MatchConnection(id,()=>{},async()=>next);await c.load();next=view(2);await c.load();assert.equal(c.state.view.revision,4);next={...view(5),id:'other-match-123'};await c.load();assert.equal(c.state.view.revision,4);assert.match(c.state.error,/different match/);
});
test('computer advancement sends no selected action and is blocked by uncertain human moves',async()=>{
 const requests=[];let fail=false;const c=new MatchConnection(id,()=>{},async(_,body)=>{if(body)requests.push(body);if(fail)throw Error('offline');return {...view(),mode:'cpu'}});await c.load();await c.advance();assert.deepEqual(requests,[{operation:'advance'}]);fail=true;await c.choose('pass');await c.advance();assert.equal(requests.length,2);
});
test('disposed connection never renders a late response',async()=>{
 let release;const updates=[];const c=new MatchConnection(id,x=>updates.push(x),async()=>new Promise(r=>release=r));const pending=c.load();c.dispose();release(view());await pending;assert.equal(updates.length,1);assert.equal(updates[0].busy,true);
});
test('non-JSON authentication and success failures retain meaningful retry status',async()=>{
 const {matchRequest}=load(new URL('../../lib/native-engine/client.ts',import.meta.url)),before=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response('Sign in',{status:401});await assert.rejects(matchRequest('/api/matches'),e=>e.status===401&&/Sign in/.test(e.message));globalThis.fetch=async()=>new Response('broken',{status:200});await assert.rejects(matchRequest('/api/matches'),e=>e.status===502)}finally{globalThis.fetch=before}
});
