import assert from 'node:assert/strict';
import {createCountdown, installAutoContinue, noActionDecision} from '../public/auto-continue.js';
function clock(){let time=0,id=0;const tasks=new Map();return {now:()=>time,schedule:(fn,ms)=>{tasks.set(++id,{at:time+ms,fn});return id},unschedule:i=>tasks.delete(i),advance(ms){const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);next[1].fn()}time=end},pending:()=>tasks.size}}
function element(tag,attributes={},children=[]){return {tag,attributes,children,getAttribute(key){return this.attributes[key]??null},getElementsByTagName(name){return this.children.flatMap(c=>[...(c.tag===name?[c]:[]),...c.getElementsByTagName(name)])}}}
function decision(type='CARD_ACTION_CHOICE',parameters={noPass:['false']},id='1',player='pilot'){return element('ge',{type:'D',id,decisionType:type,participantId:player},Object.entries(parameters).flatMap(([name,values])=>values.map(value=>element('parameter',{name,value}))))}
const empty=()=>decision('CARD_ACTION_CHOICE',{noPass:['false'],yourTurn:['true'],autoPassEligible:['true'],revertEligible:['true']});
assert.ok(noActionDecision(empty(),'pilot'));
for(const d of [decision('INTEGER'),decision('MULTIPLE_CHOICE',{results:['OK']}),decision('ACTION_CHOICE'),decision('EMPTY'),decision('CARD_SELECTION'),decision('ARBITRARY_CARDS'),decision('CARD_ACTION_CHOICE',{}),decision('CARD_ACTION_CHOICE',{noPass:['true']}),decision('CARD_ACTION_CHOICE',{noPass:['false'],actionId:['draw']}),decision('CARD_ACTION_CHOICE',{noPass:['false'],cardId:['1']}),decision('CARD_ACTION_CHOICE',{noPass:['false'],blueprintId:['1_1']})])assert.equal(noActionDecision(d,'pilot'),null);
assert.equal(noActionDecision(empty(),'spectator'),null);
{
 const time=clock(),sent=[],changes=[];
 const c=createCountdown({...time,onContinue:x=>sent.push(x),onChange:x=>changes.push(x)});
 c.start('first');assert.equal(c.getState().seconds,2);time.advance(1000);assert.equal(c.getState().seconds,1);assert.deepEqual(sent,[]);
 c.pause();time.advance(60000);assert.deepEqual(sent,[]);c.resume();time.advance(999);assert.deepEqual(sent,[]);time.advance(1);assert.deepEqual(sent,['first']);assert.equal(time.pending(),0);
 c.start('manual');c.continueNow();time.advance(5000);assert.deepEqual(sent,['first','manual']);
 c.start('cancel');c.cancel();time.advance(5000);assert.equal(sent.length,2);
 c.start('replace');time.advance(1900);c.start('latest');time.advance(100);assert.equal(sent.length,2);time.advance(1900);assert.equal(sent.at(-1),'latest');
}
function fixture(){
 const time=clock(),sent=[],native=[],rendered=[];let hidden=false,controls;
 const prototype={replayMode:false,spectatorMode:false,channelNumber:'7',bottomPlayerId:'pilot',
  stopDecisionCountdown(){},startDecisionCountdown(){sent.push('UNSAFE NATIVE AUTO-PASS')},
  cleanupDecision(){},decisionFunction(...args){sent.push(args)},showErrorDialog(){},participant(){},startGameSession(){},startReplaySession(){},
  processGameEventsXml(e){this.channelNumber=e.getAttribute('cn')},
 };
 for(const method of ['emptyDecision','integerDecision','multipleChoiceDecision','arbitraryCardsDecision','actionChoiceDecision','cardActionChoiceDecision','cardSelectionDecision'])prototype[method]=function(){native.push(method);this.startDecisionCountdown()};
 installAutoContinue(prototype,{clock:time,isHidden:()=>hidden,render:(ui,s,c)=>{rendered.push(s);controls=c}});
 return {time,sent,native,rendered,ui:Object.create(prototype),controls:()=>controls,hidden:value=>{hidden=value}};
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(1999);assert.equal(f.sent.length,0);f.time.advance(1);assert.deepEqual(f.sent,[['1','']]);assert.equal(f.native.length,0);
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(1900);
 // Engine IDs are reused. A new actionable decision with ID 1 must invalidate the old one.
 f.ui.cardActionChoiceDecision(decision('CARD_ACTION_CHOICE',{noPass:['false'],autoPassEligible:['true'],cardId:['force'],actionId:['draw']}));f.time.advance(10000);assert.deepEqual(f.sent,[]);assert.deepEqual(f.native,['cardActionChoiceDecision']);
}
for(const method of ['cleanupDecision','showErrorDialog','participant','startGameSession','startReplaySession','holotableCancelContinue']){
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(1900);f.ui[method]();f.time.advance(10000);assert.deepEqual(f.sent,[],method);
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(1900);f.ui.decisionFunction('1','');f.time.advance(10000);assert.deepEqual(f.sent,[['1','']]);
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(1000);f.ui.processGameEventsXml(element('update',{cn:'7'}));f.time.advance(1000);assert.equal(f.sent.length,1,'Clock-only response retains deadline');
}
for(const response of [element('update',{cn:'8'}),element('update',{cn:'7'},[decision('MULTIPLE_CHOICE',{results:['Yes','No']})])]){
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.ui.processGameEventsXml(response);f.time.advance(5000);assert.deepEqual(f.sent,[]);
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.time.advance(500);f.hidden(true);f.ui.holotableContinueVisibility();f.time.advance(60000);assert.equal(f.sent.length,0);f.hidden(false);f.ui.holotableContinueVisibility();f.time.advance(1500);assert.equal(f.sent.length,1);
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.controls().pause();f.hidden(true);f.ui.holotableContinueVisibility();f.hidden(false);f.ui.holotableContinueVisibility();f.time.advance(10000);assert.equal(f.sent.length,0);f.controls().resume();f.time.advance(2000);assert.equal(f.sent.length,1);
}
for(const mode of ['replayMode','spectatorMode']){
 const f=fixture();f.ui[mode]=true;f.ui.cardActionChoiceDecision(empty());f.time.advance(5000);assert.equal(f.sent.length,0);assert.equal(f.native.length,1);
}
{
 const f=fixture(),d=empty();f.ui.cardActionChoiceDecision(d);d.children.push(element('parameter',{name:'actionId',value:'new-action'}));f.time.advance(2000);assert.equal(f.sent.length,0,'Revalidate before submission');
}
{
 const f=fixture();f.ui.cardActionChoiceDecision(empty());f.hidden(true);f.time.advance(2000);assert.equal(f.sent.length,0);assert.equal(f.rendered.at(-1).paused,true);f.hidden(false);f.ui.holotableContinueVisibility();f.time.advance(2000);assert.equal(f.sent.length,1);
}
for(const method of ['showErrorDialog','holotableCancelContinue']){
 const f=fixture(),d=empty();f.ui.processGameEventsXml(element('update',{cn:'7'},[d]));
 f.ui[method]();f.ui.cardActionChoiceDecision(d);f.time.advance(5000);
 assert.deepEqual(f.sent,[],`${method} blocks animation-queued prompts`);assert.deepEqual(f.native,[]);assert.equal(f.time.pending(),0);
 // A late response behind the error dialog must not restart automatic decisions.
 const late=empty();f.ui.processGameEventsXml(element('update',{cn:'8'},[late]));f.ui.cardActionChoiceDecision(late);f.time.advance(5000);assert.deepEqual(f.sent,[]);
 // Only an explicit new session can accept a fresh prompt.
 f.ui.startGameSession();f.ui.cardActionChoiceDecision(late);assert.equal(f.time.pending(),0);
 const fresh=empty();f.ui.processGameEventsXml(element('update',{cn:'9'},[fresh]));f.ui.cardActionChoiceDecision(fresh);f.time.advance(2000);assert.deepEqual(f.sent,[['1','']]);
}
{
 const f=fixture(),old=empty(),latest=empty();f.ui.processGameEventsXml(element('update',{cn:'7'},[old]));
 f.ui.processGameEventsXml(element('update',{cn:'8'},[latest]));f.ui.cardActionChoiceDecision(latest);f.time.advance(1000);
 f.ui.cardActionChoiceDecision(old);f.ui.cardActionChoiceDecision(latest);f.time.advance(1000);
 assert.deepEqual(f.sent,[['1','']],'Stale or duplicate animation callbacks cannot replace a current timer');
 f.ui.cardActionChoiceDecision(latest);f.time.advance(5000);assert.equal(f.sent.length,1,'Consumed prompt cannot submit again');
}
{
 const f=fixture(),old=empty(),choice=decision('MULTIPLE_CHOICE',{results:['Yes','No']});
 f.ui.processGameEventsXml(element('update',{cn:'7'},[old]));f.ui.processGameEventsXml(element('update',{cn:'8'},[choice]));
 f.ui.cardActionChoiceDecision(old);f.ui.multipleChoiceDecision(choice);f.time.advance(5000);assert.deepEqual(f.sent,[]);assert.deepEqual(f.native,['multipleChoiceDecision']);
}
{
 const f=fixture(),d=empty();f.ui.startGameSession();f.ui.processGameEventsXml(element('update',{cn:'7'},[d]));
 f.ui.participant();f.ui.cardActionChoiceDecision(d);f.time.advance(2000);assert.equal(f.sent.length,1,'Participant initialization preserves the decision from its response');
}
console.log('No-action eligibility, 2s timing, pause/resume, manual continue, repeated IDs, queued decisions, lifecycle cancellation, spectator/replay and native auto-pass guards passed.');
