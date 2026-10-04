import fs from 'node:fs';
import {runtime,rules,pull,location,force,phase,priority,step,seek} from './noble-fixture.mjs';
import {load} from '../native-proof/load-engine.mjs';
export {runtime,rules,pull,location,force,phase,priority,step,seek,load};
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
export function fixture(side='light',extra={}){
 let m=runtime.createMatch('ground-creature-test',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['6_48','1_152','1_153','1_2','1_6','1_149','1_11','1_70','1_88']:['6_138','1_317','1_312','1_194','1_262']),...(extra[d.side]??[]),...d.main].slice(0,60)})),rules);
 const site=location(m,'light','1_129'),otherSite=location(m,'dark','1_293'),mobile=location(m,'dark','1_284');
 const creature=pull(m,side,side==='light'?'6_48':'6_138','hand');force(m,'light',12);force(m,'dark',12);
 m=phase(m,'deploy');if(side==='light')m=seek(m,x=>x.turn.side==='light'&&x.turn.phase==='deploy'&&x.stack.length===1);
 m=priority(m,side);return {m,creature,site,otherSite,mobile,side};
}
export function deploy(f){f.m=step(f.m,'ground-creature:deploy:'+f.creature+':'+f.site);f.m=priority(seek(f.m,x=>x.stack.length===1),f.side);return f;}
export function attack(f,mode='hunt',targetSide=f.side==='light'?'dark':'light'){
 let m=phase(f.m,'battle');m=priority(m,f.side);m=step(m,'creature:begin:'+f.creature+':'+f.site+':'+mode+':'+targetSide);return m;
}
export function armedFixture({side='light',rifle=true,hunt=false}={}){
 const f=deploy(fixture(side));const userSide=hunt?(side==='light'?'dark':'light'):side;
 const target=pull(f.m,userSide,userSide==='light'?'1_28':'1_194','table',f.site);
 const weapon=pull(f.m,userSide,userSide==='light'?(rifle?'1_153':'1_152'):(rifle?'1_312':'1_317'),'table',f.site);f.m.cards[weapon].attachedTo=target;
 f.m=attack(f,hunt?'hunt':'assault',userSide);f.m=seek(f.m,x=>x.stack.at(-1)?.event?.kind==='attack-weapons');f.m=priority(f.m,userSide);return {...f,target,weapon,userSide};
}
