import {ArrowRight,Check,Clock3,GitCompareArrows} from 'lucide-react';
import type {Choice,Projection,PublicCard,Side} from '@/lib/native-proof/types';

const sideName=(side:Side)=>side==='light'?'Light':'Dark';
const value=(n:number|null)=>n===null?'—':n;

export function ResponseStudy({game,onInspect}:{game:Projection;onInspect:(card:PublicCard)=>void}){
 const battle=game.battle!;
 const original=battle.destinyBeforeSwitch||battle.destiny;
 const resolving=game.playing?.[0];
 const available=game.prompt?.choices.some(c=>c.destinyPreview);
 const finishedDrawing=battle.drawn.light&&battle.drawn.dark;
 const skipped=finishedDrawing&&(battle.destiny.light===null||battle.destiny.dark===null);
 const totalsApplied=!!game.losses;
 const left=game.complete&&!battle.drawn.light&&!battle.drawn.dark;
 const headline=left?'Battle not initiated':resolving?'Takeel is resolving':battle.destinySwitched?'The numbers have switched':available?'A response can change the battle':skipped?'Takeel needs one destiny each':totalsApplied?'These numbers stand':'Draw, then respond';
 const detail=left?'This checkpoint ended before battle. Restart to try the response.':resolving?'1 Force paid. The destiny numbers stay unchanged until responses to Takeel finish.':battle.destinySwitched?'The destiny values traded places. Each drawn card stayed in its owner’s Used Pile. Takeel went to Lost.':available?'Use the response below to spend 1 Force and switch the numbers, or pass to keep them. This decision waits for you.':skipped?'A player drew no battle destiny, so Takeel cannot be played in this battle.':totalsApplied?'The response opportunity has closed. Battle losses now use these destiny values.':'Takeel can respond only after both players finish drawing exactly one battle destiny.';
 return <section className="proof-response-study" aria-labelledby="proof-response-title">
  <div className="proof-response-heading"><GitCompareArrows size={21}/><div><span className="eyebrow amber">TAKEEL / RESPONSE STUDY</span><h2 id="proof-response-title">{headline}</h2></div></div>
  <div className="proof-destiny-comparison">
   <div className="proof-destiny-labels"><span>Side</span><span>Drawn</span><span aria-hidden="true"/><span>Now</span></div>
   {(['light','dark'] as const).map(side=><div className={'proof-destiny-row '+side} key={side}><span>{sideName(side)}</span><b>{value(original[side])}</b><ArrowRight size={16}/><b className={battle.destinySwitched?'switched':''}>{value(battle.destiny[side])}</b></div>)}
  </div>
  <p>{detail}</p>
  {resolving&&<button className="proof-playing-card" onClick={()=>onInspect(resolving)} aria-label={'Inspect '+resolving.name+' while it resolves'}><img src={resolving.image} alt=""/><span><strong>{resolving.name}</strong><small>Lost Interrupt · awaiting responses</small></span><Clock3 size={18}/></button>}
  {battle.destinySwitched&&<div className="proof-response-result"><Check size={15}/>Switched before power and attrition are calculated</div>}
 </section>;
}

export function ResponseChoice({choice,game}:{choice:Choice;game:Projection}){
 return <><span className="proof-response-choice-title">{choice.label}<ArrowRight size={16}/></span><span className="proof-response-preview">{(['light','dark'] as const).map(side=><span key={side}>{sideName(side)} destiny <b>{value(game.battle!.destiny[side])}<ArrowRight size={13}/>{choice.destinyPreview![side]}</b></span>)}</span><span className="proof-response-choice-note">Force goes to Used. Takeel goes to Lost after resolving.</span></>;
}
