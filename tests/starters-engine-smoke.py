"""Verify all shipped starters against local GEMP, then create/concede CPU tables.
This proves format acceptance and starting decisions, not full-match AI quality.
"""
import hashlib
import http.cookiejar
from html.parser import HTMLParser
import json
from pathlib import Path
import secrets
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE='http://localhost:5173/gemp-swccg-server'
manifest=json.loads(Path('data/starter-decks.json').read_text())
decks=manifest['decks']
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(path,form=None):
    data=urllib.parse.urlencode(form).encode() if form is not None else None
    with opener.open(urllib.request.Request(BASE+path,data=data),timeout=35) as response:
        return response.read().decode()
def xml(path,form=None): return ET.fromstring(request(path,form))
def ids(root,tag='card'): return [c.get('blueprintId') for c in root.findall('.//'+tag)]
class Results(HTMLParser):
    def __init__(self): super().__init__(); self.classes={}
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if attrs.get('id'): self.classes[attrs['id']]=attrs.get('class','').split()

request('/register',{'login':'s'+secrets.token_hex(4),'password':secrets.token_hex(20)})
for deck in decks:
    name=deck['libraryName']
    current=xml('/deck/library?'+urllib.parse.urlencode({'deckName':name}))
    assert sorted(ids(current))==sorted(deck['main']),name
    assert sorted(ids(current,'cardOutsideDeck'))==sorted(deck['outside']),name
    contents=','.join(deck['main'])+'|'+','.join(deck['outside'])
    assert hashlib.sha256(contents.encode()).hexdigest()==deck['contentsSha256']
    results=Results();results.feed(request('/deck/stats',{'deckContents':contents}))
    selected='deckstats-format-'+('Open' if deck['size']==60 else 'Open-40-cards')+'-content'
    assert 'deckstats-format-valid' in results.classes.get(selected,[]),(name,selected)
    wrong='deckstats-format-'+('Open-40-cards' if deck['size']==60 else 'Open')+'-content'
    assert 'deckstats-format-invalid' in results.classes.get(wrong,[]),'Wrong-size format must not pass'
    saved_name='Starter check '+deck['id']
    xml('/deck',{'deckName':saved_name,'deckContents':contents})
    saved=xml('/deck?'+urllib.parse.urlencode({'deckName':saved_name}))
    assert sorted(ids(saved))==sorted(deck['main']) and sorted(ids(saved,'cardOutsideDeck'))==sorted(deck['outside'])
    opponent=next(d for d in decks if d['size']==deck['size'] and d['side']!=deck['side'])
    hall=xml('/hall');channel=hall.get('channelNumber')
    created=xml('/hall',{'format':deck['format'],'deckName':name,'sampleDeck':'true','tableDesc':'Current starter verification','isPrivate':'true','playVsAi':'true','aiSkill':'BEGINNER','aiDeckName':opponent['libraryName'],'aiDeckSample':'true'})
    assert created.find('.//error') is None,ET.tostring(created)
    game_id=None
    for _ in range(4):
        update=xml('/hall/update',{'channelNumber':channel});channel=update.get('channelNumber',channel)
        game=update.find('.//newGame')
        if game is not None: game_id=game.get('id');break
    assert game_id,name
    try:
        state=xml('/game/'+game_id);pending=None
        for _ in range(8):
            pending=next((e for e in state.findall('.//ge') if e.get('type')=='D'),None)
            if pending is not None:break
            state=xml('/game/'+game_id,{'channelNumber':state.get('cn')})
        assert pending is not None,name
        if pending.get('decisionType')=='MULTIPLE_CHOICE' and pending.get('text')=='Select OK to start game':
            state=xml('/game/'+game_id,{'channelNumber':state.get('cn'),'decisionId':pending.get('id'),'decisionValue':'0'})
            for _ in range(10):
                pending=next((e for e in state.findall('.//ge') if e.get('type')=='D'),None)
                if pending is not None:break
                state=xml('/game/'+game_id,{'channelNumber':state.get('cn')})
            assert pending is not None,name
        assert pending.get('decisionType') in ['ARBITRARY_CARDS','CARD_SELECTION','CARD_ACTION_CHOICE','MULTIPLE_CHOICE','INTEGER','ACTION_CHOICE','EMPTY']
        print(name+': exact library match, selected format valid, wrong size rejected, saved copy intact, CPU table and setup decision accepted')
    finally:
        xml('/game/'+game_id+'/concede',{})
print('All four starters verified against live local GEMP; no rules or authored card lists changed.')
