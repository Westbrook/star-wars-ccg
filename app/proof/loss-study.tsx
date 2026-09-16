import {ShieldCheck} from 'lucide-react';
import type {Choice,Projection,PublicCard} from '@/lib/native-proof/types';
export function LossStudy({game,onInspect}:{game:Projection;onInspect:(c:PublicCard)=>void}){
 const study=game.lossStudy!;
 return <section className="proof-loss-study" aria-label="Loss management study">
  <span className="eyebrow amber">{study.kind==='rescue'?'SOMEONE TO BRING YOU HOME':'MAKE YOUR FORCE COUNT'}</span>
  <h2>{study.kind==='rescue'?'A hit is not the end.':'Use Force. Keep Life Force.'}</h2>
  <p>{study.kind==='rescue'?'During battle losses, Talz may forfeit to restore another hit character here. Talz can be hit too: its one forfeit satisfies both hits and pays 4 toward damage and attrition. The rescued character and its weapon stay.':study.kind==='drain'?'The drain has its result before you choose how to lose Force. It Could Be Worse moves X saved Force to Used and reduces the remaining loss by X. Those used cards stay in Life Force. Multiple copies do not add their reductions together.':'It Could Be Worse reduces battle damage only. Attrition still needs forfeits, and reducing damage never clears a weapon hit. You may reconsider after each card you lose.'}</p>
  <div className="proof-loss-study-totals">{study.kind==='rescue'?<span>Characters restored <b>{study.rescued.length}</b></span>:<><span>{study.kind==='drain'?'Force loss remaining':'Light damage remaining'} <b>{study.remaining}</b></span><span>Prevented this study <b>{study.reduced}</b></span></>}</div>
  {game.playing?.map(c=><button key={c.id} className="proof-playing-card" onClick={()=>onInspect(c)}><img src={c.image} alt=""/><span><strong>{c.name}</strong><small>Force paid · result awaits responses</small></span><ShieldCheck size={20}/></button>)}
 </section>;
}
export function ReductionChoice({choice}:{choice:Choice}){
 const p=choice.reductionPreview!;
 return <span className="proof-reduction-choice"><strong>{choice.label}</strong><span>Remaining loss <b>{p.remaining}</b> · attrition <b>{p.attrition}</b></span><small>{p.duplicate?'Another copy already modifies this loss. You still pay the cost; it adds no reduction.':'Cost goes to Used; the Interrupt joins it after resolving.'}</small></span>;
}
