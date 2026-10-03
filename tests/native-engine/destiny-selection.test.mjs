import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const destiny=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const selection=load(new URL('../../lib/native-engine/destiny-selection.ts',import.meta.url));
const {premiereRules}=load(new URL('../../lib/native-engine/premiere-rules.ts',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
const rules={...premiereRules,starting:undefined,supports:()=>true,setupComplete:()=>true,resolve:(m,r,c)=>{if(r.action.handler==='probe:done')m.data.observed=r.action.payload;else premiereRules.resolve(m,r,c)}};
const clone=x=>JSON.parse(JSON.stringify(x)),next={id:'done',label:'Record',handler:'probe:done',payload:{}};
const prompt=m=>{const p=runtime.prompt(m,rules,'dark');return p&&runtime.prompt(m,rules,p.side)};
const event=m=>m.stack.at(-1)?.event;
function step(m,id,side=prompt(m).side){const before=clone(m);const n=runtime.applyCommand(clone(m),rules,side,{revision:m.revision,choice:id},()=>0);assert.deepEqual(m,before);for(const s of ['light','dark'])assert.deepEqual(runtime.project(n,rules,s),runtime.project(clone(n),rules,s));return n}
function seek(m,done){for(let i=0;i<600;i++){if(done(m))return m;const p=prompt(m);assert.ok(p);m=step(m,p.choices.some(c=>c.id==='pass')?'pass':p.choices[0].id)}throw Error('Unreached boundary')}
const choose=m=>seek(m,x=>x.stack.at(-1)?.handler==='selection:choose'||!!x.data.observed);
const finish=m=>seek(m,x=>!!x.data.observed);
function fixture(values=[1,5,0],y=1,remainder='used',x=values.length){
 let m=runtime.createMatch('destiny-selection',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['1_28','1_115','1_124']:[]),...d.main].slice(0,60)})),rules);
 const source=m.players.light.reserve.at(-1);state.moveCard(m,source,'playing');const buffer=m.players.light.reserve.at(-1);state.moveCard(m,buffer,'force');
 const cards=values.map(value=>{const id=m.players.light.reserve.find(id=>m.cards[id].blueprint==={0:'1_124',1:'1_28',5:'1_115'}[value]);assert.ok(id);state.moveCard(m,id,'hand');return id});
 for(const id of [...m.players.light.reserve])state.moveCard(m,id,'hand');for(const id of cards.slice().reverse())state.moveCard(m,id,'reserve');
 m=runtime.startTurns(m,rules);selection.drawDestinySelection(m,'light',source,'probe-selection',x,y,next,0,remainder);
 // Empty batches have no before window; resolve only the same shared draw
 // continuation normally settled by an initiating action.
 while(m.stack.at(-1)?.kind==='resolution')rules.resolve(m,m.stack.pop(),{entropy:()=>0,now:0});
 if(event(m)?.kind==='destiny-cost')m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny');
 return {m,source,cards};
}
test('three draws stay unresolved through completion; selected values alone supply the total',()=>{
 let {m,cards}=fixture([1,5,0],2);m=choose(m);assert.equal(m.players.light.destiny.length,3);assert.equal(m.players.light.used.length,0);assert.deepEqual(prompt(m).choices.map(c=>c.id),['destiny-choice:0','destiny-choice:1','destiny-choice:2']);
 m=step(m,'destiny-choice:1');assert.equal(m.stack.at(-1).handler,'selection:choose');assert.equal(m.cards[cards[1]].zone,'used');assert.deepEqual(prompt(m).choices.map(c=>c.id),['destiny-choice:0','destiny-choice:2']);m=step(m,'destiny-choice:0');assert.equal(event(m).kind,'destiny-total');assert.equal(event(m).total,6);m=finish(m);assert.deepEqual(m.data.observed.draws.map(d=>d.value),[5,1]);assert.deepEqual(m.players.light.used,[cards[2],cards[0],cards[1]]);
});
test('unselected values go to hand when instructed, after selecting a successful zero',()=>{
 let {m,cards}=fixture([1,5,0],1,'hand');m=choose(m);m=step(m,'destiny-choice:2');m=finish(m);assert.equal(m.data.observed.total,0);assert.deepEqual(m.players.light.used,[cards[2]]);assert.ok(cards.slice(0,2).every(id=>m.cards[id].zone==='hand'));
});
test('canceled draw is immediately cleaned up and cannot be selected',()=>{
 let {m,cards}=fixture();m=seek(m,x=>event(x)?.kind==='destiny-drawn');m.stack.at(-2).cancelled=true;m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny');assert.equal(m.cards[cards[0]].zone,'used');m=choose(m);assert.deepEqual(prompt(m).choices.map(c=>c.id),['destiny-choice:1','destiny-choice:2']);m=finish(m);assert.equal(m.data.observed.total,5);
});
test('all canceled draws yield no selection or total window and retain physical cleanup',()=>{
 let {m,cards}=fixture([1,5],1);for(let n=0;n<2;n++){m=seek(m,x=>event(x)?.kind==='destiny-drawn'&&event(x).card===cards[n]);m.stack.at(-2).cancelled=true;if(n===0)m=seek(m,x=>event(x)?.kind==='about-to-draw-destiny')}
 m=finish(m);assert.deepEqual(m.data.observed,{draws:[],total:null});assert.deepEqual(m.players.light.used,[cards[1],cards[0]]);
});
test('not enough Reserve resolves available values and never offers failed draws',()=>{
 let {m,cards}=fixture([1],2,'used',3);m=choose(m);assert.equal(prompt(m).choices.length,1);m=finish(m);assert.equal(m.data.observed.total,1);assert.deepEqual(m.players.light.used,cards);
});
test('empty Reserve returns a failed total and no mandatory choice',()=>{let {m}=fixture([],1,'used',2);m=finish(m);assert.deepEqual(m.data.observed,{draws:[],total:null})});
test('negative individual modifiers settle to zero before choosing',()=>{
 let {m}=fixture([1,5],1);m=seek(m,x=>event(x)?.kind==='destiny-drawn');m.stack.at(-2).action.payload.draw.value=-3;m=choose(m);assert.match(prompt(m).choices[0].label,/ · 0$/);m=step(m,'destiny-choice:0');m=finish(m);assert.equal(m.data.observed.total,0);
});
test('substituted draw is a successful candidate without consuming a card',()=>{
 let {m,source,cards}=fixture([1,5],1);assert.ok(destiny.substituteDestiny(m,m.stack.at(-2),source,0));m=choose(m);assert.equal(m.cards[cards[1]].zone,'reserve');assert.match(prompt(m).choices[0].label,/substituted destiny · 0/);m=step(m,'destiny-choice:0');m=finish(m);assert.equal(m.data.observed.total,0);assert.equal(m.data.observed.draws[0].substitution.value,0);assert.deepEqual(m.players.light.used,[cards[0]]);
});
test('relocating and returning a drawn physical card cannot make cleanup target a new visit',()=>{
 let {m,cards}=fixture([1,5]);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');state.moveCard(m,cards[0],'hand');state.moveCard(m,cards[0],'destiny');m=choose(m);m=step(m,'destiny-choice:0');m=finish(m);assert.equal(m.data.observed.total,1);assert.equal(m.cards[cards[0]].zone,'destiny');assert.deepEqual(m.players.light.used,[cards[1]]);
});
test('a relocated draw keeps its value without revealing a hidden card in the choice label',()=>{
 let {m,cards}=fixture([1,5]);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');state.moveCard(m,cards[0],'hand');m=choose(m);assert.equal(runtime.project(m,rules,'dark').prompt.choices.length,0);m=step(m,'destiny-choice:0');m=finish(m);assert.equal(m.data.observed.total,1);assert.equal(m.cards[cards[0]].zone,'hand');
});
test('saved choices reject duplicate, foreign and stale commands without mutation',()=>{
 let {m}=fixture([1,5,0],2);m=choose(m);const before=clone(m);assert.throws(()=>step(m,'destiny-choice:0','dark'));assert.throws(()=>runtime.applyCommand(m,rules,'light',{revision:m.revision-1,choice:'destiny-choice:0'}));assert.throws(()=>step(m,'destiny-choice:99'));assert.deepEqual(m,before);m=step(m,'destiny-choice:0');assert.throws(()=>step(m,'destiny-choice:0'));assert.deepEqual(prompt(m).choices.map(c=>c.id),['destiny-choice:1','destiny-choice:2']);
});
test('malformed selection snapshots fail before any choice mutates state',()=>{
 const {m:start}=fixture([1,5,0],2),m=choose(start);
 for(const corrupt of [p=>p.chooseY=0,p=>p.drawX=1,p=>p.remainder='lost',p=>p.selected=[0,0],p=>p.selected=[9],p=>p.candidates[0].draw.value=null,p=>p.candidates[0].reference.version=999,p=>p.candidates.push(clone(p.candidates[0])),p=>p.modifier={weapon:'nope'}]){const bad=clone(m);corrupt(bad.stack.at(-1).payload);if(bad.stack.at(-1).payload.candidates[0].draw.value===null)bad.stack.at(-1).payload.selected=[0];assert.throws(()=>prompt(bad));}
 const bad=clone(start);bad.stack.at(-2).action.payload.next.payload.chooseY=0;assert.throws(()=>prompt(bad));
});
test('total modification leaves selected draw history intact',()=>{let {m}=fixture([1,5]);m=choose(m);m=step(m,'destiny-choice:1');m.stack.at(-2).action.payload.total=8;m=finish(m);assert.equal(m.data.observed.total,8);assert.equal(m.data.observed.draws[0].value,5)});
test('concession during selection freezes unresolved cards',()=>{let {m,cards}=fixture([1,5]);m=choose(m);m=step(m,'concede','dark');assert.equal(m.result.winner,'light');assert.ok(cards.every(id=>m.cards[id].zone==='destiny'));assert.equal(runtime.prompt(m,rules,'light'),null)});

test('cancel-and-redraw replaces one selection slot and only the replacement completes',()=>{
 let {m,cards}=fixture([1,5,0],1,'used',2);m=seek(m,x=>event(x)?.kind==='destiny-drawn');assert.ok(destiny.redrawDestiny(m,m.stack.at(-2)));assert.equal(destiny.redrawDestiny(m,m.stack.at(-2)),false);m=choose(m);assert.equal(m.cards[cards[0]].zone,'used');assert.deepEqual(prompt(m).choices.map(c=>c.label.split(' · ')[1]),['5','0']);m=step(m,'destiny-choice:0');m=finish(m);assert.equal(m.data.observed.total,5);assert.deepEqual(m.players.light.used,[cards[2],cards[1],cards[0]]);
});
test('substituted candidates cannot be redrawn',()=>{
 let {m,source}=fixture([1,5]);destiny.substituteDestiny(m,m.stack.at(-2),source,2);m=seek(m,x=>event(x)?.kind==='destiny-drawn');assert.equal(destiny.redrawDestiny(m,m.stack.at(-2)),false);m=finish(m);assert.equal(m.data.observed.total,2);
});

test('nested drawing cannot capture or dispose an outer unresolved candidate',()=>{
 let {m,source,cards}=fixture([1,5,0],1,'used',2);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');
 selection.drawDestinySelection(m,'light',source,'nested-selection',1,1,{...next,payload:{nested:true}});m=finish(m);assert.equal(m.data.observed.nested,true);assert.equal(m.data.observed.total,5);assert.equal(m.cards[cards[0]].zone,'destiny');delete m.data.observed;m=finish(m);assert.equal(m.data.observed.total,1);assert.deepEqual(m.players.light.used,[cards[2],cards[0],cards[1]]);
});
test('completion cannot silently drop the selection retention flag',()=>{
 let {m}=fixture([1,5]);m=seek(m,x=>event(x)?.kind==='destiny-draw-complete');const bad=clone(m);delete bad.stack.at(-2).action.payload.retain;assert.throws(()=>prompt(bad));
});
test('redraw with exhausted Reserve fails without leaving its canceled original unresolved',()=>{
 let {m,cards}=fixture([1],1,'used',2);m=seek(m,x=>event(x)?.kind==='destiny-drawn');destiny.redrawDestiny(m,m.stack.at(-2));m=finish(m);assert.equal(m.data.observed.total,null);assert.deepEqual(m.players.light.used,cards);assert.equal(m.players.light.destiny.length,0);
});

const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/selection-results.json',import.meta.url)));
for(const reference of oracle)test('executed GEMP selection: '+reference.name,()=>{
 const mode=reference.name, values=mode==='three-two'||mode==='redraw'?[1,5,0]:mode==='empty'?[]:mode==='short'?[1]:mode==='zero'?[0,5]:[1,5];
 let {m,cards}=fixture(values,mode==='three-two'||mode==='short'?2:1,mode==='hand'?'hand':'used',mode==='three-two'?3:2);
 const seen=new Set(),events=[];let intervened=false;
 while(!m.data.observed){const e=event(m),frame=m.stack.at(-1);
  if(e&&!seen.has(frame.serial)){seen.add(frame.serial);const stage={'about-to-draw-destiny':'before','destiny-drawn':'drawn','destiny-draw-complete':'complete','destiny-total':'total'}[e.kind];
   if(stage){const value=stage==='before'?null:stage==='drawn'?m.stack.at(-2).action.payload.draw.value:stage==='total'?e.total:e.value;events.push({stage,value,unresolved:m.players.light.destiny.length});
    if(!intervened&&stage==='drawn'&&['canceled','redraw'].includes(mode)){if(mode==='redraw')destiny.redrawDestiny(m,m.stack.at(-2));else m.stack.at(-2).cancelled=true;intervened=true;}
    if(!intervened&&stage==='complete'&&mode==='relocated'){state.moveCard(m,cards[0],'hand');intervened=true;}
   }
  }
  const p=prompt(m);if(frame.handler==='selection:choose'){
   const order=mode==='three-two'?[1,0]:mode==='second'||mode==='canceled'?[1]:[0];
   m=step(m,'destiny-choice:'+order.find(i=>p.choices.some(c=>c.id==='destiny-choice:'+i)));
  }else m=step(m,'pass');
 }
 assert.deepEqual(events,reference.events);assert.equal(m.data.observed.total,reference.total);
 const labels=new Map(cards.map((id,i)=>[id,{0:'zero',1:'one',5:'five'}[values[i]]]));
 const used=m.players.light.used.filter(id=>labels.has(id)).map(id=>labels.get(id));
 if(mode==='second'||mode==='three-two'){
  // Preserve the actual disagreement. AR p32 resolves each chosen draw before
  // remaining cleanup; pinned GEMP cleans every card in original draw order.
  assert.notDeepEqual(used,reference.used);assert.deepEqual(used,mode==='second'?['one','five']:['zero','one','five']);
  assert.deepEqual(m.data.observed.draws.map(d=>d.value).sort((a,b)=>a-b),reference.values.slice().sort((a,b)=>a-b));
 }else{assert.deepEqual(used,reference.used);assert.deepEqual(m.data.observed.draws.map(d=>d.value),reference.values)}
});
