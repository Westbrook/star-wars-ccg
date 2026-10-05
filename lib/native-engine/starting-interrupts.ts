import type {Entropy} from './random';
import {other,sides,type Match,type Prompt,type Side} from './types';

/** Card providers own their printed effects and validate their continuations.
 * The setup protocol owns selection secrecy, reveal and resolution order.
 * This contract grants no general pre-game Interrupt/response permission. */
export interface StartingInterruptRules {
 candidates(match:Match,side:Side):string[];
 choices(match:Match,card:string):Prompt['choices'];
 apply(match:Match,card:string,choice:string,entropy:Entropy):boolean;
 /** A printed provider may run nested responses before its result completes. */
 running?(match:Match,card:string):boolean;
 complete?(match:Match,card:string):boolean;
 validate(match:Match):void;
}
export type StartingInterruptSetup={
 selected:Record<Side,string|null>;
 committed:Record<Side,boolean>;
 revealed:boolean;
 order:Side[];
 resolved:number;
 // Opening-hand accounting begins after all starting effects have resolved.
 opening?:Record<Side,{hand:number;reserve:number}>;
};
const candidates=(m:Match,r:StartingInterruptRules,side:Side)=>{
 const ids=r.candidates(m,side);
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!m.cards[id]||m.cards[id].owner!==side||m.cards[id].zone!=='reserve'))throw Error('Invalid starting Interrupt candidates.');
 return ids;
};
export function beginStartingInterrupts(m:Match,r:StartingInterruptRules|undefined):boolean {
 if(!r||m.setup!.interrupts)return false;
 const eligible=Object.fromEntries(sides.map(side=>[side,candidates(m,r,side)])) as Record<Side,string[]>;
 // Preserve the exact old setup path when no Starting Interrupt is available.
 if(sides.every(side=>!eligible[side].length))return false;
 m.setup!.interrupts={selected:{dark:null,light:null},committed:{dark:!eligible.dark.length,light:!eligible.light.length},revealed:false,order:[],resolved:0};
 m.setup!.stage='starting-choice';return true;
}
export function startingInterruptPrompt(m:Match,r:StartingInterruptRules,seat:Side,name:(m:Match,id:string)=>string):Prompt {
 const s=m.setup!,i=s.interrupts!;let side:Side='dark',choices:Prompt['choices']=[];
 if(s.stage==='starting-choice'){
  side=!i.committed[seat]?seat:!i.committed.dark?'dark':'light';
  if(side===seat)choices=[...candidates(m,r,side).map(card=>({id:'starting-select:'+card,label:name(m,card),card})),{id:'starting-decline',label:'No Starting Interrupt'}];
 }else if(s.stage==='starting-reveal')choices=[{id:'starting-reveal',label:'Reveal Starting Interrupts together'}];
 else if(s.stage==='starting-resolve'){
  side=i.order[i.resolved];const card=i.selected[side];if(!card)throw Error('Missing starting Interrupt source.');choices=r.choices(m,card);
  if(!choices.length||new Set(choices.map(c=>c.id)).size!==choices.length)throw Error('Starting Interrupt needs a resolution choice.');
 }else throw Error('Not a starting Interrupt step.');
 return {revision:m.revision,side,timing:'setup',mandatory:true,choices:side===seat?choices:[]};
}
export function resumeStartingInterrupts(m:Match,r:StartingInterruptRules|undefined):void {
 if(m.status!=='setup'||m.stack.length||m.setup?.stage!=='starting-resolve'||!r?.complete)return;
 const i=m.setup.interrupts!,card=i.selected[i.order[i.resolved]];
 if(card&&r.complete(m,card)){i.resolved++;if(i.resolved===i.order.length)finish(m);}
}
export function startingStackAllowed(m:Match,r:StartingInterruptRules|undefined):boolean {
 const i=m.setup?.interrupts;if(m.setup?.stage!=='starting-resolve'||!i||!r?.running)return false;
 const card=i.selected[i.order[i.resolved]];return !!card&&r.running(m,card);
}
function finish(m:Match){
 const i=m.setup!.interrupts!;
 i.opening=Object.fromEntries(sides.map(side=>[side,{hand:m.players[side].hand.length,reserve:m.players[side].reserve.length}])) as StartingInterruptSetup['opening'];
 m.setup!.stage='shuffle';
}
export function applyStartingInterrupt(m:Match,r:StartingInterruptRules,seat:Side,choice:string,entropy:Entropy,first:Side):void {
 const s=m.setup!,i=s.interrupts!;
 if(s.stage==='starting-choice'){
  if(i.committed[seat])throw Error('Starting Interrupt choice already committed.');
  if(choice==='starting-decline')i.selected[seat]=null;
  else {const card=choice.slice('starting-select:'.length);if(!choice.startsWith('starting-select:')||!candidates(m,r,seat).includes(card))throw Error('Illegal starting Interrupt selection.');i.selected[seat]=card;}
  i.committed[seat]=true;if(sides.every(side=>i.committed[side]))s.stage='starting-reveal';
 }else if(s.stage==='starting-reveal'){
  if(choice!=='starting-reveal'||seat!=='dark')throw Error('Invalid starting Interrupt reveal.');
  m.turn.side=first;
  i.revealed=true;i.order=[first,other(first)].filter(side=>i.selected[side]!==null);
  if(i.order.length)s.stage='starting-resolve';else finish(m);
 }else if(s.stage==='starting-resolve'){
  const side=i.order[i.resolved],card=i.selected[side];if(side!==seat||!card||!r.choices(m,card).some(c=>c.id===choice))throw Error('Invalid starting Interrupt resolution.');
  const done=r.apply(m,card,choice,entropy);if(typeof done!=='boolean')throw Error('Invalid starting Interrupt completion.');
  if(done){i.resolved++;if(i.resolved===i.order.length)finish(m);}
 }else throw Error('Starting Interrupt sequence is not active.');
}
export function projectStartingInterrupts(m:Match,seat:Side,name:(m:Match,id:string)=>string){
 const i=m.setup!.interrupts;if(!i)return undefined;
 return {committed:{...i.committed},revealed:i.revealed,selected:Object.fromEntries(sides.map(side=>{
  const id=i.selected[side];
  // History must not expose where a revealed Interrupt moves after the shuffle.
  return [side,id&&(i.revealed||side===seat)?{id,blueprint:m.cards[id].blueprint,owner:side,name:name(m,id)}:null];
 })),resolving:i.revealed&&i.resolved<i.order.length?i.order[i.resolved]:null};
}
export function assertStartingInterrupts(m:Match,r:StartingInterruptRules|undefined,first:Side):void {
 const s=m.setup!,i=s.interrupts,active=s.stage.startsWith('starting-');
 if(!i){if(active)throw Error('Missing starting Interrupt sequence.');return;}
 if(!r||!['starting-choice','starting-reveal','starting-resolve','shuffle','complete'].includes(s.stage))throw Error('Unexpected starting Interrupt sequence.');
 if(!i.selected||!i.committed||typeof i.revealed!=='boolean'||!Array.isArray(i.order)||new Set(i.order).size!==i.order.length||i.order.some(side=>!sides.includes(side))||!Number.isSafeInteger(i.resolved)||i.resolved<0||i.resolved>i.order.length)throw Error('Invalid starting Interrupt sequence.');
 for(const side of sides){const id=i.selected[side];if(typeof i.committed[side]!=='boolean'||id!==null&&(typeof id!=='string'||m.cards[id]?.owner!==side||!i.committed[side]))throw Error('Invalid starting Interrupt selection.');}
 const both=sides.every(side=>i.committed[side]);
 if(s.stage==='starting-choice'?both:!both)throw Error('Invalid starting Interrupt commitments.');
 if(i.revealed!==!['starting-choice','starting-reveal'].includes(s.stage))throw Error('Invalid starting Interrupt disclosure.');
 const order=i.revealed?[first,other(first)].filter(side=>i.selected[side]!==null):[];
 if(JSON.stringify(i.order)!==JSON.stringify(order))throw Error('Invalid starting Interrupt resolution order.');
 if(!i.revealed&&i.resolved!==0||s.stage==='starting-resolve'&&i.resolved>=i.order.length||['shuffle','complete'].includes(s.stage)&&i.resolved!==i.order.length)throw Error('Starting Interrupt results skipped.');
 if(['shuffle','complete'].includes(s.stage)!==!!i.opening)throw Error('Missing starting Interrupt opening accounting.');
 if(i.opening)for(const side of sides){const p=i.opening[side];if(!p||![p.hand,p.reserve].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=m.deckSize)||p.hand+p.reserve>m.deckSize)throw Error('Invalid starting Interrupt opening counts.');}
 if(m.status==='setup'&&i.opening)for(const side of sides){const p=i.opening[side],drawn=s.stage==='complete'?Math.min(8,p.reserve):0;if(m.players[side].hand.length!==p.hand+drawn||m.players[side].reserve.length!==p.reserve-drawn)throw Error('Unexpected starting Interrupt opening piles.');}
 if(m.status==='setup'&&!i.revealed)for(const side of sides){const id=i.selected[side];if(id!==null&&!candidates(m,r,side).includes(id))throw Error('Starting Interrupt became ineligible before reveal.');}
 r.validate(m);
}
