import {env} from 'cloudflare:workers';
import {concedeGame,applyCommand,assertMatch,createScenario,project,prompt} from './engine';
import {scenarios} from './catalog';
import type {Match,ScenarioId,Side} from './types';

type Row={id:string;owner:string;guest:string|null;mode:'solo'|'shared';scenario:ScenarioId;state:string;version:number;created:number;updated:number};
type Receipt={actor:string;request_hash:string;result_version:number};
export class ProofError extends Error{constructor(message:string,public status=400){super(message);}}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9_-]{12,80}$/.test(id);
const db=()=>{if(!env.DB)throw new ProofError('The saved-game database is unavailable.',503);return env.DB;};
export function identity(request:Request){
 const id=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email');
 if(id&&email)return id;
 // Sites supplies these headers after authentication. The local Sites sign-in
 // plugin provides the same contract; no anonymous fallback changes ownership.
 throw new ProofError('Sign in to open the private rules lab.',401);
}
export async function input(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ProofError('This request came from another site.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ProofError('Use a JSON command.',415);
 if(Number(request.headers.get('content-length')||0)>4096)throw new ProofError('Command too large.',413);
 const text=await request.text();if(text.length>4096)throw new ProofError('Command too large.',413);
 try{const b=JSON.parse(text);if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b as Record<string,unknown>;}catch{throw new ProofError('Malformed command.');}
}
function parse(row:Row){const m=JSON.parse(row.state) as Match;assertMatch(m);if(m.revision!==row.version)throw Error('Saved revision mismatch.');return m;}
function seat(row:Row,actor:string,requested?:unknown):Side{
 if(actor!==row.owner&&actor!==row.guest)throw new ProofError('This private checkpoint belongs to another pilot.',403);
 const assigned:Side=actor===row.owner?'dark':'light';
 if(row.mode==='solo'&&actor===row.owner){if(requested!==undefined&&requested!=='light'&&requested!=='dark')throw new ProofError('Choose a valid seat.');return requested as Side||prompt(parse(row))?.side||'dark';}
 if(requested!==undefined&&requested!==assigned)throw new ProofError('You cannot view the other seat.',403);
 return assigned;
}
async function rowFor(id:string){if(!validId(id))throw new ProofError('Invalid checkpoint link.');const r=await db().prepare('SELECT * FROM proof_matches WHERE id = ?').bind(id).first<Row>();if(!r)throw new ProofError('This checkpoint was not found.',404);return r;}
function response(row:Row,actor:string,requested?:unknown){const s=seat(row,actor,requested);return {id:row.id,mode:row.mode,waitingForOpponent:row.mode==='shared'&&!row.guest,created:row.created,updated:row.updated,game:project(parse(row),s,row.mode==='solo'&&row.owner===actor)};}
export async function listMatches(actor:string){const r=await db().prepare('SELECT id, mode, scenario, version, created, updated FROM proof_matches WHERE owner = ? OR guest = ? ORDER BY updated DESC LIMIT 12').bind(actor,actor).all();return r.results;}
export async function readMatch(id:string,actor:string,requested?:unknown){return response(await rowFor(id),actor,requested);}
export async function createMatch(actor:string,body:Record<string,unknown>){
 const {id,scenario,mode}=body;if(!validId(id)||!scenarios.some(s=>s.id===scenario)||(mode!=='solo'&&mode!=='shared'))throw new ProofError('Choose a supported checkpoint and mode.');
 const state=createScenario(scenario as ScenarioId);const now=Date.now();
 await db().prepare('INSERT INTO proof_matches (id,owner,guest,mode,scenario,state,version,created,updated) VALUES (?, ?, NULL, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,actor,mode,scenario,JSON.stringify(state),now,now).run();
 const r=await rowFor(id);if(r.owner!==actor||r.mode!==mode||r.scenario!==scenario)throw new ProofError('That creation ID was already used for another checkpoint.',409);
 return response(r,actor);
}
export async function joinMatch(id:string,actor:string){
 const r=await rowFor(id);if(r.mode!=='shared')throw new ProofError('This is a private two-seat study.',403);
 if(r.owner===actor||r.guest===actor)return response(r,actor);
 if(r.guest)throw new ProofError('Both seats are already occupied.',403);
 await db().prepare('UPDATE proof_matches SET guest = ? WHERE id = ? AND guest IS NULL AND owner <> ? AND mode = ?').bind(actor,id,actor,'shared').run();
 return response(await rowFor(id),actor);
}
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function choose(id:string,actor:string,body:Record<string,unknown>){
 const {commandId,version,choice,prompt:promptId}=body;
 if(body.seat!=='light'&&body.seat!=='dark')throw new ProofError('A command must identify its authorized seat.');
 if(!validId(commandId)||!Number.isSafeInteger(version)||Number(version)<0||typeof choice!=='string'||choice.length>200||typeof promptId!=='string'||promptId.length>100)throw new ProofError('Malformed choice.');
 let row=await rowFor(id);const s=seat(row,actor,body.seat);
 if(row.mode==='shared'&&!row.guest)throw new ProofError('Wait for the second pilot to join.',409);
 const key=id+':'+commandId;const digest=await hash(JSON.stringify({actor,seat:s,version,choice,promptId}));
 const prior=await db().prepare('SELECT actor,request_hash,result_version FROM proof_commands WHERE id = ?').bind(key).first<Receipt>();
 if(prior){if(prior.actor!==actor||prior.request_hash!==digest)throw new ProofError('A command ID cannot be reused for a different choice.',409);return {...response(await rowFor(id),actor,body.seat),duplicate:true,acceptedVersion:prior.result_version};}
 if(row.version!==version)throw new ProofError('Another choice already advanced this checkpoint. Reload its current state.',409);
 let state:Match;try{state=choice==='concede-game'?concedeGame(parse(row),s,promptId):applyCommand(parse(row),s,{choice,prompt:promptId});}catch(e){throw new ProofError((e as Error).message,422);}
 const claim=crypto.randomUUID();const now=Date.now();
 // Both writes are one transaction. A random claim makes the update conditional
 // on THIS invocation inserting the receipt, including simultaneous duplicates.
 const results=await db().batch([
  db().prepare('INSERT INTO proof_commands (id,match_id,actor,command_id,request_hash,claim,base_version,result_version,created) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM proof_matches WHERE id = ? AND version = ?) ON CONFLICT(id) DO NOTHING').bind(key,id,actor,commandId,digest,claim,version,state.revision,now,id,version),
  db().prepare('UPDATE proof_matches SET state = ?, version = ?, updated = ? WHERE id = ? AND version = ? AND EXISTS (SELECT 1 FROM proof_commands WHERE id = ? AND claim = ?)').bind(JSON.stringify(state),state.revision,now,id,version,key,claim),
 ]);
 row=await rowFor(id);
 if(results[1].meta.changes!==1){
  const accepted=await db().prepare('SELECT actor,request_hash,result_version FROM proof_commands WHERE id = ?').bind(key).first<Receipt>();
  if(!accepted||accepted.actor!==actor||accepted.request_hash!==digest)throw new ProofError('A concurrent choice won. Reload the current checkpoint.',409);
  return {...response(row,actor,body.seat),duplicate:true,acceptedVersion:accepted.result_version};
 }
 return {...response(row,actor,body.seat),duplicate:false,acceptedVersion:state.revision};
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(e:unknown){if(e instanceof ProofError)return json({error:e.message},e.status);console.error('Native proof request failed:',e instanceof Error?e.message:'unknown');return json({error:'The checkpoint could not be loaded or saved. No move was assumed successful.'},503);}
