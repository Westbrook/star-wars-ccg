import assert from 'node:assert/strict';
import {frameLocation, gameFrame, readGameLocation, viewLocation} from '../lib/game-links.ts';

const origin = 'http://localhost:5173';
const id = '0a3046f2341c-430b-89c1-8f8b-2bccce10'; // GEMP's reversed UUID format.
const original = `${origin}/?view=decks&progress-report&theme=dark#table`;
const game = frameLocation(original, gameFrame(id));
assert.equal(new URL(game).searchParams.get('gameId'), id);
assert.equal(new URL(game).searchParams.get('view'), 'table');
assert.ok(new URL(game).searchParams.has('progress-report'));
assert.equal(new URL(game).searchParams.get('theme'), 'dark');
assert.equal(new URL(game).hash, '#table');

// No in-memory state or storage is needed: a freshly loaded link recovers the table.
const reloaded = readGameLocation(game);
assert.equal(reloaded.view, 'Battlefield');
assert.equal(reloaded.frame, gameFrame(id));
assert.equal(reloaded.invalidGame, false);
assert.equal(readGameLocation(`${origin}/?gameId=${id}`).frame, gameFrame(id));
const away = viewLocation(game, 'Card archive');
assert.equal(readGameLocation(away).view, 'Card archive');
assert.equal(readGameLocation(away).frame, '');
assert.equal(new URL(away).searchParams.get('gameId'), null);
assert.ok(new URL(away).searchParams.has('progress-report'));
// Back/forward can restore either route with the same parser, without creating a game.
assert.deepEqual(readGameLocation(game), reloaded);
assert.equal(readGameLocation(frameLocation(away, '/gemp-swccg/hall.html')).gameId, null);
assert.equal(readGameLocation(frameLocation(game, '/gemp-swccg/deckBuild.html')).frame, '/gemp-swccg/deckBuild.html');
assert.equal(readGameLocation(`${origin}/?view=table`).frame, '/gemp-swccg/hall.html');

for (const suffix of ['', 'bad%2Fid', '%00', '%3Cscript%3E', 'x'.repeat(129), 'a&gameId=b']) {
  const route = readGameLocation(`${origin}/?view=table&gameId=${suffix}`);
  assert.equal(route.invalidGame, true, suffix);
  assert.equal(route.frame, '');
}
for (const path of [null, {}, '//other.example/gemp-swccg/game.html?gameId=abc', 'javascript:alert(1)',
  '/gemp-swccg/game.html', '/gemp-swccg/game.html?gameId=a&gameId=b', '/gemp-swccg/game.html?gameId=../admin',
  '/gemp-swccg-server/admin', '/unrelated.html?gameId=abc']) assert.equal(frameLocation(original, path), null);
const clean = frameLocation(`${origin}/`, `${gameFrame(id)}&participantId=other&channelNumber=7&loggedUser=secret`);
assert.deepEqual([...new URL(clean).searchParams.keys()], ['view', 'gameId']);
console.log('Game links restore on fresh load, preserve report navigation, reject unsafe targets and exclude native session parameters.');
