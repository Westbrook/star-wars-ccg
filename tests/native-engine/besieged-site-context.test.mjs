import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,runtime,state,rules,pull,phase,step,ids,seek,boundary,priority,clone} from './prisoner-fixture.mjs';
function fixture(crew='1_19'){
 const decks=['light','dark'].map(side=>({side,cards:[...(side==='light'?['1_127','1_140',crew,'1_119','5_41','5_48','5_69']:['1_302','2_115','2_117','5_159','4_103']),...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)}));
 let m=runtime.createMatch('besieged-site-context',60,decks,rules);
 const site=pull(m,'light','1_127');m.locations.push(site);
 const ship=pull(m,'light','1_140','table',site),host=pull(m,'dark','1_302','table',site),beam=pull(m,'dark','2_115','table',site),light=pull(m,'light',crew,'table',site),trooper=pull(m,'dark','1_194','table',site),other=pull(m,'dark','1_194','table',site),ardan=pull(m,'dark','4_103','table',site);
 m.cards[beam].attachedTo=host;
 for(const [id,vessel] of [[light,ship],[trooper,host],[other,host],[ardan,host]]){m.cards[id].attachedTo=vessel;m.cards[id].aboardRole='passenger';}
 const effect=pull(m,'dark','2_117','hand'),assault=pull(m,'dark','5_159','hand'),courage=pull(m,'light','1_119','hand'),skywalker=pull(m,'light','5_41','hand'),luck=pull(m,'light','5_48','hand'),smoke=pull(m,'light','5_69','hand');
 for(const side of ['light','dark'])for(let i=0;i<12;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','deploy');mod('captured-ships').captureStarship(m,ship,host);m=seek(m,x=>ids(x).includes('besieged:deploy:'+effect+':'+ship));
 m=seek(step(m,'besieged:deploy:'+effect+':'+ship),x=>x.cards[effect].zone==='table');m=phase(m,'dark','battle');m=step(m,'besieged:select:'+effect+':'+ship);
 return {m,site,ship,host,light,trooper,other,ardan,assault,courage,skywalker,luck,smoke};
}
function begin(f,selected=[f.trooper]){let m=f.m;for(const id of selected)m=step(m,'besieged:add:'+id);return step(m,'besieged:begin');}
function refresh(m){state.assertState(m);rules.validate(m);assert.deepEqual(runtime.project(m,rules,'light'),runtime.project(clone(m),rules,'light'));return m;}
test('aboard selected trooper can play Trooper Assault without affecting excluded crew',()=>{
 const f=fixture();let m=begin(f);
 m=seek(m,x=>x.stack.at(-1)?.kind==='window'&&x.stack.at(-1).event===undefined&&x.stack.at(-2)?.action?.handler==='battle:begin'&&!x.stack.at(-2).awaitingResponses);m=priority(m,'dark');
 assert.equal(mod('board').cardDefinition(m,f.site).subType,'System');assert.ok(ids(m).includes('trooper-assault:'+f.assault));
 m=step(m,'trooper-assault:'+f.assault);refresh(m);m=boundary(m,'battle-weapons');refresh(m);
 assert.equal(mod('board').power(m,f.trooper),3);assert.equal(mod('board').power(m,f.other),1);
});
test('Warriors Courage and Skywalkers battle mode work for the trapped defender',()=>{
 const f=fixture();let m=priority(boundary(begin(f),'battle-weapons'),'light');
 assert.ok(ids(m).some(id=>id.startsWith('battle-add:'+f.courage+':')));assert.ok(ids(m).includes('duel-interrupt:battle:'+f.skywalker+':'+f.light));
 const courage=ids(m).find(id=>id.startsWith('battle-add:'+f.courage+':'));m=step(m,courage);refresh(m);m=boundary(m,'battle-weapons');refresh(m);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'light').count,2);
});
test('Gambler and Smoke Screen use site battle semantics at a space custody location',()=>{
 const f=fixture('1_11');let m=priority(boundary(begin(f),'battle-weapons'),'light');assert.ok(ids(m).includes('gamblers-luck:'+f.luck+':1'));
 m=step(m,'gamblers-luck:'+f.luck+':1');m=seek(m,x=>x.stack.at(-1)?.handler==='battle:destiny'&&x.stack.at(-1).side==='light');m=step(m,'draw-destiny');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-draw-destiny'&&x.stack.at(-1).event.side==='light');m=priority(m,'light');refresh(m);
 assert.ok(ids(m).includes('smoke:'+f.smoke+':'+f.light));m=step(m,'smoke:'+f.smoke+':'+f.light);refresh(m);
});
test('Ardan can supply his site battle destiny while selected aboard a Star Destroyer',()=>{
 const f=fixture();const m=boundary(begin(f,[f.ardan]),'battle-weapons');refresh(m);assert.equal(mod('battle-destiny').battleDrawPolicy(m,'dark').minimum,1);
});
