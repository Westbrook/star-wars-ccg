import assert from 'node:assert/strict';
const events={},documentEvents={};
globalThis.document={addEventListener:(name,fn)=>{documentEvents[name]=fn}};
const prototype={};
for(const method of ['emptyDecision','integerDecision','multipleChoiceDecision','arbitraryCardsDecision','actionChoiceDecision','cardActionChoiceDecision','cardSelectionDecision','cleanupDecision','decisionFunction','showErrorDialog','participant','startGameSession','startReplaySession','processGameEventsXml','stopDecisionCountdown'])prototype[method]=()=>{};
function Game(){}Game.prototype=prototype;
globalThis.window={GempSwccgGameUI:Game,addEventListener:(name,fn)=>{events[name]=fn}};
window.parent=window;
await import('../public/engine-bridge.js');
// GEMP hall/login pages load gameUi.js too, but their global ui is not a game client.
for(const ui of [undefined,{}, {replayMode:false}]){
 window.ui=ui;assert.doesNotThrow(()=>documentEvents.visibilitychange());assert.doesNotThrow(()=>events.pagehide());assert.doesNotThrow(()=>events.offline());
}
let canceled=0,visible=0,errors=0;
window.ui={holotableAutoContinueInstalled:true,replayMode:false,holotableCancelContinue:()=>canceled++,holotableContinueVisibility:()=>visible++,showErrorDialog:()=>errors++};
documentEvents.visibilitychange();events.pagehide();events.offline();assert.equal(visible,1);assert.equal(canceled,2);assert.equal(errors,1);
window.ui.replayMode=true;events.offline();assert.equal(errors,1);
console.log('Bridge lifecycle is safe on hall/login pages; game visibility, navigation and disconnection handlers pass.');
