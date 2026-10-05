// Native-only continuous integration. Legal deterministic shuffle and commands,
// actual setup and real service persistence; not a GEMP conformance claim.
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {seeded} from './match-runner.mjs';
import {objectiveRules} from './objective-fixture.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const {nativeMatchService}=load(new URL('../../lib/native-engine/service.ts',import.meta.url));
const {chooseComputerAction}=load(new URL('../../lib/native-engine/computer.ts',import.meta.url));
const copy=x=>JSON.parse(JSON.stringify(x));
export const objectiveMatchDecks=()=>[
 {side:'dark',cards:['7_299','12_166','1_166','102_11','106_11','104_6','2_129','1_166','1_194','1_194',...Array(50).fill('1_194')]},
 {side:'light',cards:['1_129','1_17','2_40','1_28','1_28','1_28','1_28','1_132','1_130',...Array(51).fill('1_28')]},
];
const agents=new Set(['1_166','102_11','106_11','104_6']);
/** Deliberately cooperative coverage policy using only the acting player's
 * projection. It preserves separate fronts long enough to exercise retrieval
 * and undercover movement; it never creates actions or bypasses legality. */
function choiceFor(view,side,policy){
 const p=view.prompt,ids=p.choices.map(c=>c.id),own=view.players[side],visible=[...view.table,...own.hand,...own.lost],cards=new Map(visible.map(c=>[c.id,c]));
 const find=fn=>ids.find(fn),available=id=>ids.includes(id)?id:null;
 const bp=id=>cards.get(id)?.blueprint;
 if(view.status==='setup')return find(id=>side==='dark'?id.startsWith('select:')&&p.choices.find(c=>c.id===id)?.card==='dark-1':id==='select:light-1')??ids[0];
 if(p.mandatory){
  if(side==='dark'&&!policy.agentLost){const duplicate=own.hand.find(c=>c.blueprint==='1_166'&&view.table.some(t=>t.blueprint===c.blueprint&&t.owner===side));const lose=duplicate&&available('lose-hand:'+duplicate.id);if(lose){policy.agentLost=true;return lose;}}
  return available('lose:reserve')??available('lose:used')??available('lose:force')??chooseComputerAction(view,side)??ids[0];
 }
 const objective=view.rules?.objectives?.find(o=>o.side==='dark');
 const retrieval=find(id=>id.startsWith('objective:retrieve:'));if(retrieval&&objective?.retrievable?.length)return retrieval;
 const drain=find(id=>id.startsWith('drain:'));if(drain)return drain;
 if(available('core:activate'))return 'core:activate';
 if(view.turn.phase==='deploy'&&view.turn.side===side){
  const site=find(id=>id.startsWith('site:'));if(site)return site;
  if(side==='dark'){
   const deploy=find(id=>id.startsWith('deploy:')&&agents.has(bp(id.split(':')[1]))&&id.split(':')[2]==='dark-2');if(deploy)return deploy;
   if(objective?.face==='back'&&!policy.darkUndercover){const id=find(id=>id.startsWith('undercover:deploy:')&&bp(id.split(':')[3])==='1_166');if(id){policy.darkUndercover=view.turn.number;return id;}}
   if(policy.darkUndercover&&view.turn.number>policy.darkUndercover){const id=find(id=>id.startsWith('undercover:break:'));if(id)return id;}
  }else{
   // Keep a visible defender while Leia demonstrates undercover movement.
   const ownCharacters=view.table.filter(c=>c.owner===side&&c.zone==='table'&&['1_17','1_28'].includes(c.blueprint));
   if(ownCharacters.length<3){const deploy=find(id=>id.startsWith('deploy:')&&id.split(':')[2]==='light-1');if(deploy)return deploy;}
   if(!policy.lightUndercover&&ownCharacters.some(c=>c.blueprint==='1_17')){const id=find(id=>id.startsWith('undercover:deploy:'));if(id){policy.lightUndercover=view.turn.number;return id;}}
   if(policy.lightMoved){const id=find(id=>id.startsWith('undercover:break:'));if(id)return id;}
  }
 }
 if(side==='light'&&policy.lightUndercover&&!policy.lightMoved){const id=find(id=>id.startsWith('undercover:move:'));if(id){policy.lightMoved=true;return id;}}
 // Optional nonessential effects are passed so the fixture's coverage choices
 // remain reproducible, while the same public projection CPU is checked below.
 return available('pass')??chooseComputerAction(view,side)??ids[0];
}

export async function runObjectiveMatch({maxCommands=10000,onStep=()=>{}}={}){
 const decks=objectiveMatchDecks(),db=new SqliteD1(),random=seeded(818),transcript=[],snapshots={},policy={};
 let now=1800000000000,entropyValues=[],entropyIndex=0;
 const entropy=()=>{const n=entropyIndex<entropyValues.length?entropyValues[entropyIndex]:random();entropyValues[entropyIndex++]=n;return n;};
 const fresh=()=>nativeMatchService(db,{currentRules:objectiveRules.id,rules:()=>objectiveRules,entropy,now:()=>now});
 const created=await fresh().create('dark-player',{id:'objective-complete-match',mode:'pvp',side:'dark',deckSize:60,deck:decks[0].cards});
 await fresh().join(created.id,'light-player',{commandId:'objective-match-join',inviteToken:created.inviteToken,deck:decks[1].cards});
 const read=()=>JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(created.id).state);
 const initial=copy(read());let state=initial;
 try{
  for(let index=0;index<maxCommands&&state.status!=='finished';index++){
   now=1800000000000+index;
   let view=(await fresh().read(created.id,'dark-player')).game;
   if(!view.prompt?.choices.length)view=(await fresh().read(created.id,'light-player')).game;
   assert.ok(view.prompt?.choices.length,'No legal public decision');const side=view.prompt.side;
   const cpu=chooseComputerAction(copy(view),side);if(cpu!==null)assert.ok(view.prompt.choices.some(c=>c.id===cpu),'CPU returned unavailable action');
   const choice=choiceFor(view,side,policy);assert.ok(view.prompt.choices.some(c=>c.id===choice));
   entropyValues=[];entropyIndex=0;
   // Fisher-Yates i->i is a lawful recorded shuffle, preserving authored deck
   // order. It fixes the opening hands, never patches either player's piles.
   if(state.status==='setup'&&state.setup?.stage==='shuffle')entropyValues=['dark','light'].flatMap(s=>Array.from({length:state.players[s].reserve.length-1},(_,i)=>state.players[s].reserve.length-1-i));
   const before=copy(state),entry={revision:state.revision,side,choice,time:now};
   await fresh().command(created.id,side+'-player',{commandId:'objective-command-'+index,revision:entry.revision,choice});
   entry.entropy=entropyValues.slice(0,entropyIndex);state=read();transcript.push(entry);
   let used=0;assert.deepEqual(state,runtime.applyCommand(before,objectiveRules,side,{revision:entry.revision,choice},()=>{assert.ok(used<entry.entropy.length);return entry.entropy[used++];},now),'Service command diverged from exact entropy replay');assert.equal(used,entry.entropy.length);
   for(const [label,condition]of [['opening',state.status==='playing'&&before.status==='setup'],['flip',state.data.objectives?.some(o=>o.flips>0)],['retrieval',choice.startsWith('retrieve:')],['undercover',state.data.undercover?.length>0],['undercover-move',choice.startsWith('undercover:move:')]])if(condition&&!snapshots[label])snapshots[label]={state:copy(state),offset:transcript.length};
   await onStep({state:copy(state),entry:copy(entry),view:copy(view)});
  }
  assert.equal(state.status,'finished','Continuous match exceeded command budget');assert.equal(state.result.reason,'life-force');
  return {initial,decks,transcript,snapshots,policy,state,commandRows:db.sqlite.prepare('SELECT count(*) n FROM native_commands WHERE match_id=?').get(created.id).n};
 }catch(error){error.audit={initial,state,transcript,snapshots,policy};throw error;}finally{db.close();}
}
export function resumeObjectiveMatch(record,{state=record.initial,offset=0}={}){
 let m=copy(state);
 for(const e of record.transcript.slice(offset)){let used=0;m=runtime.applyCommand(copy(m),objectiveRules,e.side,{revision:e.revision,choice:e.choice},()=>{assert.ok(used<e.entropy.length,'Missing recorded entropy');return e.entropy[used++];},e.time);assert.equal(used,e.entropy.length);}
 return m;
}
