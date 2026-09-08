import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import {inspectGtoNode} from "@/lib/gto-node-integrity";
import {playerDnaSpotToSolverState} from "@/lib/player-dna-state-adapter";

export type AiSpotAnalysisGateResult={status:"PASS"|"REJECT";issues:string[]};

export function validateAiSpotForAnalysis(spot:PlayerDnaSpot):AiSpotAnalysisGateResult{
  const issues:string[]=[];
  const state=playerDnaSpotToSolverState(spot);
  if(!state)return{status:"REJECT",issues:["ESTADO DO SPOT NÃO PÔDE SER CONVERTIDO PARA O MOTOR DE ANÁLISE."]};
  const declared=spot.legalActions??spot.actions;
  const integrity=inspectGtoNode(state,declared);
  if(!integrity.blockersReady)issues.push("CARTAS/BLOCKERS INVÁLIDOS.");
  if(!integrity.legalActions.length)issues.push("NÓ SEM AÇÕES LEGAIS.");
  if(!integrity.rangeReady)issues.push("RANGES PONDERADOS INCOMPLETOS PARA HERO/VILÕES.");
  if(state.street!=="PREFLOP"&&!integrity.equityReady)issues.push("NÓ PÓS-FLOP SEM PRÉ-REQUISITOS PARA EQUITY EXATA.");
  if(state.mode==="CASH"&&state.rakePct===undefined)issues.push("RAKE AUSENTE EM SPOT CASH.");
  if(state.mode==="TORNEIO"&&!integrity.icmReady)issues.push("PAYOUTS/FIELD STACKS AUSENTES EM SPOT DE TORNEIO.");
  const activeVillains=state.players.filter(player=>player.position.toUpperCase()!==state.hero.position.toUpperCase()&&player.action.toUpperCase()!=="FOLD").length;
  if(activeVillains>1&&!integrity.potAccountingReady)issues.push("MULTIWAY SEM COMMITMENTS/POT ACCOUNTING EXATOS.");
  if(integrity.issues.some(issue=>issue.includes("AÇÕES IMPOSSÍVEIS")||issue.includes("INCOMPATÍVEIS")))issues.push("ÁRVORE DE AÇÕES INCOMPATÍVEL COM O ESTADO.");
  return{status:issues.length?"REJECT":"PASS",issues};
}
