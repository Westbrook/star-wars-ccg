import {Minus,ArrowRight,Check,Layers3} from 'lucide-react';
import type {Choice,LossBalance,Side} from '@/lib/native-proof/types';

export function BattleLosses({losses,seat,mandatoryHits,battleComplete=false}:{losses:Record<Side,LossBalance>;seat:Side;mandatoryHits?:Record<Side,number>;battleComplete?:boolean}){
 return <section className="proof-losses proof-battle-losses" aria-label="Battle losses — both sides">
  <div className="proof-losses-heading"><h3>Battle losses</h3><span>{battleComplete?'Final totals':'Remaining'}</span></div>
  <div className="proof-battle-sides">{(['dark','light'] as const).map(side=>{
   const current=losses[side],hits=mandatoryHits?.[side]??0,numericClear=current.attrition===0&&current.damage===0,clear=numericClear&&hits===0;
   return <section key={side} className={'proof-loss-side '+side} aria-label={(side==='dark'?'Dark':'Light')+' side losses'}>
    <header><h4>{side==='dark'?'Dark side':'Light side'}</h4>{seat===side&&<span>Your losses</span>}</header>
    <div className="proof-loss-counters">
     <LossCounter label="Attrition" remaining={current.attrition} initial={current.initialAttrition} tone="attrition"/>
     <LossCounter label="Battle damage" remaining={current.damage} initial={current.initialDamage} tone="damage"/>
    </div>
    <p className={'proof-loss-side-status '+(clear?'cleared':'')}>{clear?<><Check size={13}/>Losses clear</>:<>{numericClear?'Totals cleared. ':current.damage===0?'No battle damage remains. ':''}{hits>0?`${hits} hit ${hits===1?'trooper':'troopers'} still to forfeit.`:current.damage===0?'Forfeit for remaining attrition.':current.attrition===0?'Forfeit or lose Force for remaining damage.':'Forfeit reduces both totals.'}</>}</p>
   </section>;
  })}</div>
  <div className="proof-loss-guidance"><Layers3 size={16}/><p>Each card’s forfeit value reduces both totals at once. Losing Force reduces only battle damage.</p></div>
 </section>;
}
function LossCounter({label,remaining,initial,tone}:{label:string;remaining:number;initial:number;tone:string}){
 const clear=remaining===0;
 return <div className={'proof-loss-counter '+tone+(clear?' cleared':'')}>
  <h4>{label}</h4><div className="proof-loss-value"><strong>{remaining}</strong><span>{clear?<><Check size={13}/>{initial===0?'None incurred':'Cleared'}</>:'remaining'}</span></div>
  <div className="proof-loss-meter" aria-hidden="true"><i style={{width:(initial?Math.min(100,remaining/initial*100):0)+'%'}}/></div>
  <small>{initial} at battle result</small>
 </div>;
}
export function LossChoice({choice,balance,hit=false}:{choice:Choice;balance:LossBalance;hit?:boolean}){
 const preview=choice.lossPreview;if(!preview)return <>{choice.label}<ArrowRight size={15}/></>;
 const damageCovered=balance.damage>0&&preview.damage===0;
 const resolution=hit&&balance.attrition===0&&balance.damage===0?'Satisfies this weapon hit':preview.attrition===0&&preview.damage===0?(balance.attrition>0?(balance.damage>0?'Clears both totals':'Clears remaining attrition'):'Clears remaining battle damage'):damageCovered?'Clears damage · '+preview.attrition+' attrition remains':'';
 return <><span className="proof-loss-choice-title">{choice.label}<ArrowRight size={16}/></span><span className="proof-loss-choice-effect">{preview.kind==='forfeit'?'Forfeit value '+preview.value+' applies to both':'Lose 1 Force · damage only'}</span><span className="proof-loss-choice-preview"><span>Attrition <b>{balance.attrition}<ArrowRight size={12}/>{preview.attrition}</b></span><span>Damage <b>{balance.damage}<ArrowRight size={12}/>{preview.damage}</b></span></span>{resolution&&<span className="proof-loss-choice-covered"><Check size={13}/>{resolution}</span>}{preview.kind==='force'&&balance.attrition>0&&<span className="proof-loss-choice-warning"><Minus size={13}/>Attrition stays at {balance.attrition}</span>}</>;
}
