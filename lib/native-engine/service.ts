import {buildSealedComputerDeck,sealedDeckPolicy} from '../sealed-computer-deck';
import {nativeSealedService} from '../native-sealed';
import {assertClock, createClock, expiredClock, moveClock, projectClock, validClockMinutes, type MatchClock} from './match-clock';
import starterManifest from '../../data/native-proof/manifest.json';
import {chooseComputerAction, computerPolicy} from './computer';
import {applyCommand, advanceTime, createMatch, project, prompt, type Rules} from './runtime';
import {secureEntropy, type Entropy} from './random';
import {other, type Deck, type Match, type Side} from './types';

type Database = Pick<D1Database, 'prepare' | 'batch'>;
type Row = {id: string; owner: string; guest: string | null; owner_side: Side; mode: 'pvp' | 'cpu'; rules_version: string; deck_size: 40 | 60; owner_deck: string; invite_token: string | null; creation_hash: string; state: string | null; clock: string | null; version: number; created: number; updated: number};
type Receipt = {actor: string; request_hash: string; result_version: number};
type Body = Record<string, unknown>;
export class MatchServiceError extends Error {constructor(message: string, public status = 400, public code = 'INVALID_REQUEST') {super(message);}}
const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{12,80}$/.test(id);
const validVersion = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
function fail(message: string, status = 400, code = 'INVALID_REQUEST'): never {throw new MatchServiceError(message, status, code);}
const keys = (body: Body, allowed: string[]) => {if (Object.keys(body).some(k => !allowed.includes(k))) fail('This command contains unsupported fields.');};
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
const user = (actor: string) => {if (typeof actor !== 'string' || !actor || actor.length > 256) fail('Sign in to open your match.', 401, 'SIGN_IN_REQUIRED');return 'user:' + actor;};

/** Only the server constructs this service and supplies identities, rules, time
 * and entropy. No client can supply a saved state, rules implementation or clock. */
export function nativeMatchService(db: Database, options: {currentRules: string; rules: (id: string) => Rules | undefined; now?: () => number; entropy?: Entropy; uuid?: () => string}) {
  const clock = options.now ?? Date.now, entropy = options.entropy ?? secureEntropy, uuid = options.uuid ?? (() => crypto.randomUUID());
  const now = () => {const n = clock();if (!validVersion(n)) throw Error('Invalid service clock.');return n;};
  const rulesFor = (id: string) => options.rules(id) ?? fail('This saved match needs its original rules version.', 503, 'RULES_UNAVAILABLE');
  async function find(id: string): Promise<Row | null> {if (!validId(id)) fail('Invalid match link.');return db.prepare('SELECT * FROM native_matches WHERE id = ?').bind(id).first<Row>();}
  const rowFor = async (id: string) => await find(id) ?? fail('This private match was not found.', 404, 'NOT_FOUND');
  function seat(row: Row, actor: string): Side {user(actor);if (row.owner === actor) return row.owner_side;if (row.mode === 'pvp' && row.guest === actor) return other(row.owner_side);return fail('This private match was not found.', 404, 'NOT_FOUND');}
  // Legacy open games store an array. Sealed games freeze their pool binding
  // beside the owner's cards in the same immutable creation snapshot.
  function ownerSnapshot(row: Row): {cards:string[];poolId?:string} {
    const value=JSON.parse(row.owner_deck);
    if(Array.isArray(value))return {cards:value};
    if(value?.schema!==1||value.format!=='otsd'||!validId(value.poolId)||!Array.isArray(value.cards)||row.deck_size!==40)throw Error('Invalid sealed match binding.');
    if(row.mode==='cpu'&&(typeof value.computerPolicy!=='string'||!Array.isArray(value.computerDeck)||value.computerDeck.length!==40))throw Error('Missing computer sealed snapshot.');
    return {cards:value.cards,poolId:value.poolId};
  }
  function parse(row: Row): Match {
    if (!row.state) throw Error('Match has not started.');
    const m = JSON.parse(row.state) as Match;
    if (m.id !== row.id || m.revision !== row.version || m.rules !== row.rules_version || m.deckSize !== row.deck_size) throw Error('Saved match metadata mismatch.');
    // Projection invokes all runtime and rules validators before any state is used.
    project(m, rulesFor(row.rules_version), row.owner_side, now());return m;
  }
  function clockSeat(m: Match): Side | null {
    if (m.status !== 'playing') return null;
    const rules = rulesFor(m.rules), pending = (['dark','light'] as const).filter(side => prompt(m,rules,side)?.choices.length);
    if (pending.length !== 1) throw Error('A timed match requires exactly one gameplay decision owner.');
    return pending[0];
  }
  function savedClock(row: Row, m?: Match): MatchClock | null {
    if (!row.clock) {if (m?.result?.reason === 'timeout') throw Error('Missing timeout clock.');return null;}
    const c = JSON.parse(row.clock) as MatchClock; assertClock(c);
    if (row.mode !== 'pvp' || c.running !== (m ? clockSeat(m) : null) ||
        m?.result?.reason === 'timeout' && c.remaining[m.result.loser] !== 0) throw Error('Saved clock does not match the game.');
    return c;
  }
  function response(row: Row, side: Side, actor?: string) {
    const time = now(), m = row.state ? parse(row) : null, c = savedClock(row,m ?? undefined);
    return {clock: c ? projectClock(c,time) : null, id: row.id, mode: row.mode, side, rules: row.rules_version, deckSize: row.deck_size, revision: row.version,
      format: ownerSnapshot(row).poolId ? 'otsd' as const : 'open' as const, ...(ownerSnapshot(row).poolId ? {poolId:ownerSnapshot(row).poolId} : {}), serverTime: time, waitingForOpponent: !row.state, created: row.created, updated: row.updated,
      ...(actor === row.owner && !row.guest && row.mode === 'pvp' ? {inviteToken: row.invite_token} : {}),
      game: m ? project(m, rulesFor(row.rules_version), side, time) : null};
  }
  function deck(input: unknown, side: Side, size: number, rules: Rules): Deck {
    if (!Array.isArray(input) || input.length !== size || input.some(bp => typeof bp !== 'string' || !/^\d+_\d+$/.test(bp) || bp.length > 40)) fail('Choose a complete deck for this format.');
    const cards = input as string[];
    if (cards.some(bp => !rules.supports(bp))) fail('These cards are not yet verified for native matches.', 422, 'DECK_NOT_ADMITTED');
    if (cards.some(bp => rules.definition(bp).side !== side)) fail('Every card must belong to your chosen side.');
    return {side, cards: [...cards]};
  }
  const prior = (key: string) => db.prepare('SELECT actor, request_hash, result_version FROM native_commands WHERE id = ?').bind(key).first<Receipt>();
  function sameReceipt(receipt: Receipt, actor: string, hash: string) {if (receipt.actor !== actor || receipt.request_hash !== hash) fail('That command ID was already used for a different request.', 409, 'COMMAND_ID_REUSED');}
  /** Receipt and snapshot are committed together. Only the invocation that
   * inserts its random claim may advance the row. No receipt on a lost CAS. */
  async function commit(row: Row, state: Match, actor: string, key: string, hash: string, guest = row.guest, clock = row.clock) {
    if (state.revision !== row.version + 1) throw Error('Invalid committed revision.');
    const claim = uuid(), time = now();
    const result = await db.batch([
      db.prepare('INSERT INTO native_commands (id,match_id,actor,request_hash,claim,base_version,result_version,created) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM native_matches WHERE id = ? AND version = ?) ON CONFLICT(id) DO NOTHING').bind(key,row.id,actor,hash,claim,row.version,state.revision,time,row.id,row.version),
      db.prepare('UPDATE native_matches SET state = ?, version = ?, guest = ?, clock = ?, updated = ? WHERE id = ? AND version = ? AND EXISTS (SELECT 1 FROM native_commands WHERE id = ? AND claim = ?)').bind(JSON.stringify(state),state.revision,guest,clock,time,row.id,row.version,key,claim),
    ]);
    return result[1].meta.changes === 1;
  }
  async function settleTime(row: Row, time = now()): Promise<Row> {
    // A stale reader always reloads the winning state. It cannot overwrite a
    // command or another timer; a read does not create a new rules deadline.
    for (let i = 0; i < 3 && row.state; i++) {
      const m = parse(row), c = savedClock(row,m), loser = c && expiredClock(c,time);
      const next = loser ? {...m, revision: m.revision + 1, status: 'finished' as const, result: {winner: other(loser), loser, reason: 'timeout' as const}} : advanceTime(m, rulesFor(row.rules_version), time, entropy);
      if (next.revision === m.revision) return row;
      const updatedClock = c ? JSON.stringify(moveClock(c,clockSeat(next),time)) : null;
      await commit(row, next, 'timer', row.id + ':timer:' + row.version, await digest({version: row.version, time}),row.guest,updatedClock);
      row = await rowFor(row.id);
    }
    return row;
  }
  async function read(id: string, actor: string) {let row = await rowFor(id);const side = seat(row, actor);row = await settleTime(row);return response(row, side, actor);}
  async function create(actor: string, body: Body) {
    user(actor);keys(body, ['id','mode','side','deckSize','deck','computerDeck','clockMinutes','poolId']);
    const {id, mode, side, deckSize} = body;
    if (!validId(id) || mode !== 'pvp' && mode !== 'cpu' || side !== 'dark' && side !== 'light' || deckSize !== 40 && deckSize !== 60) fail('Choose a valid match, format, mode and side.');
    if (mode === 'pvp' && body.computerDeck !== undefined) fail('The other player supplies their own deck.');
    if(body.poolId!==undefined&&(!validId(body.poolId)||deckSize!==40))fail('Choose a paired 40-card OTSD table.',422,'SEALED_FORMAT');
    if(body.poolId&&body.computerDeck!==undefined)fail('The server builds the computer’s sealed deck.',400,'SERVER_COMPUTER_DECK');
    const minutes = body.clockMinutes ?? null;
    if (minutes !== null && (!validClockMinutes(minutes) || mode !== 'pvp')) fail('Choose an untimed match or a 15, 30, 45 or 60 minute clock for private opponents.');
    const hash = await digest({...(minutes !== null ? {clockMinutes:minutes} : {}),actor,mode,side,deckSize,...(body.poolId?{poolId:body.poolId}:{}),deck:body.deck,computerDeck:body.computerDeck ?? null,rules:options.currentRules});
    const existing = await find(id as string);
    if (existing) {if (existing.owner !== actor || existing.creation_hash !== hash) fail('That match ID was already used.', 409, 'MATCH_ID_REUSED');return read(existing.id, actor);}
    const rules = rulesFor(options.currentRules), ownerDeck = deck(body.deck, side as Side, deckSize as number, rules);
    let computerInput=body.computerDeck;
    if(body.poolId){
      const sealed=nativeSealedService(db),pool=await sealed.checkDeck(body.poolId as string,actor,side,deckSize,ownerDeck.cards);
      if(pool.mode!==mode)fail('Use the opponent assigned to this sealed table.',422,'SEALED_FORMAT');
      if(mode==='cpu'){const inventory=await sealed.computerInventory(pool.id,actor);computerInput=buildSealedComputerDeck(inventory.cards,inventory.side,rules);}
    }
    const snapshot=body.poolId?{schema:1,format:'otsd',poolId:body.poolId,cards:ownerDeck.cards,...(mode==='cpu'?{computerPolicy:sealedDeckPolicy,computerDeck:computerInput}:{})}:ownerDeck.cards;
    const state = mode === 'cpu' ? createMatch(id as string, deckSize as 40 | 60, [ownerDeck,deck(computerInput,other(side as Side),deckSize as number,rules)],rules) : null;
    const time = now(), c = minutes === null ? null : createClock(minutes as number,time), invite = mode === 'pvp' ? uuid() + uuid() : null;
    await db.prepare('INSERT INTO native_matches (id,owner,guest,owner_side,mode,rules_version,deck_size,owner_deck,invite_token,creation_hash,state,clock,version,created,updated) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,0,?,?) ON CONFLICT(id) DO NOTHING').bind(id,actor,side,mode,rules.id,deckSize,JSON.stringify(snapshot),invite,hash,state ? JSON.stringify(state) : null,c ? JSON.stringify(c) : null,time,time).run();
    const row = await rowFor(id as string);if (row.owner !== actor || row.creation_hash !== hash) fail('That match ID was already used.', 409, 'MATCH_ID_REUSED');
    return response(row, side as Side, actor);
  }
  async function join(id: string, actor: string, body: Body) {
    const principal = user(actor);keys(body, ['operation','commandId','inviteToken','deck','clockMinutes']);
    if (!validId(body.commandId) || typeof body.inviteToken !== 'string') fail('Use a valid invitation and request ID.');
    let row = await rowFor(id);
    if (row.mode !== 'pvp' || row.owner === actor || body.inviteToken !== row.invite_token) fail('This invitation cannot seat you in this match.', 403, 'INVALID_INVITATION');
    const minutes = savedClock(row,row.state ? parse(row) : undefined)?.minutes ?? null;
    if ((body.clockMinutes ?? null) !== minutes) fail('This invitation requires acknowledgment of its time control.',409,'TIME_CONTROL_MISMATCH');
    const key = id + ':command:' + body.commandId, hash = await digest({operation:'join',actor,invite:body.inviteToken,deck:body.deck,...(minutes !== null ? {clockMinutes:minutes} : {})});
    const receipt = await prior(key);
    if (receipt) {sameReceipt(receipt,principal,hash);row = await settleTime(await rowFor(id));return {...response(row,seat(row,actor),actor),duplicate:true,acceptedRevision:receipt.result_version};}
    if (row.guest || row.state) fail('Both seats are already occupied.', 409, 'SEAT_OCCUPIED');
    const side = other(row.owner_side), rules = rulesFor(row.rules_version);
    const snapshot=ownerSnapshot(row);
    const guestDeck = deck(body.deck, side, row.deck_size, rules), ownerDeck = deck(snapshot.cards,row.owner_side,row.deck_size,rules);
    if(snapshot.poolId){
      const sealed=nativeSealedService(db);
      await sealed.checkDeck(snapshot.poolId,actor,side,row.deck_size,guestDeck.cards);
      await sealed.checkDeck(snapshot.poolId,row.owner,row.owner_side,row.deck_size,ownerDeck.cards);
    }
    const state = createMatch(id,row.deck_size,[ownerDeck,guestDeck],rules);state.revision = row.version + 1;
    const won = await commit(row,state,principal,key,hash,actor);row = await rowFor(id);
    if (!won) {const accepted = await prior(key);if (!accepted) fail('Another player joined first.',409,'SEAT_OCCUPIED');sameReceipt(accepted,principal,hash);}
    return {...response(row,seat(row,actor),actor),duplicate:!won,acceptedRevision:state.revision};
  }
  async function command(id: string, actor: string | null, body: Body) {
    keys(body, ['operation','commandId','revision','choice']);
    if (!validId(body.commandId) || !validVersion(body.revision) || typeof body.choice !== 'string' || !body.choice || body.choice.length > 512) fail('Use a valid command ID, revision and choice.');
    let row = await rowFor(id);
    if (actor === null && row.mode !== 'cpu') fail('This match has no computer seat.',403,'NO_COMPUTER');
    const side = actor === null ? other(row.owner_side) : seat(row,actor), principal = actor === null ? 'computer' : user(actor);
    const key = id + (actor === null ? ':computer:' : ':command:') + body.commandId, hash = await digest({operation:'command',actor:principal,side,revision:body.revision,choice:body.choice});
    const receipt = await prior(key);
    if (receipt) {sameReceipt(receipt,principal,hash);row = await settleTime(await rowFor(id));return {...response(row,side,actor ?? undefined),duplicate:true,acceptedRevision:receipt.result_version};}
    if (!row.state) fail('Wait for the other player to join.',409,'WAITING_FOR_OPPONENT');
    const time = now();row = await settleTime(row,time);
    if (row.version !== body.revision) fail('This match has advanced. Refresh and use its current choices.',409,'STALE_REVISION');
    const m = parse(row), rules = rulesFor(row.rules_version);
    if (m.status === 'finished') fail('This match has ended.',409,'MATCH_FINISHED');
    if (body.choice !== 'concede') {const p = prompt(m,rules,side);if (!p || p.side !== side || !p.choices.some(c => c.id === body.choice)) fail('That choice is not available to your seat.',422,'ILLEGAL_CHOICE');}
    // Rules errors abort before any database mutation. No partial action is saved.
    const state = applyCommand(m,rules,side,{revision:body.revision,choice:body.choice},entropy,time);
    const c = savedClock(row,m), updatedClock = c ? JSON.stringify(moveClock(c,clockSeat(state),time)) : null;
    const won = await commit(row,state,principal,key,hash,row.guest,updatedClock);row = await rowFor(id);
    if (!won) {const accepted = await prior(key);if (!accepted) fail('Another command advanced this match.',409,'STALE_REVISION');sameReceipt(accepted,principal,hash);}
    return {...response(row,side,actor ?? undefined),duplicate:!won,acceptedRevision:state.revision};
  }
  async function readComputer(id: string) {
    const row = await rowFor(id);
    if (row.mode !== 'cpu') fail('This match has no computer seat.',403,'NO_COMPUTER');
    return response(await settleTime(row),other(row.owner_side));
  }
  async function advanceComputer(id: string, actor: string, body: Body) {
    keys(body,['operation']);
    const owner = await read(id,actor); // Authorize before any computer work.
    if (owner.mode !== 'cpu') fail('This match has no computer seat.',403,'NO_COMPUTER');
    let steps = 0;
    // Bound requests including contention. A client may request another batch;
    // exhaustion never invents a pass, concession or success receipt.
    for (let attempt = 0; attempt < 24; attempt++) {
      const view = await readComputer(id);
      const choice = view.game && chooseComputerAction(view.game,view.side);
      if (!choice) break;
      try {
        const result = await command(id,null,{commandId:computerPolicy+'-'+view.revision,revision:view.revision,choice});
        if (!result.duplicate) steps++;
      } catch(e) {
        if (!(e instanceof MatchServiceError) || !['STALE_REVISION','MATCH_FINISHED'].includes(e.code)) throw e;
      }
    }
    const row = await settleTime(await rowFor(id));
    const result = response(row,seat(row,actor),actor), cpu = response(row,other(row.owner_side));
    const status = result.game?.status === 'finished' ? 'finished' : cpu.game && chooseComputerAction(cpu.game,cpu.side) ? 'ready' : 'waiting';
    return {...result,computer:{policy:computerPolicy,status,steps}};
  }
  return {create,join,read,advanceComputer,
    starters: () => starterManifest.decks.map(d => ({id:d.id,side:d.side,size:d.size,admitted:d.main.every(bp => rulesFor(options.currentRules).supports(bp))})),
    list: async (actor: string) => {user(actor);return (await db.prepare("SELECT id,mode,CASE WHEN owner = ? THEN owner_side WHEN owner_side = 'dark' THEN 'light' ELSE 'dark' END AS side,rules_version AS rules,deck_size AS deckSize,version AS revision,created,updated FROM native_matches WHERE owner = ? OR guest = ? ORDER BY updated DESC LIMIT 30").bind(actor,actor,actor).all()).results;},
    command: (id: string, actor: string, body: Body) => {user(actor);return command(id,actor,body);},
    // Internal diagnostics/dispatcher only; never accept client-selected CPU moves.
    readComputer,
    computerCommand: (id: string, body: Body) => command(id,null,body),
  };
}
