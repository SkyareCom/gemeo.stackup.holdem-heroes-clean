import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";

export type AdvancedVerdictCode="CORRECT_ACTION"|"ADJUSTABLE_ACTION"|"INCORRECT_ACTION";
export type AdvancedEvStatus="EV_MAX"|"EV_NEUTRAL"|"EV_NEGATIVE"|"UNVALIDATED";
export type AdvancedRangeAction={action_name:string;frequency_percent:number|null;ev_status:AdvancedEvStatus;note:string};
export type AdvancedStreetAnalysis={street:"Pre-Flop"|"Flop"|"Turn"|"River";decision_point:string;technical_evaluation:string;action_classification:{verdict_code:AdvancedVerdictCode;verdict_label:"Ação Correta (+EV)"|"Ação Ajustável (Mista)"|"Ação Incorreta (-EV)";justification:string};range_action_distribution:{total_percentage:100|null;actions:AdvancedRangeAction[]}};
export type AdvancedDecisionEvaluatorOutput={street_analysis:AdvancedStreetAnalysis[]};

const streetLabel:Record<SolverSpotState["street"],AdvancedStreetAnalysis["street"]>={PREFLOP:"Pre-Flop",FLOP:"Flop",TURN:"Turn",RIVER:"River"};
function actionLabel(action:PlayerAction,sizing?:string){return sizing&&["BET","RAISE"].includes(action)?`${action} ${sizing}`:action}
function legalTree(state:SolverSpotState,declared:PlayerAction[]){
  const unique=[...new Set(declared)];
  const facingBet=(state.heroToCall??0)>0||Math.max(0,...state.players.map(p=>p.value))>0;
  const filtered=unique.filter(action=>facingBet?!["CHECK","BET"].includes(action):!["CALL","FOLD"].includes(action));
  return filtered.length?filtered:unique;
}

export function evaluateAdvancedDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):AdvancedDecisionEvaluatorOutput{
  const legal=legalTree(state,legalActions);
  const technical=analyzeTechnicalDecision(state,selectedAction,legal,selectedSizing);
  const selectedIsLegal=legal.includes(selectedAction);
  let verdictCode:AdvancedVerdictCode=technical.verdict.startsWith("AÇÃO CORRETA")?"CORRECT_ACTION":technical.verdict.startsWith("AÇÃO INCORRETA")?"INCORRECT_ACTION":"ADJUSTABLE_ACTION";
  if(!selectedIsLegal)verdictCode="INCORRECT_ACTION";
  const verdictLabel=verdictCode==="CORRECT_ACTION"?"Ação Correta (+EV)":verdictCode==="INCORRECT_ACTION"?"Ação Incorreta (-EV)":"Ação Ajustável (Mista)";
  const decisionPoint=selectedSizing?`HERO ESCOLHE ${selectedAction} ${selectedSizing}`:`HERO ESCOLHE ${selectedAction}`;
  const relevant=technical.sections.map(section=>`${section.label}: ${section.text}`).join(" | ");
  const justification=!selectedIsLegal?`AÇÃO ${selectedAction} É INCOMPATÍVEL COM O ESTADO ATUAL DA ÁRVORE. AÇÕES LEGAIS: ${legal.join(", ")}.`:verdictCode==="CORRECT_ACTION"?`A AÇÃO É COERENTE COM A ANÁLISE DIAGNÓSTICA. ${technical.summary}`:verdictCode==="INCORRECT_ACTION"?`A AÇÃO PERDE PRIORIDADE PARA ${technical.bestAction}. ${technical.summary}`:`A AÇÃO É DEFENSÁVEL NO MODELO DIAGNÓSTICO, COM ${technical.bestAction} COMO LINHA DE REFERÊNCIA. ${technical.summary}`;
  const distribution:AdvancedRangeAction[]=legal.map(action=>({action_name:actionLabel(action,action===selectedAction?selectedSizing:undefined),frequency_percent:null,ev_status:"UNVALIDATED",note:"SEM SOLUÇÃO GTO VALIDADA PARA ESTE NÓ; FREQUÊNCIA E EV NÃO SÃO INFERIDOS."}));
  return{street_analysis:[{street:streetLabel[state.street],decision_point:decisionPoint,technical_evaluation:`AUDITORIA DIAGNÓSTICA: ${relevant} | REGRA DE INTEGRIDADE: FREQUÊNCIAS E EV NUMÉRICOS EXIGEM SOLUÇÃO VALIDADA DA ÁRVORE/RANGES.`,action_classification:{verdict_code:verdictCode,verdict_label:verdictLabel,justification},range_action_distribution:{total_percentage:null,actions:distribution}}]};
}
