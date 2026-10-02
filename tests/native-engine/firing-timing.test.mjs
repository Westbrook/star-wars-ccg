import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const combat=load(new URL('../../lib/native-engine/battle.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Component-only boards. Production admission stays closed.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
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
const event=m=>m.stack.at(-1)?.event;
const other=s=>s==='light'?'dark':'light';
const use=load(new URL('../../lib/native-engine/weapon-state.ts',import.meta.url));
function attach(m,side,bp,host){const id=pull(m,side,bp,'table',m.cards[host].location);m.cards[id].attachedTo=host;return id;}
function fixture({initiator='dark',siteBP='1_129',armed=true,deployed=true,blaster=false}={}){
 let m=fresh({light:['1_129','1_130','1_132','1_152','1_152','1_153','1_28','1_28','1_28','1_40','1_153','1_153'],dark:['1_315','1_315','1_196','1_196','1_196','1_194','1_317','1_285','1_262','1_252','1_196','1_317','1_194','1_317']});const site=location(m,'light',siteBP),remote=location(m,'light','1_130');
 const host=pull(m,'dark',blaster?'1_194':'1_196','table',site),otherRaider=pull(m,'dark','1_196','table',remote),backup=pull(m,'dark','1_194','table',site),target=pull(m,'light','1_28','table',site),otherTarget=pull(m,'light','1_28','table',site);
 const stick=deployed?attach(m,'dark',blaster?'1_317':'1_315',host):pull(m,'dark','1_315','hand'),second=pull(m,'dark','1_315','hand'),gun=armed?attach(m,'light','1_152',target):pull(m,'light','1_152','hand'),otherGun=attach(m,'light','1_152',otherTarget);force(m,'dark',6);force(m,'light',6);m=phase(m,'deploy');
 if(initiator==='light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);
 return {m,site,remote,host,otherRaider,backup,target,otherTarget,stick,second,gun,otherGun};
}
const pending=m=>m.stack.at(-2);
const kind=m=>event(m)?.kind;
const start=f=>{let m=phase(f.m,'battle');return step(m,'battle:'+f.site);};
function draws(m,values){const bp={0:'1_285',1:'1_194',2:'1_196',3:'1_317',4:'1_315',5:'1_262',6:'1_252'};const picked=[];for(const v of values)if(v!==null)picked.push(pull(m,'dark',bp[v],'hand'));for(const id of [...picked].reverse())state.moveCard(m,id,'reserve');if(values.includes(null))for(const id of [...m.players.dark.reserve])if(!picked.includes(id))state.moveCard(m,id,'hand');return picked;}
function fire(f,values=[3,3]){let m=start(f);const drawn=draws(m,values);m=priority(m,'dark');return {m:step(m,'gaffi:fire:'+f.stick+':'+f.target),drawn};}
const weapons=m=>seek(m,x=>kind(x)==='battle-weapons');
const shot=m=>combat.battle(m).gaffiShots.at(-1);
const finish=m=>seek(m,x=>combat.battle(x)?.stage==='complete'&&x.stack.length===1);

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/firing-identity-results.json',import.meta.url)));
// Zone changes here are deliberate fixture interventions at real response
// windows, matching the Java oracle; they do not pretend to play removal cards.
for(const weapon of ['blaster','stick'])for(const who of ['weapon','host','target'])for(const returned of [false,true])for(const duringDraw of [false,true])test(`pending ${weapon}: ${who} ${returned?'returns':'leaves'} during ${duringDraw?'draw':'responses'}`,()=>{
 const f=fixture({blaster:weapon==='blaster'});let m=start(f);
 if(weapon==='blaster')m=weapons(m);
 m=priority(m,'dark');draws(m,[3,3]);const forceBefore=m.players.dark.force.length;
 m=step(m,weapon==='blaster'?'fire:'+f.stick+':'+f.target:'gaffi:fire:'+f.stick+':'+f.target);
 if(duringDraw)m=seek(m,x=>['destiny-drawn','weapon-destiny-drawn'].includes(kind(x)));
 const id=who==='target'?f.target:who==='host'?f.host:f.stick;
 const child=who==='target'?f.gun:who==='host'?f.stick:null;
 if(child)state.moveCard(m,child,'hand');state.moveCard(m,id,'hand');
 if(returned){state.moveCard(m,id,'table');m.cards[id].location=f.site;if(who==='weapon')m.cards[id].attachedTo=f.host;
   if(child){state.moveCard(m,child,'table');m.cards[child].attachedTo=id;m.cards[child].location=f.site;}}
 m=seek(m,x=>kind(x)==='weapon-fired');
 const record=weapon==='blaster'?combat.battle(m).shots.at(-1):shot(m);
 const actual={draws:weapon==='blaster'?(record.card?1:0):record.draws.filter(d=>d.card).length,
   forceSpent:forceBefore-m.players.dark.force.length,targetHit:combat.battle(m).hits.includes(f.target),targetParticipating:combat.members(m,'light').includes(f.target),
   targetWeaponSuppressed:combat.battle(m).knockedWeapons?.includes(f.gun)??false};
 const name=`${weapon}-${who}-${returned?'return':'leave'}-${duringDraw?'draw':'response'}`;
 const {name:_,...expected}=oracle.find(r=>r.name===name);
 assert.deepEqual(actual,expected);
});
