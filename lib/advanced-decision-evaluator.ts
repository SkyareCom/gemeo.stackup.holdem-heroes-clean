import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import {inspectGtoNode} from "@/lib/gto-node-integrity";
import {evaluateCallFoldEv} from "@/lib/gto-call-ev";

export type AdvancedVerdictCode="CORRECT_ACTION"|"ADJUSTABLE_ACTION"|"INCORRECT_ACTION"|"UNVALIDATED_ACTION";
export type AdvancedEvStatus="EV_MAX"|"EV_NEUTRAL"|"EV_NEGATIVE"|"UNVALIDATED";
export type AdvancedRangeAction={action_name:string;frequency_percent:number|null;ev_status:AdvancedEvStatus;note:string};
export type AdvancedStreetAnalysis={street:"Pre-Flop"|"Flop"|"Turn"|"River";decision_point:string;technical_evaluation:string;action_classification:{verdict_code:AdvancedVerdictCode;verdict_label:"Ação Correta (+EV)"|"Ação Ajustável (Mista)"|"Ação Incorreta (-EV)"|"Análise GTO não validada";justification:string};range_action_distribution:{total_percentage:100|null;actions:AdvancedRangeAction[]}};
export type AdvancedDecisionEvaluatorOutput={street_analysis:AdvancedStreetAnalysis[]};

const streetLabel:Record<SolverSpotState["street"],AdvancedStreetAnalysis["street"]>={PREFLOP:"Pre-Flop",FLOP:"Flop",TURN:"Turn",RIVER:"River"};
function actionLabel(action:PlayerAction,sizing?:string){return sizing&&["BET","RAISE"].includes(action)?`${action} ${sizing}`:action}
function pct(v:number|null){return v===null?"N/A":`${(v*100).toFixed(1)}%`}

export function evaluateAdvancedDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):AdvancedDecisionEvaluatorOutput{
  const integrity=inspectGtoNode(state,legalActions),legal=integrity.legalActions,selectedIsLegal=legal.includes(selectedAction),technical=analyzeTechnicalDecision(state,selectedAction,legal,selectedSizing),callFold=evaluateCallFoldEv(state);
  const diagnosticVerdict:AdvancedVerdictCode=technical.verdict.startsWith("AÇÃO CORRETA")?"CORRECT_ACTION":technical.verdict.startsWith("AÇÃO INCORRETA")?"INCORRECT_ACTION":"ADJUSTABLE_ACTION";
  let verdictCode:AdvancedVerdictCode=!selectedIsLegal?"INCORRECT_ACTION":"UNVALIDATED_ACTION";
  let verdictLabel:AdvancedStreetAnalysis["action_classification"]["verdict_label"]=!selectedIsLegal?"Ação Incorreta (-EV)":"Análise GTO não validada";
  let deterministicJustification="";
  if(selectedIsLegal&&callFold.status==="EXACT_TERMINAL"&&(selectedAction==="CALL"||selectedAction==="FOLD")){
    const callEv=callFold.callEvBb??0,preferred=callFold.preferred;
    if(preferred==="INDIFFERENT"){verdictCode="ADJUSTABLE_ACTION";verdictLabel="Ação Ajustável (Mista)"}
    else if(selectedAction===preferred){verdictCode="CORRECT_ACTION";verdictLabel="Ação Correta (+EV)"}
    else{verdictCode="INCORRECT_ACTION";verdictLabel="Ação Incorreta (-EV)"}
    deterministicJustification=`EV TERMINAL DETERMINÍSTICO CONTRA RANGE PONDERADO: EQUITY ${pct(callFold.equity)} · EQUITY NECESSÁRIA ${pct(callFold.requiredEquity)} · EV CALL ${callEv.toFixed(3)} BB · EV FOLD 0.000 BB · LINHA MATEMÁTICA ${preferred}. ESTE RESULTADO NÃO É FREQUÊNCIA GTO NEM SOLUÇÃO DE EQUILÍBRIO; É EV TERMINAL DO CALL/FOLD PARA O RANGE INFORMADO.`;
  }
  const decisionPoint=selectedSizing?`HERO ESCOLHE ${selectedAction} ${selectedSizing}`:`HERO ESCOLHE ${selectedAction}`;
  const treeAudit=`TO CALL ${integrity.toCall.toFixed(1)} BB · POT ${integrity.potBeforeCall.toFixed(1)} BB · POT ODDS ${pct(integrity.potOdds)} · STACK EFETIVO ${integrity.effectiveStack.toFixed(1)} BB · SPR ${integrity.spr===null?"N/A":integrity.spr.toFixed(2)} · ${integrity.facingBet?"ENFRENTA APOSTA/RAISE":"SEM APOSTA A ENFRENTAR"} · AÇÕES LEGAIS ${legal.join(", ")}`;
  const readiness=`RANGES ${integrity.rangeReady?"OK":"AUSENTES"} · BLOCKERS ${integrity.blockersReady?"OK":"INVÁLIDOS"} · EQUITY ${integrity.equityReady?"PRONTA":"BLOQUEADA"} · ICM ${integrity.icmReady?"OK":"INCOMPLETO"} · SOLVER ${integrity.solverReady?"PRONTO":"NÃO PRONTO"}`;
  const issues=integrity.issues.length?integrity.issues.join(" | "):"SEM INCONSISTÊNCIAS ESTRUTURAIS DETECTADAS";
  const equityAudit=callFold.status==="EXACT_TERMINAL"?`EV CALL/FOLD TERMINAL DISPONÍVEL · EQUITY ${pct(callFold.equity)} · REQUIRED ${pct(callFold.requiredEquity)} · CALL EV ${(callFold.callEvBb??0).toFixed(3)} BB`:callFold.status==="EQUITY_ONLY"?`EQUITY DE SHOWDOWN ${pct(callFold.equity)} DISPONÍVEL, MAS EV DE CALL NÃO É FECHADO POR EXISTIREM DECISÕES FUTURAS`:`EV CALL/FOLD INDISPONÍVEL: ${callFold.issues.join(" / ")}`;
  const justification=!selectedIsLegal?`AÇÃO ${selectedAction} É ILEGAL NESTE NÓ. ${treeAudit}.`:deterministicJustification||`SEM SOLUÇÃO CONVERGIDA/VALIDADA, O APP NÃO ATRIBUI +EV/-EV GTO NEM FREQUÊNCIA GTO. O DIAGNÓSTICO INTERNO APONTA ${technical.bestAction} (${diagnosticVerdict}), APENAS COMO HIPÓTESE DE ESTUDO.`;
  const distribution:AdvancedRangeAction[]=legal.map(action=>({action_name:actionLabel(action,action===selectedAction?selectedSizing:undefined),frequency_percent:null,ev_status:"UNVALIDATED",note:callFold.status==="EXACT_TERMINAL"&&(action==="CALL"||action==="FOLD")?`EV TERMINAL DISPONÍVEL PARA CALL/FOLD; FREQUÊNCIA GTO CONTINUA NÃO VALIDADA.`:"FREQUÊNCIA E EV ESTRATÉGICO BLOQUEADOS ATÉ EXISTIR SOLUÇÃO GTO VALIDADA PARA ESTE NÓ."}));
  return{street_analysis:[{street:streetLabel[state.street],decision_point:decisionPoint,technical_evaluation:`INTEGRIDADE DO NÓ: ${treeAudit} | PRONTIDÃO: ${readiness} | EQUITY/EV: ${equityAudit} | PENDÊNCIAS: ${issues}`,action_classification:{verdict_code:verdictCode,verdict_label:verdictLabel,justification},range_action_distribution:{total_percentage:null,actions:distribution}}]};
}
