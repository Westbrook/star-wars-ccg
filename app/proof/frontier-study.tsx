import type {Projection,Side} from '@/lib/native-proof/types';
import {isFrontierStudy} from '@/lib/native-proof/frontier-rules';

export function FrontierStudy({game}:{game:Projection}){
 if(!isFrontierStudy(game.scenario))return null;
 const battle=game.battle,active=!!battle&&!battle.resolved;
 const dune=active&&game.locations.find(c=>c.id===battle.site)?.blueprint==='1_130';
 const ability=(side:Side)=>game.table.filter(c=>c.type==='Character'&&c.side===side&&battle?.participants[side].includes(c.id)).reduce((sum,c)=>sum+Number(c.stats.ability||0),0);
 return <div className="proof-frontier-study">
  <span className="eyebrow amber">THE PRICE OF REINFORCEMENTS</span>
  <p>A Jawa normally uses <strong>1 Force from each player</strong>. At Jawa Camp, Light’s Jawas use <strong>only 1 Light Force</strong>. Dark’s Jawas still require both players to pay.</p>
  <div className="proof-frontier-force" aria-label="Force available for deployment">{(['dark','light'] as const).map(side=><span key={side}>{side==='dark'?'Dark':'Light'} Force <b>{game.players[side].counts.force}</b></span>)}</div>
  {active&&<div className="proof-frontier-destiny" aria-label="Participating ability and battle destiny">{(['dark','light'] as const).map(side=>{const required=side==='dark'&&dune?6:4,total=ability(side);return <div key={side}><strong>{side==='dark'?'Dark':'Light'} ability {total} / {required}</strong><span>{game.losses?(battle.destiny[side]===null?'No battle destiny drawn':'Battle destiny drawn: '+battle.destiny[side]):total>=required?'Ability requirement met':'Not enough ability for battle destiny'}</span></div>})}<small>Only participating characters count. Dark needs 6 at the Dune Sea; elsewhere the normal requirement is 4.</small></div>}
  {game.scenario==='desert-patrol'&&<p className="proof-frontier-scope">This recorded late-game board has only supported ground cards left to draw. Other cards are already in Lost. Play two turns, then stop before Dark’s next activation.</p>}
 </div>;
}
