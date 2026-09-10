export type View = 'Play' | 'Card archive' | 'My decks' | 'Sealed play' | 'How to play' | 'Battlefield';
export const viewParams: Record<View, string> = {
  Play: 'play', 'Card archive': 'cards', 'My decks': 'decks', 'Sealed play': 'sealed',
  'How to play': 'rules', Battlefield: 'table',
};
const gamePage = '/gemp-swccg/game.html';
const hallPage = '/gemp-swccg/hall.html';
const deckPage = '/gemp-swccg/deckBuild.html';

// IDs are opaque engine identifiers (GEMP currently uses reversed UUIDs).
// Restrict URL structure, not the order of UUID groups.
export function validGameId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export function gameFrame(id: string) {
  if (!validGameId(id)) throw new Error('This game link is invalid.');
  return `${gamePage}?gameId=${encodeURIComponent(id)}`;
}
export function readGameLocation(href: string) {
  const url = new URL(href);
  const values = url.searchParams.getAll('gameId');
  const invalidGame = values.length > 0 && (values.length !== 1 || !validGameId(values[0]));
  const gameId = values.length === 1 && !invalidGame ? values[0] : null;
  const view: View = values.length ? 'Battlefield' :
    (Object.keys(viewParams) as View[]).find(v => viewParams[v] === url.searchParams.get('view')) || 'Play';
  const frame = invalidGame || view !== 'Battlefield' ? '' :
    gameId ? gameFrame(gameId) : url.searchParams.get('screen') === 'decks' ? deckPage : hallPage;
  return {view, frame, gameId, invalidGame, report: url.searchParams.has('progress-report')};
}
export function viewLocation(href: string, view: View) {
  const url = new URL(href);
  url.searchParams.set('view', viewParams[view]);
  url.searchParams.delete('gameId');
  url.searchParams.delete('screen');
  return url.href;
}
export function frameLocation(href: string, path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const current = new URL(href);
  let target: URL;
  try { target = new URL(path, current); } catch { return null; }
  if (target.origin !== current.origin) return null;
  const url = new URL(viewLocation(href, 'Battlefield'));
  if (target.pathname === gamePage) {
    const ids = target.searchParams.getAll('gameId');
    if (ids.length !== 1 || !validGameId(ids[0])) return null;
    // Credentials, channel numbers and unrelated native query parameters never
    // become part of the wrapper link. GEMP restores the signed-in player's state.
    url.searchParams.set('gameId', ids[0]);
  } else if (target.pathname === deckPage) url.searchParams.set('screen', 'decks');
  else if (target.pathname !== hallPage) return null;
  return url.href;
}
