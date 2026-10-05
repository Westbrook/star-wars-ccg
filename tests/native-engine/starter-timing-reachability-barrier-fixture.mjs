import fs from 'node:fs';
import {runtime,state,rules,pull,location,force,phase,priority,step,prompt,seek} from './noble-fixture.mjs';
export {runtime,state,rules,step,prompt};
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Actual deployment -> Barrier -> battle, after a controlled initial board using exact starter counts.
export function fixture(extra=false){
 let m=runtime.createMatch('starter-barrier-reachability',60,manifest.decks.map(d=>({side:d.side,cards:d.main})),rules);
 const site=location(m,'light','1_129');location(m,'dark','1_284');
 const rebel=pull(m,'light','1_28','table',site),raider=pull(m,'dark','1_194','table',site),storm=pull(m,'dark','1_194','hand'),barrier=pull(m,'light','1_105','hand'),accident=pull(m,'light','1_80','hand'),gun=pull(m,'dark','1_317','table',site);m.cards[gun].attachedTo=raider;
 const second=extra?pull(m,'dark','1_194','table',site):undefined;
 force(m,'dark',10);force(m,'light',10);m=phase(m,'deploy');m=priority(m,'dark');
 const draw=Object.values(m.cards).find(c=>c.owner==='light'&&c.blueprint==='1_131'&&['reserve','force'].includes(c.zone));state.moveCard(m,draw.id,'reserve');
 m=step(m,'deploy:'+storm+':'+site);m=seek(m,x=>x.stack.at(-1)?.event?.kind==='deployed');m=priority(m,'light');m=step(m,'barrier:'+barrier+':'+storm);m=seek(m,x=>x.stack.length===1);m=phase(m,'battle');m=priority(m,'dark');m=step(m,'battle:'+site);m=priority(m,'light');return {m,site,rebel,raider,storm,barrier,accident,gun,second};
}
