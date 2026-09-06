import type {Card,HandAction,HandGameMode,Position,Street,TableSize,TournamentPhase,TournamentType,FieldLeft} from "@/lib/hand-review";

export type VisionConfidence="ALTA"|"MÉDIA"|"BAIXA";
export interface VisionVillainDraft{position:Position;stack:number|null;action:HandAction|null;actionAmount:number|null}
export interface VisionHandDraft{
  game:HandGameMode|null;
  tournamentTypes:TournamentType[];
  tournamentPhase:TournamentPhase|null;
  fieldLeft:FieldLeft|null;
  tableSize:TableSize|null;
  bigBlind:number|null;
  ante:number|null;
  pot:number|null;
  street:Street|null;
  heroPosition:Position|null;
  heroCards:Card[];
  heroStack:number|null;
  heroAction:HandAction|null;
  heroActionAmount:number|null;
  board:Card[];
  villains:VisionVillainDraft[];
  notes:string;
  confidence:VisionConfidence;
  needsConfirmation:string[];
}

const POSITIONS=new Set<Position>(["SB","BB","UTG1","UTG2","MP1","MP2","LJ","HJ","CO","BTN"]);
const ACTIONS=new Set<HandAction>(["FOLD","CHECK","CALL","RAISE","3-BET","4-BET","ALL-IN"]);
const STREETS=new Set<Street>(["PREFLOP","FLOP","TURN","RIVER"]);
const TABLES=new Set<TableSize>([2,6,8,9,10]);
const TYPES=new Set<TournamentType>(["MTT","SNG","BOUNTY","MULTIDAY","HIGH ROLLER","REGULAR","TURBO"]);
const PHASES=new Set<TournamentPhase>(["EARLY","MID","BOLHA ITM","BOLHA FT","ITM","FT"]);
const FIELDS=new Set<FieldLeft>(["10%","20%","30%","50%"]);
const CARD=/^(?:[2-9TJQKA])[♠♥♦♣]$/;
function num(v:unknown){const n=typeof v==="number"?v:Number(v);return Number.isFinite(n)&&n>=0?n:null}
function enumValue<T extends string>(v:unknown,set:Set<T>):T|null{return typeof v==="string"&&set.has(v as T)?v as T:null}
function cards(v:unknown){return Array.isArray(v)?v.filter((x):x is Card=>typeof x==="string"&&CARD.test(x)):[]}

export function parseVisionHandDraft(text:string):VisionHandDraft|null{
  try{
    const cleaned=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    const start=cleaned.indexOf("{");const end=cleaned.lastIndexOf("}");
    if(start<0||end<start)return null;
    const raw=JSON.parse(cleaned.slice(start,end+1)) as Record<string,unknown>;
    const villains=Array.isArray(raw.villains)?raw.villains.map(v=>{
      const o=(v&&typeof v==="object"?v:{}) as Record<string,unknown>;
      const position=enumValue(o.position,POSITIONS);if(!position)return null;
      return{position,stack:num(o.stack),action:enumValue(o.action,ACTIONS),actionAmount:num(o.actionAmount)};
    }).filter((v):v is VisionVillainDraft=>!!v):[];
    const confidence=raw.confidence==="ALTA"||raw.confidence==="MÉDIA"?raw.confidence:"BAIXA";
    return{
      game:raw.game==="CASH"||raw.game==="TORNEIO"?raw.game:null,
      tournamentTypes:Array.isArray(raw.tournamentTypes)?raw.tournamentTypes.filter((v):v is TournamentType=>typeof v==="string"&&TYPES.has(v as TournamentType)):[],
      tournamentPhase:enumValue(raw.tournamentPhase,PHASES),fieldLeft:enumValue(raw.fieldLeft,FIELDS),
      tableSize:TABLES.has(raw.tableSize as TableSize)?raw.tableSize as TableSize:null,
      bigBlind:num(raw.bigBlind),ante:num(raw.ante),pot:num(raw.pot),street:enumValue(raw.street,STREETS),
      heroPosition:enumValue(raw.heroPosition,POSITIONS),heroCards:cards(raw.heroCards).slice(0,2),heroStack:num(raw.heroStack),
      heroAction:enumValue(raw.heroAction,ACTIONS),heroActionAmount:num(raw.heroActionAmount),board:cards(raw.board).slice(0,5),villains,
      notes:typeof raw.notes==="string"?raw.notes.slice(0,1500):"",confidence,
      needsConfirmation:Array.isArray(raw.needsConfirmation)?raw.needsConfirmation.filter((v):v is string=>typeof v==="string").slice(0,20):[],
    };
  }catch{return null}
}
