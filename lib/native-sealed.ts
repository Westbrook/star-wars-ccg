import {allocateOtsd,poolContains,sealedProductId,type SealedAllocation} from './sealed-products';
import {secureEntropy,type Entropy} from './native-engine/random';
import {other,type Side} from './native-engine/types';
// Keep this service independent of match/deck services to avoid initialization
// cycles. HTTP adapters translate its bounded public errors to responses.
export class SealedError extends Error{constructor(message:string,public status=400,public code='INVALID_SEALED_REQUEST'){super(message)}}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9_-]{12,80}$/.test(id);
function fail(message:string,status=400,code='INVALID_SEALED_REQUEST'):never{throw new SealedError(message,status,code)}
const principal=(actor:string)=>{if(typeof actor!=='string'||!actor||actor.length>256)fail('Sign in to sealed play.',401,'SIGN_IN_REQUIRED')};
type Row={owner:string;data:string;created:number};
type Room={schema:1;id:string;side:Side;product:string;guest:string|null;invite:string;pools:SealedAllocation};
export type SealedView={id:string;side:Side;product:string;size:40;created:number;opponentReady:boolean;cards:string[];packs:{name:string;cards:string[]}[];inviteToken?:string};
export function nativeSealedService(db:Pick<D1Database,'prepare'>,options:{entropy?:Entropy;now?:()=>number;uuid?:()=>string}={}){
 const entropy=options.entropy??secureEntropy,now=options.now??Date.now,uuid=options.uuid??(()=>crypto.randomUUID());
 async function find(id:string){if(!validId(id))fail('Invalid sealed table link.');return db.prepare('SELECT owner,data,created FROM pools WHERE id = ?').bind('native-sealed:'+id).first<Row>()}
 function parse(row:Row):Room{const r=JSON.parse(row.data);if(r.schema!==1||r.product!==sealedProductId||!validId(r.id)||!['light','dark'].includes(r.side)||!r.pools?.light||!r.pools?.dark)throw Error('Invalid saved sealed allocation');return r}
 function project(row:Row,actor:string):SealedView{
  const r=parse(row),side=actor===row.owner?r.side:actor===r.guest?other(r.side):fail('This private sealed table was not found.',404,'SEALED_NOT_FOUND');
  return {id:r.id,side,product:r.product,size:40,created:row.created,opponentReady:!!r.guest,packs:r.guest?r.pools[side]:[],cards:r.guest?r.pools[side].flatMap(p=>p.cards):[],...(actor===row.owner&&!r.guest?{inviteToken:r.invite}:{})};
 }
 async function read(id:string,actor:string){principal(actor);const row=await find(id);if(!row)fail('This private sealed table was not found.',404,'SEALED_NOT_FOUND');return project(row,actor)}
 async function list(actor:string){principal(actor);const rows=await db.prepare('SELECT owner,data,created FROM pools WHERE id LIKE ? AND (owner = ? OR json_extract(data,\'$.guest\') = ?) ORDER BY created DESC LIMIT 40').bind('native-sealed:%',actor,actor).all<Row>();return {pools:rows.results.map(row=>project(row,actor))}}
 async function create(actor:string,body:Record<string,unknown>){
  principal(actor);if(Object.keys(body).some(k=>!['id','side'].includes(k))||!validId(body.id)||(body.side!=='light'&&body.side!=='dark'))fail('Choose a side before opening your sealed table.');
  const id=body.id,old=await find(id);
  if(old){if(old.owner!==actor||parse(old).side!==body.side)fail('This sealed table ID is already in use.',409,'SEALED_ID_REUSED');return project(old,actor)}
  const room:Room={schema:1,id,side:body.side,product:sealedProductId,guest:null,invite:uuid()+uuid(),pools:allocateOtsd(entropy)};
  await db.prepare('INSERT INTO pools (id,owner,data,created) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('native-sealed:'+id,actor,JSON.stringify(room),now()).run();
  const row=(await find(id))!;if(row.owner!==actor||parse(row).side!==body.side)fail('This sealed table ID is already in use.',409,'SEALED_ID_REUSED');return project(row,actor);
 }
 async function join(id:string,actor:string,body:Record<string,unknown>){
  principal(actor);if(Object.keys(body).some(k=>k!=='inviteToken')||typeof body.inviteToken!=='string')fail('Use the private sealed invitation.');
  const row=await find(id);if(!row)fail('This invitation is unavailable.',404,'SEALED_NOT_FOUND');const r=parse(row);
  if(row.owner===actor||r.invite!==body.inviteToken)fail('This invitation cannot seat you.',403,'INVALID_INVITATION');
  if(r.guest===actor)return project(row,actor);if(r.guest)fail('The other seat is occupied.',409,'SEAT_OCCUPIED');
  await db.prepare('UPDATE pools SET data = ? WHERE id = ? AND data = ?').bind(JSON.stringify({...r,guest:actor}),'native-sealed:'+id,row.data).run();
  const result=(await find(id))!;if(parse(result).guest!==actor)fail('Another player joined first.',409,'SEAT_OCCUPIED');return project(result,actor);
 }
 async function checkDeck(id:string,actor:string,side:Side,size:number,cards:readonly string[]){
  const pool=await read(id,actor);if(!pool.opponentReady)fail('Wait for your opponent before opening the products.',409,'SEALED_WAITING');if(pool.side!==side||pool.size!==size)fail('Use your assigned side and the 40-card sealed format.',422,'SEALED_FORMAT');
  if(!poolContains(pool.cards,cards))fail('This deck uses cards or copies outside your sealed pool.',422,'OUTSIDE_SEALED_POOL');return pool;
 }
 return {read,list,create,join,checkDeck};
}
