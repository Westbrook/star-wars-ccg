import {Minus,ArrowRight,Check,Layers3,ShieldCheck} from 'lucide-react';
import type {Choice,LossBalance,Side} from '@/lib/native-proof/types';

export function BattleLosses({losses,seat,mandatoryHits=0}:{losses:Record<Side,LossBalance>;seat:Side;mandatoryHits?:number}){
 const current=losses[seat],opponent=seat==='dark'?'light':'dark',numericClear=current.attrition===0&&current.damage===0,clear=numericClear&&mandatoryHits===0;
 return <section className="proof-losses" aria-label={'Your losses — '+seat+' side'}>
  <div className="proof-losses-heading"><h3>Your losses</h3><span>{seat==='dark'?'Dark side':'Light side'}</span></div>
  <div className="proof-loss-counters">
   <LossCounter label="Attrition" remaining={current.attrition} initial={current.initialAttrition} explanation="Satisfy by forfeiting" tone="attrition"/>
   <LossCounter label="Battle damage" remaining={current.damage} initial={current.initialDamage} explanation="Forfeit or lose Force" tone="damage"/>
  </div>
  <div className={'proof-loss-guidance '+(clear?'cleared':'')}>
   {clear?<ShieldCheck size={18}/>:current.damage===0?<Check size={18}/>:<Layers3 size={18}/>}
   <p>{clear?'Your losses are clear.':numericClear?'Damage and attrition are cleared. Hit troopers still need to be forfeited.':current.damage===0?'No battle damage remains. You still need to forfeit for attrition.':current.attrition===0?'Attrition is clear. Satisfy the remaining battle damage by forfeiting or losing Force.':'Each card’s forfeit value reduces both totals at once.'}</p>
  </div>
  <div className="proof-opponent-losses"><span>{opponent==='dark'?'Dark':'Light'} side</span><span>Attrition <b>{losses[opponent].attrition}</b></span><span>Damage <b>{losses[opponent].damage}</b></span></div>
 </section>;
}
function LossCounter({label,remaining,initial,explanation,tone}:{label:string;remaining:number;initial:number;explanation:string;tone:string}){
 const clear=remaining===0;
 return <div className={'proof-loss-counter '+tone+(clear?' cleared':'')}>
  <h4>{label}</h4><div className="proof-loss-value"><strong>{remaining}</strong><span>{clear?<><Check size={13}/>{initial===0?'None incurred':'Cleared'}</>:'remaining'}</span></div>
  <div className="proof-loss-meter" aria-hidden="true"><i style={{width:(initial?Math.min(100,remaining/initial*100):0)+'%'}}/></div>
  <p>{explanation}</p><small>{initial} at battle result</small>
 </div>;
}
export function LossChoice({choice,balance,hit=false}:{choice:Choice;balance:LossBalance;hit?:boolean}){
 const preview=choice.lossPreview;if(!preview)return <>{choice.label}<ArrowRight size={15}/></>;
 const damageCovered=balance.damage>0&&preview.damage===0;
 const resolution=hit&&balance.attrition===0&&balance.damage===0?'Satisfies this weapon hit':preview.attrition===0&&preview.damage===0?(balance.attrition>0?(balance.damage>0?'Clears both totals':'Clears remaining attrition'):'Clears remaining battle damage'):damageCovered?'Clears damage · '+preview.attrition+' attrition remains':'';
 return <><span className="proof-loss-choice-title">{choice.label}<ArrowRight size={16}/></span><span className="proof-loss-choice-effect">{preview.kind==='forfeit'?'Forfeit value '+preview.value+' applies to both':'Lose 1 Force · damage only'}</span><span className="proof-loss-choice-preview"><span>Attrition <b>{balance.attrition}<ArrowRight size={12}/>{preview.attrition}</b></span><span>Damage <b>{balance.damage}<ArrowRight size={12}/>{preview.damage}</b></span></span>{resolution&&<span className="proof-loss-choice-covered"><Check size={13}/>{resolution}</span>}{preview.kind==='force'&&balance.attrition>0&&<span className="proof-loss-choice-warning"><Minus size={13}/>Attrition stays at {balance.attrition}</span>}</>;
}
