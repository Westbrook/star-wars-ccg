import {env} from 'cloudflare:workers';
export function engineOrigin(){const raw=(env as unknown as {GEMP_ORIGIN?:string}).GEMP_ORIGIN;if(!raw)return null;try{const url=new URL(raw);return ['http:','https:'].includes(url.protocol)?url.origin:null}catch{return null}}
export async function engineProxy(request:Request){
 const base=engineOrigin();if(!base)return Response.json({error:'The rules service is not connected in this environment.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const incoming=new URL(request.url);if(!/^\/gemp-swccg(?:-server)?\//.test(incoming.pathname))return new Response(null,{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD'){const origin=request.headers.get('origin');if(origin&&origin!==incoming.origin)return new Response(null,{status:403})}
 const target=new URL(incoming.pathname+incoming.search,base);const headers=new Headers();
 for(const key of ['content-type','accept','if-none-match','if-modified-since']){const value=request.headers.get(key);if(value)headers.set(key,value)}
 // Never forward Sites identity or unrelated application cookies to the engine.
 const session=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('loggedUser='));if(session)headers.set('cookie',session);
 headers.set('origin',base);
 try{
  const response=await fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'});
  const out=new Headers();for(const key of ['content-type','etag','last-modified']){const value=response.headers.get(key);if(value)out.set(key,value)}
  out.set('Cache-Control','no-store');
  for(const cookie of response.headers.getSetCookie()){if(cookie.startsWith('loggedUser='))out.append('set-cookie',cookie.replace(/;\s*Domain=[^;]*/ig,'').replace(/;\s*Path=[^;]*/ig,'')+'; Path=/; HttpOnly; SameSite=Lax'+(incoming.protocol==='https:'?'; Secure':''))}
  const location=response.headers.get('location');if(location){const dest=new URL(location,base);if(dest.origin!==base)return new Response(null,{status:502});out.set('location',dest.pathname+dest.search+dest.hash)}
  if(out.get('content-type')?.includes('text/html')){let html=await response.text();html=html.replace('</head>','<link rel="stylesheet" href="/engine-client.css"><script defer src="/engine-bridge.js"></script></head>');return new Response(html,{status:response.status,headers:out})}
  return new Response(response.body,{status:response.status,headers:out});
 }catch{return Response.json({error:'The rules service is currently unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
