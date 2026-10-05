import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fixture,play,prompt,step,manifest} from './starter-timing-reachability-fixture.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const audit=read('./starter-timing-reachability.json');
const reference=read('./starter-timing-reachability-results.json');
const modes=['duel-pass','duel-cancel','friendly-dark','friendly-light','collateral-dark','collateral-light'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const semanticReference=w=>w.actions.map(a=>a==="Cancel Vader's Obsession"?'cancel':a==='Reduce Force loss'?'reduce':a==='Regenerate top-most character'?'kintan':a);
const semanticNative=choices=>[...new Set(choices.filter(c=>c!=='pass').map(c=>c.startsWith('duel:cancel:')?'cancel':c.startsWith('reduce:')?'reduce':c.startsWith('revival:kintan:')?'kintan':c))];
for(const mode of modes)test('exact starter provider timing matches actual GEMP inventory: '+mode,()=>{
 const f=fixture(mode),row=reference.find(r=>r.mode===mode);assert.ok(row);
 const inventory=side=>manifest.cards.filter(c=>c.type==='Interrupt'&&c.side===side).map(c=>c.gempId).sort();
 for(const side of ['light','dark'])assert.deepEqual(row.handInterrupts[side].slice().sort(),inventory(side));
 if(!f.duel){const before=f.baseline.flatMap(b=>b.choices);assert.ok(before.some(c=>c.startsWith('accident:play:')));if(before.some(c=>c.startsWith('run-luke:')))assert.ok(row.baseline.flatMap(b=>b.actions).some(a=>a==='Move Luke to battle'));
  if(mode==='collateral-dark')assert.ok(before.some(c=>c.startsWith('escape:')),'Narrow Escape is available with Luke in battle');
  if(mode==='friendly-dark'){for(const prefix of ['react-deploy:','react-move:','run-luke:'])assert.ok(before.some(c=>c.startsWith(prefix)),prefix+' is genuinely available before accident');}
 }
 let m=play(f),nativeNonempty=[],casualtyChosen=false,preResultWindows=0,duelDraws=0,accidentDraws=0,windowCount=0;
 const initialCharacters=Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===f.site&&manifest.cards.find(d=>d.gempId===c.blueprint)?.type==='Character').map(c=>c.id);
 for(let n=0;n<300&&m.cards[f.card].zone!=='lost';n++){
  const p=prompt(m),choices=p.choices.map(c=>c.id),top=m.stack.at(-1),duel=m.data.duel;
  if(top.kind==='window'){
   windowCount++;const event=top.event;
   if(event?.category==='duel'&&event.kind==='destiny-drawn'&&top.passes===0)duelDraws++;
   if(!f.duel&&event?.kind==='destiny-drawn'&&top.passes===0)accidentDraws++;
   const actions=semanticNative(choices);if(actions.length)nativeNonempty.push({side:p.side,actions});
   for(const action of actions){assert.ok(['cancel','reduce','kintan'].includes(action),'No unrelated response: '+action);
    if(action==='cancel')assert.equal(duel,undefined,'Cancellation precedes duel');
    if(action==='reduce')assert.ok(['result','losses'].includes(duel?.stage),'Force loss follows determined duel result');
    if(action==='kintan'){assert.equal(casualtyChosen,true);assert.equal(event.kind,'character-lost');}
   }
   if(f.duel&&duel&&['begin','draws'].includes(duel.stage)){
    preResultWindows++;assert.deepEqual(choices,['pass']);assert.equal(m.cards[f.luke].zone,'table');assert.equal(m.cards[f.vader].zone,'table');assert.equal(m.cards[f.luke].location,f.site);assert.equal(m.cards[f.vader].location,f.site);
   }
   if(!f.duel&&!casualtyChosen){assert.deepEqual(choices,['pass']);for(const id of initialCharacters){assert.equal(m.cards[id].zone,'table');assert.equal(m.cards[id].location,f.site);}}
  }
  let choice=mode==='duel-cancel'?choices.find(c=>c.startsWith('duel:cancel:')):undefined;
  if(top.handler==='accident:select'){const ids=choices.map(c=>c.replace('accident-lose:',''));assert.ok(ids.every(id=>initialCharacters.includes(id)));choice='accident-lose:'+(f.light?f.storm:f.rebel);casualtyChosen=true;}
  choice??=choices.includes('pass')?'pass':choices[0];m=step(m,choice);
 }
 assert.equal(m.cards[f.card].zone,'lost');assert.ok(windowCount>0);
 assert.deepEqual(nativeNonempty,row.windows.filter(w=>w.actions.length).map(w=>({side:w.side,actions:semanticReference(w)})));
 if(mode==='duel-pass'){assert.ok(preResultWindows>0);assert.equal(duelDraws,4);assert.equal(row.preResultSeen,true);assert.equal(row.resultsSeen,true);assert.ok(row.windows.filter(w=>w.duelPreResult).length>0);for(const w of row.windows.filter(w=>w.duelPreResult))assert.deepEqual(w.actions,[]);}
 if(mode==='duel-cancel'){for(let n=0;n<30&&m.cards[f.hand['101_3']].zone==='playing';n++)m=step(m,'pass');assert.equal(duelDraws,0);assert.equal(row.canceled,true);assert.equal(m.cards[f.hand['101_3']].zone,'lost');assert.equal(m.cards[f.luke].zone,'table');assert.equal(m.cards[f.vader].zone,'table');}
 if(!f.duel){assert.equal(accidentDraws,1);assert.ok(casualtyChosen);for(const w of row.windows.filter(w=>!w.casualtyAlreadyChosen))assert.deepEqual(w.actions,[]);assert.equal(m.cards[f.light?f.storm:f.rebel].zone,'lost');}
});
test('post-accident Kintan retrieves to hand without reopening deployment or selecting another casualty',()=>{
 const f=fixture('collateral-dark');const retrieved=f.m.players.dark.lost.find(id=>f.m.cards[id].blueprint==='1_194');assert.ok(retrieved);let m=play(f),played=false;
 for(let n=0;n<300&&m.cards[f.card].zone!=='lost';n++){
  const p=prompt(m),cs=p.choices.map(c=>c.id);assert.ok(!cs.some(c=>/^(react-deploy:|react-move:|run-luke:|stun:|revival:old-ben:)/.test(c)));
  let choice=cs.find(c=>c.startsWith('revival:kintan:'));if(choice){assert.equal(m.cards[f.rebel].zone,'lost');played=true;}
  choice??=cs.find(c=>c==='accident-lose:'+f.rebel)??(cs.includes('pass')?'pass':cs[0]);m=step(m,choice);
 }
 assert.ok(played);assert.equal(m.cards[retrieved].zone,'hand');assert.equal(m.cards[f.rebel].zone,'lost');assert.equal(m.cards[f.card].zone,'lost');
});
test('68-definition timing review and executed receipt are fingerprint-bound, with broader discrepancies retained',()=>{
 assert.equal(audit.productionAdmission,'closed');assert.equal(audit.classification,'outside-current-pair');assert.equal(audit.productionVerification.verifiedFiles,6820);assert.equal(audit.productionVerification.allUnchanged,true);
 assert.deepEqual(audit.cards.map(c=>c.gempId).sort(),manifest.cards.map(c=>c.gempId).sort());assert.equal(audit.cards.length,68);for(const deck of manifest.decks)assert.equal(hash(JSON.stringify(deck.main)),audit.deckFingerprints[deck.id]);
 const grouped=audit.groups.flatMap(g=>{assert.ok(g.duelPredicate&&g.accidentPredicate);return g.cards;});assert.equal(new Set(grouped).size,68);assert.equal(grouped.length,68);
 for(const c of audit.cards){assert.equal(hash(JSON.stringify(manifest.cards.find(d=>d.gempId===c.gempId))),c.manifestDefinitionSha256);assert.match(c.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(audit.groups.find(g=>g.id===c.group).cards.includes(c.gempId),true);}
 for(const [path,digest] of Object.entries({...audit.fingerprints,...audit.nativeRuntimeInputs}))assert.equal(hash(fs.readFileSync(new URL('../../'+path,import.meta.url))),digest,path+' changed: review receipt/timing scope');
 assert.deepEqual(reference.map(r=>r.mode),modes);assert.equal(reference.reduce((n,r)=>n+r.windows.length,0),audit.execution.responseWindows);assert.equal(audit.execution.junitFailures,0);assert.equal(audit.execution.junitErrors,0);assert.equal(audit.execution.junitTests,1);
 assert.ok(audit.limits.some(s=>s.includes('No exhaustive state search')));assert.ok(audit.limits.some(s=>s.includes('Failed-Obsession')));
});
