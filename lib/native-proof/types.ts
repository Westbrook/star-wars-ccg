export type Side = 'light' | 'dark';
export type Zone = 'reserve' | 'force' | 'used' | 'lost' | 'hand' | 'destiny' | 'table' | 'playing' | 'leaving';
export type Pile = Exclude<Zone,'table'|'playing'|'leaving'>;
export type ScenarioId = 'activation' | 'drain' | 'battle' | 'recirculation' | 'takeel' | 'barrier' | 'imperial-barrier' | 'weapons' | 'rebel-weapons' | 'next-turn' | 'opening-table' | 'first-contact' | 'guard-post' | 'rebel-post' | 'corridor-crossfire' | 'second-contact';
export type TurnStage = 'start'|'activate'|'control'|'deploy'|'battle'|'move'|'draw'|'end'|'complete';
export type Restriction = {target:string;source:string;expiresTurn:number};
export type StudyTurn = {number:number;deployer:Side;stage:TurnStage;restrictions:Restriction[];expired:Restriction[];moved:string[];battled:string[]};
export type TurnRecord = {number:number;side:Side;generation:number;activated:number;carriedForce:Record<Side,number>;recirculated:Record<Side,number>;expired:number};
export type TurnCycle = {generation:number;activated:number;recirculated:Record<Side,number>;history:TurnRecord[]};
export type Card = {id:string; blueprint:string; owner:Side; zone:Zone; location?:string;attachedTo?:string;hit?:boolean;coveredBy?:string};
export type SetupStage = 'choose'|'reveal'|'collision'|'place'|'shuffle'|'draw'|'start'|'complete';
export type SetupState = {stage:SetupStage;round:number;selected:Record<Side,string|null>;revealed:boolean;collisionPriority:Side|null;covered:string|null;rejected:string[][];shuffleOrder:Record<Side,string[]>;startPasses:number;generation:Record<Side,number>|null};
export type Player = {reserve:string[];force:string[];used:string[];lost:string[];hand:string[];destiny:string[]};
export type Shot = {weapon:string;user:string;target:string;side:Side;cost:number;bonus:number;defense:number;status:'pending'|'drawn'|'resolved';card?:string;destiny?:number;hit?:boolean};
export type Battle = {site:string;initiator:Side;participants:Record<Side,string[]>;destiny:Record<Side,number|null>;drawn:Record<Side,boolean>;power:Record<Side,number>;attrition:Record<Side,number>;damage:Record<Side,number>;next:Side;destinyBeforeSwitch?:Record<Side,number>;destinySwitched?:boolean;resolved?:boolean;fired?:string[];weaponUsers?:Record<string,string>;shots?:Shot[]};
export type Frame =
 | {kind:'activation';used:number;generation:number;priority:Side;passes:number}
 | {kind:'drain';stage:'start'|'loss'|'end';site:string;remaining:number}
 | {kind:'battle';stage:'start'|'weapons'|'destiny'|'totals'|'damage'|'end';side:Side}
 | {kind:'window';label:string;priority:Side;passes:number;event?:'battle-destiny-complete'|'character-deployed';target?:string}
 | {kind:'interrupt';card:string;side:Side;effect:'switch-battle-destiny'}
 | {kind:'interrupt';card:string;side:Side;effect:'barrier';target:string;expiresTurn:number}
 | {kind:'turn';priority:Side;passes:number}
 | {kind:'turn-start'}
 | {kind:'turn-end';stage:'automatic'|'handoff'}
 | {kind:'armory';priority:Side;passes:number}
 | {kind:'weapons';priority:Side;passes:number}
 | {kind:'shot';index:number;stage:'draw'|'resolve'}
 | {kind:'lost-order';side:Side;remaining:string[];placed:string[]}
 | {kind:'destiny';side:Side;card:string;value:number}
 | {kind:'recirculation';next:Side}
 | {kind:'finish';message:string};
export type Match = {
 schema:1;engine:'native-proof-1'|'native-proof-2'|'native-proof-3'|'native-proof-4'|'native-proof-5'|'native-proof-6'|'native-proof-7'|'native-proof-8'|'native-proof-9';scenario:ScenarioId;revision:number;active:Side;phase:string;
 cards:Record<string,Card>;players:Record<Side,Player>;locations:string[];stack:Frame[];
 battle:Battle|null;drained:string[];log:{n:number;text:string}[];complete:boolean;winner:Side|null;turn?:StudyTurn;cycle?:TurnCycle;setup?:SetupState;
};
export type LossBalance = {attrition:number;damage:number;initialAttrition:number;initialDamage:number};
export type LossPreview = {kind:'forfeit'|'force';value:number;attrition:number;damage:number};
export type Choice = {id:string;label:string;card?:string;tone?:'primary'|'danger';lossPreview?:LossPreview;destinyPreview?:Record<Side,number>;barrierTarget?:string;forceIcons?:Record<Side,number>;weaponPreview?:{user:string;target:string;cost:number;bonus:number;defense:number}};
export type Prompt = {id:string;side:Side;title:string;detail:string;choices:Choice[];automatic:boolean};
export type Command = {choice:string;prompt:string};
export type PublicCard = {id:string;blueprint:string;name:string;image:string;side:Side;type:string;text:string;stats:Record<string,string>;forceIcons?:Record<Side,number>;rulesView?:{power:number;printedPower:number;canMove:boolean;notes:string[]};location?:string;attachedTo?:string;hit?:boolean};
export type StudyPiles = Pick<Player,'reserve'|'used'|'force'>;
export type RecirculationStudy = {
 cards:Record<string,Pick<PublicCard,'id'|'name'|'image'>>;
 players:Record<Side,{before:StudyPiles;current:StudyPiles;resolved:boolean;orderPreserved:boolean|null;reserveUnchanged:boolean;forceUnchanged:boolean}>;
};
export type Projection = {
 scenario:ScenarioId;engine:string;revision:number;active:Side;phase:string;seat:Side;complete:boolean;winner:Side|null;
 players:Record<Side,{counts:Record<Pile,number>;life:number;hand:PublicCard[];lost:PublicCard[];destiny:PublicCard[]}>;
 locations:PublicCard[];table:PublicCard[];prompt:Prompt|null;log:Match['log'];battle:Battle|null;losses:Record<Side,LossBalance>|null;recirculationStudy?:RecirculationStudy;playing?:PublicCard[];
 turn?:StudyTurn & {deploymentSites:{site:string;allowed:boolean;reason:string}[]};
 cycle?:TurnCycle;
 setup?:{stage:SetupStage;round:number;committed:Record<Side,boolean>;selected:Record<Side,PublicCard|null>;candidates:PublicCard[];rejected:PublicCard[][];covered:PublicCard|null;generation:Record<Side,number>|null;groups:{name:string;cards:PublicCard[]}[];openingHands?:Record<Side,PublicCard[]>};
 weaponStudy?:{stage:'deploy'|'battle'|'complete';hits:Record<Side,string[]>;lostOrder:{side:Side;remaining:PublicCard[];placed:PublicCard[]}|null};
};
