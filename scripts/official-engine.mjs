/** Isolated local development runtime. Never changes the upstream rules. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(readFileSync(resolve(root,'engine/source.json'),'utf8'));
const envFile=resolve(root,'engine/.env'),compose=resolve(root,'engine/compose.yaml');
if(!existsSync(envFile)){mkdirSync(resolve(root,'.engine'),{recursive:true});writeFileSync(envFile,`SWCCG_ENGINE_SOURCE=${resolve(root,'.engine/source')}\nSWCCG_DB_PASSWORD=${randomBytes(24).toString('hex')}\nSWCCG_DB_ROOT_PASSWORD=${randomBytes(24).toString('hex')}\n`,{mode:0o600})}
const values=Object.fromEntries(readFileSync(envFile,'utf8').trim().split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
function command(program,args,quiet=false){const r=spawnSync(program,args,{cwd:root,stdio:quiet?['ignore','pipe','inherit']:'inherit',encoding:'utf8'});if(r.status!==0)throw Error(`${program} did not complete.`);return r.stdout?.trim()}
const docker=(args)=>command('docker',['compose','--env-file',envFile,'-f',compose,...args]);
const action=process.argv[2]||'start';
if(action==='stop'){docker(['stop']);process.exit(0)}
if(action==='status'){docker(['ps']);process.exit(0)}
if(action!=='start')throw Error('Use start, stop or status.');
const source=values.SWCCG_ENGINE_SOURCE;
if(!existsSync(resolve(source,'.git'))){mkdirSync(dirname(source),{recursive:true});command('git',['clone',config.repository,source]);command('git',['-C',source,'checkout','--detach',config.commit])}
if(command('git',['-C',source,'rev-parse','HEAD'],true)!==config.commit)throw Error('Engine source differs from the pinned commit. Review it before starting.');
if(!existsSync(resolve(source,'src/gemp-swccg-async/target/web.jar')))command('docker',['run','--rm','--name','swccg-official-compile','-v',source+':/opt/gemp-swccg','-v','swccg-official-maven:/root/.m2','-w','/opt/gemp-swccg/src','maven:3.9.6-eclipse-temurin-21','mvn','-B','-ntp','install','-DskipTests']);
docker(['up','-d']);
const base='http://127.0.0.1:17181';let ready=false;
for(let n=0;n<60;n++){try{ready=(await fetch(base+'/gemp-swccg/index.html',{signal:AbortSignal.timeout(2000)})).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,1000))}
if(!ready)throw Error('Rules service has not become ready. Check npm run engine:status.');
// Upstream local seed accounts are development-only. Do not expose this stack remotely.
const login=await fetch(base+'/gemp-swccg-server/login',{method:'POST',body:new URLSearchParams({login:'asdf',password:'asdf'})});
const cookie=login.headers.getSetCookie().find(c=>c.startsWith('loggedUser='))?.split(';')[0];if(!cookie)throw Error('Could not initialize the local engine session.');
const hall=await fetch(base+'/gemp-swccg-server/hall',{headers:{cookie}});const text=await hall.text();
if(text.includes('Server is not yet in operational mode')){const response=await fetch(base+'/gemp-swccg-server/admin/shutdown',{method:'POST',headers:{cookie},body:new URLSearchParams({enabled:'false'})});if(!response.ok)throw Error('Could not enable the local game service.')}
console.log('Official engine ready on http://127.0.0.1:17181. App preview uses GEMP_ORIGIN in .env.local.');
