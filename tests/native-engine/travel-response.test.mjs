import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,play,prompt,step,rules,runtime,state,pull,manifest} from './travel-response-fixture.mjs';
const reference=JSON.parse(fs.readFileSync(new URL('./gemp/travel-response-results.json',import.meta.url)));
for(const mode of ['run','run-light','escape'])test('all starter Interrupts cannot reopen battle-initiation responses inside '+mode,()=>{
 const f=fixture(mode),before=f.before;
 assert.ok(before.some(id=>id.startsWith('react-deploy:')),'Deployment reaction is available before the Interrupt');
 if(mode!=='run-light')assert.ok(before.some(id=>id.startsWith('react-move:')),'Wolfman is available before the Interrupt');
 assert.ok(before.some(id=>id.startsWith('accident:')),'accident is available before the Interrupt');
 let m=play(f),windows=[];
 for(let n=0;n<150&&m.cards[f.interrupt].zone==='playing';n++){
  const top=m.stack.at(-1),p=prompt(m),choices=p.choices.map(c=>c.id);
  assert.deepEqual(runtime.project(m,rules,p.side),runtime.project(structuredClone(m),rules,p.side));
  if(top.kind==='window'){
   assert.deepEqual(choices,['pass'],'No unrelated action during '+(top.event?.kind??m.stack.at(-2)?.action?.handler));
   windows.push({side:p.side,event:top.event?.kind??m.stack.at(-2)?.action?.handler});m=step(m,'pass');
  }else{
   assert.equal(top.handler,'travel:escape');const moving=[f.luke,f.rebel].find(id=>choices.includes('away:'+id+':'+f.near));assert.ok(moving);
   m=step(m,'away:'+moving+':'+f.near);
  }
 }
 const row=reference.find(r=>r.mode===mode);assert.equal(m.cards[f.interrupt].zone,mode.startsWith('run')?'lost':'used');
 assert.equal(m.cards[f.luke].location,mode.startsWith('run')?f.site:f.near);assert.equal(row.lukeMoved,true);
 assert.ok(windows.some(w=>w.side==='light'));assert.ok(windows.some(w=>w.side==='dark'));
 assert.ok(windows.some(w=>w.event==='moved'));assert.ok(windows.some(w=>w.event==='travel:'+(mode.startsWith('run')?'run':mode)+'-move'));
 assert.ok(row.windows.length>=6);for(const w of row.windows)assert.deepEqual(w.actions,[]);
 // Native safely elides empty payment windows after querying both sides.
 // Compare every remaining response's stage and player, not just the result.
 const referenceWindows=row.windows.filter(w=>!w.text.startsWith('Use 1 Force')).map(w=>({side:w.side,event:w.text.startsWith('Playing ')?'interrupt':w.text.startsWith('MOVING_')?'moving':'moved'}));
 assert.deepEqual(windows.map(w=>({side:w.side,event:w.event==='moved'?'moved':w.event.endsWith('-move')?'moving':'interrupt'})),referenceWindows);
 assert.ok(row.before.some(a=>a.includes('react')),'Reference baseline has actual nonempty responses');
});
test('arrival mine loss permits Kintan, but cannot return a target or deploy a late arrival into pending Escape',()=>{
 const f=fixture('escape');
 const mine=Object.values(f.m.cards).find(c=>c.owner==='dark'&&c.blueprint==='1_322'&&c.zone==='force').id;state.moveCard(f.m,mine,'buried');f.m.cards[mine].location=f.near;
 const retrieved=pull(f.m,'dark','1_194','lost');
 // Prepare a one-character mine result; the actual draw/loss/retrieval then run normally.
 const destiny=pull(f.m,'dark','1_194','hand');state.moveCard(f.m,destiny,'reserve');
 let m=play(f),kintanPlayed=false,lossSeen=false,secondMove=false;
 for(let n=0;n<240&&m.cards[f.interrupt].zone==='playing';n++){
  const p=prompt(m),choices=p.choices.map(c=>c.id),top=m.stack.at(-1);
  assert.deepEqual(runtime.project(m,rules,p.side),runtime.project(structuredClone(m),rules,p.side));
  assert.ok(!choices.some(id=>id.startsWith('react-deploy:')||id.startsWith('react-move:')||id.startsWith('stun:')));
  assert.ok(!choices.some(id=>id.startsWith('revival:old-ben:')),'Mine loss is not forfeiture');
  let choice;
  if(choices.includes('away:'+f.luke+':'+f.near))choice='away:'+f.luke+':'+f.near;
  else if(choices.includes('away:'+f.rebel+':'+f.near)){assert.equal(m.cards[f.luke].zone,'lost');assert.equal(m.cards[retrieved].zone,'hand');secondMove=true;choice='away:'+f.rebel+':'+f.near;}
  else if(choices.includes('select:'+f.luke))choice='select:'+f.luke;
  else if(choices.includes('revival:kintan:'+f.hand['1_254'])){lossSeen=true;kintanPlayed=true;choice='revival:kintan:'+f.hand['1_254'];}
  else choice=choices.includes('pass')?'pass':choices[0];
  if(top.kind==='window'&&top.event?.kind==='cards-lost'&&top.event.cards.includes(f.luke))lossSeen=true;
  m=step(m,choice);
 }
 assert.equal(m.cards[f.interrupt].zone,'used');assert.ok(lossSeen&&kintanPlayed&&secondMove);
 assert.equal(m.cards[f.luke].zone,'lost');assert.equal(m.cards[retrieved].zone,'hand');
 assert.equal(m.cards[mine].zone,'lost');assert.equal(m.cards[f.rebel].location,f.near);
 assert.equal(m.cards[f.extra].zone,'hand');assert.equal(m.cards[f.darkExtra].zone,'hand');
});
