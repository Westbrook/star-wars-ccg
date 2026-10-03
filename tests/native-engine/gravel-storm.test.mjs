import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,resolve:(m,r,c)=>{if(r.action.handler==='probe:done')m.data.observed=r.action.payload;else premiereRules.resolve(m,r,c)}};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('interrupt-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id,side=prompt(m).side){const before=clone(m),r=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<900;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices.some(c=>c.id==='skip-destiny')?'skip-destiny':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.stack.length===1)}
function settle(m){return seek(m,x=>x.stack.length===1||x.stack.at(-1)?.kind==='decision')}
function priority(m,side){if(prompt(m).side!==side)m=step(m,'pass');assert.equal(prompt(m).side,side);return m}
function topDestiny(m,side,bp){const id=pull(m,side,bp,'hand');state.moveCard(m,id,'reserve');return id}

const gravel=load(new URL('../../lib/native-engine/gravel-storm.ts',import.meta.url));
const immunity=load(new URL('../../lib/native-engine/card-immunity.ts',import.meta.url));
const identity=load(new URL('../../lib/native-engine/identity.ts',import.meta.url));
const ground=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
function base(){let m=fresh({light:['1_132','1_153','1_2','1_109','1_41','1_130','1_131','1_129','1_6'],dark:['1_247','1_247','1_194']});const site=location(m,'light','1_132'),remote=location(m,'dark','1_284'),target=pull(m,'light','1_2','table',site),card=pull(m,'dark','1_247','hand');force(m,'dark',2);m=phase(m,'deploy');return {m,site,remote,target,card};}
const options=(m,w=m.stack.at(-1),side='dark')=>gravel.gravelActions(m,w,side).map(a=>a.id);
function attachVapor(m,site){const v=pull(m,'light','1_41','table');m.cards[v].attachedTo=site;return v;}
function withSites(f){const {m,site,remote}=f,dune=location(m,'light','1_130'),jawa=location(m,'light','1_131');m.locations=[site,dune,jawa,remote];return {...f,dune,jawa};}
function targetCase(mode){let f=withSites(base()),{m,site,dune,jawa,remote,target}=f;if(mode==='wrong-site'){const bay=location(m,'light','1_129');m.locations=[site,dune,jawa,bay,remote];m.cards[target].location=bay;}else if(mode!=='none')attachVapor(m,mode==='same'?site:mode==='adjacent'?dune:mode==='remote'?jawa:remote);return {name:'target-'+mode,offered:options(m).length>0};}
function play(m,card,target){m=priority(m,'dark');return step(m,'gravel:play:'+card+':'+target);}
function finish(m,card){return seek(m,x=>x.cards[card].zone==='lost'&&x.stack.length===1);}
function outcome(mode){let {m,site,remote,target,card}=base();topDestiny(m,'dark',mode==='equal'?'1_194':'1_247');if(mode==='failed')for(const id of [...m.players.dark.reserve])state.moveCard(m,id,'hand');m=play(m,card,target);
 const intervene=()=>{if(mode.startsWith('vapor'))attachVapor(m,site);else if(mode.startsWith('move'))m.cards[target].location=remote;else {state.moveCard(m,target,'hand');state.moveCard(m,target,'table');m.cards[target].location=site;}};
 if(mode.endsWith('before'))intervene();if(mode.endsWith('after')){m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');intervene();}
 m=finish(clone(m),card);return {name:mode,lost:m.cards[target].zone==='lost',destinyUsed:m.players.dark.used.length};
}
for(const [mode,expected] of [['none',true],['same',false],['adjacent',false],['remote',true],['other-system',true],['wrong-site',false]])test('Vaporator targeting range '+mode,()=>assert.equal(targetCase(mode).offered,expected));
for(const mode of ['success','equal','failed','vapor-before','move-before','vapor-after','move-after','reentry-before','reentry-after'])test('Gravel Storm '+mode+' follows GEMP timing across serialization',()=>assert.deepEqual(outcome(mode),{name:mode,lost:!['equal','failed'].includes(mode),destinyUsed:mode==='failed'?0:1}));
test('title immunity applies to both sides, depends on active device text and only names Gravel Storm',()=>{let {m,site,target}=base();const v=attachVapor(m,site),enemy=pull(m,'dark','1_194','table',site);assert.equal(immunity.immuneToCardTitle(m,enemy,'Gravel Storm'),true);assert.equal(immunity.immuneToCardTitle(m,target,'Set For Stun'),false);m.data.canceledGameText=[identity.referenceCard(m,v)];assert.equal(immunity.immuneToCardTitle(m,target,'Gravel Storm'),false);delete m.data.canceledGameText;state.moveCard(m,v,'hand');assert.equal(immunity.immuneToCardTitle(m,target,'Gravel Storm'),false);});
test('only opponents present at named sites are targets; no generic response play',()=>{let {m,site,target}=base();assert.equal(options(m,{...m.stack.at(-1),timing:'response',event:{kind:'destiny-drawn'}}).length,0);const droid=pull(m,'light','1_6','table',site);assert.equal(options(m).length,2);m.cards[target].attachedTo=droid;assert.equal(options(m).length,1);assert.equal(options(m,m.stack.at(-1),'light').length,0);});
test('Vaporator blocks battle targets without being a battle participant',()=>{let {m,site,target}=base();force(m,'dark',2);pull(m,'dark','1_194','table',site);const v=attachVapor(m,site);m=phase(m,'battle');m=step(m,'battle:'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.equal(options(m).length,0);state.moveCard(m,v,'hand');assert.equal(options(m).length,1);ground.record(m).barriers[target]=m.turn.number;assert.equal(options(m).length,0);});
test('Gravel Storm may target outside the current battle during weapons',()=>{let {m,site,remote,target}=base();const luke=pull(m,'light','101_2','table',remote);pull(m,'dark','1_194','table',remote);force(m,'dark',2);m=phase(m,'battle');m=step(m,'battle:'+remote);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.equal(options(m).length,1);assert.ok(options(m)[0].endsWith(':'+target));assert.equal(m.cards[luke].zone,'table');});
test('a lost character and attachments leave together, owner orders Lost and Beru triggers once',()=>{let {m,site,target,card}=base();const gun=pull(m,'light','1_153','table',site);m.cards[gun].attachedTo=target;topDestiny(m,'dark','1_247');m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.handler==='table:lost-order');assert.equal(prompt(m).side,'light');assert.equal(m.cards[target].zone,'leaving');assert.equal(m.cards[gun].zone,'leaving');m=step(m,ids(m).find(id=>id.endsWith(gun)));m=seek(m,x=>ids(x).some(id=>id.startsWith('lars:loss:')));assert.equal(m.cards[gun].zone,'lost');assert.equal(m.cards[target].zone,'lost');m=finish(m,card);assert.equal(m.data.larsEffects.filter(e=>e.applied).length,1);});
test('canceling Gravel Storm discards it without drawing or losing its target',()=>{let {m,target,card}=base();m=play(m,card,target);m.stack.find(f=>f.action?.handler==='gravel:play').cancelled=true;m=finish(m,card);assert.equal(m.cards[target].zone,'table');assert.equal(m.players.dark.used.length,0);});
test('target absent at the loss step is not lost from hand',()=>{let {m,target,card}=base();topDestiny(m,'dark','1_247');m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-lose');state.moveCard(m,target,'hand');m=finish(m,card);assert.equal(m.cards[target].zone,'hand');assert.equal(m.players.dark.used.length,1);});
test('Gravel Storm compares current ability and handles Droid zero',()=>{let {m,site,target,card}=base();state.moveCard(m,target,'hand');target=pull(m,'light','1_6','table',site);topDestiny(m,'dark','1_194');m=finish(play(m,card,target),card);assert.equal(m.cards[target].zone,'lost');});
test('saved continuations reject wrong ownership and invalid target references',()=>{let {m,target,card}=base();topDestiny(m,'dark','1_247');m=play(m,card,target);for(const mutation of [x=>x.stack.find(f=>f.action?.handler==='gravel:play').actor='light',x=>x.stack.find(f=>f.action?.handler==='gravel:play').action.payload.target.version++,x=>x.stack.find(f=>f.action?.handler==='gravel:play').action.payload.target.zone='hand']){const bad=clone(m);mutation(bad);assert.throws(()=>prompt(bad));}assert.equal(premiereRules.supports('1_247'),false);});
test('actual Sense can cancel Gravel Storm before its destiny starts',()=>{let {m,site,target,card}=base();const sense=pull(m,'light','1_109','hand'),luke=pull(m,'light','101_2','table',site);topDestiny(m,'light','1_124');m=play(m,card,target);m=priority(m,'light');const choice='cancel:play:'+sense+':'+card+':'+luke;assert.ok(ids(m).includes(choice));m=step(m,choice);m=finish(m,card);assert.equal(m.cards[target].zone,'table');assert.equal(m.cards[sense].zone,'used');assert.equal(m.players.dark.used.length,0);});
for(const value of [0.5,4])test('Gravel compares ability '+value+' set during destiny responses',()=>{let {m,site,target,card}=base();topDestiny(m,'dark','1_247');m=play(m,card,target);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-drawn');load(new URL('../../lib/native-engine/ability.ts',import.meta.url)).addAbilityModifier(m,site,target,'reset',value);m=finish(m,card);assert.equal(m.cards[target].zone,value<3?'lost':'table');});
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/gravel-results.json',import.meta.url)));
for(const expected of oracle)test('executed GEMP parity '+expected.name,()=>assert.deepEqual(expected.name.startsWith('target-')?targetCase(expected.name.slice(7)):outcome(expected.name),expected));
import crypto from 'node:crypto';
test('Gravel evidence fingerprints the executed reference harness and results',()=>{const p=JSON.parse(fs.readFileSync(new URL('./gemp/gravel-provenance.json',import.meta.url)));for(const [file,hash] of [[p.harness,p.harnessSha256],[p.result,p.resultSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+file,import.meta.url))).digest('hex'),hash);assert.equal(p.observations,oracle.length);assert.equal(p.junitTests,2);assert.equal(p.unchangedProductionFiles,6820);});
