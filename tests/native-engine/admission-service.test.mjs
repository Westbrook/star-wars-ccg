import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {auditRules,starterDecks} from './match-runner.mjs';
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const a=load(new URL('../../lib/native-engine/admission.ts',import.meta.url));
const decks=starterDecks(60),get=side=>decks.find(d=>d.side===side).cards;
const profile={id:'intro-service-test',rulesVersion:auditRules.id,evidenceVersion:'test-only-1',enabled:true,format:'open',deckSize:60,decks:Object.fromEntries(decks.map(d=>[d.side,a.deckCounts(d.cards)]))};
const rules={...auditRules,supports:()=>false,admissionProfiles:a.defineAdmissionProfiles([profile])};
const config=(mode='cpu',side='light')=>({id:randomUUID(),mode,side,deckSize:60,deck:get(side),...(mode==='cpu'?{computerDeck:get(side==='light'?'dark':'light')}:{})});
function fixture(t){const db=new SqliteD1();t.after(()=>db.close());return{db,fresh:(r=rules)=>nativeMatchService(db,{currentRules:r.id,rules:id=>id===r.id?r:undefined,now:()=>1800000000000})};}
const rejected=(p,code)=>assert.rejects(p,e=>e.code===code);

test('CPU exact pair is saved, recoverable and idempotent without global card support',async t=>{
 const f=fixture(t),body=config(),v=await f.fresh().create('owner',body);assert.equal(v.game.status,'setup');
 const row=f.db.sqlite.prepare('SELECT * FROM native_matches WHERE id=?').get(v.id),m=JSON.parse(row.state),owner=JSON.parse(row.owner_deck);
 assert.equal(m.data.nativeAdmission.evidenceVersion,'test-only-1');assert.equal(owner.schema,2);
 assert.deepEqual(await f.fresh().create('owner',body),v);assert.deepEqual(await f.fresh().read(v.id,'owner'),v);
 assert.ok(f.fresh().starters().every(d=>d.admitted));
 const body2=config('cpu','dark');await f.fresh().create('dark-owner',body2);
});
test('waiting PvP records admission and checks opposite deck at join, including retry',async t=>{
 const f=fixture(t),v=await f.fresh().create('owner',config('pvp'));assert.equal(v.waitingForOpponent,true);assert.equal(v.game,null);
 assert.deepEqual(await f.fresh().read(v.id,'owner'),v);
 const join={operation:'join',commandId:randomUUID(),inviteToken:v.inviteToken,deck:[...get('dark')].reverse()};
 const bad=[...join.deck];bad[0]=bad.find(bp=>bp!==bad[0]);await rejected(f.fresh().join(v.id,'guest',{...join,deck:bad}),'DECK_NOT_ADMITTED');
 assert.equal(f.db.sqlite.prepare('SELECT guest FROM native_matches WHERE id=?').get(v.id).guest,null);
 const g=await f.fresh().join(v.id,'guest',join);assert.equal(g.side,'dark');assert.equal(g.waitingForOpponent,false);
 assert.equal((await f.fresh().join(v.id,'guest',join)).duplicate,true);assert.equal((await f.fresh().read(v.id,'owner')).game.status,'setup');
});
test('profile privileges cannot be supplied in requests or applied to sealed/open40',async t=>{
 const f=fixture(t);await rejected(f.fresh().create('owner',{...config(),admissionProfile:profile.id}),'INVALID_REQUEST');
 await rejected(f.fresh().create('owner',{...config(),poolId:randomUUID()}),'SEALED_FORMAT');
 const body=config();body.deckSize=40;body.deck=starterDecks(40).find(d=>d.side==='light').cards;body.computerDeck=starterDecks(40).find(d=>d.side==='dark').cards;
 await rejected(f.fresh().create('owner',body),'DECK_NOT_ADMITTED');await rejected(f.fresh().create('owner',{...body,poolId:randomUUID()}),'SERVER_COMPUTER_DECK');
 delete body.computerDeck;body.mode='pvp';await rejected(f.fresh().create('owner',{...body,poolId:randomUUID()}),'DECK_NOT_ADMITTED');
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_matches').get().n,0);
});
test('changed or stripped admission snapshots cannot reopen saved or waiting games',async t=>{
 const f=fixture(t),v=await f.fresh().create('owner',config()),pvp=await f.fresh().create('owner',config('pvp'));
 const changed={...rules,admissionProfiles:a.defineAdmissionProfiles([{...profile,evidenceVersion:'test-only-2'}])};
 await assert.rejects(f.fresh(changed).read(v.id,'owner'),/original admission/);await assert.rejects(f.fresh(changed).read(pvp.id,'owner'),/original admission/);
 const row=f.db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id);const m=JSON.parse(row.state);delete m.data.nativeAdmission;f.db.sqlite.prepare('UPDATE native_matches SET state=? WHERE id=?').run(JSON.stringify(m),v.id);await assert.rejects(f.fresh().read(v.id,'owner'),/Missing verified/);
 f.db.sqlite.prepare('UPDATE native_matches SET owner_deck=? WHERE id=?').run(JSON.stringify(get('light')),pvp.id);await assert.rejects(f.fresh().read(pvp.id,'owner'),/Missing waiting/);
});
test('individually eligible but mismatched profile halves cannot create or join a match',async t=>{
 const f=fixture(t),alt=structuredClone(decks);for(const d of alt)d.cards[0]=d.cards.find(bp=>bp!==d.cards[0]);
 const r={...rules,admissionProfiles:a.defineAdmissionProfiles([profile,{...profile,id:'alternate',decks:Object.fromEntries(alt.map(d=>[d.side,a.deckCounts(d.cards)]))}])},s=f.fresh(r),dark=alt.find(d=>d.side==='dark').cards;
 await rejected(s.create('owner',{...config(),computerDeck:dark}),'DECK_PAIR_NOT_ADMITTED');
 const waiting=await s.create('owner',config('pvp'));await rejected(s.join(waiting.id,'guest',{commandId:randomUUID(),inviteToken:waiting.inviteToken,deck:dark}),'DECK_PAIR_NOT_ADMITTED');
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM native_commands').get().n,0);
});
test('saved profile remains on its original rules registry when current rules advance',async t=>{
 const f=fixture(t),v=await f.fresh().create('owner',config()),newRules={...rules,id:'new-native-rules',admissionProfiles:[]};
 const service=nativeMatchService(f.db,{currentRules:newRules.id,rules:id=>id===rules.id?rules:id===newRules.id?newRules:undefined,now:()=>1800000000000});
 assert.deepEqual(await service.read(v.id,'owner'),v);await rejected(service.create('owner',config()),'DECK_NOT_ADMITTED');
 const missing=nativeMatchService(f.db,{currentRules:newRules.id,rules:id=>id===newRules.id?newRules:undefined});await rejected(missing.read(v.id,'owner'),'RULES_UNAVAILABLE');
});
test('profile snapshot stays private and commands recover its binding after setup and concession',async t=>{
 const f=fixture(t),v=await f.fresh().create('owner',config());assert.equal(v.game.data,undefined);assert.equal(v.game.admissionCandidates,undefined);assert.equal(v.game.nativeAdmission,undefined);
 const cpu=await f.fresh().readComputer(v.id);await f.fresh().computerCommand(v.id,{commandId:randomUUID(),revision:cpu.revision,choice:cpu.game.prompt.choices[0].id});
 const fresh=await f.fresh().read(v.id,'owner');const choice=fresh.game.prompt.choices[0].id,body={commandId:randomUUID(),revision:fresh.revision,choice};await f.fresh().command(v.id,'owner',body);
 const current=await f.fresh().read(v.id,'owner'),done=await f.fresh().command(v.id,'owner',{commandId:randomUUID(),revision:current.revision,choice:'concede'});assert.equal(done.game.result.winner,'dark');assert.deepEqual((await f.fresh().read(v.id,'owner')).game,done.game);
});
test('recovery rejects a profile match whose immutable owner snapshot changes decks',async t=>{
 const f=fixture(t),v=await f.fresh().create('owner',config());const row=f.db.sqlite.prepare('SELECT owner_deck FROM native_matches WHERE id=?').get(v.id),snapshot=JSON.parse(row.owner_deck);snapshot.cards[0]=snapshot.cards.find(bp=>bp!==snapshot.cards[0]);
 f.db.sqlite.prepare('UPDATE native_matches SET owner_deck=? WHERE id=?').run(JSON.stringify(snapshot),v.id);await assert.rejects(f.fresh().read(v.id,'owner'),/differs from its admission/);
});
