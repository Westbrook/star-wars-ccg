import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from './load-engine.mjs';

const {emptyOpportunityChoice,canPassEmptyOpportunity}=load(new URL('../../app/proof/empty-opportunity.ts',import.meta.url));
const prompt={id:'window:1',side:'dark',automatic:true,choices:[{id:'pass',label:'Pass empty opportunity'}]};
const event={key:'ArrowRight',repeat:false,isComposing:false,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false};
const state={prompt,seat:'dark',waiting:false,blocked:false,hidden:false,focusConsumesArrows:false};

test('Right arrow allows only the sole automatic empty pass',()=>{
 assert.equal(canPassEmptyOpportunity(event,state),true);
 for(const changed of [null,{...prompt,automatic:false},{...prompt,choices:[]},{...prompt,choices:[{id:'pass',label:'Pass weapons opportunity'}]},{...prompt,choices:[...prompt.choices,{id:'fire',label:'Fire blaster'}]},{...prompt,choices:[{id:'other',label:'Pass empty opportunity'}]}]){
  assert.equal(emptyOpportunityChoice(changed),null);
  assert.equal(canPassEmptyOpportunity(event,{...state,prompt:changed}),false);
 }
});
test('A held key, composing input and modified or consumed arrows never advance',()=>{
 for(const flag of ['repeat','isComposing','defaultPrevented','altKey','ctrlKey','metaKey','shiftKey'])assert.equal(canPassEmptyOpportunity({...event,[flag]:true},state),false,flag);
 assert.equal(canPassEmptyOpportunity({...event,key:'ArrowLeft'},state),false);
});
test('Hidden, editing, unavailable, busy and opponent states cannot use the shortcut',()=>{
 for(const flag of ['waiting','blocked','hidden','focusConsumesArrows'])assert.equal(canPassEmptyOpportunity(event,{...state,[flag]:true}),false,flag);
 assert.equal(canPassEmptyOpportunity(event,{...state,seat:'light'}),false);
 assert.equal(canPassEmptyOpportunity(event,{...state,seat:undefined}),false);
});

// Render the actual component without a browser or a DOM mock.
const filename=new URL('../../app/proof/battle-losses.tsx',import.meta.url);
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const component={exports:{}};
new Function('require','module','exports',compiled)(createRequire(filename),component,component.exports);
const {BattleLosses}=component.exports;
const render=props=>renderToStaticMarkup(React.createElement(BattleLosses,props));
const cleared={attrition:0,damage:0,initialAttrition:3,initialDamage:5};
const losses={dark:cleared,light:{attrition:4,damage:0,initialAttrition:4,initialDamage:0}};

test('Both sides retain full labeled counters when the active seat changes',()=>{
 for(const seat of ['dark','light']){
  const html=render({losses,seat});
  assert.match(html,/aria-label="Dark side losses"/);
  assert.match(html,/aria-label="Light side losses"/);
  assert.equal((html.match(/<h4>Attrition<\/h4>/g)||[]).length,2);
  assert.equal((html.match(/<h4>Battle damage<\/h4>/g)||[]).length,2);
  assert.ok(html.indexOf('Dark side losses')<html.indexOf('Light side losses'));
  assert.match(html,/5 at battle result/);
  assert.match(html,/No battle damage remains/);
 }
});
test('Zero totals stay visible through mandatory hits and final battle totals',()=>{
 const zeroLosses={dark:cleared,light:cleared};
 const pending=render({losses:zeroLosses,seat:'dark',mandatoryHits:{dark:1,light:1}});
 assert.equal((pending.match(/<strong>0<\/strong>/g)||[]).length,4);
 assert.equal((pending.match(/1 hit trooper still to forfeit/g)||[]).length,2);
 assert.doesNotMatch(pending,/Losses clear<\/p>/);
 const finished=render({losses:zeroLosses,seat:'light',battleComplete:true});
 assert.match(finished,/Final totals/);
 assert.equal((finished.match(/<strong>0<\/strong>/g)||[]).length,4);
 assert.equal((finished.match(/Losses clear/g)||[]).length,2);
});
