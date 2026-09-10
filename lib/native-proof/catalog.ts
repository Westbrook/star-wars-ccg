import manifest from '../../data/native-proof/manifest.json';
import type {Side} from './types';
export {manifest};
export const definitions = new Map(manifest.cards.map(c => [c.gempId,c]));
export function definition(id:string){const c=definitions.get(id);if(!c)throw new Error('Unsupported card identity.');return c;}
export function printed(id:string,key:string){const raw=(definition(id).stats as Record<string,string>)[key];const n=Number(raw);if(raw===undefined||!Number.isFinite(n))throw new Error('This printed value needs an explicit rules handler.');return n;}
export const other=(side:Side):Side=>side==='light'?'dark':'light';
export const sites:Record<string,Record<Side,number>>={'1_124':{light:1,dark:1},'1_129':{light:1,dark:1}};
export const scenarios = [
 {id:'activation' as const,title:'The flow of the Force',subtitle:'Activation & priority',description:'Activate one Force at a time. Each action returns priority before another card can move.',rules:['Personal Force + location icons','Optional activation','Response and action opportunities'],phase:'Activate'},
 {id:'drain' as const,title:'Hold the docking bay',subtitle:'Control & Force loss',description:'A Stormtrooper controls the site. Resolve its drain, choose where to lose Force, and retain every decision after reload.',rules:['Presence and control','Opponent Force icons','Choice of Force-loss source'],phase:'Control'},
 {id:'battle' as const,title:'Crossfire at Docking Bay 327',subtitle:'Battle destiny & attrition',description:'Four troopers on each side. Initiate a battle, choose whether to draw destiny, then resolve attrition and battle damage.',rules:['One Force to initiate','Four ability for one destiny','Forfeit satisfies damage and attrition'],phase:'Battle'},
 {id:'recirculation' as const,title:'The Force returns',subtitle:'Both players recirculate',description:'Resolve the end-of-turn recirculation checkpoint. Used cards return beneath Reserve in order; unspent Force stays put.',rules:['Both players recirculate','Pile order preserved','Force pile retained'],phase:'End of turn'},
 {id:'takeel' as const,title:'A turn of destiny',subtitle:'Takeel & response timing',description:'A familiar battle, with Takeel in Dark’s hand. After both players draw one destiny, spend 1 Force to switch the numbers—or let them stand.',rules:['Optional Interrupt response','Pay cost before resolving','Destiny numbers switch; cards stay put'],phase:'Battle'},
];
