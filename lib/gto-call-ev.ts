import type {SolverSpotState} from "@/lib/player-dna-solver-v2";
import {heroVsWeightedRangeEquity} from "@/lib/gto-equity-engine";

export type CallFoldEvResult={
  status:"EXACT_TERMINAL"|"EQUITY_ONLY"|"UNAVAILABLE";
  equity:number|null;
  requiredEquity:number|null;
  callEvBb:number|null;
  foldEvBb:0;
  preferred:"CALL"|"FOLD"|"INDIFFERENT"|null;
  villainPosition:string|null;
  assumptions:string[];
  issues:string[];
};

function round(v:number,p=4){const f=10**p;return Math.round(v*f)/f}
function activeVillains(state:SolverSpotState){const hero=state.hero.position.toUpperCase();return state.players.filter(p=>p.position.toUpperCase()!==hero&&p.action.toUpperCase()!=="FOLD")}
function heroCommitted(state:SolverSpotState){const hero=state.hero.position.toUpperCase();return Math.max(0,state.players.find(p=>p.position.toUpperCase()===hero)?.value??0)}
function toCall(state:SolverSpotState){if(typeof state.heroToCall==="number")return Math.max(0,state.heroToCall);const committed=heroCommitted(state);const max=Math.max(committed,...state.players.filter(p=>p.action.toUpperCase()!=="FOLD").map(p=>Math.max(0,p.value)));return Math.max(0,max-committed)}

export function evaluateCallFoldEv(state:SolverSpotState):CallFoldEvResult{
  const assumptions:string[]=[],issues:string[]=[];const villains=activeVillains(state),call=toCall(state),pot=Math.max(0,state.pot);
  if(call<=0)return{status:"UNAVAILABLE",equity:null,requiredEquity:null,callEvBb:null,foldEvBb:0,preferred:null,villainPosition:null,assumptions,issues:["HERO NÃO ENFRENTA APOSTA; CALL/FOLD EV NÃO SE APLICA."]};
  const required=pot+call>0?call/(pot+call):null;
  if(villains.length!==1)return{status:"UNAVAILABLE",equity:null,requiredEquity:required===null?null:round(required),callEvBb:null,foldEvBb:0,preferred:null,villainPosition:null,assumptions,issues:["EV CALL/FOLD EXATO AINDA É BLOQUEADO EM NÓ MULTIWAY."]};
  const villain=villains[0],range=state.ranges?.villains?.[villain.position]??Object.entries(state.ranges?.villains??{}).find(([pos])=>pos.toUpperCase()===villain.position.toUpperCase())?.[1];
  if(!range?.length)return{status:"UNAVAILABLE",equity:null,requiredEquity:required===null?null:round(required),callEvBb:null,foldEvBb:0,preferred:null,villainPosition:villain.position,assumptions,issues:[`RANGE PONDERADO AUSENTE PARA ${villain.position.toUpperCase()}.`]};
  if(state.street==="PREFLOP")return{status:"UNAVAILABLE",equity:null,requiredEquity:required===null?null:round(required),callEvBb:null,foldEvBb:0,preferred:null,villainPosition:villain.position,assumptions,issues:["MOTOR DE EQUITY EXATA ATUAL EXIGE FLOP/TURN/RIVER."]};
  const heroCards=state.hero.cards as [string,string];const equityResult=heroVsWeightedRangeEquity(heroCards,range,state.board);
  if(equityResult.status!=="OK")return{status:"UNAVAILABLE",equity:null,requiredEquity:required===null?null:round(required),callEvBb:null,foldEvBb:0,preferred:null,villainPosition:villain.position,assumptions,issues:equityResult.issues};
  const equity=equityResult.heroEquity;const terminal=state.street==="RIVER"||call>=Math.min(state.hero.stack,villain.stack)-1e-9;
  if(!terminal){assumptions.push("EQUITY ENUMERADA ATÉ O RIVER, MAS FUTURAS DECISÕES DE APOSTA NÃO ESTÃO MODELADAS.");return{status:"EQUITY_ONLY",equity:round(equity),requiredEquity:required===null?null:round(required),callEvBb:null,foldEvBb:0,preferred:null,villainPosition:villain.position,assumptions,issues};}
  assumptions.push(state.street==="RIVER"?"RIVER: NÃO HÁ STREET FUTURA APÓS O CALL.":"CALL TRATADO COMO TERMINAL POR COMPROMETER O STACK EFETIVO.");
  const ev=equity*(pot+call)-call;const eps=.0005;const preferred=ev>eps?"CALL":ev<-eps?"FOLD":"INDIFFERENT";
  return{status:"EXACT_TERMINAL",equity:round(equity),requiredEquity:required===null?null:round(required),callEvBb:round(ev),foldEvBb:0,preferred,villainPosition:villain.position,assumptions,issues};
}
