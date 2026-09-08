import type {PlayerAction} from "@/data/player-dna-spots";
import type {WeightedRangeEntry} from "@/lib/gto-range-engine";

export type SolverMode="CASH"|"TORNEIO";
export type SolverStreet="PREFLOP"|"FLOP"|"TURN"|"RIVER";
export type SolverPlayer={position:string;stack:number;action:string;value:number};
export type SolverActionHistory={position:string;action:string;value:number};
export type SolverNodeRanges={hero?:WeightedRangeEntry[];villains?:Record<string,WeightedRangeEntry[]>};
export type SolverSpotState={
  mode:SolverMode;
  street:SolverStreet;
  hero:{position:string;stack:number;cards:string[]};
  board:string[];
  pot:number;
  potSides?:{value:number;players:string[]}[];
  players:SolverPlayer[];
  scenario:string[];
  actionHistory?:SolverActionHistory[];
  heroToCall?:number;
  currentBet?:number;
  legalActions?:PlayerAction[];
  rakePct?:number;
  anteBb?:number;
  payouts?:number[];
  fieldStacks?:number[];
  bounties?:number[];
  ranges?:SolverNodeRanges;
  commitments?:Record<string,number>;
};

export type SolverActionReference={frequency:number;evBb:number};
export type SolverReference={fingerprint:string;source:"IMPORTED_REFERENCE"|"STACKUP_VALIDATED";sourceDetail?:string;actions:Partial<Record<PlayerAction,SolverActionReference>>;sizings?:Partial<Record<string,SolverActionReference>>;exploitabilityBb?:number;verifiedAt?:string};
export type SolverActionMix={action:PlayerAction;frequency:number;evBb:number;deltaEvBb:number;classification:"MAIOR EV"|"MISTA"|"MENOR EV"};
export type SolverDecisionResult={status:"VALIDATED"|"UNVALIDATED";verdict:"CORRETA"|"MISTA"|"EV NEGATIVO"|"NÃO JULGADA";fingerprint:string;selectedAction:PlayerAction;selectedSizing?:string;frequency?:number;evBb?:number;deltaEvBb?:number;bestAction?:PlayerAction;actionMix:SolverActionMix[];potOddsPct:number;requiredEquityPct:number;spr:number;effectiveStackBb:number;toCallBb:number;reference?:SolverReference;missingContext:string[];comment:string};
let references:SolverReference[]=[];
function round(value:number,places=3){const factor=10**places;return Math.round(value*factor)/factor}
function finite(value:number){return Number.isFinite(value)?round(value,4):0}
function upper(value:string){return value.trim().toUpperCase()}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
function heroBlind(position:string,street:SolverStreet){if(street!=="PREFLOP")return 0;if(position==="SB")return .5;if(position==="BB")return 1;return 0}
function canonicalRange(entries:WeightedRangeEntry[]|undefined){return entries?.map(entry=>({hand:upper(entry.hand),weight:finite(entry.weight)})).sort((a,b)=>a.hand.localeCompare(b.hand)||a.weight-b.weight)??null}
function canonicalCommitments(entries:Record<string,number>|undefined){if(!entries)return null;const rows:[string,number][]=Object.entries(entries).map(([position,value])=>[upper(position),finite(value)]);rows.sort(([a],[b])=>a.localeCompare(b));return Object.fromEntries(rows)}
export function canonicalSolverState(state:SolverSpotState){return{mode:state.mode,street:state.street,hero:{position:upper(state.hero.position),stack:finite(state.hero.stack),cards:state.hero.cards.map(upper).join(" ")},board:state.board.map(upper).join(" "),pot:finite(state.pot),potSides:(state.potSides??[]).map(side=>({value:finite(side.value),players:[...side.players].map(upper).sort()})),players:[...state.players].map(player=>({position:upper(player.position),stack:finite(player.stack),action:upper(player.action),value:finite(player.value)})).sort((a,b)=>a.position.localeCompare(b.position)),scenario:[...state.scenario].map(upper).sort(),actionHistory:(state.actionHistory??[]).map(item=>({position:upper(item.position),action:upper(item.action),value:finite(item.value)})),heroToCall:state.heroToCall===undefined?null:finite(state.heroToCall),currentBet:state.currentBet===undefined?null:finite(state.currentBet),legalActions:state.legalActions?.map(upper).sort()??null,rakePct:state.rakePct===undefined?null:finite(state.rakePct),anteBb:state.anteBb===undefined?null:finite(state.anteBb),payouts:state.payouts?.map(finite)??null,fieldStacks:state.fieldStacks?.map(finite)??null,bounties:state.bounties?.map(finite)??null,ranges:state.ranges?{hero:canonicalRange(state.ranges.hero),villains:Object.fromEntries(Object.entries(state.ranges.villains??{}).sort(([a],[b])=>a.localeCompare(b)).map(([position,range])=>[upper(position),canonicalRange(range)]))}:null,commitments:canonicalCommitments(state.commitments)}}
export function solverFingerprint(state:SolverSpotState){return`stk2-${hashText(JSON.stringify(canonicalSolverState(state)))}`}
function validReference(reference:SolverReference){if(!reference?.fingerprint||!reference.actions)return false;const entries=Object.values(reference.actions).filter(Boolean) as SolverActionReference[];if(!entries.length)return false;if(entries.some(entry=>!Number.isFinite(entry.frequency)||entry.frequency<0||entry.frequency>100||!Number.isFinite(entry.evBb)))return false;const sum=entries.reduce((s,e)=>s+e.frequency,0);return sum>=99&&sum<=101}
export function setSolverReferences(next:SolverReference[]){const unique=new Map<string,SolverReference>();for(const reference of next)if(validReference(reference))unique.set(reference.fingerprint,reference);references=[...unique.values()];return references.length}
export function addSolverReferences(next:SolverReference[]){return setSolverReferences([...references,...next])}
export function solverReferenceCount(){return references.length}
export async function loadSolverReferenceCatalog(url:string){if(!url)return 0;const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(`SOLVER_REFERENCE_HTTP_${response.status}`);const payload=await response.json() as {references?:SolverReference[]}|SolverReference[];return setSolverReferences(Array.isArray(payload)?payload:payload.references??[])}
function contextGaps(state:SolverSpotState){const gaps:string[]=[];const scenario=state.scenario.join(" ").toUpperCase();if(state.mode==="CASH"&&state.rakePct===undefined)gaps.push("RAKE");const icm=scenario.includes("ICM")||scenario.includes("BOLHA")||scenario.includes("FT");if(state.mode==="TORNEIO"&&icm){if(!state.payouts?.length)gaps.push("PAYOUTS");if(!state.fieldStacks?.length)gaps.push("STACKS DO FIELD");if(scenario.includes("BOUNTY")&&!state.bounties?.length)gaps.push("BOUNTIES")}return gaps}
function deterministicMath(state:SolverSpotState){const heroPosition=upper(state.hero.position);const live=state.players.filter(player=>upper(player.action)!=="FOLD"&&upper(player.position)!==heroPosition);const inferredCommit=heroBlind(heroPosition,state.street);const maxCommit=Math.max(0,...state.players.filter(player=>upper(player.action)!=="FOLD").map(player=>player.value));const inferredToCall=Math.max(0,maxCommit-inferredCommit);const toCall=Math.max(0,state.heroToCall??inferredToCall);const potBeforeCall=Math.max(0,state.pot);const potOdds=toCall>0?toCall/(potBeforeCall+toCall):0;const effective=Math.max(0,Math.min(state.hero.stack,...(live.length?live.map(player=>player.stack):[state.hero.stack])));const spr=potBeforeCall>0?effective/potBeforeCall:0;return{toCallBb:round(toCall,2),potOddsPct:round(potOdds*100,2),requiredEquityPct:round(potOdds*100,2),effectiveStackBb:round(effective,2),spr:round(spr,2)}}
function actionMix(reference:SolverReference):SolverActionMix[]{const entries=(Object.entries(reference.actions) as [PlayerAction,SolverActionReference][]).filter(([,value])=>value&&Number.isFinite(value.evBb)&&Number.isFinite(value.frequency));if(!entries.length)return[];const bestEv=Math.max(...entries.map(([,value])=>value.evBb));const worstEv=Math.min(...entries.map(([,value])=>value.evBb));return entries.map(([action,value])=>{const delta=value.evBb-bestEv;let classification:SolverActionMix["classification"]="MISTA";if(Math.abs(value.evBb-bestEv)<=.01)classification="MAIOR EV";else if(Math.abs(value.evBb-worstEv)<=.01)classification="MENOR EV";return{action,frequency:round(value.frequency,2),evBb:round(value.evBb,3),deltaEvBb:round(delta,3),classification}}).sort((a,b)=>b.evBb-a.evBb||b.frequency-a.frequency)}
export function evaluateSolverDecision(state:SolverSpotState,selectedAction:PlayerAction,selectedSizing?:string):SolverDecisionResult{const fingerprint=solverFingerprint(state),math=deterministicMath(state),gaps=contextGaps(state),reference=references.find(item=>item.fingerprint===fingerprint);if(!reference||gaps.length){const reason=gaps.length?`CONTEXTO INCOMPLETO: ${gaps.join(" / ")}`:"SEM REFERÊNCIA EXATA VALIDADA";return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,selectedSizing,actionMix:[],...math,missingContext:gaps,comment:`${reason}. EV E FREQUÊNCIAS NÃO FORAM INFERIDOS.`}}const mix=actionMix(reference),sizingKey=selectedSizing?`${selectedAction} ${upper(selectedSizing)}`:"",selected=(sizingKey&&reference.sizings?.[sizingKey])||reference.actions[selectedAction];if(!selected||!mix.length)return{status:"UNVALIDATED",verdict:"NÃO JULGADA",fingerprint,selectedAction,selectedSizing,actionMix:[],...math,reference,missingContext:["AÇÃO/SIZING AUSENTE"],comment:"A REFERÊNCIA EXATA NÃO CONTÉM ESTA AÇÃO/SIZING."};const best=mix[0],delta=selected.evBb-best.evBb,frequency=selected.frequency;let verdict:SolverDecisionResult["verdict"]="EV NEGATIVO";if(delta>=-.01)verdict="CORRETA";else if(frequency>=1&&delta>=-.05)verdict="MISTA";return{status:"VALIDATED",verdict,fingerprint,selectedAction,selectedSizing,frequency:round(frequency,2),evBb:round(selected.evBb,3),deltaEvBb:round(delta,3),bestAction:best.action,actionMix:mix,...math,reference,missingContext:[],comment:verdict==="CORRETA"?"AÇÃO NA FAIXA DE EV MÁXIMO.":verdict==="MISTA"?"AÇÃO PRESENTE NA ESTRATÉGIA MISTA.":"AÇÃO COM PERDA MATERIAL DE EV."}}
