import assert from 'node:assert/strict';

const messages=[], nativeOpens=[], events={}, nativeErrors=[];
globalThis.document={addEventListener:(name,callback)=>{events[name]=callback}};
const prototype={gameErrorMap(){return {409:()=>nativeErrors.push(409)}}};
for(const method of ['emptyDecision','integerDecision','multipleChoiceDecision','arbitraryCardsDecision','actionChoiceDecision','cardActionChoiceDecision','cardSelectionDecision','cleanupDecision','decisionFunction','showErrorDialog','participant','startGameSession','startReplaySession','processGameEventsXml','stopDecisionCountdown'])prototype[method]=()=>{};
function Game(){}Game.prototype=prototype;
globalThis.window={
  GempSwccgGameUI:Game,
  location:{href:'http://localhost:5173/gemp-swccg/hall.html',origin:'http://localhost:5173'},
  parent:{postMessage:(data,origin)=>messages.push({data,origin})},
  open:(...args)=>{nativeOpens.push(args);return 'native-window'},addEventListener(){},
};
await import('../public/engine-bridge.js');
const game='game.html?gameId=0a3046f2341c-430b-89c1-8f8b-2bccce10';
assert.equal(window.open(game),null);
assert.equal(messages[0].data.url,'/gemp-swccg/'+game);
assert.equal(messages[0].origin,window.location.origin);
assert.equal(nativeOpens.length,0);
window.open(game+'&channelNumber=7&participantId=another');
assert.equal(messages[1].data.url,'/gemp-swccg/'+game);
for(const url of ['deckBuild.html','https://other.example/'+game,'game.html?gameId=bad%2Fid','game.html?gameId=a&gameId=b'])assert.equal(window.open(url),'native-window');
function click(href,extra={}){
  let prevented=false;
  const link={href:new URL(href,window.location.href).href,hasAttribute:()=>false};
  events.click({defaultPrevented:false,button:0,target:{closest:()=>link},preventDefault(){prevented=true},...extra});
  return prevented;
}
assert.equal(click(game),true,'Play/Watch anchor stays in the wrapper');
const before=messages.length;
assert.equal(click(game,{ctrlKey:true}),false);
assert.equal(click(game,{metaKey:true}),false);
assert.equal(click(game,{button:1}),false);
assert.equal(click('deckBuild.html'),false);
assert.equal(messages.length,before);
assert.doesNotThrow(()=>events.click({button:0,target:null}));

window.location.href='http://localhost:5173/gemp-swccg/'+game;
const ui=new Game();let canceled=0;ui.holotableCancelContinue=()=>canceled++;
const errors=ui.gameErrorMap();
for(const status of [401,403,404]){
  errors[status]();
  assert.deepEqual(messages.at(-1),{origin:window.location.origin,data:{type:'holotable-game-error',status,url:window.location.href}});
}
assert.equal(canceled,3);errors[409]();assert.deepEqual(nativeErrors,[409]);
console.log('Lobby windows and anchors produce wrapper links; modifier clicks remain native; authentication/access/missing-game errors preserve the target.');
