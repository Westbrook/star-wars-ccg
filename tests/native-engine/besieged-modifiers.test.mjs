import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,pull,phase,step,ids,seek,boundary,clone} from './prisoner-fixture.mjs';
const stats=mod('ability'),effects=mod('battle-effects'),destiny=mod('battle-destiny'),totals=mod('location-ability');
function fixture({mind=false,site=false,outsideMind=false}={}){
 const decks=['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_127','1_140','1_21','1_19','4_37','1_43','1_129','1_149']:['1_302','2_115','2_117','1_174','1_172','1_168','1_285','2_111','1_310']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
 let m=runtime.createMatch('besieged-modifiers',60,decks,rules);
 const orbit=pull(m,'light','1_127'),remote=pull(m,'light','1_129');m.locations.push(orbit,remote);
 const ship=pull(m,'light','1_140','table',orbit),host=pull(m,'dark','1_302','table',orbit),beam=pull(m,'dark','2_115','table',orbit);m.cards[beam].attachedTo=host;
 const light=pull(m,'light',mind&&!outsideMind?'1_21':'1_19','table',orbit);m.cards[light].attachedTo=ship;m.cards[light].aboardRole=mind&&!outsideMind?'passenger':'pilot';
 const effect=pull(m,'dark','2_117','hand'),scramble=pull(m,'light','4_37',mind?'hand':'table'),affect=pull(m,'light','1_43',mind?'table':'hand');
 if(mind){m.cards[affect].attachedTo=light;m.cards[affect].location=orbit;}
 const support=pull(m,'dark','1_174','table',remote),pilot=pull(m,'dark','1_172','table',orbit),vader=pull(m,'dark','1_168','table',orbit),trooper=pull(m,'dark','1_194','table',orbit);
 for(const id of [pilot,vader,trooper]){m.cards[id].attachedTo=host;m.cards[id].aboardRole='passenger';}
 let bay;
 if(site){bay=pull(m,'dark','1_285');m.locations.push(bay);const siteBeam=pull(m,'dark','2_111','table',bay);m.cards[siteBeam].attachedTo=bay;for(const id of [pilot,vader,trooper]){delete m.cards[id].attachedTo;delete m.cards[id].aboardRole;m.cards[id].location=bay;}}
 if(outsideMind){const bearer=pull(m,'light','1_21','table',bay);m.cards[affect].attachedTo=bearer;m.cards[affect].location=bay;}
 for(const side of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','deploy');mod('captured-ships').captureStarship(m,ship,bay??host);
 m=seek(m,x=>ids(x).includes('besieged:deploy:'+effect+':'+ship));m=seek(step(m,'besieged:deploy:'+effect+':'+ship),x=>x.cards[effect].zone==='table');m=phase(m,'dark','battle');
 return {m,orbit,remote,ship,host,light,effect,scramble,affect,support,pilot,vader,trooper,bay};
}
function begin(f,selected=[f.pilot]){let m=step(f.m,'besieged:select:'+f.effect+':'+f.ship);for(const id of selected)m=step(m,'besieged:add:'+id);return boundary(step(m,'besieged:begin'),'battle-weapons');}
function refresh(m){state.assertState(m);rules.validate(m);for(const side of ['light','dark'])assert.deepEqual(runtime.project(m,rules,side),runtime.project(clone(m),rules,side));return clone(m);}
const cancellation=(m,f)=>effects.battleEffectAutomatic(m,m.stack.at(-1)).some(a=>a.source===f.scramble);

test('Scramble applies only battle-destiny prevention to a selected attached pilot at the virtual site',()=>{
 const f=fixture();let m=refresh(begin(f));assert.equal(mod('board').cardDefinition(m,f.orbit).subType,'System');assert.equal(stats.ability(m,f.pilot),2);assert.equal(stats.abilityForBattleDestiny(m,f.pilot),0);assert.equal(stats.pilotAtSite(m,f.pilot),true);assert.equal(stats.pilotAtSite(m,f.vader),false);assert.equal(stats.abilityForBattleDestiny(m,f.light),4);
 state.moveCard(m,f.support,'hand');m=refresh(m);assert.equal(cancellation(m,f),false);assert.equal(effects.battleAbility(m,'dark'),0);assert.ok(!ids(m).includes('battle-premature-end'));
 state.moveCard(m,f.scramble,'lost');m=refresh(m);assert.equal(stats.abilityForBattleDestiny(m,f.pilot),2);
});
test('Vader is exempt from Scramble but keeps it active as the only virtual-site pilot',()=>{
 const f=fixture();const m=refresh(begin(f,[f.vader]));state.moveCard(m,f.support,'hand');assert.equal(stats.abilityForBattleDestiny(m,f.vader),6);assert.equal(cancellation(m,f),false);assert.equal(destiny.battleDrawPolicy(m,'dark').count,1);refresh(m);
});
test('unselected pilots aboard the host do not keep Scramble active for a nonpilot boarding party',()=>{
 const f=fixture();let m=begin(f,[f.trooper]);state.moveCard(m,f.support,'hand');assert.equal(stats.pilotAtSite(m,f.pilot),false);assert.equal(stats.pilotAtSite(m,f.vader),false);assert.equal(cancellation(m,f),true);m=seek(m,x=>x.cards[f.scramble].zone==='lost');refresh(m);
});
test('a departing selected pilot ceases to support Scramble while unselected crew remain aboard',()=>{
 const f=fixture();let m=begin(f);state.moveCard(m,f.support,'hand');state.moveCard(m,f.pilot,'hand');assert.equal(stats.pilotAtSite(m,f.pilot),false);assert.equal(cancellation(m,f),true);m=seek(m,x=>x.cards[f.scramble].zone==='lost');refresh(m);
});
test('completion removes virtual-site presence and cancels Scramble once no physical-site pilot remains',()=>{
 const f=fixture();let m=begin(f);state.moveCard(m,f.support,'hand');m=seek(m,x=>x.data.battle.stage==='complete');assert.equal(stats.pilotAtSite(m,f.pilot),false);assert.equal(stats.pilotAtSite(m,f.light),false);m=seek(m,x=>x.cards[f.scramble].zone==='lost');refresh(m);
});
for(const site of [false,true])test('Affect Mind changes the Besieged total and excludes an unselected Dark Jedi: '+(site?'bay':'system'),()=>{
 const f=fixture({mind:true,site});let m=begin(f,[f.pilot,f.trooper]);m=refresh(m);assert.equal(m.cards[f.affect].zone,'table');assert.equal(stats.ability(m,f.pilot),2);assert.equal(mod('battle').participatingAbility(m,'dark'),3);assert.equal(effects.battleAbility(m,'dark'),1);assert.equal(totals.locationAbility(m,'dark',f.remote,2,0),2);
 state.moveCard(m,f.affect,'lost');m=refresh(m);assert.equal(effects.battleAbility(m,'dark'),3);
});
test('a selected Dark Jedi suppresses Affect Mind and uses current individual ability',()=>{
 const f=fixture({mind:true});const m=refresh(begin(f,[f.vader]));assert.equal(effects.battleAbility(m,'dark'),6);stats.addAbilityModifier(m,f.effect,f.vader,'reset',5);assert.equal(effects.battleAbility(m,'dark'),3);assert.equal(stats.ability(m,f.vader),5);refresh(m);
});
test('Affect Mind returns inactive with its trapped bearer when Besieged ends',()=>{
 const f=fixture({mind:true});let m=begin(f,[f.pilot,f.trooper]);m=seek(m,x=>x.data.battle.stage==='complete');assert.equal(m.cards[f.light].zone,'inactive');assert.equal(m.cards[f.affect].zone,'inactive');assert.equal(totals.locationAbility(m,'dark',f.orbit,3,0),3);refresh(m);
});

test('an outside Affect Mind bearer at the docking bay cannot modify the separate trapped-crew battle',()=>{
 const f=fixture({mind:true,site:true,outsideMind:true});const m=refresh(begin(f,[f.pilot,f.trooper]));assert.equal(m.cards[f.affect].zone,'table');assert.equal(mod('battle').participatingAbility(m,'dark'),3);assert.equal(effects.battleAbility(m,'dark'),3);
});

for(const canceled of [false,true])test('Scramble disabled game text stops its restriction and mandatory cancellation: '+(canceled?'canceled':'suppressed'),()=>{
 const f=fixture();let m=begin(f);const text=mod('game-text');
 if(canceled)m.data.canceledGameText=[mod('identity').referenceCard(m,f.scramble)];else text.suppressGameText(m,f.light,f.scramble);
 assert.equal(stats.abilityForBattleDestiny(m,f.pilot),2);state.moveCard(m,f.support,'hand');state.moveCard(m,f.pilot,'hand');assert.equal(cancellation(m,f),false);refresh(m);
});
test('Scramble source-duration suppression expires when its suppressor leaves',()=>{
 const f=fixture();const m=begin(f);mod('game-text').suppressGameText(m,f.support,f.scramble,'source');assert.equal(stats.abilityForBattleDestiny(m,f.pilot),2);state.moveCard(m,f.support,'hand');assert.equal(stats.abilityForBattleDestiny(m,f.pilot),0);assert.equal(cancellation(m,f),false);refresh(m);
});
for(const canceled of [false,true])test('disabled Affect Mind text stops reducing the virtual-site total: '+(canceled?'canceled':'suppressed'),()=>{
 const f=fixture({mind:true});const m=begin(f,[f.pilot,f.trooper]);
 if(canceled)m.data.canceledGameText=[mod('identity').referenceCard(m,f.affect)];else mod('game-text').suppressGameText(m,f.support,f.affect,'source');
 assert.equal(effects.battleAbility(m,'dark'),3);assert.equal(stats.ability(m,f.pilot),2);refresh(m);
 if(!canceled){state.moveCard(m,f.support,'hand');assert.equal(effects.battleAbility(m,'dark'),1);refresh(m);}
});

test('a selected but battle-prohibited Dark Jedi cannot suppress Affect Mind for the remaining party',()=>{
 const f=fixture({mind:true});const m=begin(f,[f.vader,f.pilot,f.trooper]);assert.equal(effects.battleAbility(m,'dark'),9);
 mod('ground').record(m).barriers[f.vader]=m.turn.number;assert.equal(mod('battle').participatingAbility(m,'dark'),3);assert.equal(effects.battleAbility(m,'dark'),1);refresh(m);
});
test('an Affect Mind bearer who becomes battle-prohibited cannot project the modifier into Besieged',()=>{
 const f=fixture({mind:true});const m=begin(f,[f.pilot,f.trooper]);assert.equal(effects.battleAbility(m,'dark'),1);
 mod('ground').record(m).barriers[f.light]=m.turn.number;assert.equal(effects.battleAbility(m,'dark'),3);refresh(m);
});

for(const enclosed of [false,true])test('Scramble distinguishes a pilot present aboard an open vehicle from an enclosed driver: '+(enclosed?'enclosed':'open'),()=>{
 const f=fixture();const m=f.m,vehicle=pull(m,enclosed?'dark':'light',enclosed?'1_310':'1_149','table',f.remote);if(!enclosed){m.cards[vehicle].originalOwner='light';m.cards[vehicle].owner='dark';}m.cards[f.support].attachedTo=vehicle;m.cards[f.support].aboardRole=enclosed?'driver':'passenger';
 assert.equal(stats.pilotAtSite(m,f.support),true);assert.equal(mod('occupancy').characterPresent(m,f.support),!enclosed);assert.equal(cancellation(m,f),false);assert.equal(stats.abilityForBattleDestiny(m,f.support),enclosed?stats.ability(m,f.support):0);refresh(m);
 state.moveCard(m,f.scramble,'lost');assert.equal(stats.abilityForBattleDestiny(m,f.support),stats.ability(m,f.support));refresh(m);
});
