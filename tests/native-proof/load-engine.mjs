import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Compile the actual TypeScript modules in memory, with no bundler/runtime mock.
const cache=new Map();
export function load(file){
 const filename=file instanceof URL?fileURLToPath(file):file;
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 if(filename.endsWith('.json'))module.exports=JSON.parse(fs.readFileSync(filename,'utf8'));
 else{
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const require=specifier=>{if(!specifier.startsWith('.'))throw Error('Unexpected engine dependency: '+specifier);let target=path.resolve(path.dirname(filename),specifier);if(!path.extname(target))target+='.ts';return load(target)};
  new Function('require','module','exports',compiled)(require,module,module.exports);
 }
 return module.exports;
}
export const engine=load(new URL('../../lib/native-proof/engine.ts',import.meta.url));
