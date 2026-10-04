import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {isModel} from './characteristics';
import type {Card,Match} from './types';

export type AboardRole='pilot'|'driver'|'passenger';
type VesselRule={pilots:number;drivers:number;passengers:number;shared:number;permanent:number;enclosed:boolean;world?:string};
/** Printed capacities; permanent personnel do not consume these additional slots. */
export const vesselRules:Record<string,VesselRule>={
 '1_147':{pilots:0,drivers:0,passengers:0,shared:1,permanent:1,enclosed:true},
 '1_305':{pilots:0,drivers:0,passengers:1,shared:1,permanent:1,enclosed:true},
 '1_150':{pilots:0,drivers:1,passengers:7,shared:0,permanent:0,enclosed:true,world:'Tatooine'},
 '1_309':{pilots:0,drivers:1,passengers:7,shared:0,permanent:0,enclosed:true,world:'Tatooine'},
};
export const vesselRule=(m:Match,id:string)=>vesselRules[m.cards[id]?.blueprint];
export const isVessel=(m:Match,id:string)=>!!m.cards[id]&&['Starship','Vehicle'].includes(cardDefinition(m,id).type);
export const occupants=(m:Match,host:string)=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.attachedTo===host&&!!c.aboardRole);
export const landed=(m:Match,id:string)=>isVessel(m,id)&&!!m.cards[id].location&&cardDefinition(m,id).type==='Starship'&&cardDefinition(m,m.cards[id].location!).subType==='Site';
export const permanentAbility=(m:Match,id:string)=>gameTextActive(m,id)?vesselRule(m,id)?.permanent??0:0;
export const operational=(m:Match,id:string)=>!!vesselRule(m,id)&&!landed(m,id)&&(permanentAbility(m,id)>0||occupants(m,id).some(c=>c.aboardRole==='pilot'||c.aboardRole==='driver'));
export const enclosedOccupant=(m:Match,id:string)=>!!m.cards[id]?.aboardRole&&!!vesselRule(m,m.cards[id].attachedTo!)?.enclosed;
export const characterPresent=(m:Match,id:string)=>cardDefinition(m,id).type==='Character'&&!enclosedOccupant(m,id)&&(!m.cards[id].attachedTo||!!m.cards[id].aboardRole);
export const unitsAt=(m:Match,location:string):Card[]=>Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===location&&!c.coveredBy&&(cardDefinition(m,c.id).type==='Character'&&(!c.attachedTo||!!c.aboardRole)||isVessel(m,c.id)&&!c.attachedTo));
export function canDrive(m:Match,id:string):boolean {
 const d=cardDefinition(m,id);return d.type==='Character'&&(d.subType!=='Droid'||['VEHICLE','BATTLE','PROTOCOL'].some(model=>isModel(m,id,model))||(d.icons as string[]).some(i=>i==='Pilot'||i==='Warrior'));
}
export function capacityFits(m:Match,host:string,crew:{id:string;role:AboardRole}[]):boolean {
 const r=vesselRule(m,host);if(!r)return false;
 const n={pilot:0,driver:0,passenger:0};
 for(const c of crew){if(!['pilot','driver','passenger'].includes(c.role)||cardDefinition(m,c.id).type!=='Character')return false;if(c.role==='pilot'&&!(cardDefinition(m,c.id).icons as string[]).includes('Pilot')||c.role==='driver'&&!canDrive(m,c.id))return false;n[c.role]++;}
 return n.driver<=r.drivers&&Math.max(0,n.pilot-r.pilots)+Math.max(0,n.passenger-r.passengers)<=r.shared;
}
export function roleAvailable(m:Match,host:string,id:string,role:AboardRole):boolean {
 return capacityFits(m,host,[...occupants(m,host).filter(c=>c.id!==id).map(c=>({id:c.id,role:c.aboardRole!})),{id,role}]);
}
const pilotBonuses:Record<string,number>={'1_11':2,'5_5':2,'1_4':3,'1_172':2,'1_19':3,'3_3':3,'5_99':2,'4_1':2,'9_24':2,'1_168':3,'1_167':2,'1_179':2};
export function vesselPower(m:Match,id:string):number {
 if(!operational(m,id))return 0;
 return Number((cardDefinition(m,id).stats as Record<string,string>).power)+occupants(m,id).filter(c=>c.aboardRole==='pilot'&&gameTextActive(m,c.id)).reduce((n,c)=>n+(pilotBonuses[c.blueprint]??0),0);
}
export function assertOccupancy(m:Match):void {
 for(const c of Object.values(m.cards)){
  if(c.aboardRole!==undefined&&(!['pilot','driver','passenger'].includes(c.aboardRole)||c.zone!=='table'||!c.attachedTo||!vesselRule(m,c.attachedTo)||m.cards[c.attachedTo].owner!==c.owner||c.location!==m.cards[c.attachedTo].location||cardDefinition(m,c.id).type!=='Character'))throw Error('Invalid aboard capacity role.');
  if(c.zone==='table'&&cardDefinition(m,c.id).type==='Character'&&c.attachedTo&&isVessel(m,c.attachedTo)&&!c.aboardRole)throw Error('Aboard character needs a capacity role.');
  if(c.zone==='table'&&vesselRule(m,c.id)){
   if(!c.location||!m.locations.includes(c.location)||c.attachedTo)throw Error('Vessel needs an active location.');
   const d=cardDefinition(m,c.location);if(cardDefinition(m,c.id).type==='Vehicle'?(d.subType!=='Site'||!(d.icons as string[]).includes('Exterior')):!(d.subType==='System'||d.subType==='Site'&&(d.icons as string[]).includes('Exterior')))throw Error('Invalid vessel location.');
   if(!capacityFits(m,c.id,occupants(m,c.id).map(x=>({id:x.id,role:x.aboardRole!}))))throw Error('Vessel capacity exceeded.');
  }
 }
}
export function occupancyView(m:Match){return {vessels:Object.fromEntries(Object.values(m.cards).filter(c=>c.zone==='table'&&vesselRule(m,c.id)).map(c=>[c.id,{operational:operational(m,c.id),landed:landed(m,c.id),permanent:permanentAbility(m,c.id),capacity:vesselRule(m,c.id),crew:occupants(m,c.id).map(x=>({id:x.id,role:x.aboardRole!}))}]))};}
