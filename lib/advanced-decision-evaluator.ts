import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import {inspectGtoNode} from "@/lib/gto-node-integrity";

export type AdvancedVerdictCode="CORRECT_ACTION"|"ADJUSTABLE_ACTION"|"INCORRECT_ACTION"|"UNVALIDATED_ACTION";
export type AdvancedEvStatus="EV_MAX"|"EV_NEUTRAL"|"EV_NEGATIVE"|"UNVALIDATED";
export type AdvancedRangeAction={action_name:string;frequency_percent:number|null;ev_status:AdvancedEvStatus;note:string};
export type AdvancedStreetAnalysis={street:"Pre-Flop"|"Flop"|"Turn"|"River";decision_point:string;technical_evaluation:string;action_classification:{verdict_code:AdvancedVerdictCode;verdict_label:"Ação Correta (+EV)"|"Ação Ajustável (Mista)"|"Ação Incorreta (-EV)"|"Análise GTO não validada";justification:string};range_action_distribution:{total_percentage:100|null;actions:AdvancedRangeAction[]}};
export type AdvancedDecisionEvaluatorOutput={street_analysis:AdvancedStreetAnalysis[]};

const streetLabel:Record<SolverSpotState["street"],AdvancedStreetAnalysis["street"]>={PREFLOP:"Pre-Flop",FLOP:"Flop",TURN:"Turn",RIVER:"River"};
function actionLabel(action:PlayerAction,sizing?:string){return sizing&&["BET","RAISE"].includes(action)?`${action} ${sizing}`:action}
function pct(v:number|null){return v===null?"N/A":`${(v*100).toFixed(1)}%`}

export function evaluateAdvancedDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):AdvancedDecisionEvaluatorOutput{
  const integrity=inspectGtoNode(state,legalActions);const legal=integrity.legalActions;const selectedIsLegal=legal.includes(selectedAction);
  const technical=analyzeTechnicalDecision(state,selectedAction,legal,selectedSizing);
  const diagnosticVerdict:AdvancedVerdictCode=technical.verdict.startsWith("AÇÃO CORRETA")?"CORRECT_ACTION":technical.verdict.startsWith("AÇÃO INCORRETA")?"INCORRECT_ACTION":"ADJUSTABLE_ACTION";
  const verdictCode:AdvancedVerdictCode=!selectedIsLegal?"INCORRECT_ACTION":"UNVALIDATED_ACTION";
  const verdictLabel=verdictCode==="INCORRECT_ACTION"?"Ação Incorreta (-EV)":"Análise GTO não validada";
  const decisionPoint=selectedSizing?`HERO ESCOLHE ${selectedAction} ${selectedSizing}`:`HERO ESCOLHE ${selectedAction}`;
  const treeAudit=`TO CALL ${integrity.toCall.toFixed(1)} BB · POT ${integrity.potBeforeCall.toFixed(1)} BB · POT ODDS ${pct(integrity.potOdds)} · STACK EFETIVO ${integrity.effectiveStack.toFixed(1)} BB · SPR ${integrity.spr===null?"N/A":integrity.spr.toFixed(2)} · ${integrity.facingBet?"ENFRENTA APOSTA/RAISE":"SEM APOSTA A ENFRENTAR"} · AÇÕES LEGAIS ${legal.join(", ")}`;
  const readiness=`RANGES ${integrity.rangeReady?"OK":"AUSENTES"} · BLOCKERS ${integrity.blockersReady?"OK":"INVÁLIDOS"} · ICM ${integrity.icmReady?"OK":"INCOMPLETO"} · SOLVER ${integrity.solverReady?"PRONTO":"NÃO PRONTO"}`;
  const issues=integrity.issues.length?integrity.issues.join(" | "):"SEM INCONSISTÊNCIAS ESTRUTURAIS DETECTADAS";
  const justification=!selectedIsLegal?`AÇÃO ${selectedAction} É ILEGAL NESTE NÓ. ${treeAudit}.`:`SEM RANGES PONDERADOS E SOLUÇÃO CONVERGIDA/VALIDADA, O APP NÃO ATRIBUI +EV/-EV NEM FREQUÊNCIA GTO. O DIAGNÓSTICO INTERNO APONTA ${technical.bestAction} (${diagnosticVerdict}), APENAS COMO HIPÓTESE DE ESTUDO.`;
  const distribution:AdvancedRangeAction[]=legal.map(action=>({action_name:actionLabel(action,action===selectedAction?selectedSizing:undefined),frequency_percent:null,ev_status:"UNVALIDATED",note:"FREQUÊNCIA E EV BLOQUEADOS ATÉ EXISTIR SOLUÇÃO GTO VALIDADA PARA ESTE NÓ."}));
  return{street_analysis:[{street:streetLabel[state.street],decision_point:decisionPoint,technical_evaluation:`INTEGRIDADE DO NÓ: ${treeAudit} | PRONTIDÃO: ${readiness} | PENDÊNCIAS: ${issues}`,action_classification:{verdict_code:verdictCode,verdict_label:verdictLabel,justification},range_action_distribution:{total_percentage:null,actions:distribution}}]};
}
