export type GameMode="CASH"|"TORNEIO";
export type CashProfile="MICRO STAKES"|"MID STAKES"|"HIGH STAKES";
export type TournamentProfile="MTT REGULAR"|"BOUNTY"|"HIGH ROLLER"|"TURBO";
export type AnteFormat="NONE"|"BB_ANTE"|"BB_PL";
export type PlayerAction="FOLD"|"CHECK"|"CALL"|"BET"|"RAISE"|"ALL-IN";
export type Score={aggression:number;discipline:number;pressure:number;passivity:number};
export type PlayerDnaSpot={
  id:string;
  mode:GameMode;
  gameProfile?:CashProfile|TournamentProfile;
  anteMode?:AnteFormat;
  street:"PREFLOP"|"FLOP"|"TURN"|"RIVER";
  heroCards:string;
  board?:string;
  players:{position:string;stack:number;action:string;value:number;hero?:boolean}[];
  pot:{main:number;sides?:{value:number;players:string[]}[]};
  scenario:string[];
  prompt:string;
  actions:PlayerAction[];
  weights:Partial<Record<PlayerAction,Score>>;
};

const passive:Score={aggression:0,discipline:1,pressure:0,passivity:3};
const disciplined:Score={aggression:0,discipline:3,pressure:0,passivity:1};
const call:Score={aggression:0,discipline:2,pressure:1,passivity:1};
const aggressive:Score={aggression:3,discipline:1,pressure:2,passivity:0};
const pressure:Score={aggression:3,discipline:0,pressure:3,passivity:0};

export const playerDnaSpots:PlayerDnaSpot[]=[
  {id:"cash-btn-vs-bb-3bet",mode:"CASH",street:"PREFLOP",heroCards:"A♠ Q♠",players:[{position:"BTN",stack:100,action:"AGUARDA",value:0,hero:true},{position:"BB",stack:100,action:"3-BET",value:10}],pot:{main:14},scenario:["CASH","BTN VS BB","3-BET POT","IP"],prompt:"BTN abre e recebe 3-bet do BB. Qual é sua decisão?",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-blind-war",mode:"CASH",street:"PREFLOP",heroCards:"A♦ 5♦",players:[{position:"SB",stack:100,action:"AGUARDA",value:0,hero:true},{position:"BB",stack:110,action:"RAISE",value:4}],pot:{main:6},scenario:["CASH","BLIND WAR","SB VS BB","OOP"],prompt:"Blind war: BB responde agressivamente ao seu limp. Como continua?",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-co-vs-btn",mode:"CASH",street:"FLOP",heroCards:"K♣ Q♣",board:"K♦ 8♠ 3♣",players:[{position:"CO",stack:96,action:"AGUARDA",value:0,hero:true},{position:"BTN",stack:94,action:"BET",value:5}],pot:{main:16},scenario:["CASH","CO VS BTN","SRP","OOP"],prompt:"Você tem top pair e enfrenta c-bet pequena em pote single-raised.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:passive,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-multiway",mode:"CASH",street:"FLOP",heroCards:"A♥ T♥",board:"T♣ 9♣ 5♦",players:[{position:"BB",stack:100,action:"AGUARDA",value:0,hero:true},{position:"HJ",stack:90,action:"BET",value:7},{position:"BTN",stack:56,action:"CALL",value:7}],pot:{main:28},scenario:["CASH","MULTIWAY","BB VS HJ VS BTN","OOP"],prompt:"Bet e call antes de você com top pair. Qual linha escolhe?",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-turn-barrel",mode:"CASH",street:"TURN",heroCards:"K♦ J♦",board:"K♣ 8♥ 3♠ 9♠",players:[{position:"BB",stack:76,action:"AGUARDA",value:0,hero:true},{position:"CO",stack:70,action:"BET",value:18}],pot:{main:49},scenario:["CASH","CO VS BB","2ND BARREL","OOP"],prompt:"Você pagou flop e enfrenta segundo barrel no turn.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-river-value",mode:"CASH",street:"RIVER",heroCards:"Q♠ J♠",board:"Q♥ 7♦ 4♠ 2♣ 6♣",players:[{position:"BTN",stack:58,action:"AGUARDA",value:0,hero:true},{position:"BB",stack:50,action:"CHECK",value:0}],pot:{main:36},scenario:["CASH","BTN VS BB","THIN VALUE","IP"],prompt:"Vilão dá check river. Você tem top pair e ação.",actions:["CHECK","BET","RAISE","ALL-IN"],weights:{CHECK:call,BET:aggressive,RAISE:pressure,"ALL-IN":pressure}},
  {id:"cash-river-overbet",mode:"CASH",street:"RIVER",heroCards:"K♥ Q♥",board:"K♣ 9♦ 5♠ 4♥ 2♦",players:[{position:"BB",stack:72,action:"AGUARDA",value:0,hero:true},{position:"BTN",stack:68,action:"OVERBET",value:52}],pot:{main:90},scenario:["CASH","BTN VS BB","OVERBET","BLUFF CATCH"],prompt:"Vilão usa overbet no river. Você segura top pair Q kicker.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"cash-side-pot",mode:"CASH",street:"TURN",heroCards:"J♠ J♥",board:"J♦ 8♣ 4♣ 2♥",players:[{position:"CO",stack:80,action:"AGUARDA",value:0,hero:true},{position:"BTN",stack:24,action:"ALL-IN",value:24},{position:"SB",stack:70,action:"CALL",value:24}],pot:{main:72,sides:[{value:28,players:["CO","SB"]}]},scenario:["CASH","MULTIWAY","SIDE POT","CO VS BTN VS SB"],prompt:"Há all-in e side pot possível no turn. Qual linha você escolhe?",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:passive,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},

  {id:"mtt-early-open",mode:"TORNEIO",street:"PREFLOP",heroCards:"A♠ K♠",players:[{position:"UTG",stack:80,action:"AGUARDA",value:0,hero:true},{position:"CO",stack:76,action:"CALL",value:2.2},{position:"SB",stack:64,action:"RAISE",value:9}],pot:{main:13.5},scenario:["TORNEIO","EARLY GAME","ANTE 0.1 BB","UTG VS CO VS SB","MULTIWAY"],prompt:"Early game com antes: há call e squeeze após sua abertura.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-mid-blind-war",mode:"TORNEIO",street:"PREFLOP",heroCards:"A♣ 7♣",players:[{position:"SB",stack:32,action:"AGUARDA",value:0,hero:true},{position:"BB",stack:27,action:"RAISE",value:5.5}],pot:{main:8},scenario:["TORNEIO","MID GAME","ANTE 0.1 BB","BLIND WAR","SB VS BB"],prompt:"Mid game: blind war com stacks médios. Qual resposta?",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-bubble-btn",mode:"TORNEIO",street:"PREFLOP",heroCards:"A♦ T♠",players:[{position:"BTN",stack:22,action:"AGUARDA",value:0,hero:true},{position:"CO",stack:14,action:"ALL-IN",value:14}],pot:{main:17},scenario:["TORNEIO","BOLHA","BOLHA ICM","ANTE 0.1 BB","CO VS BTN"],prompt:"Na bolha, CO short empurra e você está no BTN com cobertura.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-itm-flop",mode:"TORNEIO",street:"FLOP",heroCards:"9♥ 8♥",board:"T♥ 7♣ 2♥",players:[{position:"BB",stack:34,action:"AGUARDA",value:0,hero:true},{position:"BTN",stack:29,action:"BET",value:3.5}],pot:{main:11},scenario:["TORNEIO","ITM","ANTE 0.1 BB","BTN VS BB","COMBO DRAW"],prompt:"ITM: você tem combo draw e enfrenta c-bet pequena.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:passive,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-ft-icm",mode:"TORNEIO",street:"PREFLOP",heroCards:"Q♠ Q♥",players:[{position:"CO",stack:31,action:"AGUARDA",value:0,hero:true},{position:"BTN",stack:18,action:"ALL-IN",value:18},{position:"BB",stack:42,action:"CALL",value:18}],pot:{main:57},scenario:["TORNEIO","FT","FT ICM","ANTE 0.1 BB","MULTIWAY"],prompt:"Mesa final: shove e call antes de você sob forte pressão de ICM.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-ft-side",mode:"TORNEIO",street:"FLOP",heroCards:"A♥ K♥",board:"A♣ 9♣ 4♦",players:[{position:"BTN",stack:28,action:"AGUARDA",value:0,hero:true},{position:"SB",stack:8,action:"ALL-IN",value:8},{position:"BB",stack:24,action:"CALL",value:8}],pot:{main:26,sides:[{value:10,players:["BTN","BB"]}]},scenario:["TORNEIO","FT","FT ICM","SIDE POT","BTN VS SB VS BB"],prompt:"Na FT, SB está all-in e há side pot contra o BB.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-bubble-river",mode:"TORNEIO",street:"RIVER",heroCards:"A♣ J♣",board:"A♦ T♠ 6♥ 3♣ 2♠",players:[{position:"BTN",stack:19,action:"AGUARDA",value:0,hero:true},{position:"CO",stack:26,action:"BET",value:11}],pot:{main:24},scenario:["TORNEIO","BOLHA","BOLHA ICM","CO VS BTN","BLUFF CATCH"],prompt:"Bolha: vilão cobre você e aposta grande no river.",actions:["FOLD","CALL","RAISE","ALL-IN"],weights:{FOLD:disciplined,CALL:call,RAISE:aggressive,"ALL-IN":pressure}},
  {id:"mtt-mid-turn",mode:"TORNEIO",street:"TURN",heroCards:"K♠ Q♣",board:"Q♦ 8♠ 4♣ A♥",players:[{position:"BTN",stack:36,action:"AGUARDA",value:0,hero:true},{position:"BB",stack:33,action:"CHECK",value:0}],pot:{main:15},scenario:["TORNEIO","MID GAME","ANTE 0.1 BB","BTN VS BB","IP"],prompt:"Turn traz overcard após seu c-bet flop. BB checa novamente.",actions:["CHECK","BET","RAISE","ALL-IN"],weights:{CHECK:call,BET:aggressive,RAISE:pressure,"ALL-IN":pressure}},
];
