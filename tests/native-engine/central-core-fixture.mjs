import {mod,pull,phase,step,seek,ids} from './prisoner-fixture.mjs';
import {siteFixture,siteDecks,capturedAtSite} from './site-capture-fixture.mjs';
export const coreDecks=()=>siteDecks().map(d=>d.side==='dark'?{...d,cards:[...d.cards.slice(0,8),'1_283','1_232','2_111','2_115',...d.cards.slice(8,-4)]}:d);
export function coreFixture(){const f=siteFixture(false,coreDecks());f.core=pull(f.m,'dark','1_283');f.m.locations.unshift(f.core);f.wrong=pull(f.m,'dark','1_232','hand');return f;}
export const coreChoice=m=>ids(m).find(id=>id.startsWith('central-core:cancel:'));
export function takeCore(f){let m=capturedAtSite(f);m=phase(m,'light','move');const hero=pull(m,'light','1_13','table',f.bay);m=step(m,'move:'+hero+':'+f.core);return seek(m,x=>!!coreChoice(x));}
