import secrets,urllib.request,urllib.parse,http.cookiejar,xml.etree.ElementTree as E
BASE='http://localhost:5173/gemp-swccg-server'
def session():
 o=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(p,f=None):
  return o.open(urllib.request.Request(BASE+p,data=urllib.parse.urlencode(f).encode() if f is not None else None),timeout=35).read().decode()
 return call
admin=session();admin('/login',{'login':'asdf','password':'asdf'});p=session();name='s'+secrets.token_hex(4);p('/register',{'login':name,'password':secrets.token_hex(20)})
admin('/admin/collections/additems',{'collectionType':'permanent','players':name,'product':'1x Official Tournament Sealed Deck'})
r=E.fromstring(p('/collection/permanent',{'pack':'Official Tournament Sealed Deck'}));cards=r.findall('card');packs=r.findall('pack');print('Authentic OTSD product:',sum(int(c.attrib['count']) for c in cards),'fixed cards;',[(x.attrib['blueprintId'],x.attrib['count']) for x in packs]);assert sum(int(c.attrib['count']) for c in cards)==18
assert sum(int(c.attrib['count']) for c in packs)==5
for pack in packs:
 for _ in range(int(pack.attrib['count'])):
  result=E.fromstring(p('/collection/permanent',{'pack':pack.attrib['blueprintId']}));assert result.findall('card')
try:p('/collection/permanent',{'pack':'Official Tournament Sealed Deck'});raise AssertionError('Opened an unowned second product')
except urllib.error.HTTPError as e:assert e.code==404,e.code
print('Real sealed collation, nested pack opening and owned-product consumption checks passed.')
