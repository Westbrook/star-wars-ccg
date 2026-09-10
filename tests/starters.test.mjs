import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const {decks,source}=JSON.parse(readFileSync('data/starter-decks.json','utf8'));
const cards=JSON.parse(readFileSync('public/catalog/cards.json','utf8'));
const catalog=new Map(cards.filter(c=>c.gempId).map(c=>[c.gempId,c]));
assert.equal(decks.length,4);
assert.equal(new Set(decks.map(d=>`${d.side}-${d.size}`)).size,4);
assert.equal(source.commit,JSON.parse(readFileSync('engine/source.json','utf8')).commit);
for(const deck of decks){
  assert.equal(deck.main.length,deck.size);
  assert.equal(deck.format,deck.size===60?'open':'open40card');
  assert.equal(deck.outside.length,0,'Preserve the authored outside-deck list');
  assert.ok([...deck.main,...deck.outside].every(id=>catalog.get(id)?.side===deck.side),deck.id);
  assert.equal(deck.virtualCount,deck.main.filter(id=>catalog.get(id).era==='virtual').length);
  assert.ok(deck.virtualCount>0);
  const contents=deck.main.join(',')+'|'+deck.outside.join(',');
  assert.equal(createHash('sha256').update(contents).digest('hex'),deck.contentsSha256);
  if(deck.size===60){
    assert.equal(deck.libraryName,`Precon Open Demo Deck (${deck.side==='light'?'Light':'Dark'})`);
    assert.ok(deck.main.some(id=>catalog.get(id).type==='Objective'));
  }
}
console.log('Four authored starters: correct size/side/format, objective-led Open demos, all 200 card slots present, source fingerprints intact.');
