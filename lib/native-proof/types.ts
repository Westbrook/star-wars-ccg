export type Side = 'light' | 'dark';
export type Zone = 'reserve' | 'force' | 'used' | 'lost' | 'hand' | 'destiny' | 'table';
export type ScenarioId = 'activation' | 'drain' | 'battle' | 'recirculation';
export type Card = {id:string; blueprint:string; owner:Side; zone:Zone; location?:string};
export type Player = {reserve:string[];force:string[];used:string[];lost:string[];hand:string[];destiny:string[]};
export type Battle = {site:string;initiator:Side;participants:Record<Side,string[]>;destiny:Record<Side,number|null>;drawn:Record<Side,boolean>;power:Record<Side,number>;attrition:Record<Side,number>;damage:Record<Side,number>;next:Side};
export type Frame =
 | {kind:'activation';used:number;generation:number;priority:Side;passes:number}
 | {kind:'drain';stage:'start'|'loss'|'end';site:string;remaining:number}
 | {kind:'battle';stage:'start'|'weapons'|'destiny'|'totals'|'damage'|'end';side:Side}
 | {kind:'window';label:string;priority:Side;passes:number}
 | {kind:'destiny';side:Side;card:string;value:number}
 | {kind:'recirculation';next:Side}
 | {kind:'finish';message:string};
export type Match = {
 schema:1;engine:'native-proof-1';scenario:ScenarioId;revision:number;active:Side;phase:string;
 cards:Record<string,Card>;players:Record<Side,Player>;locations:string[];stack:Frame[];
 battle:Battle|null;drained:string[];log:{n:number;text:string}[];complete:boolean;winner:Side|null;
};
export type LossBalance = {attrition:number;damage:number;initialAttrition:number;initialDamage:number};
export type LossPreview = {kind:'forfeit'|'force';value:number;attrition:number;damage:number};
export type Choice = {id:string;label:string;card?:string;tone?:'primary'|'danger';lossPreview?:LossPreview};
export type Prompt = {id:string;side:Side;title:string;detail:string;choices:Choice[];automatic:boolean};
export type Command = {choice:string;prompt:string};
export type PublicCard = {id:string;blueprint:string;name:string;image:string;side:Side;type:string;text:string;stats:Record<string,string>;location?:string};
export type StudyPiles = Pick<Player,'reserve'|'used'|'force'>;
export type RecirculationStudy = {
 cards:Record<string,Pick<PublicCard,'id'|'name'|'image'>>;
 players:Record<Side,{before:StudyPiles;current:StudyPiles;resolved:boolean;orderPreserved:boolean|null;reserveUnchanged:boolean;forceUnchanged:boolean}>;
};
export type Projection = {
 scenario:ScenarioId;engine:string;revision:number;active:Side;phase:string;seat:Side;complete:boolean;winner:Side|null;
 players:Record<Side,{counts:Record<Exclude<Zone,'table'>,number>;life:number;hand:PublicCard[];lost:PublicCard[];destiny:PublicCard[]}>;
 locations:PublicCard[];table:PublicCard[];prompt:Prompt|null;log:Match['log'];battle:Battle|null;losses:Record<Side,LossBalance>|null;recirculationStudy?:RecirculationStudy;
};
