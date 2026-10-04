import {hasPersona} from './persona';
import {cardDefinition} from './definitions';
import {canceledTexts, gameTextActive, textCancelers, suppressedGameText, assertTextSuppressions} from './game-text';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {openWindow, type RequiredAction} from './runtime';
import {other, type Json, type Match, type Resolution, type Window} from './types';
type Payload={target:CardReference;source?:CardReference;cancel:boolean};
export function gameTextAutomatic(m:Match,w:Window):RequiredAction[]{
  return Object.values(m.cards).filter(c=>c.zone==='table'&&!c.coveredBy&&!c.blownAway).flatMap(c=>{
    if(suppressedGameText(m,c.id))return [];
    const sources=textCancelers(m,c.id),active=gameTextActive(m,c.id),cancel=active&&sources.length>0;
    if(!cancel&&(active||sources.length))return [];
    const target=referenceCard(m,c.id),p:Payload={target,cancel,...(cancel?{source:referenceCard(m,sources[0])}:{})};
    return [{id:'game-text:'+c.id+':'+target.version+':'+(cancel?'cancel':'restore')+':'+(m.data.gameTextRevision??0),
      label:(cancel?'Cancel ':'Restore ')+cardDefinition(m,c.id).name+' game text',handler:'game-text:change',actor:cancel?m.cards[sources[0]].owner:c.owner,unrespondable:true,payload:p as unknown as Json}];
  });
}
export function gameTextResolve(m:Match,r:Resolution):void{
  const p=r.action.payload as unknown as Payload;if(r.cancelled||!sameCard(m,p.target))return;
  const refs=canceledTexts(m).filter(ref=>sameCard(m,ref)&&ref.id!==p.target.id);
  if(p.cancel)refs.push(p.target);m.data.gameTextRevision=Number(m.data.gameTextRevision??0)+1;m.data.canceledGameText=refs as unknown as Json;
  openWindow(m,'response',other(r.actor),{kind:p.cancel?'game-text-canceled':'game-text-restored',card:p.target.id,...(p.source?{source:p.source.id}:{})});
}
export function assertGameText(m:Match):void{
  assertTextSuppressions(m);
  if(m.data.gameTextRevision!==undefined&&(!Number.isSafeInteger(m.data.gameTextRevision)||Number(m.data.gameTextRevision)<0))throw Error('Invalid game text revision.');
  if(!Array.isArray(canceledTexts(m)))throw Error('Invalid canceled game text.');const seen=new Set<string>();
  for(const ref of canceledTexts(m)){assertCardReference(m,ref);const key=ref.id+':'+ref.version;if(ref.zone!=='table'||seen.has(key))throw Error('Invalid canceled text reference.');seen.add(key);}
  for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('game-text:')){
    const p=f.action.payload as unknown as Payload;if(!p||f.action.handler!=='game-text:change'||typeof p.cancel!=='boolean')throw Error('Invalid game text continuation.');
    assertCardReference(m,p.target);if(p.target.zone!=='table'||p.cancel!==!!p.source||!p.cancel&&m.cards[p.target.id].owner!==f.actor||p.cancel&&!(hasPersona(m,p.target.id,'C3PO')||hasPersona(m,p.target.id,'R2D2')))throw Error('Invalid game text target.');
    if(p.source){assertCardReference(m,p.source);if(p.source.zone!=='table'||m.cards[p.source.id].blueprint!=='1_167'||m.cards[p.source.id].owner!==f.actor)throw Error('Invalid text canceler.');}
  }
}
