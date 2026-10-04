import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,begin,atExit,atMove,atBoard,finish,step,seek,ids,clone,state,ground,rules,priority,load} from './character-react-fixture.mjs';
const mod=n=>load(new URL('../../lib/native-engine/'+n+'.ts',import.meta.url));
const react=mod('character-react'),identity=mod('identity'),board=mod('board');
for(const mode of ['ground','open','closed','landed','cancel','sense-fails','embark','ground-embark','battle'])test('executed GEMP character reaction: '+mode,()=>{
 const f=fixture(mode),before=f.m.players.light.force.length;let m=begin(f);
 if(!mode.startsWith('ground')){m=atExit(m);assert.equal(m.players.light.force.length,before-1);assert.equal(m.cards[f.wolf].attachedTo,f.host);assert.deepEqual(ids(m),['disembark']);m=step(clone(m),'disembark');}
 m=atMove(m);assert.equal(m.cards[f.wolf].attachedTo,undefined);assert.equal(m.cards[f.wolf].location,f.site);
 if(['cancel','sense-fails'].includes(mode)){state.moveCard(m,mode==='cancel'?f.zero:f.high,'reserve');m=priority(m,'dark');m=step(m,'cancel:play:'+f.sense+':'+f.wolf+':'+f.vader);m=seek(m,x=>x.cards[f.sense].zone==='used');}
 if(mode.endsWith('embark')){m=atBoard(m);assert.ok(!ids(m).some(id=>id.includes(':pilot')),'Wolfman is not a pilot');m=step(clone(m),'board:'+f.dest+':passenger');}
 if(mode==='cancel'){m=seek(m,x=>!x.stack.some(r=>r.action?.handler==='core:canceled'));}else m=finish(m);
 const row={mode,cost:before-m.players.light.force.length,leftCarrier:m.cards[f.wolf].attachedTo!==f.host,atDestination:m.cards[f.wolf].location===f.dune,boarded:m.cards[f.wolf].attachedTo===f.dest,gunCarried:m.cards[f.gun].attachedTo===f.wolf,regularMove:ground.usage(m).moved.includes(f.wolf),...(mode==='cancel'?{locked:ground.usage(m).reacted.includes(f.wolf)}:{})};
 const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/character-react-results.json',import.meta.url)));assert.deepEqual(row,oracle.find(x=>x.mode===mode));assert.equal(m.cards[f.gun].location,m.cards[f.wolf].location);rules.validate(m);
 if(mode==='battle')assert.ok(m.data.battle.participants.light.includes(f.wolf));
});
for(const kind of ['barrier','moved','reacted','text','same-site','no-force','nested'])test('cannot initiate character reaction: '+kind,()=>{
 const f=fixture(),m=f.m;if(kind==='barrier')ground.record(m).barriers[f.wolf]=m.turn.number;if(kind==='moved')ground.record(m).moved.push(f.wolf);if(kind==='reacted')ground.registerReact(m,f.wolf);if(kind==='text')m.data.canceledGameText=[identity.referenceCard(m,f.wolf)];if(kind==='same-site')board.moveWithAttachments(m,f.host,f.dune);if(kind==='no-force')for(const id of [...m.players.light.force])state.moveCard(m,id,'used');
 if(kind==='nested')m.cards[f.host].aboardRole='vehicle';
 assert.equal(react.characterReactActions(m,m.stack.at(-1),'light').length,0);
});
for(const kind of ['host-return','wolf-return','barrier'])test('pre-departure disembark revalidates '+kind,()=>{
 const f=fixture();let m=step(atExit(begin(f)),'disembark');
 if(kind==='host-return'){delete m.cards[f.wolf].attachedTo;delete m.cards[f.wolf].aboardRole;state.moveCard(m,f.host,'hand');state.moveCard(m,f.host,'table');m.cards[f.host].location=f.site;m.cards[f.wolf].attachedTo=f.host;m.cards[f.wolf].aboardRole='passenger';}
 if(kind==='wolf-return'){delete m.cards[f.gun].attachedTo;state.moveCard(m,f.wolf,'hand');state.moveCard(m,f.wolf,'table');m.cards[f.wolf].location=f.site;m.cards[f.wolf].attachedTo=f.host;m.cards[f.wolf].aboardRole='passenger';m.cards[f.gun].attachedTo=f.wolf;}
 if(kind==='barrier')ground.record(m).barriers[f.wolf]=m.turn.number;
 m=finish(clone(m));assert.equal(m.cards[f.wolf].attachedTo,f.host);assert.ok(!ground.usage(m).moved.includes(f.wolf));
});
for(const kind of ['capacity','host-return','wolf-return'])test('arrival embark revalidates '+kind,()=>{
 const f=fixture('embark');let m=step(atExit(begin(f)),'disembark');m=step(atBoard(m),'board:'+f.dest+':passenger');
 if(kind==='capacity')for(const id of [f.luke,f.lightPilot]){state.moveCard(m,id,'table');m.cards[id].location=f.dune;m.cards[id].attachedTo=f.dest;m.cards[id].aboardRole='passenger';}
 if(kind==='host-return'){state.moveCard(m,f.dest,'hand');state.moveCard(m,f.dest,'table');m.cards[f.dest].location=f.dune;}
 if(kind==='wolf-return'){delete m.cards[f.gun].attachedTo;state.moveCard(m,f.wolf,'hand');state.moveCard(m,f.wolf,'table');m.cards[f.wolf].location=f.dune;m.cards[f.gun].attachedTo=f.wolf;}
 m=finish(clone(m));assert.equal(m.cards[f.wolf].attachedTo,undefined);assert.equal(m.cards[f.wolf].location,f.dune);
});
test('reaction arrival cancels a drain permanently before optional boarding',()=>{
 const f=fixture('embark');let m=atBoard(step(atExit(begin(f)),'disembark'));assert.ok(m.stack.some(r=>r.action?.handler==='ground:drain'&&r.cancelled));const before=m.players.light.lost.length;m=finish(step(m,'board:'+f.dest+':passenger'));assert.equal(m.players.light.lost.length,before);assert.equal(m.cards[f.wolf].attachedTo,f.dest);assert.equal(react.characterReactView(m).characterReact,null);
});
test('saved reaction references, role and stage reject malformed continuation',()=>{
 const f=fixture(),m=atExit(begin(f));for(const mutate of [p=>p.fromRef.version=999,p=>p.cardRef.zone='hand',p=>p.origin.version=999,p=>p.previous='starship',p=>p.site=p.from]){const bad=clone(m);mutate(bad.stack.at(-1).payload);assert.throws(()=>rules.validate(bad),/reference|react|mismatch/i);}
});
