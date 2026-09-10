import {choose,failure,identity,input,joinMatch,json,readMatch} from '@/lib/native-proof/service';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{const {id}=await context.params;return json(await readMatch(id,identity(request),new URL(request.url).searchParams.get('seat')||undefined));}catch(e){return failure(e);}}
export async function POST(request:Request,context:Context){try{const {id}=await context.params;const actor=identity(request);const body=await input(request);return json(body.operation==='join'?await joinMatch(id,actor):await choose(id,actor,body));}catch(e){return failure(e);}}
