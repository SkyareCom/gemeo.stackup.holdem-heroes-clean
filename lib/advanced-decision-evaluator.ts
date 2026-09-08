import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";

export type AdvancedVerdictCode="CORRECT_ACTION"|"ADJUSTABLE_ACTION"|"INCORRECT_ACTION"|"UNVALIDATED_ACTION";
export type AdvancedEvStatus="EV_MAX"|"EV_NEUTRAL"|"EV_NEGATIVE"|"UNVALIDATED";
export type AdvancedRangeAction={action_name:string;frequency_percent:number|null;ev_status:AdvancedEvStatus;note:string};
export type AdvancedStreetAnalysis={street:"Pre-Flop"|"Flop"|"Turn"|"River";decision_point:string;technical_evaluation:string;action_classification:{verdict_code:AdvancedVerdictCode;verdict_label:"Ação Correta (+EV)"|"Ação Ajustável (Mista)"|"Ação Incorreta (-EV)"|"Análise GTO não validada";justification:string};range_action_distribution:{total_percentage:100|null;actions:AdvancedRangeAction[]}};
export type AdvancedDecisionEvaluatorOutput={street_analysis:AdvancedStreetAnalysis[]};

const streetLabel:Record<SolverSpotState["street"],AdvancedStreetAnalysis["street"]>={PREFLOP:"Pre-Flop",FLOP:"Flop",TURN:"Turn",RIVER:"River"};
function actionLabel(action:PlayerAction,sizing?:string){return sizing&&["BET","RAISE"].includes(action)?`${action} ${sizing}`:action}
function heroCommitted(state:SolverSpotState){const pos=state.hero.position.toUpperCase();return Math.max(0,...state.players.filter(p=>p.position.toUpperCase()===pos).map(p=>p.value),0)}
function amountToCall(state:SolverSpotState){if(typeof state.heroToCall==="number")return Math.max(0,state.heroToCall);const hero=heroCommitted(state);const max=Math.max(hero,...state.players.filter(p=>p.action.toUpperCase()!=="FOLD").map(p=>p.value),0);return Math.max(0,max-hero)}
function legalTree(state:SolverSpotState,declared:PlayerAction[]){
  const unique=[...new Set(declared)];const toCall=amountToCall(state);const facingBet=toCall>0;
  const ruleLegal:PlayerAction[]=facingBet?["FOLD","CALL","RAISE","ALL-IN"]:["CHECK","BET","ALL-IN"];
  const intersection=unique.filter(action=>ruleLegal.includes(action));
  return{actions:intersection.length?intersection:ruleLegal,toCall,facingBet,declaredMismatch:intersection.length!==unique.length};
}

export function evaluateAdvancedDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):AdvancedDecisionEvaluatorOutput{
  const tree=legalTree(state,legalActions);const legal=tree.actions;const selectedIsLegal=legal.includes(selectedAction);
  const technical=analyzeTechnicalDecision(state,selectedAction,legal,selectedSizing);
  const diagnosticVerdict:AdvancedVerdictCode=technical.verdict.startsWith("AÇÃO CORRETA")?"CORRECT_ACTION":technical.verdict.startsWith("AÇÃO INCORRETA")?"INCORRECT_ACTION":"ADJUSTABLE_ACTION";
  const verdictCode:AdvancedVerdictCode=!selectedIsLegal?"INCORRECT_ACTION":"UNVALIDATED_ACTION";
  const verdictLabel=verdictCode==="INCORRECT_ACTION"?"Ação Incorreta (-EV)":"Análise GTO não validada";
  const decisionPoint=selectedSizing?`HERO ESCOLHE ${selectedAction} ${selectedSizing}`:`HERO ESCOLHE ${selectedAction}`;
  const relevant=technical.sections.map(section=>`${section.label}: ${section.text}`).join(" | ");
  const treeAudit=`TO CALL ${tree.toCall.toFixed(1)} BB · ${tree.facingBet?"HERO ENFRENTA APOSTA/RAISE":"HERO NÃO ENFRENTA APOSTA"} · AÇÕES LEGAIS ${legal.join(", ")}${tree.declaredMismatch?" · INCONSISTÊNCIA DETECTADA ENTRE SPOT E ÁRVORE LEGAL":""}`;
  const justification=!selectedIsLegal?`AÇÃO ${selectedAction} É ILEGAL NESTE NÓ. ${treeAudit}.`:`SEM SOLUÇÃO DE EQUILÍBRIO VALIDADA PARA ESTE NÓ, O APP NÃO ATRIBUI +EV/-EV, FREQUÊNCIA OU ESTRATÉGIA GTO À AÇÃO. O DIAGNÓSTICO HEURÍSTICO INTERNO SUGERE ${technical.bestAction} (${diagnosticVerdict}), MAS NÃO É APRESENTADO COMO SOLUÇÃO GTO.`;
  const distribution:AdvancedRangeAction[]=legal.map(action=>({action_name:actionLabel(action,action===selectedAction?selectedSizing:undefined),frequency_percent:null,ev_status:"UNVALIDATED",note:"SEM SOLUÇÃO GTO VALIDADA PARA ESTE NÓ; FREQUÊNCIA E EV NÃO SÃO INFERIDOS."}));
  return{street_analysis:[{street:streetLabel[state.street],decision_point:decisionPoint,technical_evaluation:`INTEGRIDADE DA ÁRVORE: ${treeAudit} | AUDITORIA DIAGNÓSTICA: ${relevant} | FREQUÊNCIAS/EV NUMÉRICOS EXIGEM RANGES, ÁRVORE E SOLUÇÃO CONVERGIDA/VALIDADA.`,action_classification:{verdict_code:verdictCode,verdict_label:verdictLabel,justification},range_action_distribution:{total_percentage:null,actions:distribution}}]};
}
