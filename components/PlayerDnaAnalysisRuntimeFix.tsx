"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import type {PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const SIZINGS=["25%","33%","50%","66%","75%","POT","125%","150%","2X","2.5X","3X","4X","SQUEEZE"];
function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]??ch))}
function parseStructuredState(session:HTMLElement):{state:SolverSpotState;spot:PlayerDnaSpot}|null{
  const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
  const raw=table?.dataset.playerDnaSpot;if(!raw)return null;
  try{
    const spot=JSON.parse(raw) as PlayerDnaSpot;const hero=spot.players.find(p=>p.hero)??spot.players[0];if(!hero)return null;
    return{spot,state:{mode:spot.mode,street:spot.street,hero:{position:hero.position,stack:hero.stack,cards:spot.heroCards.split(" ").filter(Boolean)},board:(spot.board??"").split(" ").filter(Boolean),pot:spot.pot.main,potSides:spot.pot.sides,players:spot.players.map(p=>({position:p.position,stack:p.stack,action:p.action,value:p.value})),scenario:spot.scenario,actionHistory:spot.actionHistory,heroToCall:spot.heroToCall,currentBet:spot.currentBet,legalActions:spot.legalActions??spot.actions,rakePct:spot.rakePct,anteBb:spot.anteBb,payouts:spot.payouts,fieldStacks:spot.fieldStacks,bounties:spot.bounties}};
  }catch{return null}
}
function selectedNativeAction(session:HTMLElement){return[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(button=>!button.closest("[data-final-player-actions-v2]")&&ACTIONS.includes(text(button) as PlayerAction))}
function selectedNativeSizing(session:HTMLElement){return[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(button=>!button.closest("[data-final-player-actions-v2]")&&SIZINGS.includes(text(button)))}
function ensureCard(session:HTMLElement){
  let card=session.querySelector<HTMLElement>("[data-final-analysis-card-v2]");if(card)return card;
  card=document.createElement("div");card.dataset.finalAnalysisCardV2="true";card.className="final-analysis-card-v2 awaiting";card.innerHTML='<div class="v2-line v2-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
  const finalFooter=session.querySelector<HTMLElement>("[data-final-footer-v2]"),nativeFooter=session.querySelector<HTMLElement>(".training-footer"),sizing=session.querySelector<HTMLElement>("[class*=sizingActions]"),actions=session.querySelector<HTMLElement>("[data-final-player-actions-v2]");
  if(finalFooter)finalFooter.insertAdjacentElement("beforebegin",card);else if(nativeFooter)nativeFooter.insertAdjacentElement("beforebegin",card);else if(sizing)sizing.insertAdjacentElement("afterend",card);else if(actions)actions.insertAdjacentElement("afterend",card);else session.appendChild(card);return card;
}
function renderAwaiting(card:HTMLElement){card.className="final-analysis-card-v2 awaiting";card.removeAttribute("data-analysis-source");card.innerHTML='<div class="v2-line v2-wait">AGUARDANDO A AÇÃO DO HERÓI</div>'}
function renderAnalysis(card:HTMLElement,selectedText:string,state:SolverSpotState,spot:PlayerDnaSpot,selectedAction:PlayerAction,sizing?:string){
  const solver=evaluateSolverDecision(state,selectedAction,sizing);let verdict="",body="";
  if(solver.status==="VALIDATED"){
    verdict=solver.verdict==="CORRETA"?"AÇÃO CORRETA (+EV)":solver.verdict==="MISTA"?"AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)":"AÇÃO INCORRETA (-EV)";
    body=solver.actionMix.map(row=>`<div class="v2-section"><div class="v2-label">LINHA VALIDADA</div><div class="v2-text">${escapeHtml(`${row.action} ${row.frequency}% · ${row.classification} · EV ${row.evBb} BB`)}</div></div>`).join("");
    card.dataset.analysisSource="VALIDATED_SOLVER_REFERENCE";
  }else{
    const legal=spot.legalActions??spot.actions,technical=analyzeTechnicalDecision(state,selectedAction,legal.length?legal:[selectedAction],sizing);verdict=technical.verdict;
    body=`<div class="v2-section v2-primary"><div class="v2-label">MELHOR LINHA</div><div class="v2-text">${escapeHtml(`${technical.bestAction} · CONFIANÇA ${technical.confidence} · ${technical.summary}`)}</div></div>${technical.sections.map(section=>`<div class="v2-section" data-section="${escapeHtml(section.key)}"><div class="v2-label">${escapeHtml(section.label)}</div><div class="v2-text">${escapeHtml(section.text)}</div></div>`).join("")}<div class="v2-section v2-comments"><div class="v2-label">COMENTÁRIOS TÉCNICOS</div>${technical.comments.map(comment=>`<div class="v2-comment">${escapeHtml(comment)}</div>`).join("")}</div>`;
    card.dataset.analysisSource="STACKUP_GTO_DIAGNOSTIC";
  }
  card.className="final-analysis-card-v2";
  card.innerHTML=`<div class="v2-line v2-head">AÇÃO REGISTRADA NO HISTÓRICO DO PLAYER DNA</div><div class="v2-line v2-value">${escapeHtml(selectedText)}</div><div class="v2-line v2-head">RESULTADO</div><div class="v2-line v2-verdict">${escapeHtml(verdict)}</div><div class="v2-study">${body}</div>`;
}

export default function PlayerDnaAnalysisRuntimeFix(){
  useEffect(()=>{
    const style=document.createElement("style");style.dataset.playerDnaAnalysisRuntimeFix="true";style.textContent=`
      .final-analysis-card-v2{box-sizing:border-box!important;width:100%!important;min-height:260px!important;height:auto!important;display:block!important;margin-top:5px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important;padding:8px!important;position:relative!important;z-index:60!important}
      .final-analysis-card-v2 .v2-line{display:flex!important;align-items:center!important;justify-content:center!important;min-height:20px!important;padding:2px 4px!important;border:0!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .final-analysis-card-v2 .v2-head{color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;font-size:7.5px!important;letter-spacing:.35px!important}
      .final-analysis-card-v2 .v2-value{font-size:9px!important;font-weight:700!important}
      .final-analysis-card-v2 .v2-verdict{font-size:11px!important;font-weight:800!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;margin-bottom:4px!important}
      .final-analysis-card-v2 .v2-study{display:grid!important;grid-template-columns:1fr!important;gap:4px!important}
      .final-analysis-card-v2 .v2-section{display:block!important;border:0!important;border-top:1px solid rgba(31,95,66,.45)!important;padding:5px 4px 3px!important;background:transparent!important}
      .final-analysis-card-v2 .v2-label{font-size:7.5px!important;line-height:1.15!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;text-align:left!important;margin-bottom:2px!important}
      .final-analysis-card-v2 .v2-text,.final-analysis-card-v2 .v2-comment{font-size:8px!important;line-height:1.25!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .final-analysis-card-v2 .v2-primary .v2-text{font-size:8.5px!important;font-weight:700!important}
      .final-analysis-card-v2 .v2-comment{padding:2px 0!important}
      .final-analysis-card-v2.awaiting{min-height:60px!important;height:60px!important;display:grid!important;place-items:center!important;animation:stackupAnalysisBlink 1.05s ease-in-out infinite!important}
      .final-analysis-card-v2.awaiting .v2-wait{font-size:11px!important}
      @keyframes stackupAnalysisBlink{0%,100%{opacity:1}50%{opacity:.38}}
      @media(max-width:620px){.final-analysis-card-v2{padding:7px!important}.final-analysis-card-v2 .v2-label{font-size:7px!important}.final-analysis-card-v2 .v2-text,.final-analysis-card-v2 .v2-comment{font-size:7.4px!important}.final-analysis-card-v2 .v2-verdict{font-size:10px!important}}
    `;
    document.head.querySelector("style[data-player-dna-analysis-runtime-fix]")?.remove();document.head.appendChild(style);
    let signature="",busy=false;
    const apply=()=>{if(busy)return;const session=document.querySelector<HTMLElement>(".training-session");if(!session){signature="";return}const parsed=parseStructuredState(session);if(!parsed)return;const card=ensureCard(session),nativeAction=selectedNativeAction(session),proxyAction=[...session.querySelectorAll<HTMLButtonElement>('[data-final-player-actions-v2] button[aria-pressed="true"]')].find(button=>ACTIONS.includes((button.dataset.base??"") as PlayerAction)),actionText=nativeAction?text(nativeAction):(proxyAction?.dataset.base??"").toUpperCase(),selectedAction=actionText as PlayerAction,nativeSizing=selectedNativeSizing(session),proxySizing=proxyAction?.dataset.size?.toUpperCase()||"",sizing=nativeSizing?text(nativeSizing):(proxySizing||undefined),selectedText=ACTIONS.includes(selectedAction)?`${selectedAction}${sizing?` ${sizing}`:""}`:"",nextSignature=[parsed.spot.id,selectedText].join("|");if(nextSignature===signature)return;signature=nextSignature;busy=true;if(!selectedText)renderAwaiting(card);else renderAnalysis(card,selectedText,parsed.state,parsed.spot,selectedAction,sizing);window.setTimeout(()=>{busy=false},0)};
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["aria-pressed","disabled","data-player-dna-spot"]});const timer=window.setInterval(apply,120);apply();return()=>{observer.disconnect();window.clearInterval(timer);style.remove()}
  },[]);return null;
}
