import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
export const runtime=load(new URL('../../lib/native-engine/runtime.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
const {premiereSetup}=load(new URL('../../lib/native-engine/premiere-setup.ts',import.meta.url));
const {definition}=load(new URL('../../lib/native-engine/definitions.ts',import.meta.url));
const starting={dark:'9_139',light:'9_51'};
const names={'9_139':'Prepared Defenses','9_51':'Heading For The Medical Frigate'};
export const decks=(first='dark',copies=2,size=60)=>['dark','light'].map(side=>({side,cards:[side==='dark'?(first==='light'?'2_143':'1_291'):'1_132',...Array(copies).fill(starting[side]),...Array(size-copies-1).fill(side==='dark'?'1_194':'1_28')]}));
/** Test-only provider: both real cards may finish without deploying an Effect
 * when this exact fixture contains no Effects. This verifies the shared setup
 * protocol; it is not their full printed implementation or production admission. */
export function rules({first='dark',finishZone='lost',hold=false}={}){
 const cardDefinition=bp=>names[bp]?{side:bp==='9_139'?'dark':'light',name:names[bp]}:definition(bp);
 const interrupts={
  candidates:(m,side)=>m.players[side].reserve.filter(id=>m.cards[id].blueprint===starting[side]),
  choices:(m,card)=>[{id:'starting-finish:'+card,label:'Finish '+names[m.cards[card].blueprint]+' · no eligible Effects'}],
  apply:(m,card)=>{m.data.startingResolutionOrder=[...(m.data.startingResolutionOrder??[]),m.cards[card].owner];if(hold&&!m.data.startingHeld){m.data.startingHeld=true;return false;}state.moveCard(m,card,finishZone);return true;},
  validate:m=>{for(const [side,id]of Object.entries(m.setup?.interrupts?.selected??{}))if(id!==null)assert.equal(m.cards[id].blueprint,starting[side]);},
 };
 return {id:'starting-protocol-test-1',starting:{...premiereSetup,ordinarySetup:()=>true,firstPlayer:()=>first,interrupts,name:(m,id)=>cardDefinition(m.cards[id].blueprint).name},definition:cardDefinition,supports:()=>true,setupComplete:m=>m.setup?.stage==='complete',generation:()=>1,automatic:()=>[],actions:()=>[],initiate:()=>{},resolve:()=>{throw Error('Protocol fixture has no later card effects');},decisions:()=>[],choose:()=>{},validate:()=>{}};
}
export function step(m,r,choice,side,entropy=()=>42){side??=runtime.prompt(m,r,'dark').side;return runtime.applyCommand(m,r,side,{revision:m.revision,choice},entropy);}
export function ready(options={}){
 const r=rules(options);let m=runtime.createMatch('starting-protocol',options.size??60,decks(options.first,options.copies??2,options.size??60),r);
 for(const side of ['dark','light'])m=step(m,r,'select:'+side+'-1',side);
 m=step(m,r,'reveal','dark');const p=runtime.prompt(m,r,'light');const q=p.choices.length?p:runtime.prompt(m,r,'dark');m=step(m,r,q.choices[0].id,q.side);
 return {m,r};
}
export function chooseBoth(m,r,{dark=true,light=true,first='dark'}={}){for(const side of [first,first==='dark'?'light':'dark'])m=step(m,r,(side==='dark'?dark:light)?'starting-select:'+side+'-2':'starting-decline',side);return step(m,r,'starting-reveal','dark');}
export function finish(m,r){for(let n=0;n<10&&m.status==='setup';n++){const p=runtime.prompt(m,r,'dark'),q=p.choices.length?p:runtime.prompt(m,r,'light');m=step(m,r,q.choices[0].id,q.side);}assert.equal(m.status,'playing');return m;}
