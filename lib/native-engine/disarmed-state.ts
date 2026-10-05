import {cardDefinition} from './definitions';
import {assertCardReference,referenceCard,sameCard,cardVersion,type CardReference} from './identity';
import type {Json,Match} from './types';
const statuses=(m:Match)=>(m.data.disarmedCharacters??[]) as unknown as CardReference[];
/** Disarmed is a result on this visit to the table. The disarming card's
 * continuous power/carrying restrictions are separate from this status. */
export const isDisarmed=(m:Match,id:string)=>statuses(m).some(ref=>ref.id===id&&sameCard(m,ref));
export function setDisarmed(m:Match,id:string,value:boolean):void{
 if(m.cards[id]?.zone!=='table'||cardDefinition(m,id).type!=='Character')throw Error('Disarmed status requires a character on table.');
 m.data.disarmedCharacters=[...statuses(m).filter(ref=>ref.id!==id&&sameCard(m,ref)),...(value?[referenceCard(m,id)]:[])] as unknown as Json;
}
export function clearDisarmed(m:Match,id:string):void{if(m.data.disarmedCharacters)m.data.disarmedCharacters=statuses(m).filter(ref=>ref.id!==id) as unknown as Json;}
export function assertDisarmed(m:Match):void{
 if(!Array.isArray(statuses(m)))throw Error('Invalid Disarmed status.');const seen=new Set<string>();
 for(const ref of statuses(m)){assertCardReference(m,ref);if(ref.zone!=='table'||(!['table','captive','inactive'].includes(m.cards[ref.id].zone)||cardVersion(m,ref.id)!==ref.version)||cardDefinition(m,ref.id).type!=='Character'||seen.has(ref.id))throw Error('Invalid Disarmed character.');seen.add(ref.id);}
}

export const disarmedView=(m:Match)=>({disarmed:Object.values(m.cards).filter(c=>isDisarmed(m,c.id)).map(c=>c.id)});
