import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";

export type GtoNodeIntegrity={
  legalActions:PlayerAction[];
  facingBet:boolean;
  toCall:number;
  potBeforeCall:number;
  potOdds:number|null;
  effectiveStack:number;
  spr:number|null;
  rangeReady:boolean;
  icmReady:boolean;
  solverReady:boolean;
  blockersReady:boolean;
  issues:string[];
};

const ALL:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const uniq=(xs:PlayerAction[])=>[...new Set(xs)];

export function inspectGtoNode(state:SolverSpotState,declared:PlayerAction[]):GtoNodeIntegrity{
  const issues:string[]=[];
  const heroPos=state.hero.position.toUpperCase();
  const active=state.players.filter(p=>p.position.toUpperCase()!==heroPos&&p.action.toUpperCase()!=="FOLD");
  const explicit=Math.max(0,state.heroToCall??0);
  const current=Math.max(0,state.currentBet??0);
  const heroCommitted=Math.max(0,state.players.find(p=>p.position.toUpperCase()===heroPos)?.value??0);
  const maxCommitted=Math.max(0,...active.map(p=>Math.max(0,p.value)));
  const inferred=Math.max(0,Math.max(current,maxCommitted)-heroCommitted);
  const toCall=Math.max(explicit,inferred);
  const facingBet=toCall>0;
  const structural:PlayerAction[]=facingBet?["FOLD","CALL","RAISE","ALL-IN"]:["CHECK","BET","ALL-IN"];
  const declaredUnique=uniq(declared.filter(a=>ALL.includes(a)));
  let legalActions=structural.filter(a=>declaredUnique.includes(a));
  if(!legalActions.length){legalActions=structural;issues.push("AÇÕES DECLARADAS INCOMPATÍVEIS COM O ESTADO; ÁRVORE ESTRUTURAL APLICADA.")}
  const impossible=declaredUnique.filter(a=>!structural.includes(a));
  if(impossible.length)issues.push(`AÇÕES IMPOSSÍVEIS NO NÓ: ${impossible.join(", ")}.`);
  const potBeforeCall=Math.max(0,state.pot);
  const potOdds=facingBet&&potBeforeCall+toCall>0?toCall/(potBeforeCall+toCall):null;
  const effectiveStack=Math.max(0,Math.min(state.hero.stack,...(active.length?active.map(p=>p.stack):[state.hero.stack])));
  const spr=potBeforeCall>0?effectiveStack/potBeforeCall:null;
  const blockersReady=state.hero.cards.length===2&&new Set([...state.hero.cards,...state.board]).size===state.hero.cards.length+state.board.length;
  if(!blockersReady)issues.push("CARTAS AUSENTES OU DUPLICADAS; CARD REMOVAL/BLOCKERS NÃO SÃO CONFIÁVEIS.");
  const rangeReady=false;
  issues.push("RANGES PONDERADOS DO NÓ NÃO FORAM FORNECIDOS; EQUITY DE RANGE, EQR E FREQUÊNCIAS GTO NÃO PODEM SER INFERIDOS.");
  const icmReady=state.mode!=="TORNEIO"||Boolean(state.payouts?.length&&state.fieldStacks?.length);
  if(state.mode==="TORNEIO"&&!icmReady)issues.push("DADOS DE PAYOUT/FIELD INCOMPLETOS; ICM/RISK PREMIUM EXATO NÃO PODE SER CALCULADO.");
  const solverReady=rangeReady&&blockersReady&&icmReady&&issues.length===0;
  return{legalActions,facingBet,toCall,potBeforeCall,potOdds,effectiveStack,spr,rangeReady,icmReady,solverReady,blockersReady,issues};
}
