import {definition,printed} from './catalog';
import type {Match,Side} from './types';

export const isDesertStudy=(s:string)=>['luke-arrives','luke-support','tusken-band'].includes(s);
export function activeCharacter(m:Match,id:string){
 const c=m.cards[id],b=m.battle;
 return c?.zone==='table'&&definition(c.blueprint).type==='Character'&&(!b||b.resolved||c.location!==b.site||b.participants[c.owner].includes(id));
}
export const desertCharacters=(side:Side)=>side==='light'?['101_2','1_28','1_26']:['1_196','1_194','1_170','1_181'];
export function desertDeployCost(m:Match,blueprint:string,site:string){
 if(blueprint==='101_2')return m.cards[site].blueprint==='1_132'?3:4;
 if(blueprint==='1_28'&&Object.values(m.cards).some(c=>c.owner==='light'&&c.blueprint==='101_2'&&c.location===site&&activeCharacter(m,c.id)))return 0;
 return printed(blueprint,'deploy');
}
export function desertCanDeploy(m:Match,blueprint:string,site:string){
 if(['101_2','1_196'].includes(blueprint)&&!definition(m.cards[site].blueprint).name.startsWith('Tatooine:'))return false;
 // Luke is the only Light unique persona in the closed character pool. The
 // opposing study has no unique characters; its two-unique restriction is inactive.
 return blueprint!=='101_2'||!Object.values(m.cards).some(c=>c.zone==='table'&&c.blueprint==='101_2');
}
export function tuskensAt(m:Match,site:string){return Object.values(m.cards).filter(c=>c.blueprint==='1_196'&&c.location===site&&activeCharacter(m,c.id)).length;}
export function desertPowerBonus(m:Match,id:string){const c=m.cards[id];return c.blueprint==='1_196'&&activeCharacter(m,id)&&c.location&&tuskensAt(m,c.location)>=2?1:0;}
export function groupPowerBonus(m:Match,side:Side,site:string){return isDesertStudy(m.scenario)&&side==='dark'&&tuskensAt(m,site)>=4?2:0;}
export function characterForfeit(m:Match,id:string){
 const c=m.cards[id],value=printed(c.blueprint,'forfeit');if(!isDesertStudy(m.scenario)||c.owner!=='light'||!definition(c.blueprint).icons.some(icon=>icon==='Warrior')||!activeCharacter(m,id))return value;
 const at=m.locations.indexOf(c.location!);
 return value+(Object.values(m.cards).some(l=>l.blueprint==='101_2'&&activeCharacter(m,l.id)&&Math.abs(m.locations.indexOf(l.location!)-at)<=1)?1:0);
}
