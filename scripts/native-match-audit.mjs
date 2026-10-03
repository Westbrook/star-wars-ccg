import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {runStarterMatch,replayStarterMatch} from '../tests/native-engine/match-runner.mjs';
// Test-only integration audit. This tool never changes production admission.
const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1]};
const start=Number(option('seed',1)),count=Number(option('count',10)),size=Number(option('size',60)),out=path.resolve(option('output',path.join(os.tmpdir(),'swccg-match-audit')));
if(!Number.isSafeInteger(count)||count<1||count>1000||!Number.isSafeInteger(start)||start<0||start+count>0x100000000||![40,60].includes(size))throw Error('Use --seed <uint32> --count <1..1000> --size <40|60> --output <directory>');
fs.mkdirSync(out,{recursive:true});
const summaries=[],hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(let seed=start;seed<start+count;seed++){
 try{
  const run=runStarterMatch({seed,size,replay:args.includes('--verify-each-command')});
  if(args.includes('--replay')&&hash(replayStarterMatch(run))!==hash(run.state))throw Error('Full transcript replay differs');
  const {transcript,state,...summary}=run;summary.transcriptSha256=hash(transcript);summary.finalStateSha256=hash(state);summaries.push(summary);
  fs.writeFileSync(path.join(out,`match-${size}-${seed}.json`),JSON.stringify(run)+'\n');
  fs.writeFileSync(path.join(out,`summary-${size}.json`),JSON.stringify({schema:1,deckSize:size,rules:'premiere-native-1',admission:'test-only',runs:summaries},null,2)+'\n');
  console.log(JSON.stringify({seed,size,turns:run.turns,commands:run.commands,result:run.result}));
 }catch(error){fs.writeFileSync(path.join(out,`failure-${size}-${seed}.json`),JSON.stringify(error.audit??{seed,message:error.message},null,2)+'\n');console.error(error);process.exitCode=1;break}
}
