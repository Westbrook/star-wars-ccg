import {ArrowDown,Check,Eye,TriangleAlert} from 'lucide-react';
import type {RecirculationStudy as Study,Side,StudyPiles} from '@/lib/native-proof/types';

export function RecirculationStudy({study,revision}:{study:Study;revision:number}){
 function player(side:Side){
  const p=study.players[side],name=side==='dark'?'Dark side':'Light side';
  function rows(ids:string[],offset=0){return ids.map((id,i)=>{
   const card=study.cards[id],marker=p.before.used.indexOf(id);
   return <li key={id} className={marker>=0?'tracked':''}>
    <span className="proof-order-position">{offset+i+1}</span>
    {marker>=0&&<b className="proof-order-marker">{String.fromCharCode(65+marker)}</b>}
    <img src={card.image} alt="" loading="lazy"/>
    <span>{card.name}<small>{id.toUpperCase()}</small></span>
   </li>;
  })}
  function pile(title:string,ids:string[],reserve=false){
   const original=reserve?ids.slice(0,p.before.reserve.length):[];
   const tail=reserve?ids.slice(p.before.reserve.length):ids;
   return <section className="proof-order-pile" aria-label={title+' in order'}>
    <h5>{title}<span>{ids.length} {ids.length===1?'card':'cards'}</span></h5>
    {ids.length?<>
     <div className="proof-order-direction"><span>TOP</span><ArrowDown size={12}/></div>
     {reserve&&<details className="proof-order-reserve"><summary>First {original.length} cards <span>Inspect order</span></summary><ol>{rows(original)}</ol></details>}
     {tail.length>0&&<ol className="proof-order-cards" start={reserve?original.length+1:1}>{rows(tail,reserve?original.length:0)}</ol>}
     <div className="proof-order-bottom">BOTTOM</div>
    </>:<p className="proof-order-empty">Empty</p>}
   </section>;
  }
  function snapshot(piles:StudyPiles,current=false){return <div className={'proof-order-snapshot'+(current?' current':'')}>
   <h4>{current?p.resolved?'After recirculation':'Current saved piles':'Starting fixture'}</h4>
   <p>{current?'Saved choice '+revision:'Before either player recirculates'}</p>
   {pile('Reserve Deck',piles.reserve,true)}
   {pile('Used Pile',piles.used)}
   {pile('Force Pile',piles.force)}
  </div>}
  const passed=p.orderPreserved&&p.forceUnchanged;
  return <article key={side} className={'proof-order-player '+side}>
   <header><h3>{name}</h3><span className={p.resolved?passed?'passed':'mismatch':'pending'}>{p.resolved?passed?<><Check size={15}/>Order preserved</>:<><TriangleAlert size={15}/>Order mismatch</>:<>Awaiting recirculation</>}</span></header>
   <div className="proof-order-comparison">{snapshot(p.before)}{snapshot(p.current,true)}</div>
   <div className="proof-order-verdict" aria-live="polite">
    <p>{p.resolved?p.orderPreserved?'A is still above B, now beneath the original Reserve Deck.':'The saved Reserve or Used order differs from the expected result.':'Track A above B in Used, then resolve recirculation.'}</p>
    <span className={p.reserveUnchanged?'passed':'mismatch'}>{p.reserveUnchanged?'Original Reserve order unchanged':'Original Reserve order changed'}</span>
    <span className={p.forceUnchanged?'passed':'mismatch'}>{p.forceUnchanged?'Force stays in place':'Force Pile changed'}</span>
   </div>
  </article>;
 }
 return <section className="proof-order-study" aria-labelledby="proof-order-title">
  <div className="proof-order-intro"><span className="eyebrow amber"><Eye size={14}/>TWO-SEAT STUDY</span><h2 id="proof-order-title">Follow the same two cards.</h2><p>Piles read top to bottom. A and B mark the same physical cards in both views. Hidden pile identities are revealed here for study only.</p></div>
  {(['dark','light'] as const).map(player)}
 </section>;
}
