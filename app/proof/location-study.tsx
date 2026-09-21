import type {Projection,PublicCard} from '@/lib/native-proof/types';

export function LocationStudy({game,onInspect}:{game:Projection;onInspect:(card:PublicCard)=>void}){
 const study=game.locationStudy;if(!study)return null;
 return <section className="proof-location-study" aria-label="Changing locations and transit">
  <span className="eyebrow amber">A LIVING BATTLEFRONT</span>
  <p>Place sites, keep their printed costs in view, and carry the same board into the next turn.</p>
  <div className="proof-location-metrics"><span>Next Dark generation <b>{study.generation.dark}</b></span><span>Next Light generation <b>{study.generation.light}</b></span><span>Saved reshuffles <b>{study.shuffles}</b></span></div>
  <small>Generation includes personal Force. A newly deployed location changes the next count; it does not add activation to the current turn.</small>
  {study.covered.length>0&&<details><summary>{study.covered.length} covered location{study.covered.length===1?'':'s'} · supporting cards</summary><p>The top card supplies the text and icons. Characters stay at the location when it converts.</p>{study.covered.map(c=><button className="text-button" key={c.id} onClick={()=>onInspect(c)}>{c.name} · {c.side} · {c.id.toUpperCase()}</button>)}</details>}
  {game.scenario==='control-room'&&<p className="proof-turn-note">Dark must control the Room to search during Deploy. Successful searches may repeat. A failed search reveals the Reserve cards for verification, then prevents this search for the rest of the turn.{study.failedSearch?' The search is currently unavailable.':''}</p>}
  {study.selected.length>0&&<p className="proof-transit-party">Traveling party <strong>{study.selected.map(id=>id.toUpperCase()).join(' · ')}</strong><small>Selection is saved. Confirm to pay once and move everyone together.</small></p>}
  {study.searchCards&&<details className="proof-search-cards" open><summary>Reserve inspection · {study.searchCards.length} cards</summary><p>Card identities are shown without revealing pile order. Choose a legal bay in the decision panel.</p><div>{study.searchCards.map(c=><button key={c.id} onClick={()=>onInspect(c)}><span>{c.name}</span><small>{c.id.toUpperCase()}</small></button>)}</div></details>}
 </section>;
}
