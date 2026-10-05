import {cardDefinition} from './definitions';
import {sitePlacements,name,system} from './board';
import {forceIcons} from './location-icons';
import {moveCard} from './state';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {registerObjective,completeObjective,objectiveRecord,assertObjectives} from './objectives';
import type {ObjectiveSetupRules} from './setup';
import type {Match,Json} from './types';

type SetupRecord={source:CardReference;step:'location'|'done';deployed:CardReference[];failed?:true};
const records=(m:Match)=>(m.data.objectiveSetup??[]) as unknown as SetupRecord[];
const record=(m:Match,id:string)=>records(m).find(p=>p.source.id===id);
const options=(m:Match,id:string)=>m.players[m.cards[id].owner].reserve.filter(card=>cardDefinition(m,card).type==='Location'&&system(m,card)==='Coruscant'&&cardDefinition(m,card).status!=='metadata-only').flatMap(card=>sitePlacements(m,card).map(placement=>({id:'objective-deploy:'+card+':'+placement.id,card,placement,label:'Deploy '+name(m,card)+' · '+placement.label,forceIcons:{dark:forceIcons(m,card,'dark'),light:forceIcons(m,card,'light')}})));
export const isObjectiveCard=(m:Match,id:string)=>m.cards[id]?.blueprint==='7_299';
/** Setup actions occur before starting Interrupts and opening hands. They are
 * serialized choices, not ordinary Deploy-phase card plays or optional searches. */
export const objectiveSetupRules:ObjectiveSetupRules={
 isObjective:isObjectiveCard,
 begin(m,id){
  if(!isObjectiveCard(m,id)||m.cards[id].zone!=='reserve'||record(m,id))throw Error('Invalid starting Objective.');
  moveCard(m,id,'table');registerObjective(m,id);m.data.objectiveSetup=[...records(m),{source:referenceCard(m,id),step:'location',deployed:[]}] as unknown as Json;
 },
 choices(m,id){
  const p=record(m,id);if(!p||p.step!=='location')return [];
  const choices=options(m,id);return choices.length?choices.map(({id,card,label,forceIcons})=>({id,card,label,forceIcons})):[{id:'objective-fail',label:'Cannot deploy the required Coruscant location · place Objective out of play'}];
 },
 apply(m,id,choice){
  const p=record(m,id);if(!p||p.step!=='location')throw Error('Objective setup is not waiting for deployment.');
  const available=options(m,id);
  if(choice==='objective-fail'){
   if(available.length)throw Error('A mandatory Objective deployment is available.');
   // ISB has one required deployment, so an unsuccessful sequence has no
   // previously deployed cards to undo. Later multi-card providers must retain
   // their own exact rollback journal rather than losing or redrawing cards.
   moveCard(m,id,'out');p.failed=true;p.step='done';completeObjective(m,id,true);return;
  }
  const selected=available.find(x=>x.id===choice);if(!selected)throw Error('Invalid Objective location deployment.');
  const {card,placement}=selected;moveCard(m,card,'table');
  if(placement.replace){
   const old=placement.replace;m.cards[old].coveredBy=card;m.locations[m.locations.indexOf(old)]=card;
   for(const c of Object.values(m.cards)){if(c.location===old)c.location=card;if(c.attachedTo===old)c.attachedTo=card;if(c.coveredBy===old)c.coveredBy=card;}
  }else m.locations.splice(placement.index!,0,card);
  p.deployed.push(referenceCard(m,card));p.step='done';completeObjective(m,id);
 },
 complete:(m,id)=>record(m,id)?.step==='done',
 validate(m){
  for(const c of Object.values(m.cards))if(c.blueprint==='7_299_BACK'||cardDefinition(m,c.id).type==='Objective'&&!isObjectiveCard(m,c.id))throw Error('An Objective must use its implemented physical front in the deck.');
  if(m.data.objectiveSetup!==undefined&&!Array.isArray(m.data.objectiveSetup))throw Error('Invalid Objective setup journal.');
  const seen=new Set<string>();
  for(const p of records(m)){
   assertCardReference(m,p.source);const r=objectiveRecord(m,p.source.id);
   if(!r||seen.has(p.source.id)||p.source.zone!=='table'||!isObjectiveCard(m,p.source.id)||!['location','done'].includes(p.step)||!Array.isArray(p.deployed)||p.deployed.length>1||p.failed!==undefined&&p.failed!==true||p.failed&&p.deployed.length||p.step==='location'&&(p.deployed.length||r.complete||r.failed)||p.step==='done'&&(!p.failed&&!p.deployed.length||p.failed!==r.failed||!p.failed&&!r.complete))throw Error('Invalid Objective setup journal.');
   seen.add(p.source.id);
   for(const ref of p.deployed){assertCardReference(m,ref);if(ref.zone!=='table'||cardDefinition(m,ref.id).type!=='Location'||system(m,ref.id)!=='Coruscant'||m.cards[ref.id].owner!==r.side)throw Error('Invalid Objective starting deployment.');}
   if(m.status==='setup'&&(p.step==='location'&&m.cards[p.source.id].zone!=='table'||p.failed&&m.cards[p.source.id].zone!=='out'))throw Error('Invalid Objective setup result.');
  }
  if(m.status==='setup'&&records(m).length){
   const allowed=new Set([...(Object.values(m.setup?.selected??{}).filter((id):id is string=>!!id)),...(m.setup?.additional??[]),...records(m).flatMap(p=>p.deployed.map(r=>r.id))]);
   for(const p of records(m))if(!p.failed&&(!sameCard(m,p.source)||p.deployed.some(ref=>!sameCard(m,ref))))throw Error('Objective setup changed a required card instance.');
   // Starting Interrupt providers own subsequent deployments and ordinary play
   // begins only after the opening hands have been completed.
   if(!m.setup?.interrupts)for(const c of Object.values(m.cards))if(['table','out'].includes(c.zone)&&!allowed.has(c.id)||!['table','out','reserve','hand'].includes(c.zone)||c.location||c.attachedTo)throw Error('Unrelated card entered Objective setup.');
  }
  assertObjectives(m);
 }
};
