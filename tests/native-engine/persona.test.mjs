import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const persona=load(new URL('../../lib/native-engine/persona.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Test-only admission; supplementary personas have incomplete card text.
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(extra={}){return runtime.createMatch('persona-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(extra[d.side]??[]),...d.main].slice(0,60)})),rules)}
function pull(m,side,bp,zone='table',site){const c=Object.values(m.cards).find(c=>c.owner===side&&c.blueprint===bp&&c.zone==='reserve');assert.ok(c,'fixture '+bp);state.moveCard(m,c.id,zone);if(site)m.cards[c.id].location=site;return c.id}
function location(m,side,bp){const id=pull(m,side,bp);m.locations.push(id);return id}
function force(m,side,n){for(let i=0;i<n;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force')}
function prompt(m){const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)}
const ids=m=>prompt(m).choices.map(c=>c.id);
function step(m,id){const before=clone(m),r=runtime.applyCommand(clone(m),rules,prompt(m).side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);state.assertState(r);for(const s of ['dark','light'])assert.deepEqual(runtime.project(r,rules,s),runtime.project(clone(r),rules,s));return r}
function seek(m,predicate){for(let n=0;n<700;n++){if(predicate(m))return m;const p=prompt(m);assert.ok(p,'ended too soon');m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('boundary not reached')}
function phase(m,p='deploy',side='dark'){if(m.status==='setup')m=runtime.startTurns(m,rules);return seek(m,x=>x.turn.phase===p&&x.turn.side===side&&x.stack.length===1)}
function settled(m){return seek(m,x=>x.stack.length===1)}

test('ordinary unique deployment consumes a saved turn allowance even after the character returns to hand',()=>{
 let m=fresh({dark:['101_5','101_5']});const site=location(m,'dark','101_4'),a=pull(m,'dark','101_5','hand'),b=pull(m,'dark','101_5','hand');force(m,'dark',14);m=phase(m);m=settled(step(m,'deploy:'+a+':'+site));assert.equal(m.data.cardPlays.cards.length,1);assert.equal(m.cards[a].zone,'table');state.moveCard(m,a,'hand');assert.ok(!ids(m).some(id=>id==='deploy:'+a+':'+site||id==='deploy:'+b+':'+site));
 m=seek(m,x=>x.turn.number===3&&x.turn.phase==='deploy'&&x.stack.length===1);assert.ok(ids(m).includes('deploy:'+b+':'+site));m=settled(step(m,'deploy:'+b+':'+site));assert.equal(m.data.cardPlays.turn,3);assert.equal(m.data.cardPlays.cards.length,1);
});

test('restricted characters count initiated plays rather than only remaining table copies',()=>{
 let m=fresh({light:['1_30','1_30','1_30','1_30']});const site=location(m,'light','1_129'),cards=Array.from({length:4},()=>pull(m,'light','1_30','hand'));force(m,'light',15);m=phase(m,'deploy','light');
 for(const id of cards.slice(0,3)){if(prompt(m).side!=='light')m=step(m,'pass');m=settled(step(m,'deploy:'+id+':'+site));state.moveCard(m,id,'hand')}
 if(prompt(m).side!=='light')m=step(m,'pass');assert.ok(!ids(m).includes('deploy:'+cards[3]+':'+site));assert.equal(m.data.cardPlays.cards.length,3);
});

for(const side of ['light','dark'])test(side+' starter counts every opposing unique character, excluding restricted characters',()=>{
 const extra=side==='light'?{dark:['1_184','1_195']}:{light:['1_11','1_21']};const m=fresh(extra),site=location(m,side,side==='light'?'1_129':'101_4'),target=pull(m,side,side==='light'?'101_2':'101_5','hand'),enemy=side==='light'?'dark':'light',bps=side==='light'?['1_184','1_195']:['1_11','1_21'],a=pull(m,enemy,bps[0],'table',site),b=pull(m,enemy,bps[1],'table',site);
 assert.equal(board.deploymentPayment(m,target,site),null);state.moveCard(m,b,'hand');assert.ok(board.deploymentPayment(m,target,site));assert.equal(persona.isUnique(m,a),true);
});

test('persona exclusion uses exact metadata and same-title uniqueness applies across owners',()=>{
 const m=fresh({light:['1_19','3_3','5_5','1_21'],dark:['5_99']});const site=location(m,'light','1_129'),luke=pull(m,'light','1_19','table',site),alt=pull(m,'light','3_3','hand'),lando=pull(m,'light','5_5','hand');pull(m,'dark','5_99','table',site);assert.equal(persona.canEnterTable(m,alt),false);assert.equal(persona.canEnterTable(m,lando),false);assert.equal(persona.hasPersona(m,luke,'LUKE'),true);assert.equal(persona.hasPersona(m,luke,'LANDO'),false);
 state.moveCard(m,luke,'out');assert.equal(persona.canEnterTable(m,alt),false);state.moveCard(m,luke,'lost');assert.equal(persona.canEnterTable(m,alt),true);
});

test('different printed Luke titles share a persona and Obi-Wan remains excluded from Old Ben',()=>{
 let m=fresh({light:['4_1','1_21']});const site=location(m,'light','1_129'),luke=pull(m,'light','101_2','table',site),son=pull(m,'light','4_1','hand'),obi=pull(m,'light','1_21','lost');pull(m,'light','1_100','hand');force(m,'light',1);m=phase(m,'control');
 assert.equal(persona.canEnterTable(m,son),false);state.moveCard(m,luke,'lost');assert.equal(persona.canEnterTable(m,son),true);
 runtime.openWindow(m,'response','light',{kind:'forfeited',card:obi,site});assert.ok(!ids(m).some(id=>id.startsWith('revival:old-ben:')));
});

test('restricted opposing characters do not trigger the starter unique-character limit',()=>{
 const m=fresh({light:['1_30','1_30','1_30']}),site=location(m,'dark','101_4'),vader=pull(m,'dark','101_5','hand');
 for(let i=0;i<3;i++){const id=pull(m,'light','1_30','table',site);assert.equal(persona.isUnique(m,id),false)}assert.ok(board.deploymentPayment(m,vader,site));
});

for(const boundary of ['before','response','placement'])test('Old Ben cannot create another on-table persona at '+boundary,()=>{
 let m=fresh({light:['1_19']});const site=location(m,'light','1_129'),target=pull(m,'light','101_2','lost'),alt=pull(m,'light','1_19','hand'),ben=pull(m,'light','1_100','hand');force(m,'light',1);m=phase(m,'control');runtime.openWindow(m,'response','light',{kind:'forfeited',card:target,site});
 if(boundary==='before'){state.moveCard(m,alt,'table');m.cards[alt].location=site;assert.ok(!ids(m).some(id=>id.startsWith('revival:old-ben:')));return}
 m=step(m,'revival:old-ben:'+ben+':'+target);if(boundary==='placement')m=seek(m,x=>x.stack.at(-1)?.event?.kind==='about-to-remove-just-lost');state.moveCard(m,alt,'table');m.cards[alt].location=site;m=seek(m,x=>x.cards[ben].zone==='lost');assert.equal(m.cards[target].zone,'lost');assert.equal(m.players.light.force.length,0);
});

test('revival ignores deployment turn limits and does not record a new character play',()=>{
 let m=fresh();const site=location(m,'light','1_129'),target=pull(m,'light','101_2','lost'),ben=pull(m,'light','1_100','hand');force(m,'light',1);m=phase(m,'control');persona.recordCardPlay(m,target);runtime.openWindow(m,'response','light',{kind:'forfeited',card:target,site});m=step(m,'revival:old-ben:'+ben+':'+target);m=seek(m,x=>x.cards[ben].zone==='lost');assert.equal(m.cards[target].zone,'table');assert.equal(m.data.cardPlays.cards.filter(p=>p.card===target).length,1);
});

test('character entering during pending deployment prevents a duplicate persona and preserves paid cost',()=>{
 let m=fresh({light:['1_19']});const site=location(m,'light','1_129'),target=pull(m,'light','101_2','hand'),alt=pull(m,'light','1_19','hand');force(m,'light',9);m=phase(m,'deploy','light');const cost=board.deploymentPayment(m,target,site).light;m=step(m,'deploy:'+target+':'+site);state.moveCard(m,alt,'table');m.cards[alt].location=site;m=settled(m);assert.equal(m.cards[target].zone,'lost');assert.equal(m.players.light.force.length,9-cost);
});

test('play ledger rejects malformed saved history and stays private',()=>{
 let m=fresh();location(m,'light','1_129');const card=pull(m,'light','101_3','hand');m=phase(m);persona.recordCardPlay(m,card);for(const mutate of [h=>h.turn=99,h=>h.cards[0].blueprint='missing',h=>h.cards[0].card='missing',h=>h.cards[0].side='third']){const bad=clone(m);mutate(bad.data.cardPlays);assert.throws(()=>premiereRules.validate(bad),/play history/)}for(const side of ['light','dark'])assert.ok(!JSON.stringify(runtime.project(m,rules,side)).includes('cardPlays'));
});

const reference=JSON.parse(fs.readFileSync(new URL('./gemp/persona-results.json',import.meta.url)));
for(const row of reference)test('GEMP uniqueness query '+row.name,()=>{
 let m=fresh({light:['101_2','101_2','1_19','5_5','1_30','1_30','1_30','1_30','101_3','101_3'],dark:['5_99']});
 const site=location(m,'light','1_129'),source=pull(m,'light','101_2','hand'),copy=pull(m,'light','101_2','hand'),alt=pull(m,'light','1_19','hand');m=phase(m,'control');let target=copy;
 const place=id=>{state.moveCard(m,id,'table');m.cards[id].location=site;};
 if(row.name==='same-title')place(source);
 if(row.name==='same-persona'){target=alt;place(source)}
 if(row.name==='opponent-same-title'){target=pull(m,'light','5_5','hand');pull(m,'dark','5_99','table',site)}
 if(row.name.startsWith('out-')){if(row.name==='out-persona')target=alt;state.moveCard(m,source,'out')}
 if(row.name==='lost-persona'){target=alt;state.moveCard(m,source,'lost')}
 if(row.name.includes('restricted')){const cards=Array.from({length:4},()=>pull(m,'light','1_30','hand'));target=cards[3];for(const id of cards.slice(0,row.name.endsWith('three')?3:2)){if(row.name.startsWith('turn-'))persona.recordCardPlay(m,id);else place(id)}}
 else if(row.name.startsWith('turn-')||row.name==='next-turn'){
  let played=source;if(row.name==='turn-persona')target=alt;if(row.name==='turn-canceled'){played=pull(m,'light','101_3','hand');target=pull(m,'light','101_3','hand')}
  persona.recordCardPlay(m,played);state.moveCard(m,played,'lost');if(row.name==='next-turn')m=seek(m,x=>x.turn.number===2&&x.turn.phase==='control'&&x.stack.length===1);
 }
 const actual={name:row.name,tableAllowed:persona.canEnterTable(m,target),turnAllowed:persona.canPlayThisTurn(m,target)};
 if(row.name==='turn-persona'){
  // AR p75 explicitly counts persona; pinned GEMP checks titles only.
  assert.equal(row.turnAllowed,true);assert.deepEqual(actual,{...row,turnAllowed:false});
 }else assert.deepEqual(actual,row);
});
