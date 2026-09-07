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
  sizings?:Partial<Record<string,SolverActionReference>>;
  exploitabilityBb?:number;
  verifiedAt?:string;
};
export type SolverActionMix={
  action:PlayerAction;
  frequency:number;
  evBb:number;
  deltaEvBb:number;
  classification:"MAIOR EV"|"MISTA"|"MENOR EV";
};
export type SolverDecisionResult={
  status:"VALIDATED"|"UNVALIDATED";
  verdict:"CORRETA"|"MISTA"|"EV NEGATIVO"|"NÃO JULGADA";
  fingerprint:string;
  selectedAction:PlayerAction;
  selectedSizing?:string;
  frequency?:number;
  evBb?:number;
  deltaEvBb?:number;
  bestAction?:PlayerAction;
  actionMix:SolverActionMix[];
  potOddsPct:number;
  requiredEquityPct:number;
  spr:number;
  effectiveStackBb:number;
  toCallBb:number;
  reference?:SolverReference;
  missingContext:string[];
  comment:string;
};

let references:SolverReference[]=[];

function round(value:number,places=3){const factor=10**places;return Math.round(value*factor)/factor}
function finite(value:number){return Number.isFinite(value)?round(value,4):0}
function upper(value:string){return value.trim().toUpperCase()}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
function heroBlind(position:string,street:SolverStreet){if(street!=="PREFLOP")return 0;if(position==="SB")return .5;if(position==="BB")return 1;return 0}

export function canonicalSolverState(state:SolverSpotState){
  return{
    mode:state.mode,
    street:state.street,
    hero:{position:upper(state.hero.position),stack:finite(state.hero.stack),cards:state.hero.cards.map(upper).join(" ")},
    board:state.board.map(upper).join(" "),
    pot:finite(state.pot),
    players:[...state.players].map(player=>({position:upper(player.position),stack:finite(player.stack),action:upper(player.action),value:finite(player.value)})).sort((a,b)=>a.position.localeCompare(b.position)),
    scenario:[...state.scenario].map(upper).sort(),
    rakePct:state.rakePct===undefined?null:finite(state.rakePct),
    anteBb:state.anteBb===undefined?null:finite(state.anteBb),
    payouts:state.payouts?.map(finite)??null,
    fieldStacks:state.fieldStacks?.map(finite)??null,
    bounties:state.bounties?.map(finite)??null,
  };
}

export function solverFingerprint(state:SolverSpotState){return`stk2-${hashText(JSON.stringify(canonicalSolverState(state)))}`}

export function setSolverReferences(next:SolverReference[]){
  const unique=new Map<string,SolverReference>();
  for(const reference of next){
    if(!reference?.fingerprint||!reference.actions)continue;
    const entries=Object.values(reference.actions).filter(Boolean);
    if(!entries.length)continue;
    if(entries.some(entry=>!Number.isFinite(entry!.frequency)||!Number.isFinite(entry!.evBb)))continue;
    unique.set(reference.fingerprint,reference);
  }
  references=[...unique.values()];
  return references.length;
}

export function addSolverReferences(next:SolverReference[]){return setSolverReferences([...references,...next])}
export function solverReferenceCount(){return references.length}

export async function loadSolverReferenceCatalog(url:string){
  if(!url)return 0;
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw new Error(`SOLVER_REFERENCE_HTTP_${response.status}`);
  const payload=await response.json() as {references?:SolverReference[]}|SolverReference[];
  const list=Array.isArray(payload)?payload:payload.references??[];
  return setSolverReferences(list);
}

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
  const live=state.players.filter(player=>upper(player.action)!=="FOLD");
  const heroPosition=upper(state.hero.position);
  const heroCommit=heroBlind(heroPosition,state.street);
  const maxCommit=Math.max(0,...live.map(player=>player.value));
  const toCall=Math.max(0,maxCommit-heroCommit);
  const potOdds=toCall>0?toCall/(Math.max(0,state.pot)+toCall):0;
  const opponents=live.filter(player=>upper(player.position)!==heroPosition);
  const effective=Math.min(state.hero.stack,...(opponents.length?opponents.map(player=>player.stack):[state.hero.stack]));
  const spr=state.pot>0?effective/state.pot:0;
  return{toCallBb:round(toCall,2),potOddsPct:round(potOdds*100,2),requiredEquityPct:round(potOdds*100,2),effectiveStackBb:round(effective,2),spr:round(spr,2)};
}

function actionMix(reference:SolverReference):SolverActionMix[]{
  const entries=(Object.entries(reference.actions) as [PlayerAction,SolverActionReference][]).filter(([,value])=>value&&Number.isFinite(value.evBb)&&Number.isFinite(value.frequency));
  if(!entries.length)return[];
  const bestEv=Math.max(...entries.map(([,value])=>value.evBb));
  const worstEv=Math.min(...entries.map(([,value])=>value.evBb));
  return entries.map(([action,value])=>{
    const delta=value.evBb-bestEv;
    let classification:SolverActionMix["classification"]="MISTA";
    if(Math.abs(value.evBb-bestEv)<=.01)classification="MAIOR EV";
    else if(Math.abs(value.evBb-worstEv)<=.01)classification="MENOR EV";
    return{action,frequency:round(Math.max(0,Math.min(100,value.frequency)),2),evBb:round(value.evBb,3),deltaEvBb:round(delta,3),classification};
  }).sort((a,b)=>b.evBb-a.evBb||b.frequency-a.frequency);
}

export function evaluateSolverDecision(state:SolverSpotState,selectedAction:PlayerAction,selectedSizing?:string):SolverDecisionResult{
  const fingerprint=solverFingerprint(state);
  const math=deterministicMath(state);
  const gaps=contextGaps(state);
  const reference=references.find(item=>item.fingerprint===fingerprint);
  if(!reference||gaps.length){
    const reason=gaps.length?`CONTEXTO INCOMPLETO: ${gaps.join(" / ")}`:"SEM REFERÊNCIA EXATA VALIDADA";
    return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,selectedSizing,actionMix:[],...math,missingContext:gaps,comment:`${reason}. EV E FREQUÊNCIAS NÃO FORAM INFERIDOS.`};
  }
  const mix=actionMix(reference);
  const sizingKey=selectedSizing?`${selectedAction} ${upper(selectedSizing)}`:"";
  const selected=(sizingKey&&reference.sizings?.[sizingKey])||reference.actions[selectedAction];
  if(!selected||!mix.length){
    return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,selectedSizing,actionMix:[],...math,reference,missingContext:["AÇÃO/SIZING AUSENTE"],comment:"A REFERÊNCIA EXATA NÃO CONTÉM ESTA AÇÃO/SIZING."};
  }
  const best=mix[0];
  const delta=selected.evBb-best.evBb;
  const frequency=Math.max(0,Math.min(100,selected.frequency));
  let verdict:SolverDecisionResult["verdict"]="EV NEGATIVO";
  if(delta>=-.01)verdict="CORRETA";
  else if(frequency>=1&&delta>=-.05)verdict="MISTA";
  return{status:"VALIDATED",verdict,fingerprint,selectedAction,selectedSizing,frequency:round(frequency,2),evBb:round(selected.evBb,3),deltaEvBb:round(delta,3),bestAction:best.action,actionMix:mix,...math,reference,missingContext:[],comment:verdict==="CORRETA"?"AÇÃO NA FAIXA DE EV MÁXIMO.":verdict==="MISTA"?"AÇÃO PRESENTE NA ESTRATÉGIA MISTA.":"AÇÃO COM PERDA MATERIAL DE EV."};
}
