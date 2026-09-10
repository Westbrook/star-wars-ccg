export type Side='light'|'dark';
export type CardType='Character'|'Starship'|'Vehicle'|'Weapon'|'Interrupt'|'Effect';
export type Card={id:string;name:string;side:Side;type:CardType;cost:number;power:number;destiny:number;ability:number;unique:boolean;rarity:'Common'|'Uncommon'|'Rare';text:string;image:string};
type Row=[string,string,CardType,number,number,number,number,boolean,string];
const light:Row[]=[
['luke','Luke Skywalker','Character',3,3,1,4,true,'A young hero with the courage to change the galaxy.'],
['leia','Leia Organa','Character',3,3,1,3,true,'A fearless leader of the Rebel Alliance.'],
['han','Han Solo','Character',3,3,1,3,true,'Never tell him the odds.'],
['obiwan','Obi-Wan Kenobi','Character',5,5,1,6,true,'An elegant guardian of a more civilized age.'],
['chewie','Chewbacca','Character',4,6,1,2,true,'The loyal Wookiee brings overwhelming ground power.'],
['rebel','Rebel Trooper','Character',1,2,3,1,false,'The backbone of the Rebellion.'],
['pilot','Rebel Pilot','Character',1,1,3,2,false,'A brave pilot ready for the next mission.'],
['r2','R2-D2 (Artoo-Detoo)','Character',2,1,2,1,true,'A resourceful astromech.'],
['xwing','X-wing','Starship',3,4,2,2,false,'Deploys to a system. Permanent pilot.'],
['ywing','Y-wing','Starship',2,3,3,2,false,'Deploys to a system. Permanent pilot.'],
['falcon','Millennium Falcon','Starship',5,7,1,3,true,'Deploys to a system. Han pilots in Holotable rules.'],
['corvette','Corellian Corvette','Starship',4,5,2,2,false,'Deploys to a system. Permanent pilot.'],
['landspeeder','SoroSuub V-35 Landspeeder','Vehicle',2,3,4,1,false,'Deploys to a ground site.'],
['saber','Obi-Wan’s Lightsaber','Weapon',2,2,4,0,false,'Give one friendly character here +2 power.'],
['blaster','Blaster','Weapon',1,1,5,0,false,'Give one friendly character here +1 power.'],
['courage','Rebel Barrier','Interrupt',1,0,5,0,false,'Opponent loses 2 Life Force. Goes to your Lost Pile.'],
['recovery','The Force Is Strong With This One','Effect',2,0,5,0,false,'Recover up to 3 lost cards beneath your Reserve Deck.'],
['rescue','It Could Be Worse','Interrupt',0,0,6,0,false,'Recover 1 lost card beneath your Reserve Deck. Goes to Lost.'],
];
const dark:Row[]=[
['vader','Darth Vader','Character',6,6,1,6,true,'The Dark Lord of the Sith.'],
['tarkin','Grand Moff Tarkin','Character',3,3,1,3,true,'The Empire’s ruthless architect.'],
['motti','Admiral Motti','Character',2,2,2,2,true,'Imperial command at its most ambitious.'],
['veers','General Veers','Character',3,4,2,3,true,'A relentless ground commander.'],
['trooper','Stormtrooper','Character',1,2,3,1,false,'The Empire’s ubiquitous infantry.'],
['snowtrooper','Snowtrooper','Character',2,3,3,1,false,'Trained for the harshest environments.'],
['dpilot','Imperial Pilot','Character',1,1,3,2,false,'A disciplined Imperial aviator.'],
['droid','Probe Droid','Character',2,2,3,1,false,'There is no hiding from the Empire.'],
['tie','TIE Fighter','Starship',1,2,3,1,false,'Deploys to a system. Permanent pilot.'],
['bomber','TIE Bomber','Starship',2,3,3,2,false,'Deploys to a system. Permanent pilot.'],
['destroyer','Imperial-Class Star Destroyer','Starship',6,8,1,4,false,'Deploys to a system. Permanent pilots.'],
['devastator','Devastator','Starship',5,7,1,3,true,'Deploys to a system. Permanent pilots.'],
['atat','Blizzard Walker','Vehicle',4,6,2,2,false,'Deploys to a ground site.'],
['dsaber','Vader’s Lightsaber','Weapon',2,2,4,0,false,'Give one friendly character here +2 power.'],
['dblaster','Blaster Rifle','Weapon',1,1,5,0,false,'Give one friendly character here +1 power.'],
['choke','Imperial Barrier','Interrupt',1,0,5,0,false,'Opponent loses 2 Life Force. Goes to your Lost Pile.'],
['drecovery','A Disturbance In The Force','Effect',2,0,5,0,false,'Recover up to 3 lost cards beneath your Reserve Deck.'],
['drescue','Twi’lek Advisor','Interrupt',0,0,6,0,false,'Recover 1 lost card beneath your Reserve Deck. Goes to Lost.'],
];
export const CARDS:Card[]=[...light.map(r=>make(r,'light')),...dark.map(r=>make(r,'dark'))];
function make(r:Row,side:Side):Card{const [id,name,type,cost,power,destiny,ability,unique,text]=r;return {id,name,side,type,cost,power,destiny,ability,unique,rarity:unique?'Rare':cost>=3?'Uncommon':'Common',text,image:`/cards/${id}.gif`}}
export const CARD_MAP=Object.fromEntries(CARDS.map(c=>[c.id,c]));
export type Deck={id:string;name:string;side:Side;size:40|60;cards:string[];poolId?:string};
export function starter(side:Side,size:40|60=60):Deck{const pool=CARDS.filter(c=>c.side===side);const arr:string[]=[];for(let round=0;arr.length<size;round++)for(const c of pool){if(arr.length<size)arr.push(c.id)}return {id:`starter-${side}-${size}`,name:side==='light'?'A New Hope':'Imperial Might',side,size,cards:arr}}
export function validateDeck(d:Deck,pool?:string[]):string|null{if(!d||!['light','dark'].includes(d.side)||![40,60].includes(d.size)||!Array.isArray(d.cards))return 'Choose a side and a 40- or 60-card format.';if(d.cards.length!==d.size)return `Your deck needs exactly ${d.size} cards (${d.cards.length} selected).`;const counts:Record<string,number>={};for(const id of d.cards){if(!CARD_MAP[id]||CARD_MAP[id].side!==d.side)return 'Every card must belong to your side.';counts[id]=(counts[id]??0)+1;if(!pool&&counts[id]>4)return 'Open decks allow up to 4 copies of each card.';if(pool&&counts[id]>pool.filter(x=>x===id).length)return 'This card is not available in your sealed pool.'}return null}
export const LOCATIONS=[{name:'Tatooine',subtitle:'OUTER RIM SYSTEM',kind:'space',image:'/art/death-star.png',icons:2},{name:'Mos Eisley',subtitle:'TATOOINE · EXTERIOR',kind:'ground',image:'/art/tatooine.png',icons:2},{name:'Yavin IV',subtitle:'REBEL BASE · EXTERIOR',kind:'ground',image:'/art/imperial.png',icons:1}];

export function sealedCards(side:Side,size:40|60):string[]{const cards=CARDS.filter(c=>c.side===side),pool:string[]=[];for(let n=0;n<(size===60?8:6)*15;n++){const rarity=n%15===0?'Rare':n%15<5?'Uncommon':'Common';const options=cards.filter(c=>c.rarity===rarity);pool.push(options[Math.floor(Math.random()*options.length)].id)}return pool}
export function sealedOpponent(side:Side,size:40|60):Deck{return {id:'sealed-opponent',name:'Sealed squadron',side,size,cards:sealedCards(side,size).slice(0,size),poolId:'computer-pool'}}
