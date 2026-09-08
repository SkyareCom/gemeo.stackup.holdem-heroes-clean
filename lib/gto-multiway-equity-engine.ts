import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {canonicalCard,normalizeWeightedRange,type WeightedCombo} from "@/lib/gto-range-engine";
import {bestHoldemScore} from "@/lib/gto-equity-engine";

export type MultiwayEquityPlayer={position:string;equity:number;winShare:number;weightedTrials:number};
export type MultiwayEquityResult={status:"OK"|"UNAVAILABLE"|"INVALID";players:MultiwayEquityPlayer[];runouts:number;comboTuples:number;weightedTrials:number;issues:string[]};

const RANKS="23456789TJQKA";
const SUITS=["S","H","D","C"] as const;
const DECK=[...RANKS].flatMap(rank=>SUITS.map(suit=>`${rank}${suit}`));
const MAX_EXACT_STATES=250000;

type Participant={position:string;combos:WeightedCombo[]};
type Pick={position:string;cards:[string,string];weight:number};

function combinations<T>(items:T[],k:number){const out:T[][]=[];const walk=(start:number,picked:T[])=>{if(picked.length===k){out.push(picked);return}for(let i=start;i<=items.length-(k-picked.length);i++)walk(i+1,[...picked,items[i]])};walk(0,[]);return out}
function compareScore(a:number[],b:number[]){const n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);if(d)return d>0?1:-1}return 0}
function overlaps(cards:[string,string],dead:Set<string>){return cards.some(card=>dead.has(card))}
function activeVillainPositions(state:SolverSpotState){const hero=state.hero.position.toUpperCase();return state.players.filter(p=>p.position.toUpperCase()!==hero&&p.action.toUpperCase()!=="FOLD").map(p=>p.position)}
function canonicalBoard(raw:string[]){return raw.map(canonicalCard).filter(Boolean) as string[]}

export function exactMultiwayShowdownEquity(state:SolverSpotState):MultiwayEquityResult{
  const issues:string[]=[];
  if(state.street==="PREFLOP")return{status:"UNAVAILABLE",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:["EQUITY MULTIWAY EXATA ATUAL EXIGE FLOP/TURN/RIVER."]};
  const board=canonicalBoard(state.board),heroCards=state.hero.cards.map(canonicalCard).filter(Boolean) as string[];
  if(board.length!==state.board.length||board.length<3||board.length>5||heroCards.length!==2||new Set([...board,...heroCards]).size!==board.length+2)return{status:"INVALID",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:["CARTAS/BOARD INVÁLIDOS PARA EQUITY MULTIWAY."]};
  const villainPositions=activeVillainPositions(state);
  if(villainPositions.length<2)return{status:"UNAVAILABLE",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:["NÓ NÃO É MULTIWAY; USE O MOTOR HEADS-UP."]};
  const visible=[...board,...heroCards];
  const participants:Participant[]=[];
  for(const position of villainPositions){
    const range=state.ranges?.villains?.[position]??Object.entries(state.ranges?.villains??{}).find(([p])=>p.toUpperCase()===position.toUpperCase())?.[1];
    if(!range?.length)return{status:"UNAVAILABLE",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:[`RANGE PONDERADO AUSENTE PARA ${position.toUpperCase()}.`]};
    const normalized=normalizeWeightedRange(range,visible);
    if(!normalized.combos.length)return{status:"UNAVAILABLE",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:[`RANGE DE ${position.toUpperCase()} SEM COMBOS APÓS CARD REMOVAL.`]};
    if(normalized.invalidEntries.length)issues.push(`ENTRADAS INVÁLIDAS IGNORADAS EM ${position.toUpperCase()}: ${normalized.invalidEntries.join(", ")}.`);
    participants.push({position,combos:normalized.combos});
  }
  const missing=5-board.length;
  const baseAvailable=DECK.length-visible.length;
  const runoutUpper=missing===0?1:missing===1?baseAvailable-2*participants.length:((baseAvailable-2*participants.length)*(baseAvailable-2*participants.length-1))/2;
  const comboUpper=participants.reduce((p,x)=>p*x.combos.length,1);
  if(comboUpper*Math.max(1,runoutUpper)>MAX_EXACT_STATES)return{status:"UNAVAILABLE",players:[],runouts:0,comboTuples:0,weightedTrials:0,issues:[`ESPAÇO EXATO EXCEDE LIMITE DE SEGURANÇA (${MAX_EXACT_STATES} ESTADOS). NÃO HÁ AMOSTRAGEM/CHUTE.`]};
  const heroPosition=state.hero.position;
  const equity=new Map<string,number>([[heroPosition,0],...participants.map(p=>[p.position,0] as [string,number])]);
  let totalWeight=0,runouts=0,comboTuples=0;
  const walk=(index:number,picks:Pick[],dead:Set<string>,weight:number)=>{
    if(index===participants.length){
      comboTuples++;
      const available=DECK.filter(card=>!dead.has(card));
      const boards=missing===0?[[]]:combinations(available,missing);
      for(const runout of boards){
        const fullBoard=[...board,...runout];
        const scores:[string,number[]][]=[[heroPosition,bestHoldemScore([...heroCards,...fullBoard])],...picks.map(p=>[p.position,bestHoldemScore([...p.cards,...fullBoard])] as [string,number[]])];
        let best=scores[0][1];for(const [,score] of scores)if(compareScore(score,best)>0)best=score;
        const winners=scores.filter(([,score])=>compareScore(score,best)===0).map(([position])=>position);
        const share=weight/(boards.length||1)/winners.length;
        for(const position of winners)equity.set(position,(equity.get(position)??0)+share);
        totalWeight+=weight/(boards.length||1);runouts++;
      }
      return;
    }
    const participant=participants[index];
    for(const combo of participant.combos){if(overlaps(combo.cards,dead))continue;const nextDead=new Set(dead);combo.cards.forEach(card=>nextDead.add(card));walk(index+1,[...picks,{position:participant.position,cards:combo.cards,weight:combo.weight}],nextDead,weight*combo.weight)}
  };
  walk(0,[],new Set(visible),1);
  if(totalWeight<=0)return{status:"UNAVAILABLE",players:[],runouts,comboTuples,weightedTrials:0,issues:["NENHUMA TUPLA DE COMBOS COMPATÍVEL ENTRE OS RANGES MULTIWAY."]};
  const players=[heroPosition,...participants.map(p=>p.position)].map(position=>({position,equity:(equity.get(position)??0)/totalWeight,winShare:(equity.get(position)??0),weightedTrials:totalWeight}));
  return{status:"OK",players,runouts,comboTuples,weightedTrials:totalWeight,issues};
}
