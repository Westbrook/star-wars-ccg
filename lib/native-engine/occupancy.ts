import {vesselStatBonus,ionizedShip} from './stat-modifiers';
import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {battleMembers} from './participation';
import {pilotPowerBonus,vesselArmor,vesselManeuver,aboardStarfighterBonus,vesselHyperspeed,hasNavigation} from './piloting';
import {isModel} from './characteristics';
import type {Card,Match} from './types';

export type AboardRole='pilot'|'driver'|'passenger'|'vehicle'|'starship';
type VesselRule={pilots:number;drivers:number;passengers:number;shared:number;permanent:number;enclosed:boolean;world?:string;vehicles?:number;starships?:number;astromechs?:number;tiesOnly?:boolean};
/** Printed capacities; permanent personnel do not consume these additional slots. */
export const vesselRules:Record<string,VesselRule>={
 '1_149':{pilots:0,drivers:1,passengers:2,shared:0,permanent:0,enclosed:false},
 '1_151':{pilots:0,drivers:1,passengers:3,shared:0,permanent:0,enclosed:true},
 '1_310':{pilots:0,drivers:1,passengers:2,shared:0,permanent:0,enclosed:true},
 '1_142':{pilots:0,drivers:0,passengers:0,shared:2,permanent:0,enclosed:true,astromechs:1},
 '1_145':{pilots:1,drivers:0,passengers:0,shared:0,permanent:0,enclosed:true,astromechs:1},
 '2_71':{pilots:1,drivers:0,passengers:0,shared:0,permanent:0,enclosed:true,astromechs:1},
 '1_144':{pilots:1,drivers:0,passengers:0,shared:0,permanent:0,enclosed:true},
 '1_141':{pilots:0,drivers:0,passengers:0,shared:2,permanent:0,enclosed:true},
 '1_300':{pilots:1,drivers:0,passengers:0,shared:0,permanent:0,enclosed:true},
 '1_140':{pilots:3,drivers:0,passengers:4,shared:0,permanent:1,enclosed:true,vehicles:1},
 '1_302':{pilots:6,drivers:0,passengers:8,shared:0,permanent:1,enclosed:true,vehicles:2,starships:4,tiesOnly:true},
 '1_147':{pilots:0,drivers:0,passengers:0,shared:1,permanent:1,enclosed:true},
 '1_305':{pilots:0,drivers:0,passengers:1,shared:1,permanent:1,enclosed:true},
 '1_150':{pilots:0,drivers:1,passengers:7,shared:0,permanent:0,enclosed:true,world:'Tatooine'},
 '1_309':{pilots:0,drivers:1,passengers:7,shared:0,permanent:0,enclosed:true,world:'Tatooine'},
};
export const vesselRule=(m:Match,id:string)=>vesselRules[m.cards[id]?.blueprint];
export const isVessel=(m:Match,id:string)=>!!m.cards[id]&&['Starship','Vehicle'].includes(cardDefinition(m,id).type);
export const occupants=(m:Match,host:string)=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.attachedTo===host&&!!c.aboardRole);
export const inCargo=(m:Match,id:string)=>['vehicle','starship'].includes(m.cards[id]?.aboardRole??'');
export const capital=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).type==='Starship'&&cardDefinition(m,id).subType.startsWith('Capital:');
export function belowDecks(m:Match,id:string):boolean{const seen=new Set<string>();let c=m.cards[id],cargo=false;while(c){if(seen.has(c.id))throw Error('Cyclic occupancy.');seen.add(c.id);if(inCargo(m,c.id))cargo=true;c=m.cards[c.attachedTo!];}return cargo;}
export const landed=(m:Match,id:string)=>isVessel(m,id)&&(inCargo(m,id)||!!m.cards[id].location&&cardDefinition(m,id).type==='Starship'&&cardDefinition(m,m.cards[id].location!).subType==='Site');
export const permanentAbility=(m:Match,id:string)=>gameTextActive(m,id)?vesselRule(m,id)?.permanent??0:0;
/** Excluded crew retain their seats but are inactive until the battle ends. */
export function crewActive(m:Match,id:string):boolean {
 const c=m.cards[id];if(!c||c.zone!=='table')return false;
 const b=m.data.battle as {site:string;stage:string}|undefined;
 return !b||b.stage==='begin'||b.stage==='complete'||b.site!==c.location||battleMembers(m,c.owner).includes(id);
}
export const permanentPilot=(m:Match,id:string)=>!!vesselRule(m,id)&&(cardDefinition(m,id).icons as string[]).includes('Pilot');
export const pilotAboard=(m:Match,id:string)=>permanentPilot(m,id)||occupants(m,id).some(c=>c.aboardRole==='pilot'&&crewActive(m,c.id));
export const operational=(m:Match,id:string)=>!!vesselRule(m,id)&&!landed(m,id)&&(pilotAboard(m,id)||occupants(m,id).some(c=>c.aboardRole==='driver'&&crewActive(m,c.id)));
export const enclosedOccupant=(m:Match,id:string)=>!!m.cards[id]?.aboardRole&&!!vesselRule(m,m.cards[id].attachedTo!)?.enclosed;
export const characterPresent=(m:Match,id:string)=>cardDefinition(m,id).type==='Character'&&!belowDecks(m,id)&&!enclosedOccupant(m,id)&&(!m.cards[id].attachedTo||!!m.cards[id].aboardRole);
export const unitsAt=(m:Match,location:string):Card[]=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===location&&!c.coveredBy&&(cardDefinition(m,c.id).type==='Character'&&!belowDecks(m,c.id)&&(!c.attachedTo||!!c.aboardRole)||isVessel(m,c.id)&&(!c.attachedTo||inCargo(m,c.id))));
export function canDrive(m:Match,id:string):boolean {
 const d=cardDefinition(m,id);return d.type==='Character'&&(d.subType!=='Droid'||['VEHICLE','BATTLE','PROTOCOL'].some(model=>isModel(m,id,model))||(d.icons as string[]).some(i=>i==='Pilot'||i==='Warrior'));
}
export function capacityFits(m:Match,host:string,crew:{id:string;role:AboardRole}[]):boolean {
 const r=vesselRule(m,host);if(!r)return false;
 const n={pilot:0,driver:0,passenger:0,vehicle:0,starship:0};
 for(const c of crew){
  if(!['pilot','driver','passenger','vehicle','starship'].includes(c.role))return false;
  const d=cardDefinition(m,c.id);
  if(c.role==='vehicle'){if(d.type!=='Vehicle')return false;}
  else if(c.role==='starship'){if(d.type!=='Starship'||!d.subType.startsWith('Starfighter:')||r.tiesOnly&&!['1_305','1_300'].includes(m.cards[c.id].blueprint))return false;}
  else if(d.type!=='Character'||c.role==='pilot'&&!(d.icons as string[]).includes('Pilot')||c.role==='driver'&&!canDrive(m,c.id))return false;
  n[c.role]++;
 }
 // Astromechs are passengers; reserved slots are allocated before ordinary capacity.
 const reserved=Math.min(r.astromechs??0,crew.filter(c=>c.role==='passenger'&&isModel(m,c.id,'ASTROMECH')).length);
 n.passenger-=reserved;
 return n.vehicle<=(r.vehicles??0)&&n.starship<=(r.starships??0)&&n.driver<=r.drivers&&Math.max(0,n.pilot-r.pilots)+Math.max(0,n.passenger-r.passengers)<=r.shared;
}
export function roleAvailable(m:Match,host:string,id:string,role:AboardRole):boolean {
 return capacityFits(m,host,[...occupants(m,host).filter(c=>c.id!==id).map(c=>({id:c.id,role:c.aboardRole!})),{id,role}]);
}
export function vesselPower(m:Match,id:string):number {
 if(!operational(m,id))return 0;
 return Math.max(0,Number((cardDefinition(m,id).stats as Record<string,string>).power)+vesselStatBonus(m,id,'power')+aboardStarfighterBonus(m,id)+occupants(m,id).reduce((n,c)=>n+pilotPowerBonus(m,c.id),0));
}
export function assertOccupancy(m:Match):void {
 for(const c of Object.values(m.cards)){
  if(c.aboardRole!==undefined&&(!['pilot','driver','passenger','vehicle','starship'].includes(c.aboardRole)||c.zone!=='table'||!c.attachedTo||!vesselRule(m,c.attachedTo)||m.cards[c.attachedTo].zone!=='table'||m.cards[c.attachedTo].owner!==c.owner||c.location!==m.cards[c.attachedTo].location))throw Error('Invalid aboard capacity role.');
  if(c.zone==='table'&&cardDefinition(m,c.id).type==='Character'&&c.attachedTo&&isVessel(m,c.attachedTo)&&!c.aboardRole)throw Error('Aboard character needs a capacity role.');
  if(c.zone==='table'&&vesselRule(m,c.id)){
   if(!c.location||!m.locations.includes(c.location))throw Error('Vessel needs an active location.');
   if(c.attachedTo&&!inCargo(m,c.id))throw Error('Vessel needs cargo capacity.');
   belowDecks(m,c.id);if(capital(m,c.id)&&cardDefinition(m,c.location).subType!=='System')throw Error('Capital ship needs a system.');const d=cardDefinition(m,c.location);if(!inCargo(m,c.id)&&(cardDefinition(m,c.id).type==='Vehicle'?(d.subType!=='Site'||!(d.icons as string[]).includes('Exterior')):!(d.subType==='System'||d.subType==='Site'&&(d.icons as string[]).includes('Exterior'))))throw Error('Invalid vessel location.');
   if(!capacityFits(m,c.id,occupants(m,c.id).map(x=>({id:x.id,role:x.aboardRole!}))))throw Error('Vessel capacity exceeded.');
  }
 }
}
export function occupancyView(m:Match){return {vessels:Object.fromEntries(Object.values(m.cards).filter(c=>c.zone==='table'&&vesselRule(m,c.id)).map(c=>[c.id,{ionized:ionizedShip(m,c.id),operational:operational(m,c.id),landed:landed(m,c.id),permanent:permanentAbility(m,c.id),permanentPilot:permanentPilot(m,c.id),power:vesselPower(m,c.id),armor:vesselArmor(m,c.id),maneuver:vesselManeuver(m,c.id),hyperspeed:vesselHyperspeed(m,c.id),navigation:hasNavigation(m,c.id),capacity:vesselRule(m,c.id),exposed:!vesselRule(m,c.id)?.enclosed&&!belowDecks(m,c.id),crew:occupants(m,c.id).map(x=>({id:x.id,role:x.aboardRole!,active:crewActive(m,x.id)}))}]))};}
