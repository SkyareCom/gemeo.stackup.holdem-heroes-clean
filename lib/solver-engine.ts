import type {PlayerAction} from "@/data/player-dna-spots";

export type SolverMode="CASH"|"TORNEIO";
export type SolverStreet="PREFLOP"|"FLOP"|"TURN"|"RIVER";
export type SolverPlayer={position:string;stack:number;action:string;value:number};
export type SolverSpotState={
  mode:SolverMode;
  street:SolverStreet;
  hero:{position:string;stack:number;cards:string[]};
  board:string[];
  pot:number;
  players:SolverPlayer[];
  scenario:string[];
  rakePct?:number;
  anteBb?:number;
  payouts?:number[];
  fieldStacks?:number[];
  bounties?:number[];
};

export type SolverActionReference={frequency:number;evBb:number};
export type SolverReference={
  fingerprint:string;
  source:"IMPORTED_REFERENCE"|"STACKUP_VALIDATED";
  sourceDetail?:string;
  actions:Partial<Record<PlayerAction,SolverActionReference>>;
  exploitabilityBb?:number;
  verifiedAt?:string;
};

export type SolverDecisionResult={
  status:"VALIDATED"|"UNVALIDATED";
  verdict:"CORRETA"|"MISTA"|"EV NEGATIVO"|"NÃO JULGADA";
  fingerprint:string;
  selectedAction:PlayerAction;
  frequency?:number;
  evBb?:number;
  deltaEvBb?:number;
  bestAction?:PlayerAction;
  potOddsPct?:number;
  requiredEquityPct?:number;
  spr:number;
  effectiveStackBb:number;
  toCallBb:number;
  reference?:SolverReference;
  missingContext:string[];
  comment:string;
};

/*
  ESTA BIBLIOTECA É INTENCIONALMENTE VAZIA ATÉ QUE UMA SOLUÇÃO TENHA SIDO
  IMPORTADA/VALIDADA CONTRA O ESTADO EXATO DA MÃO. NÃO ADICIONE FREQUÊNCIAS,
  EVS OU NOMES DE SOLVERS POR ESTIMATIVA. CADA REFERÊNCIA DEVE VIR DE EXPORT
  AUTORIZADO OU DE UMA SOLUÇÃO STACKUP VALIDADA E REPRODUZÍVEL.
*/
const SOLVER_REFERENCES:SolverReference[]=[];

function round(value:number,places=3){const factor=10**places;return Math.round(value*factor)/factor}
function number(value:number){return Number.isFinite(value)?round(value,4):0}
function normalizeText(value:string){return value.trim().toUpperCase()}
function blindContribution(position:string,street:SolverStreet){if(street!=="PREFLOP")return 0;if(position==="SB")return .5;if(position==="BB")return 1;return 0}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
function canonicalCards(cards:string[]){return cards.map(normalizeText).join(" ")}

export function canonicalSolverState(state:SolverSpotState){
  const players=[...state.players]
    .map(player=>({position:normalizeText(player.position),stack:number(player.stack),action:normalizeText(player.action),value:number(player.value)}))
    .sort((a,b)=>a.position.localeCompare(b.position));
  return{
    mode:state.mode,
    street:state.street,
    hero:{position:normalizeText(state.hero.position),stack:number(state.hero.stack),cards:canonicalCards(state.hero.cards)},
    board:canonicalCards(state.board),
    pot:number(state.pot),
    players,
    scenario:[...state.scenario].map(normalizeText).sort(),
    rakePct:state.rakePct===undefined?null:number(state.rakePct),
    anteBb:state.anteBb===undefined?null:number(state.anteBb),
    payouts:state.payouts?.map(number)??null,
    fieldStacks:state.fieldStacks?.map(number)??null,
    bounties:state.bounties?.map(number)??null,
  };
}

export function solverFingerprint(state:SolverSpotState){return`stk-${hashText(JSON.stringify(canonicalSolverState(state)))}`}

function contextGaps(state:SolverSpotState){
  const gaps:string[]=[];
  const scenario=state.scenario.join(" ").toUpperCase();
  if(state.mode==="CASH"&&state.rakePct===undefined)gaps.push("RAKE");
  const icm=scenario.includes("ICM")||scenario.includes("BOLHA")||scenario.includes("FT");
  if(state.mode==="TORNEIO"&&icm){
    if(!state.payouts?.length)gaps.push("PAYOUTS");
    if(!state.fieldStacks?.length)gaps.push("STACKS DO FIELD");
    if(scenario.includes("BOUNTY")&&!state.bounties?.length)gaps.push("BOUNTIES");
  }
  return gaps;
}

function deterministicMath(state:SolverSpotState){
  const heroBlind=blindContribution(state.hero.position,state.street);
  const live=state.players.filter(player=>normalizeText(player.action)!=="FOLD");
  const maxCommitment=Math.max(0,...live.map(player=>player.value));
  const toCall=Math.max(0,maxCommitment-heroBlind);
  const potOdds=toCall>0?toCall/(Math.max(0,state.pot)+toCall):0;
  const aggressor=[...live].sort((a,b)=>b.value-a.value)[0];
  const effectiveStack=Math.min(state.hero.stack,aggressor?.stack??state.hero.stack);
  const spr=state.pot>0?effectiveStack/state.pot:0;
  return{toCallBb:round(toCall,2),potOddsPct:round(potOdds*100,2),requiredEquityPct:round(potOdds*100,2),effectiveStackBb:round(effectiveStack,2),spr:round(spr,2)};
}

function findReference(state:SolverSpotState){const fingerprint=solverFingerprint(state);return SOLVER_REFERENCES.find(reference=>reference.fingerprint===fingerprint)}

export function evaluateSolverDecision(state:SolverSpotState,selectedAction:PlayerAction):SolverDecisionResult{
  const fingerprint=solverFingerprint(state);
  const math=deterministicMath(state);
  const missingContext=contextGaps(state);
  const reference=findReference(state);
  if(!reference||missingContext.length){
    const reason=missingContext.length?`CONTEXTO INCOMPLETO: ${missingContext.join(" / ")}.`:`NÃO HÁ SOLUÇÃO DE REFERÊNCIA EXATA PARA ESTA FINGERPRINT.`;
    return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,...math,missingContext,comment:`${reason} AÇÃO REGISTRADA SEM INVENTAR EV OU FREQUÊNCIA.`};
  }
  const selected=reference.actions[selectedAction];
  const entries=(Object.entries(reference.actions) as [PlayerAction,SolverActionReference][]).filter(([,value])=>value&&Number.isFinite(value.evBb));
  if(!selected||!entries.length){
    return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,...math,missingContext:["AÇÃO AUSENTE NA REFERÊNCIA"],reference,comment:"A REFERÊNCIA NÃO CONTÉM EV/FREQUÊNCIA PARA ESTA AÇÃO. AÇÃO NÃO JULGADA."};
  }
  const [bestAction,best]=entries.reduce((best,current)=>current[1].evBb>best[1].evBb?current:best);
  const delta=selected.evBb-best.evBb;
  const frequency=Math.max(0,Math.min(100,selected.frequency));
  let verdict:SolverDecisionResult["verdict"]="EV NEGATIVO";
  if(delta>=-.01)verdict="CORRETA";
  else if(frequency>=1&&delta>=-.05)verdict="MISTA";
  const comment=verdict==="CORRETA"?"AÇÃO DENTRO DA FAIXA DE EV MÁXIMO DA SOLUÇÃO VALIDADA.":verdict==="MISTA"?"AÇÃO PRESENTE NA ESTRATÉGIA, MAS COM PERDA PEQUENA DE EV CONTRA A MELHOR LINHA.":"AÇÃO COM PERDA MATERIAL DE EV NA SOLUÇÃO VALIDADA.";
  return{status:"VALIDATED",verdict,fingerprint,selectedAction,frequency:round(frequency,2),evBb:round(selected.evBb,3),deltaEvBb:round(delta,3),bestAction,...math,reference,missingContext:[],comment};
}

export function solverReferenceCount(){return SOLVER_REFERENCES.length}
