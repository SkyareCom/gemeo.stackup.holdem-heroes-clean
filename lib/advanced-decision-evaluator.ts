import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";

export type AdvancedVerdictCode="CORRECT_ACTION"|"ADJUSTABLE_ACTION"|"INCORRECT_ACTION";
export type AdvancedEvStatus="EV_MAX"|"EV_NEUTRAL"|"EV_NEGATIVE";
export type AdvancedRangeAction={action_name:string;frequency_percent:number;ev_status:AdvancedEvStatus;note:string};
export type AdvancedStreetAnalysis={
  street:"Pre-Flop"|"Flop"|"Turn"|"River";
  decision_point:string;
  technical_evaluation:string;
  action_classification:{verdict_code:AdvancedVerdictCode;verdict_label:"Ação Correta (+EV)"|"Ação Ajustável (Mista)"|"Ação Incorreta (-EV)";justification:string};
  range_action_distribution:{total_percentage:100;actions:AdvancedRangeAction[]};
};
export type AdvancedDecisionEvaluatorOutput={street_analysis:AdvancedStreetAnalysis[]};

const streetLabel:Record<SolverSpotState["street"],AdvancedStreetAnalysis["street"]>={PREFLOP:"Pre-Flop",FLOP:"Flop",TURN:"Turn",RIVER:"River"};
function round2(v:number){return Math.round(v*100)/100}
function actionLabel(action:PlayerAction,sizing?:string){return sizing&&["BET","RAISE"].includes(action)?`${action} ${sizing}`:action}
function normalizeWeights(items:{action:PlayerAction;weight:number;status:AdvancedEvStatus}[],selectedAction:PlayerAction,selectedSizing?:string){
  const positive=items.map(item=>({...item,weight:Math.max(.01,item.weight)}));
  const sum=positive.reduce((s,item)=>s+item.weight,0)||1;
  let allocated=0;
  return positive.map((item,index)=>{
    const last=index===positive.length-1;
    const pct=last?round2(100-allocated):round2(item.weight/sum*100);
    allocated=round2(allocated+pct);
    return{action_name:actionLabel(item.action,item.action===selectedAction?selectedSizing:undefined),frequency_percent:pct,ev_status:item.status,note:"FREQUÊNCIA DIAGNÓSTICA MODELADA; NÃO REPRESENTA FREQUÊNCIA EXATA DE SOLVER."};
  });
}

export function evaluateAdvancedDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):AdvancedDecisionEvaluatorOutput{
  const technical=analyzeTechnicalDecision(state,selectedAction,legalActions,selectedSizing);
  const verdictCode:AdvancedVerdictCode=technical.verdict.startsWith("AÇÃO CORRETA")?"CORRECT_ACTION":technical.verdict.startsWith("AÇÃO INCORRETA")?"INCORRECT_ACTION":"ADJUSTABLE_ACTION";
  const verdictLabel=verdictCode==="CORRECT_ACTION"?"Ação Correta (+EV)":verdictCode==="INCORRECT_ACTION"?"Ação Incorreta (-EV)":"Ação Ajustável (Mista)";
  const weights=technical.mix.map((item,index)=>{
    const status:AdvancedEvStatus=item.classification==="MAIOR EV"?"EV_MAX":item.classification==="MENOR EV"?"EV_NEGATIVE":"EV_NEUTRAL";
    const base=item.classification==="MAIOR EV"?1:item.classification==="MISTA"?.42:.08;
    const rankPenalty=Math.max(.3,1-index*.12);
    return{action:item.action,weight:base*rankPenalty,status};
  });
  const distribution=normalizeWeights(weights,selectedAction,selectedSizing);
  const selected=distribution.find(item=>item.action_name.startsWith(selectedAction))??distribution[0];
  const relevant=technical.sections.map(section=>`${section.label}: ${section.text}`).join(" | ");
  const decisionPoint=selectedSizing?`HERO ESCOLHE ${selectedAction} ${selectedSizing}`:`HERO ESCOLHE ${selectedAction}`;
  const justification=verdictCode==="CORRECT_ACTION"?`A AÇÃO ESTÁ NA FAIXA DE MAIOR PRIORIDADE DO MODELO DIAGNÓSTICO. ${technical.summary}`:verdictCode==="INCORRECT_ACTION"?`A AÇÃO PERDE PRIORIDADE MATERIAL PARA ${technical.bestAction}. ${technical.summary}`:`A AÇÃO É DEFENSÁVEL, MAS NÃO DOMINA A ÁRVORE; ${technical.bestAction} TEM PRIORIDADE. ${technical.summary}`;
  return{street_analysis:[{
    street:streetLabel[state.street],
    decision_point:decisionPoint,
    technical_evaluation:`AUDITORIA MULTICRITÉRIO: ${relevant}`,
    action_classification:{verdict_code:verdictCode,verdict_label:verdictLabel,justification},
    range_action_distribution:{total_percentage:100,actions:distribution.map(item=>({...item,note:item===selected?`${item.note} AÇÃO SELECIONADA PELO HERO.`:item.note}))},
  }]};
}
