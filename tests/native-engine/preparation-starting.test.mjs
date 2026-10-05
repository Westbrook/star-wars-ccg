import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {ready,search,playing,advance,step,prompt,rules,runtime,state,decks,premiereRules} from './preparation-starting-fixture.mjs';
const provider=load(new URL('../../lib/native-engine/preparation-starting.ts',import.meta.url));
for(const first of ['dark','light'])for(const size of [40,60])for(const effects of [false,true])test(`${first} first: ${size} cards, Effects ${effects}, normal setup through shuffled hands`,()=>{
 const m=playing(ready({first,size,effects}));assert.equal(m.turn.side,first);for(const side of ['dark','light']){assert.equal(m.players[side].hand.length,8);assert.equal(m.players[side].reserve.length,size-10-(effects?1:0));assert.deepEqual(m.players[side].lost,[side+'-2']);assert.equal(Object.values(m.cards).filter(c=>c.owner===side&&['4_21','4_134'].includes(c.blueprint)&&c.zone==='table').length,effects?1:0);assert.equal(m.players[side].force.length,0);}assert.equal(m.data.deployments,undefined);assert.equal(m.data.cardPlays,undefined);assert.deepEqual(m.data.preparationStarts,first==='dark'?['dark-2','light-2']:['light-2','dark-2']);assert.equal(m.setup.stage,'complete');
});
test('search inspection is private and failed-search verification switches to the opponent',()=>{
 let m=search(ready({effects:false}));const own=runtime.project(m,rules,'dark'),other=runtime.project(m,rules,'light');assert.equal(own.rules.startingSearch.cards.length,58);assert.deepEqual(other.rules.startingSearch.cards,[]);assert.equal(other.prompt.choices.length,0);
 m=step(m,'prep-start:not-found');assert.equal(prompt(m).side,'light');assert.equal(runtime.project(m,rules,'light').rules.startingSearch.cards.length,58);assert.equal(runtime.project(m,rules,'dark').rules.startingSearch.cards.length,0);m=step(m,'prep-start:verified');assert.equal(m.setup.interrupts.resolved,1);assert.equal(runtime.project(m,rules,'light').rules.startingSearch,null);assert.equal(m.data.failedSearches,undefined);
});
test('a selected Effect actually enters initiation, deployment and arrival windows before setup resumes',()=>{
 let m=search(ready());m=step(m,'prep-start:deploy:dark-3');assert.equal(m.cards['dark-3'].zone,'playing');assert.equal(m.cards['dark-2'].zone,'playing');assert.equal(m.status,'setup');assert.equal(m.setup.interrupts.resolved,0);
 m=advance(m,x=>x.stack.at(-1)?.event?.kind==='deployed');assert.equal(m.cards['dark-3'].zone,'table');assert.equal(m.data.deployments[0].card.id,'dark-3');assert.equal(m.cards['dark-2'].zone,'playing');m=advance(m,x=>!x.stack.length);assert.equal(m.setup.interrupts.resolved,1);assert.equal(m.cards['dark-2'].zone,'lost');assert.ok(!provider.startingEffects(m,'dark').includes('dark-4'));
});
test('every setup command resumes exactly after serialization and rejects stale retries',()=>{
 let m=ready();for(let n=0;n<100&&m.status==='setup';n++){const p=prompt(m),c=p.choices.find(c=>c.id==='pass')??p.choices[0],copy=JSON.parse(JSON.stringify(m));const a=step(m,c.id,p.side),b=step(copy,c.id,p.side);assert.deepEqual(a,b);assert.throws(()=>runtime.applyCommand(a,rules,p.side,{revision:m.revision,choice:c.id}),/Stale/);m=a;}assert.equal(m.status,'playing');
});
test('ordinary setup admits these supported preparation cards without opening native production admission',()=>{assert.doesNotThrow(()=>runtime.createMatch('admitted-fixture',60,decks(),rules));for(const bp of ['9_139','9_51','4_21','4_134'])assert.equal(premiereRules.supports(bp),false);const d=decks();d[0].cards[1]='1_279';assert.doesNotThrow(()=>runtime.createMatch('ordinary-printed',60,d,rules));});
for(const mode of ['count','history','source','phase','finish','verification'])test('corrupt setup continuation rejects '+mode,()=>{
 let m=search(ready({effects:mode!=='verification'}));if(mode==='verification'){m=step(m,'prep-start:not-found');m.stack.at(-1).side='dark';}
 else if(mode==='phase')m.stack.push({kind:'window',timing:'phase',serial:++m.serial,priority:'dark',passes:0,completed:[]});
 else if(mode==='finish')m.stack.shift();
 else {const p=m.stack.at(-1).payload;if(mode==='count')p.count=4;if(mode==='history')p.chosen=['dark-3'];if(mode==='source')p.card='light-2';}
 assert.throws(()=>runtime.project(m,rules,'dark'));
});
for(const stage of ['search','deploy','verify'])test('concession is final during starting '+stage,()=>{let m=search(ready({effects:stage!=='verify'}));if(stage==='deploy')m=step(m,'prep-start:deploy:dark-3');if(stage==='verify')m=step(m,'prep-start:not-found');m=step(m,'concede','light');assert.equal(m.status,'finished');assert.equal(m.result.winner,'dark');assert.equal(runtime.prompt(m,rules,'dark'),null);});
test('required and optional setup responses run before the additional opening hand; Force portions are ignored',()=>{
 const {queueForceLoss}=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
 const r={...rules,automatic:(m,w)=>[...rules.automatic(m,w),...(m.status==='setup'&&w.event?.kind==='deployed'?[{id:'test:required:'+w.serial,handler:'test:required',actor:'dark',label:'Required arrival',payload:null,payment:{dark:4}}]:[])],actions:(m,w,side)=>[...rules.actions(m,w,side),...(m.status==='setup'&&w.event?.kind==='deployed'&&side==='dark'&&!m.data.testOptional?[{id:'test:optional',handler:'test:optional',label:'Optional arrival',payload:null}]:[])],initiate:(m,f,c)=>{if(!f.action.handler.startsWith('test:'))rules.initiate(m,f,c);},resolve:(m,f,c)=>{if(f.action.handler==='test:required'){runtime.activateForce(m,'dark','dark-1',2);assert.equal(runtime.activateOneForce(m,'dark'),false);queueForceLoss(m,{side:'dark',remaining:2,source:'dark-1',site:null,reductionUsed:false});m.data.testRequired=(m.data.testRequired??0)+1;}else if(f.action.handler==='test:optional'){state.moveTop(m,'dark','reserve','hand');m.data.testOptional=true;}else rules.resolve(m,f,c);}};
 let m=ready({},r);m=advance(m,x=>prompt(x,r).choices.some(c=>c.id==='test:optional'),r);m=step(m,'test:optional',prompt(m,r).side,r);m=playing(m,r);assert.equal(m.data.testRequired,2);assert.equal(m.players.dark.hand.length,9);assert.equal(m.players.dark.force.length,0);assert.equal(m.players.dark.used.length,0);assert.equal(m.players.dark.lost.length,1);
});

const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const {seeded}=await import('./match-runner.mjs');
for(const size of [40,60])test('actual '+size+'-card setup and CPU match reaches Life Force victory without fixture changes',t=>{
 const entropy=seeded(8),seen=new Set();let m=runtime.createMatch('starting-full-'+size,size,decks({size}),rules),opening=false;
 for(let n=0;n<15000&&m.status!=='finished';n++){
  let v=runtime.project(m,rules,'dark'),side='dark';if(!v.prompt?.choices.length){side='light';v=runtime.project(m,rules,side);}
  const before=JSON.stringify(v),choice=chooseComputerAction(v,side);assert.ok(v.prompt.choices.some(c=>c.id===choice));assert.notEqual(choice,'concede');assert.equal(JSON.stringify(v),before);assert.equal(chooseComputerAction(JSON.parse(before),side),choice);
  seen.add(choice.split(':')[0]);m=runtime.applyCommand(JSON.parse(JSON.stringify(m)),rules,side,{revision:m.revision,choice},entropy);
  if(!opening&&m.status==='playing'){opening=true;for(const s of ['dark','light']){assert.equal(m.players[s].hand.length,8);assert.equal(m.cards[s+'-2'].zone,'lost');assert.equal(m.cards[s+'-3'].zone,'table');}}
 }
 assert.ok(opening);assert.equal(m.status,'finished');assert.equal(m.result.reason,'life-force');for(const c of ['starting-select','prep-start','deploy','drain'])assert.ok(seen.has(c),'Missing '+c);t.diagnostic('Completed turn '+m.turn.number+' at revision '+m.revision);
});

const fs=await import('node:fs'),{createHash}=await import('node:crypto');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/preparation-starting-results.json',import.meta.url)));
for(const row of oracle)test('actual GEMP setup '+JSON.stringify([row.first,row.effects,row.dark,row.light]),()=>{
 let m=runtime.createMatch('oracle',60,decks({first:row.first,effects:row.effects}),rules);for(const side of ['dark','light'])m=step(m,'select:'+side+'-1',side);m=step(m,'reveal','dark');let p=prompt(m);m=step(m,p.choices[0].id,p.side);for(const side of ['dark','light'])m=step(m,row[side]?'starting-select:'+side+'-2':'starting-decline',side);m=step(m,'starting-reveal','dark');m=playing(m);
 assert.equal(m.turn.side,row.first);assert.deepEqual((m.data.preparationStarts??[]).map(id=>m.cards[id].owner),row.lostOrder);
 assert.deepEqual(Object.values(m.cards).filter(c=>c.zone==='table'&&['4_21','4_134'].includes(c.blueprint)).map(c=>c.blueprint).sort(),row.table);
 for(const side of ['dark','light'])assert.deepEqual({reserve:m.players[side].reserve.length,hand:m.players[side].hand.length,lost:m.players[side].lost.map(id=>m.cards[id].blueprint)},row.piles[side]);
 for(const x of row.trace.filter(x=>x.text==='Choose starting interrupt'))assert.deepEqual(x.revealed,{dark:'none',light:'none'});
});
test('preparation setup receipt binds actual GEMP source and all sixteen outcomes',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./gemp/preparation-starting-provenance.json',import.meta.url)));for(const f of ['harness','results'])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+p[f],import.meta.url))).digest('hex'),p[f+'Sha256']);assert.equal(p.branches,oracle.length);assert.equal(p.branches,16);assert.equal(p.productionFilesCompared,6820);assert.equal(p.productionFilesChanged,0);
});
