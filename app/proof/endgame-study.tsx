import {gameOverMessage} from './concede-game';
import type {Projection} from '@/lib/native-proof/types';
export function EndgameStudy({game}:{game:Projection}){
 const light=game.players.light;
 return <section className="proof-loss-study" aria-label="Final Life Force study"><span className="eyebrow amber">ONE CARD / EVERYTHING TO PLAY FOR</span><h2>{game.concededBy?'The game is conceded.':game.winner?'The Force is exhausted.':game.complete?'One card keeps you in the game.':'Choose what to protect.'}</h2><p>{game.concededBy?gameOverMessage(game):<>Cards in Reserve, Force and Used count as Life Force. Cards in hand do not. Losing the hand card pays this drain while preserving the last Life Force; losing the Reserve card ends the game, even with a card still in hand.</>}</p><div className="proof-loss-study-totals"><span>Light Life Force <b>{light.life}</b></span><span>Light hand <b>{light.counts.hand}</b></span><span>Reserve <b>{light.counts.reserve}</b></span></div>{game.winner&&<p role="status">{game.winner==='dark'?'Dark':'Light'} wins{game.concededBy?' by concession':''}. Further actions are closed; restart to compare another choice.</p>}</section>;
}
