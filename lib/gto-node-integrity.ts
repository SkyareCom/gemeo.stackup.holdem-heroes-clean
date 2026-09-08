import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {normalizeWeightedRange,rangeHasValidCombos} from "@/lib/gto-range-engine";

export type GtoNodeIntegrity={
  legalActions:PlayerAction[];
  facingBet:boolean;
  toCall:number;
  potBeforeCall:number;
  potOdds:number|null;
  effectiveStack:number;
  spr:number|null;
  rangeReady:boolean;
  equityReady:boolean;
  icmReady:boolean;
  solverReady:boolean;
  blockersReady:boolean;
  heroRangeCombos:number;
  villainRangeCombos:number;
  blockedVillainCombos:number;
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
  const visibleCards=[...state.hero.cards,...state.board];
  const canonicalVisible=visibleCards.map(card=>card.trim().toUpperCase());
  const blockersReady=state.hero.cards.length===2&&new Set(canonicalVisible).size===canonicalVisible.length;
  if(!blockersReady)issues.push("CARTAS AUSENTES OU DUPLICADAS; CARD REMOVAL/BLOCKERS NÃO SÃO CONFIÁVEIS.");

  const heroRange=state.ranges?.hero;
  const heroNormalized=heroRange?.length?normalizeWeightedRange(heroRange,state.board):null;
  const villainEntries=Object.entries(state.ranges?.villains??{}).filter(([position])=>active.some(player=>player.position.toUpperCase()===position.toUpperCase()));
  let villainRangeCombos=0,blockedVillainCombos=0,villainsReady=villainEntries.length===active.length&&active.length>0;
  for(const player of active){
    const entry=villainEntries.find(([position])=>position.toUpperCase()===player.position.toUpperCase());
    if(!entry){villainsReady=false;issues.push(`RANGE AUSENTE PARA ${player.position.toUpperCase()}.`);continue}
    const normalized=normalizeWeightedRange(entry[1],visibleCards);
    villainRangeCombos+=normalized.combos.length;
    blockedVillainCombos+=normalized.blockedCombos;
    if(!normalized.combos.length){villainsReady=false;issues.push(`RANGE DE ${player.position.toUpperCase()} FICOU SEM COMBOS VÁLIDOS APÓS CARD REMOVAL.`)}
    if(normalized.invalidEntries.length)issues.push(`RANGE DE ${player.position.toUpperCase()} CONTÉM ENTRADAS INVÁLIDAS: ${normalized.invalidEntries.join(", ")}.`)
  }
  const heroRangeReady=rangeHasValidCombos(heroRange,state.board);
  if(!heroRangeReady)issues.push("RANGE PONDERADO DO HERO AUSENTE OU INVÁLIDO.");
  if(!active.length)issues.push("SEM ADVERSÁRIO ATIVO PARA ANÁLISE DE RANGE.");
  const rangeReady=heroRangeReady&&villainsReady;
  if(!rangeReady)issues.push("RANGES PONDERADOS DO NÓ INCOMPLETOS; EQUITY DE RANGE, EQR E FREQUÊNCIAS GTO NÃO PODEM SER INFERIDOS.");

  const postflopBoardReady=state.board.length>=3&&state.board.length<=5;
  if(state.board.length>5)issues.push("BOARD POSSUI MAIS DE 5 CARTAS.");
  if(state.street!=="PREFLOP"&&!postflopBoardReady)issues.push("BOARD INCOMPLETO PARA CÁLCULO EXAUSTIVO DE EQUITY PÓS-FLOP.");
  const headsUp=active.length===1;
  if(active.length>1)issues.push("EQUITY MULTIWAY EXAUSTIVA AINDA NÃO HABILITADA; NÃO CONVERTER EQUITY HU EM RESULTADO MULTIWAY.");
  const equityReady=blockersReady&&headsUp&&postflopBoardReady&&Boolean(villainEntries[0]?.[1]?.length);

  const icmReady=state.mode!=="TORNEIO"||Boolean(state.payouts?.length&&state.fieldStacks?.length);
  if(state.mode==="TORNEIO"&&!icmReady)issues.push("DADOS DE PAYOUT/FIELD INCOMPLETOS; ICM/RISK PREMIUM EXATO NÃO PODE SER CALCULADO.");
  const solverReady=rangeReady&&equityReady&&icmReady&&!issues.some(issue=>issue.includes("AÇÕES IMPOSSÍVEIS")||issue.includes("CARTAS AUSENTES")||issue.includes("INCOMPATÍVEIS"));
  return{legalActions,facingBet,toCall,potBeforeCall,potOdds,effectiveStack,spr,rangeReady,equityReady,icmReady,solverReady,blockersReady,heroRangeCombos:heroNormalized?.combos.length??0,villainRangeCombos,blockedVillainCombos,issues};
}
