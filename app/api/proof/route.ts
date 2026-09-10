import {createMatch,failure,identity,input,json,listMatches} from '@/lib/native-proof/service';
export async function GET(request:Request){try{return json({matches:await listMatches(identity(request))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{return json(await createMatch(identity(request),await input(request)),201);}catch(e){return failure(e);}}
