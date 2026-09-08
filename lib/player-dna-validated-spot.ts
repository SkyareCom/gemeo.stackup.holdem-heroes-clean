import type {PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";
import {validateAiSpotForAnalysis} from "@/lib/ai-spot-analysis-gate";
import {playerDnaSpotToSolverState} from "@/lib/player-dna-state-adapter";
import {evaluateSolverDecision,solverFingerprint} from "@/lib/player-dna-solver-v2";

export type ValidatedTrainingSpotResult={
  status:"VALIDATED"|"REJECTED";
  fingerprint?:string;
  issues:string[];
};

export function validateSpotForCertifiedTraining(spot:PlayerDnaSpot):ValidatedTrainingSpotResult{
  const integrity=validateAiSpotForAnalysis(spot);
  if(integrity.status!=="PASS")return{status:"REJECTED",issues:[...integrity.issues]};
  const state=playerDnaSpotToSolverState(spot);
  if(!state)return{status:"REJECTED",issues:["ESTADO DO SPOT NÃO PÔDE SER CONVERTIDO PARA O MOTOR DE SOLVER."]};
  const legal=(spot.legalActions??spot.actions).filter(Boolean) as PlayerAction[];
  if(!legal.length)return{status:"REJECTED",issues:["SPOT SEM AÇÃO LEGAL PARA VALIDAR."]};
  const fingerprint=solverFingerprint(state);
  for(const action of legal){
    const result=evaluateSolverDecision(state,action);
    if(result.status==="VALIDATED"&&result.reference?.source==="STACKUP_VALIDATED")return{status:"VALIDATED",fingerprint,issues:[]};
  }
  return{status:"REJECTED",fingerprint,issues:["SEM REFERÊNCIA GTO/SOLVER COM BENCHMARK COMERCIAL VALIDADO PARA ESTE NÓ."]};
}

export function isCertifiedTrainingSpot(spot:PlayerDnaSpot){return validateSpotForCertifiedTraining(spot).status==="VALIDATED"}
