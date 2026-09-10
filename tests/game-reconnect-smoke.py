"""Local-only HTTP check of native GEMP refresh restoration. No browser automation.
Creates disposable pilots and a CPU game, then concedes that game on completion.
"""
import http.cookiejar
import secrets
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ORIGIN = 'http://localhost:5173'
BASE = ORIGIN + '/gemp-swccg-server'

def client():
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    def request(path, form=None, expected=200):
        data = urllib.parse.urlencode(form).encode() if form is not None else None
        req = urllib.request.Request(BASE + path, data=data)
        try:
            with opener.open(req, timeout=35) as response:
                assert response.status == expected
                return response.read().decode()
        except urllib.error.HTTPError as error:
            assert error.code == expected, (path, error.code, expected)
            return error.read().decode()
    return request

player, stranger, anonymous = client(), client(), client()
for pilot in [player, stranger]:
    pilot('/register', {'login':'r'+secrets.token_hex(4), 'password':secrets.token_hex(20)})
def xml(path, form=None): return ET.fromstring(player(path, form))
def decision(state):
    for _ in range(8):
        found = next((e for e in state.findall('.//ge') if e.get('type') == 'D'), None)
        if found is not None: return state, found
        state = xml('/game/'+game_id, {'channelNumber':state.get('cn')})
    raise AssertionError('No pending decision')

hall = xml('/hall')
created = xml('/hall', {'format':'open', 'deckName':'Precon P-DSII Death Star II Starter (Light)',
    'sampleDeck':'true','tableDesc':'Refresh restoration check','isPrivate':'true',
    'playVsAi':'true','aiSkill':'BEGINNER','aiDeckName':'Precon P-DSII Death Star II Starter (Dark)','aiDeckSample':'true'})
assert created.find('.//error') is None, ET.tostring(created)
channel = hall.get('channelNumber')
game_id = None
for _ in range(4):
    update = xml('/hall/update', {'channelNumber':channel})
    channel = update.get('channelNumber', channel)
    game = update.find('.//newGame')
    if game is not None:
        game_id = game.get('id'); break
assert game_id
try:
    first, pending = decision(xml('/game/'+game_id))
    old_channel = first.get('cn')
    # Same authenticated GET as a freshly mounted native game page.
    restored, same_pending = decision(xml('/game/'+game_id))
    assert restored.get('cn') != old_channel
    assert ET.tostring(pending) == ET.tostring(same_pending), 'Refresh altered the pending choice'
    player('/game/'+game_id, {'channelNumber':old_channel}, expected=409)
    anonymous('/game/'+game_id, expected=401)
    stranger('/game/'+game_id, expected=403)
    anonymous('/game/not-a-real-game', expected=401)
    player('/game/not-a-real-game', expected=404)
    kind = same_pending.get('decisionType')
    params = {}
    for p in same_pending.findall('parameter'): params.setdefault(p.get('name'), []).append(p.get('value'))
    if kind == 'MULTIPLE_CHOICE' and same_pending.get('text') == 'Select OK to start game':
        choice = '0'
    elif kind == 'ARBITRARY_CARDS':
        selectable = params.get('selectable', ['true']*len(params['cardId']))
        choice = next(c for c,s in zip(params['cardId'], selectable) if s == 'true')
    else: raise AssertionError(('Unexpected starting decision', kind))
    after = xml('/game/'+game_id, {'channelNumber':restored.get('cn'),
        'decisionId':same_pending.get('id'), 'decisionValue':choice})
    assert after.tag == 'update'
    print('Same-game reconnect preserves pending choice; refreshed channel accepts it; old channel, signed-out player and private outsider are rejected.')
finally:
    player('/game/'+game_id+'/concede', {})
