import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,starterDecks,runStarterMatch,seeded} from './match-runner.mjs';
const {nativeMatchService,MatchServiceError}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
const config=(size=60,side='dark',mode='cpu',id=randomUUID())=>{const decks=starterDecks(size);return{id,mode,side,deckSize:size,deck:decks.find(d=>d.side===side).cards,...(mode==='cpu'?{computerDeck:decks.find(d=>d.side!==side).cards}:{})}};
const cmd=(view,choice=view.game.prompt.choices[0].id,commandId=randomUUID())=>({operation:'command',commandId,revision:view.revision,choice});
function fixture(t,options={}){const db=new SqliteD1();t.after(()=>db.close());let time=1_800_000_000_000;const entropy=seeded(123);const fresh=()=>nativeMatchService(db,{currentRules:auditRules.id,rules:id=>id===auditRules.id?auditRules:undefined,now:()=>time,entropy,...options});return{db,fresh,get service(){return fresh()},setTime:n=>time=n};}
const rejects=(p,status,code)=>assert.rejects(p,e=>e instanceof MatchServiceError&&e.status===status&&(!code||e.code===code));
const stored=(db,id)=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(id).state);

test('production registry rejects unfinished decks before inserting a match',async t=>{
 const f=fixture(t,{rules:()=>premiereRules});await rejects(f.service.create('owner',config()),422,'DECK_NOT_ADMITTED');assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,0);
});
test('creation retries are stable and cannot change decks, modes or ownership',async t=>{
 const f=fixture(t),body=config(),a=await f.service.create('owner',body),b=await f.fresh().create('owner',body);assert.deepEqual(a,b);
 await rejects(f.service.create('other',body),409);await rejects(f.service.create('owner',{...body,side:'light'}),409);await rejects(f.service.read(body.id,'other'),404);
 const many=await Promise.all(Array.from({length:6},()=>f.fresh().create('owner',config(60,'dark','cpu','same-create-id-123'))));assert.ok(many.every(v=>v.id===many[0].id));assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,2);
});
test('PvP joins require an invitation and independently submitted opposite-side deck',async t=>{
 const f=fixture(t),body=config(60,'light','pvp'),owner=await f.service.create('owner',body);assert.equal(owner.game,null);assert.ok(owner.inviteToken);
 await rejects(f.service.read(owner.id,'guest'),404);await rejects(f.service.command(owner.id,'owner',{commandId:randomUUID(),revision:0,choice:'pass'}),409,'WAITING_FOR_OPPONENT');
 const join={operation:'join',commandId:randomUUID(),inviteToken:owner.inviteToken,deck:starterDecks().find(d=>d.side==='dark').cards};
 await rejects(f.service.join(owner.id,'guest',{...join,inviteToken:'wrong'}),403);await rejects(f.service.join(owner.id,'owner',join),403);await rejects(f.service.join(owner.id,'guest',{...join,deck:body.deck}),400);
 const guest=await f.service.join(owner.id,'guest',join);assert.equal(guest.side,'dark');assert.equal(guest.revision,1);assert.equal(guest.inviteToken,undefined);assert.equal(guest.waitingForOpponent,false);assert.equal((await f.service.read(owner.id,'owner')).side,'light');assert.equal((await f.service.read(owner.id,'owner')).inviteToken,undefined);
 const retry=await f.service.join(owner.id,'guest',join);assert.equal(retry.duplicate,true);assert.equal(retry.acceptedRevision,1);await rejects(f.service.join(owner.id,'third',{...join,commandId:randomUUID()}),409);
 await rejects(f.service.command(owner.id,'guest',{...cmd(guest),seat:'light'}),400);await rejects(f.service.computerCommand(owner.id,cmd(guest)),403);
});
test('simultaneous invitation claims cannot overwrite the winning seat',async t=>{
 const f=fixture(t),owner=await f.service.create('owner',config(40,'dark','pvp')),body={commandId:randomUUID(),inviteToken:owner.inviteToken,deck:starterDecks(40).find(d=>d.side==='light').cards};
 const results=await Promise.allSettled(['guest-a','guest-b'].map(actor=>f.fresh().join(owner.id,actor,{...body,commandId:randomUUID()})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const row=f.db.sqlite.prepare('SELECT * FROM native_matches WHERE id=?').get(owner.id);assert.ok(['guest-a','guest-b'].includes(row.guest));assert.equal(row.version,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,1);
});
test('duplicate command retries commit once and return the latest seat projection',async t=>{
 const f=fixture(t),view=await f.service.create('owner',config()),body=cmd(view);
 const results=await Promise.all(Array.from({length:8},()=>f.fresh().command(view.id,'owner',body)));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.acceptedRevision===1&&r.revision===1));assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,1);
 const computer=await f.service.readComputer(view.id);assert.equal(computer.side,'light');await f.service.computerCommand(view.id,cmd(computer));const retry=await f.fresh().command(view.id,'owner',body);assert.equal(retry.acceptedRevision,1);assert.equal(retry.revision,2);assert.equal(retry.duplicate,true);
 await rejects(f.service.command(view.id,'owner',{...body,choice:'concede'}),409,'COMMAND_ID_REUSED');
});
test('competing legal commands use compare-and-swap; no orphan receipt is left',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config()),choices=v.game.prompt.choices.slice(0,2);assert.equal(choices.length,2);
 const results=await Promise.allSettled(choices.map(c=>f.fresh().command(v.id,'owner',cmd(v,c.id))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await f.service.read(v.id,'owner')).revision,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,1);
});
test('a failed transactional write rolls back receipt and state and can be retried',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config()),body=cmd(v),before=stored(f.db,v.id);f.db.failBatch=true;
 await assert.rejects(f.service.command(v.id,'owner',body),/storage failure/);assert.deepEqual(stored(f.db,v.id),before);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,0);assert.equal((await f.service.command(v.id,'owner',body)).acceptedRevision,1);
});
test('private seats cannot select each other, inspect raw decks or submit client state/time',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config(60,'light'));
 assert.equal(v.side,'light');assert.equal(v.owner_deck,undefined);assert.equal(v.state,undefined);assert.equal(v.game.setup.selected.dark,null);
 const computer=await f.service.readComputer(v.id);assert.equal(computer.side,'dark');const selection=computer.game.prompt.choices[0].id;
 await rejects(f.service.command(v.id,'owner',{commandId:randomUUID(),revision:0,choice:selection}),422);await rejects(f.service.command(v.id,'owner',{...cmd(v),now:0}),400);await rejects(f.service.command(v.id,'owner',{...cmd(v),state:{}}),400);
 assert.equal((await f.service.list('outsider')).length,0);assert.equal((await f.service.list('owner')).length,1);
});
test('concession freezes a match and remains safely retryable',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config()),body=cmd(v,'concede'),result=await f.service.command(v.id,'owner',body);assert.equal(result.game.result.winner,'light');assert.equal(result.game.status,'finished');assert.equal((await f.service.command(v.id,'owner',body)).duplicate,true);await rejects(f.service.command(v.id,'owner',{...body,commandId:randomUUID(),revision:1}),409,'MATCH_FINISHED');
});
test('saved state survives database close/reopen and rejects mismatched metadata or unavailable rules',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'swccg-service-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let db=new SqliteD1(path.join(dir,'matches.sqlite'));const options={currentRules:auditRules.id,rules:()=>auditRules,now:()=>1_800_000_000_000};let service=nativeMatchService(db,options);const v=await service.create('owner',config()),next=await service.command(v.id,'owner',cmd(v));db.close();db=new SqliteD1(path.join(dir,'matches.sqlite'),false);t.after(()=>db.close());service=nativeMatchService(db,options);assert.deepEqual(await service.read(v.id,'owner'),((({duplicate,acceptedRevision,...view})=>view)(next)));
 await rejects(nativeMatchService(db,{...options,rules:()=>undefined}).read(v.id,'owner'),503,'RULES_UNAVAILABLE');db.sqlite.prepare('UPDATE native_matches SET version=99 WHERE id=?').run(v.id);await assert.rejects(service.read(v.id,'owner'),/metadata mismatch/);
});

function request(pathname,body,actor='owner',headers={}){return new Request('https://private.example/api/matches'+pathname,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})})}
const context=id=>({params:Promise.resolve({id})});
test('HTTP requires gateway identity, same origin, bounded JSON and server-assigned seats',async t=>{
 const f=fixture(t),h=matchHandlers(f.fresh),body=config();assert.equal((await h.create(request('',body,null))).status,401);assert.equal((await h.create(request('',body,'owner',{origin:'https://other.example'}))).status,403);assert.equal((await h.create(request('',body,'owner',{'content-type':'text/plain'}))).status,415);assert.equal((await h.create(request('','{'))).status,400);assert.equal((await h.create(request('','x'.repeat(32769)))).status,413);
 const created=await h.create(request('',body));assert.equal(created.status,201);assert.match(created.headers.get('cache-control'),/no-store/);const v=await created.json();assert.equal((await h.read(request('/'+v.id+'?seat=light'),context(v.id))).status,403);assert.equal((await h.read(request('/'+v.id,undefined,'other'),context(v.id))).status,404);assert.equal((await h.update(request('/'+v.id,cmd(v)),context(v.id))).status,200);
 assert.equal((await h.update(request('/'+v.id,{...cmd(v),operation:'computer'}),context(v.id))).status,400);
});
for(const [size,mode,ownerSide] of [[40,'pvp','dark'],[60,'cpu','light']])test(`complete ${size}-card ${mode} match persists every legal command and survives service recreation`,async t=>{
 const run=runStarterMatch({seed:1,size});let time=1_800_000_000_000,entropy=seeded(1);const f=fixture(t,{now:()=>time,entropy:()=>entropy()});const body=config(size,ownerSide,mode,run.state.id);let v=await f.service.create('owner',body);const offset=mode==='pvp'?1:0;
 if(mode==='pvp')await f.service.join(v.id,'guest',{commandId:randomUUID(),inviteToken:v.inviteToken,deck:starterDecks(size).find(d=>d.side!==ownerSide).cards});
 for(const [i,entry] of run.transcript.entries()){
  time=entry.time;entropy=seeded(entry.entropy);
  if(!entry.command){await f.fresh().read(v.id,'owner');continue}
  const body={operation:'command',commandId:'match-trace-'+String(i).padStart(10,'0'),revision:entry.command.revision+offset,choice:entry.command.choice};
  const next=entry.side===ownerSide?await f.fresh().command(v.id,'owner',body):mode==='cpu'?await f.fresh().computerCommand(v.id,body):await f.fresh().command(v.id,'guest',body);
  assert.equal(next.revision,entry.command.revision+offset+1);assert.equal(next.side,entry.side);
  if(i%100===0){const read=await f.fresh().read(v.id,'owner');assert.equal(read.revision,next.revision);assert.equal(read.side,ownerSide);assert.equal(read.game.data,undefined);assert.equal(read.game.stack,undefined);assert.deepEqual(read.game.players[ownerSide==='dark'?'light':'dark'].hand,[]);for(const side of ['dark','light'])for(const pile of ['reserve','force','used'])assert.equal(read.game.players[side][pile],undefined);}
 }
 const final=stored(f.db,v.id),expected={...run.state,revision:run.state.revision+offset};assert.deepEqual(final,expected);assert.equal(final.status,'finished');assert.equal(final.result.reason,'life-force');assert.equal((await f.fresh().read(v.id,'owner')).game.prompt,null);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands WHERE match_id=?').get(v.id).n,run.transcript.length+offset);
});
// A synthetic expiry provider exercises service CAS without assigning invented
// timing restrictions to a real card. Production Scanning Crew is untimed.
const timedRules={...auditRules,expire:(m,{now})=>{
 if(typeof m.data.testDeadline!=='number'||now<m.data.testDeadline)return false;
 delete m.data.testDeadline;m.data.testExpired=true;return true;
}};
test('generic engine deadlines persist once and race safely',async t=>{
 let snapshot;const run=runStarterMatch({seed:1,size:40,onStep:m=>{if(!snapshot&&m.stack.at(-1)?.handler==='scan:peek')snapshot=clone(m)}});assert.ok(snapshot);
 const deadline=1_800_000_010_000;snapshot.data.testDeadline=deadline;
 const f=fixture(t,{rules:()=>timedRules}),v=await f.service.create('owner',config(40,'dark','cpu',run.state.id));f.db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(snapshot),snapshot.revision,v.id);
 f.setTime(deadline-1);assert.equal((await f.service.read(v.id,'owner')).revision,snapshot.revision);f.setTime(deadline);
 const reads=await Promise.all(Array.from({length:5},()=>f.fresh().read(v.id,'owner')));assert.ok(reads.every(r=>r.revision===snapshot.revision+1));assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,1);assert.equal(stored(f.db,v.id).data.testExpired,true);
 await rejects(f.service.command(v.id,'owner',{commandId:randomUUID(),revision:snapshot.revision,choice:'scan:continue'}),409,'STALE_REVISION');f.setTime(deadline+50000);assert.equal((await f.service.read(v.id,'owner')).revision,snapshot.revision+1);
});
test('saved Scanning Crew inspection survives elapsed time and duplicate acknowledgments',async t=>{
 let snapshot;const run=runStarterMatch({seed:1,size:40,onStep:m=>{if(!snapshot&&m.stack.at(-1)?.handler==='scan:peek')snapshot=clone(m)}});assert.ok(snapshot);
 const f=fixture(t),v=await f.service.create('owner',config(40,'dark','cpu',run.state.id));f.db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(snapshot),snapshot.revision,v.id);
 f.setTime(1_900_000_000_000);const reads=await Promise.all(Array.from({length:5},()=>f.fresh().read(v.id,'owner')));
 assert.ok(reads.every(r=>r.revision===snapshot.revision&&r.game.rules.scan.stage==='peek'&&r.game.rules.scan.cards.length>0));
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,0);
 const c={commandId:randomUUID(),revision:snapshot.revision,choice:'scan:continue'};
 const replies=await Promise.all(Array.from({length:5},()=>f.fresh().command(v.id,'owner',c)));
 assert.ok(replies.every(r=>r.acceptedRevision===snapshot.revision+1));assert.equal(stored(f.db,v.id).stack.at(-1).handler,'scan:select');
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,1);
});
test('HTTP conceals internal errors and production cannot be switched into test admission',async t=>{
 const f=fixture(t,{rules:()=>premiereRules}),h=matchHandlers(f.fresh),result=await h.create(request('',config()));assert.equal(result.status,422);assert.equal((await result.json()).code,'DECK_NOT_ADMITTED');
 const broken=matchHandlers(()=>{throw Error('secret-card-order')});const old=console.error;console.error=()=>{};try{const response=await broken.list(request(''));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret-card-order'));}finally{console.error=old}
 assert.equal((await h.create(request('',{...config(),rules:'test-only'}))).status,400);
});
test('identical joins and cross-seat command-ID collisions retain a single authoritative receipt',async t=>{
 const f=fixture(t),owner=await f.service.create('owner',config(40,'dark','pvp')),join={commandId:randomUUID(),inviteToken:owner.inviteToken,deck:starterDecks(40).find(d=>d.side==='light').cards};
 const joins=await Promise.all(Array.from({length:5},()=>f.fresh().join(owner.id,'guest',join)));assert.equal(joins.filter(j=>!j.duplicate).length,1);assert.ok(joins.every(j=>j.acceptedRevision===1));
 const dark=await f.service.read(owner.id,'owner'),light=await f.service.read(owner.id,'guest'),shared=randomUUID();const results=await Promise.allSettled([f.fresh().command(owner.id,'owner',cmd(dark,undefined,shared)),f.fresh().command(owner.id,'guest',cmd(light,undefined,shared))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await f.service.read(owner.id,'owner')).revision,2);
 assert.equal((await f.service.list('guest'))[0].side,'light');assert.equal((await f.service.list('owner'))[0].side,'dark');
});
test('late command itself settles the timer before checking its stale revision',async t=>{
 let snapshot;const run=runStarterMatch({seed:1,size:40,onStep:m=>{if(!snapshot&&m.stack.at(-1)?.handler==='scan:peek')snapshot=clone(m)}});snapshot.data.testDeadline=1_800_000_010_000;const f=fixture(t,{rules:()=>timedRules}),v=await f.service.create('owner',config(40,'dark','cpu',run.state.id));f.db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(snapshot),snapshot.revision,v.id);f.setTime(snapshot.data.testDeadline);
 await rejects(f.service.command(v.id,'owner',{commandId:randomUUID(),revision:snapshot.revision,choice:'scan:continue'}),409,'STALE_REVISION');assert.equal(stored(f.db,v.id).revision,snapshot.revision+1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands WHERE actor=?').get('timer').n,1);
});

test('authorized computer dispatch stops at the human prompt and returns only the human projection',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config(40,'light'));
 const next=await f.service.advanceComputer(v.id,'owner',{operation:'advance'});
 assert.equal(next.side,'light');assert.equal(next.computer.steps,1);assert.equal(next.computer.status,'waiting');assert.equal(next.game.setup.selected.dark,null);assert.deepEqual(next.game.players.dark.hand,[]);
 assert.equal((await f.fresh().advanceComputer(v.id,'owner',{})).revision,next.revision);
 await rejects(f.service.advanceComputer(v.id,'outsider',{}),404);await rejects(f.service.advanceComputer(v.id,'owner',{choice:'concede'}),400);
 const pvp=await f.service.create('owner',config(40,'dark','pvp'));await rejects(f.service.advanceComputer(pvp.id,'owner',{}),403,'NO_COMPUTER');
});
test('concurrent computer dispatch commits each revision once and cannot be poisoned by human command IDs',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config(40,'dark'));
 await f.service.command(v.id,'owner',cmd(v,undefined,'native-cpu-2-1'));
 const results=await Promise.all(Array.from({length:8},()=>f.fresh().advanceComputer(v.id,'owner',{})));
 assert.ok(results.every(r=>r.side==='dark'));assert.equal(results.reduce((n,r)=>n+r.computer.steps,0),1);
 const rows=f.db.sqlite.prepare('SELECT id,result_version FROM native_commands ORDER BY result_version').all();assert.equal(rows.length,2);assert.ok(rows[0].id.includes(':command:'));assert.ok(rows[1].id.includes(':computer:'));assert.equal(rows[1].result_version,2);
});
test('computer storage failure is atomic and retry works after service recreation',async t=>{
 const f=fixture(t),v=await f.service.create('owner',config(40,'light'));f.db.failBatch=true;
 await assert.rejects(f.service.advanceComputer(v.id,'owner',{}),/storage failure/);assert.equal((await f.service.read(v.id,'owner')).revision,0);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,0);
 assert.equal((await f.fresh().advanceComputer(v.id,'owner',{})).revision,1);
});
test('HTTP advance authorizes before work and rejects supplied CPU policy/choice/clock',async t=>{
 const f=fixture(t),h=matchHandlers(f.fresh),v=await f.service.create('owner',config(40,'light'));
 for(const extra of [{choice:'pass'},{policy:'cheat'},{now:1},{side:'dark'},{budget:10000}])assert.equal((await h.update(request('/'+v.id,{operation:'advance',...extra}),context(v.id))).status,400);
 assert.equal((await h.update(request('/'+v.id,{operation:'advance'},'stranger'),context(v.id))).status,404);
 assert.equal((await h.update(request('/'+v.id,{operation:'advance'},null),context(v.id))).status,401);
 const r=await h.update(request('/'+v.id,{operation:'advance'}),context(v.id));assert.equal(r.status,200);const body=await r.json();assert.equal(body.side,'light');assert.equal(body.computer.steps,1);assert.deepEqual(body.game.players.dark.hand,[]);
 await f.service.command(v.id,'owner',{commandId:randomUUID(),revision:body.revision,choice:'concede'});const ended=await f.service.advanceComputer(v.id,'owner',{});assert.equal(ended.computer.status,'finished');assert.equal(ended.computer.steps,0);
});
for(const [size,ownerSide] of [[40,'dark'],[60,'light']])test(`CPU dispatcher completes ${size}-card match across service restarts with owner ${ownerSide}`,async t=>{
 const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
 const f=fixture(t);let v=await f.service.create('owner',config(size,ownerSide));let ready=0,steps=0;
 for(let i=0;i<15000&&v.game.status!=='finished';i++){
  f.setTime(1_800_000_000_000+i*1000);
  v=await f.fresh().advanceComputer(v.id,'owner',{operation:'advance'});
  assert.ok(v.computer.steps>=0&&v.computer.steps<=24);steps+=v.computer.steps;if(v.computer.status==='ready')ready++;
  assert.equal(v.side,ownerSide);assert.deepEqual(v.game.players[ownerSide==='dark'?'light':'dark'].hand,[]);
  if(v.game.status==='finished')break;
  const choice=chooseComputerAction(v.game,ownerSide);
  if(choice)v=await f.fresh().command(v.id,'owner',cmd(v,choice));
 }
 assert.equal(v.game.status,'finished');assert.equal(v.game.result.reason,'life-force');assert.ok(steps>50);assert.equal(v.game.data,undefined);
 const receipts=f.db.sqlite.prepare("SELECT count(*) n,count(DISTINCT result_version) versions FROM native_commands WHERE match_id=?").get(v.id);assert.equal(receipts.n,receipts.versions);assert.equal(receipts.n,v.revision);
});
test('dispatch work budget yields a resumable ready state without fabricating a pass',async t=>{
 // A test-only chain isolates the dispatcher bound from card-specific timing.
 const rules={...auditRules,starting:undefined,setupComplete:()=>true,validate:()=>{},
  decisions:()=>[{id:'required',label:'Resolve required step'}],
  choose:m=>{m.data.remaining--;if(m.data.remaining)m.stack.push({kind:'decision',side:'dark',handler:'test:chain',payload:null});else runtime.openWindow(m,'phase','light')},
  automatic:()=>[],actions:()=>[]};
 const f=fixture(t,{rules:()=>rules}),v=await f.service.create('owner',config(40,'light'));
 const m=runtime.startTurns(stored(f.db,v.id),rules);m.data.remaining=30;m.stack=[{kind:'decision',side:'dark',handler:'test:chain',payload:null}];
 f.db.sqlite.prepare('UPDATE native_matches SET state=?,version=? WHERE id=?').run(JSON.stringify(m),m.revision,v.id);
 const first=await f.service.advanceComputer(v.id,'owner',{});assert.equal(first.computer.steps,24);assert.equal(first.computer.status,'ready');assert.equal(stored(f.db,v.id).data.remaining,6);
 const second=await f.fresh().advanceComputer(v.id,'owner',{});assert.equal(second.computer.steps,6);assert.equal(second.computer.status,'waiting');assert.equal(second.revision,first.revision+6);assert.equal((await f.service.advanceComputer(v.id,'owner',{})).computer.steps,0);
});
