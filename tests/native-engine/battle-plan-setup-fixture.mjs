import {decks as previous,runtime,rules,prompt,step,advance} from './resistance-setup-fixture.mjs';
export {runtime,rules,prompt,step,advance};
export const decks=(options={})=>previous(options).map(d=>({...d,cards:[...d.cards.slice(0,6),...Array(options.effects===false?0:2).fill(d.side==='light'?'8_35':'8_118'),...d.cards.slice(6)].slice(0,options.size??60)}));
export function ready(options={}){let m=runtime.createMatch('three-starting-effects',options.size??60,decks(options),rules);for(const s of ['dark','light'])m=step(m,'select:'+s+'-1',s);m=step(m,'reveal','dark');let p=prompt(m);m=step(m,p.choices[0].id,p.side);for(const s of ['dark','light'])m=step(m,'starting-select:'+s+'-2',s);return step(m,'starting-reveal','dark');}
