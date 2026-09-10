"""Import printed SWCCG records. Metadata never substitutes for executable rules.
Usage: python3 scripts/import-card-catalog.py [--commit SHA]
"""
import argparse,collections,hashlib,html,json,re,urllib.request
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--commit',default='6632336c00a87dfdb90920cc3d851786349b29b2');args=parser.parse_args()
if not re.fullmatch(r'[a-f0-9]{40}',args.commit):raise ValueError('Use a full source commit')
base='https://raw.githubusercontent.com/swccgpc/swccg-card-json/'+args.commit+'/'
def fetch(name):
 req=urllib.request.Request(base+name,headers={'User-Agent':'Holotable-card-import'})
 with urllib.request.urlopen(req,timeout=60) as r:return r.read()
raw={name:fetch(name) for name in ['Light.json','Dark.json','sets.json','LICENSE']}
sets=json.loads(raw['sets.json']);set_map={s['id']:s for s in sets}
source=json.loads(raw['Light.json'])['cards']+json.loads(raw['Dark.json'])['cards']
def clean(value):return html.unescape(re.sub(r'</?[a-zA-Z][^>]*>','',str(value or ''))).strip()
def face(f):
 image=f.get('imageUrl','')
 if image and not image.startswith('https://res.starwarsccg.org/'):raise ValueError('Unexpected artwork host')
 return {'title':clean(f.get('title')),'image':image,'text':clean(f.get('gametext')),'lore':clean(f.get('lore')),'stats':{k:clean(f[k]) for k in ['deploy','power','ability','destiny','forfeit','armor','maneuver','hyperspeed','landspeed','parsec','ferocity'] if k in f},'icons':f.get('icons',[])}
catalog=[]
for c in source:
 f=c['front'];setid=c['set'];setname=set_map[setid]['name']
 catalog.append({'id':'pc-'+str(c['id']),'sourceId':c['id'],'gempId':c.get('gempId'),'name':clean(f['title']).lstrip('•<> '),'side':c['side'].lower(),'type':f['type'],'subType':f.get('subType',''),'setId':setid,'setName':setname,'setIds':list(dict.fromkeys([setid]+[p['set'] for p in c.get('printings',[])])),'era':'virtual' if setname.startswith('Virtual') or setid=='301' else 'decipher','rarity':c.get('rarity',''),'characteristics':c.get('characteristics',[]),'personas':c.get('personas',[]),'uniqueness':f.get('uniqueness',''),**face(f),'back':face(c['back']) if c.get('back') else None})
assert len({c['id'] for c in catalog})==len(catalog)
catalog.sort(key=lambda c:(c['name'].lower(),c['setId'],c['id']))
manifest={'source':'https://github.com/swccgpc/swccg-card-json','commit':args.commit,'importedAt':datetime.now(timezone.utc).isoformat(),'files':{name:{'url':base+name,'sha256':hashlib.sha256(body).hexdigest()} for name,body in raw.items()},'count':len(catalog),'eras':dict(collections.Counter(c['era'] for c in catalog)),'types':dict(collections.Counter(c['type'] for c in catalog)),'sets':[{'id':s['id'],'name':s['name'],'release':s.get('date_release',''),'count':sum(s['id'] in c['setIds'] for c in catalog)} for s in sets if any(s['id'] in c['setIds'] for c in catalog)],'notes':['Current main Light and Dark JSON are imported; historical legacy virtual files are excluded.','Alternate artwork/printings may share a GEMP blueprint. Record count is not a count of verified playable implementations.','Card text and variable stats are preserved; the rules engine determines legality and executes abilities.','Artwork loads from the source archive on demand.']}
out=ROOT/'public/catalog';out.mkdir(exist_ok=True);(ROOT/'data').mkdir(exist_ok=True)
(out/'cards.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n')
for path in [out/'manifest.json',ROOT/'data/catalog-manifest.json']:path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
(ROOT/'data/SWCCGPC-LICENSE').write_bytes(raw['LICENSE'])
print(json.dumps({k:manifest[k] for k in ['commit','count','eras']},indent=2))
