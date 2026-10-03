import type {nativeMatchService} from './service';
export type MatchView = Awaited<ReturnType<ReturnType<typeof nativeMatchService>['read']>>;
export type SavedMatch = Pick<MatchView,'id'|'mode'|'side'|'deckSize'|'revision'|'updated'>;
export type PendingMove = {operation:'command';commandId:string;revision:number;choice:string};
export type ClientState = {view:MatchView|null;pending:PendingMove|null;busy:boolean;error:string;status:number;receivedAt:number};
export class MatchRequestError extends Error {constructor(message:string,public status:number){super(message)}}
export async function matchRequest<T>(path:string,body?:unknown):Promise<T>{
 const r=await fetch(path,{cache:'no-store',credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let data:T & {error?:string};try{data=await r.json() as T & {error?:string}}catch{throw new MatchRequestError(r.status===401?'Sign in to open your matches.':'The match service returned an unreadable response.',r.ok?502:r.status)}if(!r.ok)throw new MatchRequestError(data.error||'The match could not be loaded.',r.status);return data;
}
export function matchHref(id?:string,report=false){return '/matches'+(id?'/'+encodeURIComponent(id):'')+(report?'?progress-report':'')}
export const emptyOpportunity=(v:MatchView|null)=>!!v?.game?.prompt&&!v.waitingForOpponent&&v.game.prompt.side===v.side&&!v.game.prompt.mandatory&&v.game.prompt.choices.length===1&&v.game.prompt.choices[0].id==='pass';
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
/** One connection owns one match. Only confirmed snapshots move the UI forward;
 * uncertain writes retain the exact receipt for explicit recovery after refresh. */
export class MatchConnection {
 state:ClientState={view:null,pending:null,busy:false,error:'',status:0,receivedAt:0};
 private disposed=false;
 constructor(readonly id:string,private changed:(s:ClientState)=>void,private request:<T>(path:string,body?:unknown)=>Promise<T>=matchRequest,private storage?:Storage){
  if(!/^[A-Za-z0-9_-]{12,80}$/.test(id))throw Error('This match link is invalid.');
  try{const p=JSON.parse(storage?.getItem(this.key)||'null');if(p?.operation==='command'&&typeof p.commandId==='string'&&/^[A-Za-z0-9_-]{12,80}$/.test(p.commandId)&&Number.isSafeInteger(p.revision)&&p.revision>=0&&typeof p.choice==='string'&&p.choice.length<=512)this.state.pending=p}catch{/* Saved server state remains authoritative. */}
 }
 private get key(){return 'native-command:'+this.id}
 private update(p:Partial<ClientState>){if(this.disposed)return;this.state={...this.state,...p};this.changed(this.state)}
 private remember(p:PendingMove|null){try{if(p)this.storage?.setItem(this.key,JSON.stringify(p));else this.storage?.removeItem(this.key)}catch{/* In-memory retry still works when storage is unavailable. */}this.update({pending:p})}
 private accept(v:MatchView){if(v.id!==this.id)throw Error('The server returned a different match.');if(!this.state.view||v.revision>=this.state.view.revision)this.update({view:v,receivedAt:Date.now()})}
 private async run(body?:unknown){
  if(this.state.busy||this.disposed)return;this.update({busy:true,error:'',status:0});
  try{this.accept(await this.request<MatchView>('/api/matches/'+this.id,body));if((body as PendingMove)?.operation==='command')this.remember(null)}
  catch(e){const failure=e as MatchRequestError;this.update({error:failure.message||'Connection interrupted. Retry to recover the saved result.',status:failure.status||0});
   if((body as PendingMove)?.operation==='command'&&failure.status>=400&&failure.status<500&&failure.status!==401){this.remember(null);try{this.accept(await this.request<MatchView>('/api/matches/'+this.id))}catch{/* Keep original failure visible. */}}
  }finally{this.update({busy:false})}
 }
 load(){return this.run()}
 choose(choice:string,revision=this.state.view?.revision){
  const v=this.state.view;if(!v?.game||v.game.status==='finished'||this.state.pending||this.state.busy||v.revision!==revision)return Promise.resolve();
  if(choice!=='concede'&&(!v.game.prompt||v.game.prompt.side!==v.side||!v.game.prompt.choices.some(c=>c.id===choice)))return Promise.resolve();
  const p:PendingMove={operation:'command',commandId:crypto.randomUUID(),revision:v.revision,choice};this.remember(p);return this.run(p);
 }
 retry(){return this.state.pending?this.run(this.state.pending):this.load()}
 advance(){return !this.state.pending&&this.state.view?.mode==='cpu'?this.run({operation:'advance'}):Promise.resolve()}
 dispose(){this.disposed=true}
}
