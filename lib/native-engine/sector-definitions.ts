export type SectorKind='cloud'|'asteroid';
export const sectorDefinitions:Record<string,{kind:SectorKind;system:string;icons:{dark:number;light:number};unique?:boolean;limit:number;family:string}>={
 '4_81':{kind:'asteroid',system:'',icons:{dark:1,light:1},limit:3,family:'field'},
 '4_155':{kind:'asteroid',system:'',icons:{dark:1,light:1},limit:3,family:'field'},
 '5_85':{kind:'cloud',system:'',icons:{dark:1,light:1},limit:3,family:'clouds'},
 '5_174':{kind:'cloud',system:'',icons:{dark:1,light:1},limit:3,family:'clouds'},
 '5_77':{kind:'cloud',system:'Bespin',icons:{dark:1,light:2},unique:true,limit:1,family:'city'},
 '5_165':{kind:'cloud',system:'Bespin',icons:{dark:2,light:1},unique:true,limit:1,family:'city'},
 '4_82':{kind:'asteroid',system:'',icons:{dark:0,light:1},limit:1,family:'big-one'},
 '4_156':{kind:'asteroid',system:'',icons:{dark:1,light:0},limit:1,family:'big-one'},
};
export const caveDefinitions:Record<string,{system:string;icons:{dark:number;light:number}}>={
 '4_83':{system:'',icons:{dark:1,light:1}},'4_157':{system:'',icons:{dark:1,light:1}},
};
