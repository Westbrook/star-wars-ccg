"""HTTP integration checks against the real GEMP service, through the app proxy.
Creates disposable local players and test games. Never targets a public server by default.
"""
import os,secrets,urllib.request,urllib.parse,http.cookiejar,xml.etree.ElementTree as ET
BASE=os.environ.get('SWCCG_TEST_ORIGIN','http://localhost:5173')+'/gemp-swccg-server'
def client():
 jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
 def request(path,form=None):
  req=urllib.request.Request(BASE+path,data=urllib.parse.urlencode(form).encode() if form is not None else None)
  with opener.open(req,timeout=35) as response:return response.read().decode()
 return request
admin=client();admin('/login',{'login':'asdf','password':'asdf'});admin('/admin/shutdown',{'enabled':'false'})
player=client();player('/register',{'login':'h'+secrets.token_hex(4),'password':secrets.token_hex(20)})
def xml(path,form=None):return ET.fromstring(player(path,form))
def ids(root,tag='card'):return [c.attrib['blueprintId'] for c in root.findall('.//'+tag)]
for size in [60,40]:
 light='Precon P-DSII Death Star II Starter (Light)' if size==60 else 'Open 40 card - Beginner Light'
 dark='Precon P-DSII Death Star II Starter (Dark)' if size==60 else 'Open 40 card - Beginner Dark'
 precon=xml('/deck/library?'+urllib.parse.urlencode({'deckName':light}));main=ids(precon);outside=ids(precon,'cardOutsideDeck');assert len(main)==size,(size,len(main))
 name='Smoke '+str(size);contents=','.join(main)+'|'+','.join(outside)
 xml('/deck',{'deckName':name,'deckContents':contents});loaded=xml('/deck?'+urllib.parse.urlencode({'deckName':name}));assert sorted(ids(loaded))==sorted(main);assert sorted(ids(loaded,'cardOutsideDeck'))==sorted(outside)
 stats=player('/deck/stats',{'deckContents':contents});assert 'deckstats-format-valid' in stats
 hall=xml('/hall');cn=hall.attrib['channelNumber'];assert hall.attrib['aiTablesEnabledBoolean']=='true'
 create=xml('/hall',{'format':'open' if size==60 else 'open40card','deckName':name,'sampleDeck':'false','tableDesc':'Holotable integration check','isPrivate':'false','playVsAi':'true','aiSkill':'BEGINNER','aiDeckName':dark,'aiDeckSample':'true'})
 assert create.find('.//error') is None,ET.tostring(create).decode()
 game_id=None
 for _ in range(4):
  update=xml('/hall/update',{'channelNumber':cn});cn=update.attrib.get('channelNumber',cn);new=update.find('.//newGame')
  if new is not None:game_id=new.attrib['id'];break
 assert game_id,'No CPU game created'
 state=xml('/game/'+game_id);decision=None
 for _ in range(5):
  decision=next((e for e in state.findall('.//ge') if e.attrib.get('type')=='D'),None)
  if decision is not None:break
  state=xml('/game/'+game_id,{'channelNumber':state.attrib['cn']})
 assert decision is not None,'No decision from engine'
 kind=decision.attrib['decisionType']
 if kind=='MULTIPLE_CHOICE' and decision.attrib.get('text')=='Select OK to start game':
  state=xml('/game/'+game_id,{'channelNumber':state.attrib['cn'],'decisionId':decision.attrib['id'],'decisionValue':'0'})
  for _ in range(8):
   decision=next((e for e in state.findall('.//ge') if e.attrib.get('type')=='D'),None)
   if decision is not None:break
   state=xml('/game/'+game_id,{'channelNumber':state.attrib['cn']})
  assert decision is not None,'No starting-location decision'
  kind=decision.attrib['decisionType']
 assert kind=='ARBITRARY_CARDS',(kind,ET.tostring(decision).decode())
 params={}
 for p in decision.findall('parameter'):params.setdefault(p.attrib['name'],[]).append(p.attrib['value'])
 choices=params['cardId'];selectable=params.get('selectable',['true']*len(choices));choice=next(c for c,s in zip(choices,selectable) if s=='true')
 response=xml('/game/'+game_id,{'channelNumber':state.attrib['cn'],'decisionId':decision.attrib['id'],'decisionValue':choice})
 assert response.tag=='update';print(f'{size}-card official starter: save/readback, CPU table, starting-location decision accepted')
 xml('/game/'+game_id+'/concede',{})
print('Authoritative GEMP smoke checks passed. No full-match/rules-exhaustiveness claim.')
