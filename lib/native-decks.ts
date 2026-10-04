import {nativeSealedService,type SealedView} from './native-sealed';
import manifest from '../data/native-proof/manifest.json';
import {MatchServiceError} from './native-engine/service';
import type {Rules} from './native-engine/runtime';
import type {Side} from './native-engine/types';

export type NativeDeck = {id:string;name:string;side:Side;size:40|60;cards:string[];revision:number;updated:number;poolId?:string};
export type DeckChoice = NativeDeck & {source:'saved'|'starter';eligible:boolean;issues:string[];pool?:SealedView};
type Row = {data:string;updated:number};
const prefix='native-deck:';
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9_-]{12,80}$/.test(id);
function fail(message:string,status=400,code='INVALID_DECK'):never{throw new MatchServiceError(message,status,code)}
const owner=(actor:string)=>{if(typeof actor!=='string'||!actor||actor.length>256)fail('Sign in to your decks.',401,'SIGN_IN_REQUIRED');return actor};
/** Draft storage is separate from match admission. It never changes Rules.supports,
 * and starting a game still validates a frozen copy through the match service. */
export function nativeDeckService(db:Pick<D1Database,'prepare'>,rules:Rules,now=Date.now){
 async function assess(d:NativeDeck,source:'saved'|'starter',actor:string):Promise<DeckChoice>{
  const issues:string[]=[];
  if(d.cards.length!==d.size)issues.push(`Choose exactly ${d.size} cards (${d.cards.length} selected).`);
  const unique=[...new Set(d.cards)],unverified=unique.filter(bp=>!rules.supports(bp));
  if(unverified.length)issues.push(`${unverified.length} card ${unverified.length===1?'type still needs':'types still need'} native rules verification.`);
  if(unique.some(bp=>{try{return rules.definition(bp).side!==d.side}catch{return false}}))issues.push('Every card must belong to the chosen side.');
  const pool=d.poolId?await nativeSealedService(db).read(d.poolId,actor):undefined;
  if(pool)await nativeSealedService(db).checkDeck(pool.id,actor,d.side,d.size,d.cards);
  return {...d,source,eligible:issues.length===0,issues,...(pool?{pool}:{})};
 }
 function parse(row:Row):NativeDeck{
  const d=JSON.parse(row.data);if(d.schema!==1||!validId(d.id)||!['dark','light'].includes(d.side)||![40,60].includes(d.size)||!Array.isArray(d.cards)||!Number.isSafeInteger(d.revision))throw Error('Invalid saved deck');
  return {id:d.id,name:d.name,side:d.side,size:d.size,cards:d.cards,revision:d.revision,updated:row.updated,...(d.poolId?{poolId:d.poolId}:{})};
 }
 async function list(actor:string){
  owner(actor);const rows=await db.prepare('SELECT data,updated FROM decks WHERE owner = ? AND id LIKE ? ORDER BY updated DESC LIMIT 100').bind(actor,prefix+'%').all<Row>();
  return {decks:await Promise.all([...rows.results.map(row=>assess(parse(row),'saved',actor)),...manifest.decks.map(d=>assess({id:d.id,name:d.title,side:d.side as Side,size:d.size as 40|60,cards:[...d.main],revision:0,updated:0},'starter',actor))])};
 }
 async function save(actor:string,body:Record<string,unknown>){
  owner(actor);
  if(Object.keys(body).some(k=>!['id','name','side','size','cards','revision','poolId'].includes(k)))fail('This deck contains unsupported fields.');
  const {id,name,side,size,cards,revision,poolId}=body;
  if(poolId!==undefined&&!validId(poolId))fail('Choose a valid sealed pool.');
  if(!validId(id)||typeof name!=='string'||!name.trim()||name.trim().length>80||(side!=='light'&&side!=='dark')||![40,60].includes(Number(size))||typeof size!=='number'||!Number.isSafeInteger(revision)||Number(revision)<0)fail('Choose a deck name, side and 40- or 60-card format.');
  if(!Array.isArray(cards)||cards.length>120||cards.some(bp=>typeof bp!=='string'||!/^\d+_\d+$/.test(bp)||bp.length>40))fail('Use up to 120 card identifiers in a draft.');
  const key=prefix+id,old=await db.prepare('SELECT data,updated FROM decks WHERE id = ? AND owner = ?').bind(key,actor).first<Row>();
  const content={schema:1,id,name:name.trim(),side:side as Side,size:size as 40|60,cards:[...cards] as string[],...(poolId?{poolId:poolId as string}:{})};
  if(poolId)await nativeSealedService(db).checkDeck(poolId as string,actor,side,size,cards);
  if(old&&parse(old).poolId&&parse(old).poolId!==poolId)fail('A sealed draft must stay with its original pool.');
  if(old){const d=parse(old);if(d.revision!==revision){
   // A lost save response can be retried safely, even after process restart.
   if(d.revision===Number(revision)+1&&JSON.stringify({...content,revision:d.revision})===old.data)return assess(d,'saved',actor);
   fail('This deck changed in another tab. Reload it before saving.',409,'STALE_DECK');
  }}else if(revision!==0)fail('This saved deck was not found.',404,'DECK_NOT_FOUND');
  const updated=now(),data=JSON.stringify({...content,revision:Number(revision)+1});
  const result=old?await db.prepare('UPDATE decks SET data = ?, updated = ? WHERE id = ? AND owner = ? AND data = ?').bind(data,updated,key,actor,old.data).run():await db.prepare('INSERT INTO decks (id,owner,data,updated) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(key,actor,data,updated).run();
  if(result.meta.changes!==1){
   const row=await db.prepare('SELECT data,updated FROM decks WHERE id = ? AND owner = ?').bind(key,actor).first<Row>();
   if(row?.data===data)return assess(parse(row),'saved',actor);
   fail('This deck changed in another tab. Reload it before saving.',409,'STALE_DECK');
  }
  return assess(parse({data,updated}),'saved',actor);
 }
 return {list,save};
}
