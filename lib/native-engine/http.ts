import {MatchServiceError, type nativeMatchService} from './service';
type Service = ReturnType<typeof nativeMatchService>;
type Context = {params: Promise<{id: string}>};
export function matchIdentity(request: Request): string {
  const id = request.headers.get('oai-authenticated-user-id'), email = request.headers.get('oai-authenticated-user-email');
  // Trusted Sites gateway headers; never accept identity/seat from JSON, query
  // strings or anonymous local fallbacks. Production origin is gateway-only.
  if (!id || !email || id.length > 256) throw new MatchServiceError('Sign in to open your private matches.',401,'SIGN_IN_REQUIRED');
  return id;
}
export async function matchInput(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new MatchServiceError('This command came from another site.',403,'CROSS_ORIGIN');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new MatchServiceError('Use a JSON command.',415,'JSON_REQUIRED');
  const limit = 32768, reader = request.body?.getReader();let size = 0;const chunks: Uint8Array[] = [];
  if (Number(request.headers.get('content-length')) > limit) throw new MatchServiceError('Command too large.',413,'TOO_LARGE');
  if (reader) while (true) {const {done,value} = await reader.read();if (done) break;size += value.byteLength;if (size > limit) {await reader.cancel();throw new MatchServiceError('Command too large.',413,'TOO_LARGE');}chunks.push(value);}
  const bytes = new Uint8Array(size);let offset = 0;for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.length;}
  try {const body = JSON.parse(new TextDecoder().decode(bytes));if (!body || Array.isArray(body) || typeof body !== 'object') throw Error();return body;} catch {throw new MatchServiceError('Malformed command.',400,'INVALID_JSON');}
}
const json = (value: unknown, status = 200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'}});
function failure(e: unknown) {
  if (e instanceof MatchServiceError) return json({error:e.message,code:e.code},e.status);
  // Do not leak private card identifiers or saved state from rules/SQL errors.
  console.error('Native match request could not complete.');
  return json({error:'The match could not be advanced or loaded. No move was assumed successful.',code:'MATCH_UNAVAILABLE'},503);
}
export function matchHandlers(service: () => Service) {
  return {
    list: async (request: Request) => {try {const actor = matchIdentity(request);return json({matches:await service().list(actor)});} catch(e) {return failure(e);}},
    create: async (request: Request) => {try {const actor = matchIdentity(request),body = await matchInput(request);return json(await service().create(actor,body),201);} catch(e) {return failure(e);}},
    read: async (request: Request,context: Context) => {try {const actor = matchIdentity(request),{id} = await context.params;if (new URL(request.url).searchParams.has('seat')) throw new MatchServiceError('Your seat is assigned by the server.',403,'ASSIGNED_SEAT');return json(await service().read(id,actor));} catch(e) {return failure(e);}},
    update: async (request: Request,context: Context) => {try {const actor = matchIdentity(request),body = await matchInput(request),{id} = await context.params,s = service();if (body.operation === 'join') return json(await s.join(id,actor,body));if (body.operation === 'command') return json(await s.command(id,actor,body));throw new MatchServiceError('Choose a supported operation.');} catch(e) {return failure(e);}},
  };
}
