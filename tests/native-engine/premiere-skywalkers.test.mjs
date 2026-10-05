import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,mod,runtime,state,rules,pull,phase,step,ids} from './besieged-fixture.mjs';
import {fixture as captured} from './captured-ships-fixture.mjs';
import {fixture as vessels,deploy} from './vessels-fixture.mjs';
const board=mod('board'),combat=mod('combat-modifiers'),text=mod('game-text'),destiny=mod('destiny-response');
const clone=x=>JSON.parse(JSON.stringify(x));
function seek(m,predicate){for(let n=0;n<700;n++){if(predicate(m))return m;const choices=ids(m);m=step(m,choices.includes('draw-destiny')?'draw-destiny':choices.includes('pass')?'pass':choices[0]);}throw Error('Skywalker boundary not reached');}
function pending(m){return m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='battle:destiny-finish'&&f.action.payload.side==='dark');}
function drawBoundary(m){return seek(m,x=>!!pending(x)&&x.stack.at(-1)?.event?.kind==='battle-destiny-drawn');}
function battle(){const f=captured(1,{capture:false});let m=phase(f.m,'dark','battle');m=step(m,'battle:'+f.site);return {...f,m};}

test('Premiere Luke and Vader deploy through legal paid pilot actions while production admission remains closed',()=>{
 const f=vessels({light:['1_19'],dark:['1_168']});let m=deploy(f.m,f.scout,f.planet);const vader=pull(m,'dark','1_168','hand'),before=m.players.dark.force.length;
 assert.ok(ids(m).includes('vessel:aboard:'+vader+':'+f.scout+':pilot'));m=deploy(m,vader,f.scout,'pilot');assert.equal(m.players.dark.force.length,before-6);assert.equal(m.cards[vader].aboardRole,'pilot');assert.equal(mod('piloting').pilotPowerBonus(m,vader),3);
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);if(runtime.prompt(m,rules,'light').side!=='light')m=step(m,'pass');m=deploy(m,f.ywing,f.planet);const luke=pull(m,'light','1_19','hand'),lightForce=m.players.light.force.length;
 m=deploy(m,luke,f.ywing,'pilot');assert.equal(m.players.light.force.length,lightForce-3);assert.equal(mod('piloting').pilotPowerBonus(m,luke),3);
 for(const id of ['1_19','1_168']){assert.equal(board.definition(id).status,'pending');assert.equal(mod('premiere-rules').premiereRules.supports(id),false);}
});
test('Luke generates off Tatooine including orbit but not while on its surface or text-suppressed',()=>{
 const f=vessels({light:['1_19'],dark:[]}),m=f.m,luke=pull(m,'light','1_19','table',f.site),baseline=board.generation(m,'light'),dark=board.generation(m,'dark');
 assert.equal(board.onSystem(m,luke,'Tatooine'),true);m.cards[luke].location=f.planet;
 assert.equal(board.onSystem(m,luke,'Tatooine'),false);assert.equal(board.generation(m,'light'),baseline+1);
 m.cards[luke].location=f.remote;assert.equal(board.generation(m,'light'),baseline+1);
 text.suppressGameText(m,f.remote,luke);assert.equal(board.generation(m,'light'),baseline);assert.equal(board.generation(m,'dark'),dark);
});
test('capturing Luke makes his generation inactive without moving the table location',()=>{
 const f=captured(1,{capture:false}),m=f.m,before=board.generation(m,'light');
 mod('captured-ships').captureStarship(m,f.ship,f.host);assert.equal(m.cards[f.characters[0]].zone,'inactive');assert.equal(board.generation(m,'light'),before-1);
});
for(const branch of ['normal','suppressed','departed'])test('Vader modifies each real battle destiny, and '+branch+' pending draw survives refresh',()=>{
 const f=battle();let m=drawBoundary(f.m),r=pending(m);const drawn=m.data.battle.destinyCards.dark,printed=board.printed(m,drawn,'destiny');
 assert.equal(destiny.pendingDestiny(m,r).value,printed+1);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'dark').count,1);
 if(branch==='suppressed')text.suppressGameText(m,f.host,f.escort);
 if(branch==='departed')state.moveCard(m,f.escort,'lost');
 const expected=printed+(branch==='normal'?1:0);m=clone(m);r=pending(m);
 assert.equal(destiny.pendingDestiny(m,r).value,expected);assert.equal(runtime.project(m,rules,'dark').rules.battle.destiny.dark,expected);
 m=seek(m,x=>!!x.data.battle.destinyResults?.dark);assert.equal(m.data.battle.destinyResults.dark.total,expected);
});
test('Vader bonus applies separately to multiple battle draws, not once to their total',()=>{
 const f=battle();let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');mod('battle-destiny').addBattleDrawModifier(m,f.escort,'dark','add',1);
 m=seek(m,x=>!!x.data.battle.destinyResults?.dark);const result=m.data.battle.destinyResults.dark;assert.equal(result.draws.length,2);
 for(const draw of result.draws)assert.equal(draw.value,board.printed(m,draw.card,'destiny')+1);assert.equal(result.total,result.draws.reduce((n,d)=>n+d.value,0));
});
test('Vader cannot modify substituted battle destiny',()=>{
 const f=battle();let m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1)?.event?.category==='battle'&&x.stack.at(-1)?.event?.side==='dark');
 const draw=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='destiny:draw'&&f.actor==='dark');assert.ok(draw);assert.equal(mod('destiny').substituteDestiny(m,draw,f.escort,2),true);
 m=drawBoundary(m);assert.equal(destiny.pendingDestiny(m,pending(m)).value,2);assert.equal(pending(m).action.payload.continuousBattleBonus,undefined);
 m=seek(m,x=>!!x.data.battle.destinyResults?.dark);assert.equal(m.data.battle.destinyResults.dark.total,2);
});
test('Luke/Vader immunity disappears with their own text but not an independent modifier',()=>{
 const f=captured(1,{capture:false}),m=f.m,luke=f.characters[0];
 for(const [id,threshold]of [[luke,3],[f.escort,5]]){assert.equal(combat.attritionImmunity(m,id),threshold);text.suppressGameText(m,f.host,id);assert.equal(combat.attritionImmunity(m,id),0);combat.addCombatModifier(m,f.host,id,'immunity-less-than',2);assert.equal(combat.attritionImmunity(m,id),2);}
});
test('saved pending Vader draw rejects a forged continuous bonus',()=>{let m=drawBoundary(battle().m);pending(m).action.payload.continuousBattleBonus=2;assert.throws(()=>rules.validate(m),/continuous battle destiny bonus/);});
test('Luke and Vader also use ordinary legal ground deployment costs',()=>{
 const f=vessels({light:['1_19'],dark:['1_168']});let m=f.m;const vader=pull(m,'dark','1_168','hand'),dark=m.players.dark.force.length;
 assert.ok(ids(m).includes('deploy:'+vader+':'+f.remote));m=seek(step(m,'deploy:'+vader+':'+f.remote),x=>x.cards[vader].zone==='table');assert.equal(m.players.dark.force.length,dark-6);
 m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);if(runtime.prompt(m,rules,'light').side!=='light')m=step(m,'pass');const luke=pull(m,'light','1_19','hand'),light=m.players.light.force.length;
 assert.ok(ids(m).includes('deploy:'+luke+':'+f.site));m=seek(step(m,'deploy:'+luke+':'+f.site),x=>x.cards[luke].zone==='table');assert.equal(m.players.light.force.length,light-3);
});
test('Vader cannot turn a failed draw into a successful bonus-only destiny',()=>{
 let m=seek(battle().m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1)?.event?.category==='battle'&&x.stack.at(-1)?.event?.side==='dark');
 for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');m=seek(m,x=>!!pending(x)&&x.stack.at(-1)?.event?.kind==='battle-destiny-failed');assert.equal(destiny.pendingDestiny(m,pending(m)).value,null);
 m=seek(m,x=>!!x.data.battle.destinyResults?.dark);assert.equal(m.data.battle.destinyResults.dark.total,null);
});
