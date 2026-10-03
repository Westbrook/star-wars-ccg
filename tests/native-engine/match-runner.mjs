import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Internal integration test admission only. No production rules or deck gate is changed.
export const auditRules={...premiereRules,supports:bp=>manifest.cards.some(c=>c.gempId===bp)};
const copy=x=>JSON.parse(JSON.stringify(x));
export function starterDecks(size=60){
 if(![40,60].includes(size))throw Error('Unsupported audit deck size');
 return manifest.decks.map(d=>{
  if(size===60)return {side:d.side,cards:[...d.main]};
  // Open-40 test derivatives, not published/authored official starter lists.
  // Keep every unique definition and remove only duplicate physical copies.
  const seen=new Set(),kept=d.main.map(bp=>{if(seen.has(bp))return false;seen.add(bp);return true});
  let remaining=size-seen.size;for(let i=0;i<kept.length&&remaining;i++)if(!kept[i]){kept[i]=true;remaining--}
  return {side:d.side,cards:d.main.filter((_,i)=>kept[i])};
 });
}
export function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x}}
function choose(m,p,random,seen){
 const choices=p.choices, frame=m.stack.at(-1);
 if(p.timing==='setup')return choices[Math.floor(random()*choices.length)].id;
 if(p.mandatory){
  const draw=choices.find(c=>c.id==='draw-destiny');if(draw)return draw.id;
  const loss=choices.filter(c=>c.id.startsWith('lose-hand:'));if(loss.length&&random()<0.65)return loss[Math.floor(random()*loss.length)].id;
  return choices[Math.floor(random()*choices.length)].id;
 }
 const pass=choices.find(c=>c.id==='pass'),active=choices.filter(c=>c.id!=='pass'&&!seen.has(frame.serial+':'+c.id));
 const activation=choices.find(c=>c.id==='core:activate');if(activation)return activation.id;
 const draw=choices.find(c=>c.id==='core:draw');if(draw)return m.players[p.side].hand.length<10||random()<0.22?draw.id:'pass';
 if(!active.length)return pass?.id??choices[0].id;
 if(pass&&p.timing!=='phase'&&random()<0.45)return pass.id;
 const rank=c=>c.id.startsWith('drain:')?8:c.id.startsWith('battle:')?7:c.id.startsWith('deploy:')?6:c.id.startsWith('forfeit:')?6:c.id.startsWith('move:')?4:c.id.startsWith('transfer:')?0:2;
 const ranked=active.map(c=>({c,score:rank(c)+random()*4})).sort((a,b)=>b.score-a.score);
 return ranked[0].c.id;
}
/** Exercise only legal commands from a normal shuffled setup. Policy is a test
 * driver, not a strategic CPU. Separate entropy streams keep replay independent
 * of policy decisions. Every command round-trips through JSON before execution. */
export function runStarterMatch({seed=1,size=60,maxCommands=20000,replay=false,onStep=()=>{}}={}){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(maxCommands)||maxCommands<1)throw Error('Invalid audit configuration');
 const entropy=seeded(seed),choices=seeded(seed^0x9e3779b9),random=()=>choices()/0x100000000;
 const decks=starterDecks(size);
 let m=runtime.createMatch('starter-audit-'+size+'-'+seed,size,decks,auditRules);
 let attempt=null;
 const transcript=[],seen=new Set(),handlers={},events={},blueprints=new Set();let now=1_800_000_000_000;
 try{
  for(let i=0;i<maxCommands&&m.status!=='finished';i++){
   now+=1000;
   const timeSeed=entropy();attempt={time:now,entropy:timeSeed,revision:m.revision};
   const advanced=runtime.advanceTime(copy(m),auditRules,now,seeded(timeSeed));if(advanced.revision!==m.revision){
    if(replay&&JSON.stringify(advanced)!==JSON.stringify(runtime.advanceTime(copy(m),auditRules,now,seeded(timeSeed))))throw Error('Nondeterministic timer replay');
    m=advanced;transcript.push(attempt);onStep(m,attempt);attempt=null;continue
   }
   let p=runtime.prompt(m,auditRules,'dark');if(!p?.choices.length)p=runtime.prompt(m,auditRules,'light');
   if(!p?.choices.length)throw Error('No legal prompt at '+m.turn.number+':'+m.turn.phase);
   const id=choose(m,p,random,seen),frame=m.stack.at(-1),w=frame?.kind==='window'?frame:null;
   let action=w&&!p.mandatory?auditRules.actions(m,w,p.side).find(a=>a.id===id):w?auditRules.automatic(m,w).find(a=>a.id===id):null;
   const handler=action?.handler??(id==='pass'?'pass':frame?.handler??(id.startsWith('core:')?id:id.split(':')[0]));handlers[handler]=(handlers[handler]??0)+1;
   if(action?.source)blueprints.add(m.cards[action.source].blueprint);
   const kind=w?.event?.kind;if(kind)events[kind]=(events[kind]??0)+1;
   const command={revision:m.revision,choice:id},before=copy(m),rng=entropy();
   // Each command gets its own stream; record its seed for exact replay.
   attempt={side:p.side,command,time:now,entropy:rng,handler};
   const n=runtime.applyCommand(copy(m),auditRules,p.side,command,seeded(rng),now);
   if(replay){const again=runtime.applyCommand(copy(m),auditRules,p.side,command,seeded(rng),now);if(JSON.stringify(again)!==JSON.stringify(n))throw Error('Nondeterministic replay');}
   if(JSON.stringify(m)!==JSON.stringify(before))throw Error('Command mutated prior state');
   if(w)seen.add(w.serial+':'+id);
   transcript.push(attempt);m=n;onStep(m,transcript.at(-1));attempt=null;
  }
  if(m.status!=='finished')throw Error('Command budget exhausted');
  return {schema:1,seed,size,decks,result:m.result,turns:m.turn.number,commands:transcript.length,handlers,events,blueprints:[...blueprints].sort(),transcript,state:m};
 }catch(error){error.audit={schema:1,seed,size,decks,attempt,message:error.message,turn:m.turn,handlers,events,blueprints:[...blueprints].sort(),transcript,state:m};throw error}
}

/** Reconstruct a run using its exact entropy/time/commands, optionally resuming
 * at a persisted command boundary. No policy choices or fresh randomness occur. */
export function replayStarterMatch(record,{snapshot,offset=0,onStep=()=>{}}={}){
 if(record.schema!==1||!Array.isArray(record.transcript)||!Number.isSafeInteger(offset)||offset<0||offset>record.transcript.length||(!snapshot&&offset))throw Error('Invalid replay');
 let m=snapshot?copy(snapshot):runtime.createMatch('starter-audit-'+record.size+'-'+record.seed,record.size,record.decks,auditRules);
 for(const entry of record.transcript.slice(offset)){
  if(entry.command)m=runtime.applyCommand(copy(m),auditRules,entry.side,entry.command,seeded(entry.entropy),entry.time);
  else {if(m.revision!==entry.revision)throw Error('Stale replay timer');m=runtime.advanceTime(copy(m),auditRules,entry.time,seeded(entry.entropy));}
  onStep(m,entry);
 }
 return m;
}
