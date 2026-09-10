import assert from 'node:assert/strict';
import {starter,CARD_MAP,validateDeck,CARDS} from '../lib/cards';
import {createGame,act,cpuTurn,life,publicGame,PHASES} from '../lib/game';
for(const side of ['light','dark'] as const)for(const size of [40,60] as const){assert.equal(validateDeck(starter(side,size)),null);assert.equal(starter(side,size).cards.length,size)}
let game=createGame(starter('dark',40),starter('light',40),'local');assert.equal(game.active,0);assert.equal(game.players[0].hand.length,8);assert.equal(life(game.players[0]),32);assert.throws(()=>act(game,1,{type:'activate'}));game=act(game,0,{type:'activate'});assert.equal(game.players[0].force.length,5);assert.throws(()=>act(game,0,{type:'activate'}));game=act(game,0,{type:'next'});assert.equal(game.phase,1);game=act(game,0,{type:'next'});
game.players[0].hand=['trooper','vader','tie'];game.players[0].force=['trooper','trooper','tie','bomber','choke','vader','droid'];const original=structuredClone(game);assert.throws(()=>act(game,0,{type:'deploy',card:0,location:0}));assert.deepEqual(game,original);game=act(game,0,{type:'deploy',card:0,location:1});assert.equal(game.players[0].units[0].id,'trooper');assert.equal(game.players[0].used.length,1);game=act(game,0,{type:'deploy',card:0,location:1});game.players[0].hand.push('vader');assert.throws(()=>act(game,0,{type:'deploy',card:1,location:1}));
let battle=createGame(starter('dark'),starter('light'),'local');battle.phase=3;battle.players[0].force=['tie'];battle.players[0].units=[{uid:'a',id:'trooper',location:1,bonus:0,moved:false}];battle.players[1].units=[{uid:'b',id:'rebel',location:1,bonus:0,moved:false}];const before=life(battle.players[1]);battle=act(battle,0,{type:'battle',location:1});assert.equal(life(battle.players[1]),before);assert.equal(battle.players[1].units.length,1);assert.throws(()=>act(battle,0,{type:'battle',location:1}));
const hidden=publicGame(battle,0);assert(hidden.players[1].hand.every(x=>x==='?'));assert(hidden.players[0].reserve.every(x=>x==='?'));assert(hidden.players[1].force.every(x=>x==='?'));
const bad=starter('light');bad.cards[0]='vader';assert.match(validateDeck(bad)??'',/side/);
const pool=starter('light',40);assert.equal(validateDeck(pool,pool.cards),null);assert.match(validateDeck(pool,pool.cards.slice(1))??'',/pool/);
// Play full games on both difficulty levels, using the computer policy for each side.
let totalTurns=0;
for(const difficulty of ['cadet','commander'] as const)for(let run=0;run<20;run++){
 let g=createGame(starter('light',run%2?40:60),starter('dark',run%2?40:60),'cpu',difficulty);
 for(let turns=0;g.winner===null&&turns<300;turns++){
  if(g.active===0){g.players.reverse();g.active=1;g=cpuTurn(g);g.players.reverse();g.active=g.active===1?0:1;if(g.winner!==null)g.winner=1-g.winner}else g=cpuTurn(g);
  assert(g.players.every(p=>p.reserve.length>=0&&p.force.length>=0&&p.hand.length<=16));
 }
 assert.notEqual(g.winner,null,'Automated match must terminate');totalTurns+=g.turn;
}
console.log('PASS: 40/60-card validation, Force activation, illegal actions, legal deployment, uniqueness, battle ties, hidden information, sealed limits, and 40 complete simulated matches ('+totalTurns+' turns).');

let waiting=createGame(starter('light',40),starter('dark',40),'online');waiting=act(waiting,0,{type:'concede'});assert.equal(waiting.winner,1);
let casualty=createGame(starter('dark'),starter('light'),'local');casualty.phase=3;casualty.players[0].force=['tie'];casualty.players[0].units=[{uid:'v',id:'vader',location:1,bonus:10,moved:false}];casualty.players[1].units=[{uid:'buffed',id:'rebel',location:1,bonus:5,moved:false},{uid:'weak',id:'han',location:1,bonus:0,moved:false}];casualty=act(casualty,0,{type:'battle',location:1});assert.equal(casualty.players[1].units[0].uid,'buffed');console.log('PASS: cancelled waiting table and effective-power casualty selection.');
