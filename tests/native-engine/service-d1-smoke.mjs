import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {load} from '../native-proof/load-engine.mjs';
import {auditRules,starterDecks} from './match-runner.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {matchHandlers}=load(new URL('../../lib/native-engine/http.ts',import.meta.url));
// Isolated real D1/workerd runtime. No production Site or shared local DB used.
const mf=new Miniflare({modules:true,script:'export default { fetch() { return new Response("native-service-test") } }',compatibilityDate:'2026-05-22',d1Databases:['DB'],cf:false});
try{
 const db=await mf.getD1Database('DB');const migration=['0002_native_match_sessions.sql','0003_native_match_clocks.sql'].map(file=>fs.readFileSync(new URL('../../drizzle/'+file,import.meta.url),'utf8')).join('\n--> statement-breakpoint\n');
 await db.batch(migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 let time=1800000000000;
 const fresh=()=>nativeMatchService(db.withSession('first-primary'),{now:()=>time,currentRules:auditRules.id,rules:id=>id===auditRules.id?auditRules:undefined});
 const http=matchHandlers(fresh),decks=starterDecks(40),body={id:randomUUID(),mode:'cpu',side:'dark',deckSize:40,deck:decks.find(d=>d.side==='dark').cards,computerDeck:decks.find(d=>d.side==='light').cards};
 const request=(body,actor='owner')=>new Request('http://localhost/api/matches',{method:body?'POST':'GET',headers:{'content-type':'application/json','oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'},...(body?{body:JSON.stringify(body)}:{})});
 const created=await http.create(request(body));assert.equal(created.status,201);let view=await created.json();
 const choice={operation:'command',commandId:randomUUID(),revision:0,choice:view.game.prompt.choices[0].id},ctx={params:Promise.resolve({id:body.id})};
 const responses=await Promise.all(Array.from({length:8},()=>http.update(request(choice),ctx)));assert.ok(responses.every(r=>r.status===200));const results=await Promise.all(responses.map(r=>r.json()));assert.equal(results.filter(r=>!r.duplicate).length,1);assert.ok(results.every(r=>r.acceptedRevision===1&&r.revision===1));
 assert.equal((await db.prepare('SELECT count(*) n FROM native_commands').first()).n,1);
 assert.equal((await http.read(request(undefined,'outsider'),ctx)).status,404);
 await db.prepare("CREATE TRIGGER rollback_native BEFORE UPDATE ON native_matches BEGIN SELECT RAISE(ABORT,'rollback-probe'); END").run();
 await assert.rejects(fresh().advanceComputer(body.id,'owner',{}),/rollback-probe/);assert.equal((await db.prepare('SELECT version FROM native_matches WHERE id=?').bind(body.id).first()).version,1);assert.equal((await db.prepare('SELECT count(*) n FROM native_commands').first()).n,1);
 await db.prepare('DROP TRIGGER rollback_native').run();
 const dispatch=await Promise.all(Array.from({length:8},()=>http.update(request({operation:'advance'}),ctx)));assert.ok(dispatch.every(r=>r.status===200));const dispatched=await Promise.all(dispatch.map(r=>r.json()));assert.equal(dispatched.reduce((n,r)=>n+r.computer.steps,0),1);assert.ok(dispatched.every(r=>r.side==='dark'&&r.computer.status==='waiting'&&!r.game.setup.selected.light));
 view=await fresh().read(body.id,'owner');assert.equal(view.revision,2);assert.equal((await fresh().command(body.id,'owner',choice)).acceptedRevision,1);
 const pvp=await fresh().create('owner',{...body,id:randomUUID(),mode:'pvp',computerDeck:undefined});const guestDeck=decks.find(d=>d.side==='light').cards;
 const joins=await Promise.allSettled(['guest-a','guest-b'].map(actor=>fresh().join(pvp.id,actor,{commandId:randomUUID(),inviteToken:pvp.inviteToken,deck:guestDeck})));assert.equal(joins.filter(r=>r.status==='fulfilled').length,1);assert.equal(joins.filter(r=>r.status==='rejected').length,1);
 const timed=await fresh().create('clock-owner',{...body,id:randomUUID(),mode:'pvp',computerDeck:undefined,clockMinutes:15});
 await fresh().join(timed.id,'clock-guest',{commandId:randomUUID(),inviteToken:timed.inviteToken,deck:guestDeck,clockMinutes:15});
 let tv=await fresh().read(timed.id,'clock-owner');
 for(let n=0;tv.game.status==='setup'&&n<20;n++){
  let actor='clock-owner',choice=tv.game.prompt?.choices[0]?.id;if(!choice){actor='clock-guest';choice=(await fresh().read(tv.id,actor)).game.prompt?.choices[0]?.id}
  assert.ok(choice);await fresh().command(tv.id,actor,{commandId:randomUUID(),revision:tv.revision,choice});tv=await fresh().read(tv.id,'clock-owner');
 }
 assert.equal(tv.game.status,'playing');const base=tv.revision;time+=900000;
 const expired=await Promise.all(Array.from({length:8},()=>fresh().read(tv.id,'clock-owner')));
 assert.ok(expired.every(v=>v.game.result.reason==='timeout'&&v.revision===base+1&&v.clock.running===null));
 assert.equal((await db.prepare("SELECT count(*) n FROM native_commands WHERE match_id=? AND actor='timer'").bind(tv.id).first()).n,1);
 console.log('D1/workerd: atomic retry receipts, transaction rollback/retry, first-primary session reads, private projections, concurrent authorized computer dispatch and competing invitation claims, additive clock migration and concurrent clock expiration passed.');
}finally{await mf.dispose()}
