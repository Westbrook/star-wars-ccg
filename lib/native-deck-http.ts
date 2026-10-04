import {SealedError} from './native-sealed';
import {nativeDeckService} from './native-decks';
import {matchIdentity,matchInput} from './native-engine/http';
import {MatchServiceError} from './native-engine/service';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'}});
export function nativeDeckHandlers(service:()=>ReturnType<typeof nativeDeckService>){
 const handle=async(request:Request,write:boolean)=>{try{const actor=matchIdentity(request);return json(write?await service().save(actor,await matchInput(request)):await service().list(actor));}catch(e){return (e instanceof MatchServiceError||e instanceof SealedError)?json({error:e.message,code:e.code},e.status):json({error:'Your decks could not be loaded or saved. Please retry.',code:'DECKS_UNAVAILABLE'},503)}};
 return {list:(request:Request)=>handle(request,false),save:(request:Request)=>handle(request,true)};
}
