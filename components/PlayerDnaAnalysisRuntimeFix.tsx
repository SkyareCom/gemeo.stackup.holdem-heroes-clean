"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import type {PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const SIZINGS=["25%","33%","50%","66%","75%","POT","125%","150%","2X","2.5X","3X","4X","SQUEEZE"];
function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function parseStructuredState(session:HTMLElement):{state:SolverSpotState;spot:PlayerDnaSpot}|null{
  const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
  const raw=table?.dataset.playerDnaSpot;if(!raw)return null;
  try{
    const spot=JSON.parse(raw) as PlayerDnaSpot;const hero=spot.players.find(p=>p.hero)??spot.players[0];if(!hero)return null;
    return{spot,state:{mode:spot.mode,street:spot.street,hero:{position:hero.position,stack:hero.stack,cards:spot.heroCards.split(" ").filter(Boolean)},board:(spot.board??"").split(" ").filter(Boolean),pot:spot.pot.main,potSides:spot.pot.sides,players:spot.players.map(p=>({position:p.position,stack:p.stack,action:p.action,value:p.value})),scenario:spot.scenario,actionHistory:spot.actionHistory,heroToCall:spot.heroToCall,currentBet:spot.currentBet,legalActions:spot.legalActions??spot.actions,rakePct:spot.rakePct,anteBb:spot.anteBb,payouts:spot.payouts,fieldStacks:spot.fieldStacks,bounties:spot.bounties}};
  }catch{return null}
}
function selectedNativeAction(session:HTMLElement){
  return [...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(button=>!button.closest("[data-final-player-actions-v2]")&&ACTIONS.includes(text(button) as PlayerAction));
}
function selectedNativeSizing(session:HTMLElement){
  return [...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(button=>!button.closest("[data-final-player-actions-v2]")&&SIZINGS.includes(text(button)));
}
function ensureCard(session:HTMLElement){
  let card=session.querySelector<HTMLElement>("[data-final-analysis-card-v2]");
  if(card)return card;
  card=document.createElement("div");
  card.dataset.finalAnalysisCardV2="true";
  card.className="final-analysis-card-v2 awaiting";
  card.innerHTML='<div class="v2-line v2-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
  const finalFooter=session.querySelector<HTMLElement>("[data-final-footer-v2]");
  const nativeFooter=session.querySelector<HTMLElement>(".training-footer");
  const sizing=session.querySelector<HTMLElement>("[class*=sizingActions]");
  const actions=session.querySelector<HTMLElement>("[data-final-player-actions-v2]");
  if(finalFooter)finalFooter.insertAdjacentElement("beforebegin",card);
  else if(nativeFooter)nativeFooter.insertAdjacentElement("beforebegin",card);
  else if(sizing)sizing.insertAdjacentElement("afterend",card);
  else if(actions)actions.insertAdjacentElement("afterend",card);
  else session.appendChild(card);
  return card;
}
function renderAwaiting(card:HTMLElement){
  card.className="final-analysis-card-v2 awaiting";
  card.removeAttribute("data-analysis-source");
  card.innerHTML='<div class="v2-line v2-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
}
function renderAnalysis(card:HTMLElement,selectedText:string,state:SolverSpotState,spot:PlayerDnaSpot,selectedAction:PlayerAction,sizing?:string){
  const solver=evaluateSolverDecision(state,selectedAction,sizing);
  let verdict="";let rows:string[]=[];
  if(solver.status==="VALIDATED"){
    verdict=solver.verdict==="CORRETA"?"AÇÃO CORRETA (+EV)":solver.verdict==="MISTA"?"AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)":"AÇÃO INCORRETA (-EV)";
    rows=solver.actionMix.slice(0,4).map(row=>`${row.action} ${row.frequency}% · ${row.classification} · EV ${row.evBb} BB`);
    card.dataset.analysisSource="VALIDATED_SOLVER_REFERENCE";
  }else{
    const legal=spot.legalActions??spot.actions;
    const technical=analyzeTechnicalDecision(state,selectedAction,legal.length?legal:[selectedAction],sizing);
    verdict=technical.verdict;
    rows=[
      `MELHOR LINHA: ${technical.bestAction} · CONFIANÇA ${technical.confidence}`,
      technical.diagnostics[1]??technical.summary,
      technical.diagnostics[2]??`POT ODDS ${technical.potOdds}% · SPR ${technical.spr}`,
      technical.diagnostics[3]??"ANÁLISE GTO DIAGNÓSTICA",
    ];
    card.dataset.analysisSource="STACKUP_GTO_DIAGNOSTIC";
    card.title=`${technical.summary} · BASE TEÓRICA GTO E PADRÕES CONSOLIDADOS DE SOLVERS; NÃO REPRESENTA UM CÁLCULO CFR EM TEMPO REAL.`;
  }
  while(rows.length<4)rows.push("---");
  card.className="final-analysis-card-v2";
  card.innerHTML=`
    <div class="v2-line v2-head">AÇÃO REGISTRADA NO HISTÓRICO DO PLAYER DNA</div>
    <div class="v2-line v2-value">${selectedText}</div>
    <div class="v2-line v2-head">RESULTADO</div>
    <div class="v2-line v2-value">${verdict}</div>
    ${rows.slice(0,4).map((row,index)=>`<div class="v2-line v2-analysis" data-row="${index+1}">${row||"---"}</div>`).join("")}
  `;
}

export default function PlayerDnaAnalysisRuntimeFix(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.playerDnaAnalysisRuntimeFix="true";
    style.textContent=`
      .final-analysis-card-v2{box-sizing:border-box!important;width:100%!important;min-height:160px!important;height:auto!important;display:grid!important;grid-template-rows:repeat(8,minmax(20px,auto))!important;margin-top:5px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important;padding:5px 7px!important;row-gap:2px!important;position:relative!important;z-index:60!important}
      .final-analysis-card-v2 .v2-line,.final-analysis-card-v2 .v2-line:last-child{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;min-height:18px!important;padding:1px 4px!important;border:0!important;box-shadow:none!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:8px!important;line-height:1.2!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .final-analysis-card-v2 .v2-head{color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;font-size:7.5px!important}
      .final-analysis-card-v2 .v2-value{font-size:9px!important;font-weight:700!important}
      .final-analysis-card-v2 .v2-analysis{font-size:8px!important}
      .final-analysis-card-v2.awaiting{min-height:60px!important;height:60px!important;grid-template-rows:60px!important;animation:stackupAnalysisBlink 1.05s ease-in-out infinite!important}
      .final-analysis-card-v2.awaiting .v2-wait{font-size:11px!important}
      @keyframes stackupAnalysisBlink{0%,100%{opacity:1}50%{opacity:.38}}
      @media(max-width:620px){.final-analysis-card-v2 .v2-line{font-size:7px!important}.final-analysis-card-v2 .v2-value{font-size:8px!important}}
    `;
    document.head.querySelector("style[data-player-dna-analysis-runtime-fix]")?.remove();document.head.appendChild(style);
    let signature="";let busy=false;
    const apply=()=>{
      if(busy)return;
      const session=document.querySelector<HTMLElement>(".training-session");if(!session){signature="";return}
      const parsed=parseStructuredState(session);if(!parsed)return;
      const card=ensureCard(session);
      const nativeAction=selectedNativeAction(session);
      const proxyAction=[...session.querySelectorAll<HTMLButtonElement>('[data-final-player-actions-v2] button[aria-pressed="true"]')].find(button=>ACTIONS.includes((button.dataset.base??"") as PlayerAction));
      const actionText=nativeAction?text(nativeAction):(proxyAction?.dataset.base??"").toUpperCase();
      const selectedAction=actionText as PlayerAction;
      const nativeSizing=selectedNativeSizing(session);
      const proxySizing=proxyAction?.dataset.size?.toUpperCase()||"";
      const sizing=nativeSizing?text(nativeSizing):(proxySizing||undefined);
      const selectedText=ACTIONS.includes(selectedAction)?`${selectedAction}${sizing?` ${sizing}`:""}`:"";
      const nextSignature=[parsed.spot.id,selectedText].join("|");if(nextSignature===signature)return;signature=nextSignature;
      busy=true;
      if(!selectedText)renderAwaiting(card);else renderAnalysis(card,selectedText,parsed.state,parsed.spot,selectedAction,sizing);
      window.setTimeout(()=>{busy=false},0);
    };
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["aria-pressed","disabled","data-player-dna-spot"]});
    const timer=window.setInterval(apply,120);apply();
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()}
  },[]);
  return null;
}
