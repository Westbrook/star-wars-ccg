import {nativeSealedService,SealedError} from './native-sealed';
import {matchIdentity,matchInput} from './native-engine/http';
import {MatchServiceError} from './native-engine/service';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'}});
export function nativeSealedHandlers(service:()=>ReturnType<typeof nativeSealedService>){
 const handle=async(request:Request,id?:string)=>{try{const actor=matchIdentity(request),s=service();return json(request.method==='GET'?id?await s.read(id,actor):await s.list(actor):id?await s.join(id,actor,await matchInput(request)):await s.create(actor,await matchInput(request)));}catch(e){return e instanceof SealedError||e instanceof MatchServiceError?json({error:e.message,code:e.code},e.status):json({error:'Your sealed table could not be loaded. Retry to recover its saved products.',code:'SEALED_UNAVAILABLE'},503)}};
 return {collection:(r:Request)=>handle(r),room:async(r:Request,c:{params:Promise<{id:string}>})=>handle(r,(await c.params).id)};
}
