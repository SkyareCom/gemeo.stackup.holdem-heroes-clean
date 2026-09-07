"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import type {PlayerAction} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function num(value:string){const match=value.replace(",",".").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):0}
function cardFrom(el:Element){return`${text(el.querySelector(".rank"))}${text(el.querySelector(".suit"))}`}
function actionFromBadge(value:string){const upper=value.trim().toUpperCase();if(upper.startsWith("ALL-IN"))return"ALL-IN";if(upper.startsWith("RAISE"))return"RAISE";if(upper.startsWith("BET"))return"BET";if(upper.startsWith("CALL"))return"CALL";if(upper.startsWith("CHECK"))return"CHECK";if(upper.startsWith("FOLD"))return"FOLD";return"---"}
function fmt(value:number|undefined,places=1){return value===undefined?"---":value.toFixed(places).replace(/\.0$/,'')}

function parseState(session:HTMLElement):SolverSpotState|null{
  const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
  const root=table?.shadowRoot;if(!root)return null;
  const heroPlate=text(root.querySelector(".heroplate b"));
  const heroPosition=(heroPlate.split("·")[1]??"").trim();
  const heroStack=num(text(root.querySelector(".herostack")));
  const heroCards=[...root.querySelectorAll(".herocards .card")].map(cardFrom).filter(Boolean);
  const board=[...root.querySelectorAll(".board .card")].map(cardFrom).filter(Boolean);
  const street=text(root.querySelector(".street")) as SolverSpotState["street"];
  const pot=num(text(root.querySelector(".pot")));
  if(!heroPosition||!heroStack||!street||!pot)return null;
  const players=[...root.querySelectorAll<HTMLElement>(".seat")].map(seat=>{
    const position=seat.dataset.position??text(seat.querySelector(".plate b"));
    const stack=num(text(seat.querySelector(".stack")));
    const badge=text(seat.querySelector(".action"));
    return{position,stack,action:actionFromBadge(badge),value:num(badge)};
  });
  const scenarioSection=[...session.querySelectorAll<HTMLElement>("h4")].find(h=>text(h)==="CENÁRIO")?.parentElement as HTMLElement|null;
  const source=scenarioSection?.dataset.scenarioSource??"";
  const scenario=source.split(" / ").map(item=>item.trim()).filter(Boolean);
  const mode:SolverSpotState["mode"]=scenario.some(item=>item.includes("TORNEIO"))?"TORNEIO":"CASH";
  return{mode,street,hero:{position:heroPosition,stack:heroStack,cards:heroCards},board,pot,players,scenario};
}

function legalActions(session:HTMLElement){
  return [...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
    .filter(btn=>!btn.closest("[data-final-player-actions-v2]")&&ACTIONS.includes(text(btn) as PlayerAction)&&!btn.disabled)
    .map(btn=>text(btn) as PlayerAction)
    .filter((action,index,array)=>array.indexOf(action)===index);
}

export default function PlayerDnaAnalysisRuntimeFix(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.playerDnaAnalysisRuntimeFix="true";
    style.textContent=`
      .final-analysis-card-v2{border:1px solid #1F5F42!important;overflow:hidden!important;padding:5px 7px!important;row-gap:2px!important}
      .final-analysis-card-v2 .v2-line,.final-analysis-card-v2 .v2-line:last-child{border:0!important;border-bottom:0!important;border-top:0!important;box-shadow:none!important;background:transparent!important;min-height:18px!important;padding:1px 4px!important}
    `;
    document.head.querySelector("style[data-player-dna-analysis-runtime-fix]")?.remove();document.head.appendChild(style);

    let busy=false;
    const apply=()=>{
      if(busy)return;
      const session=document.querySelector<HTMLElement>(".training-session");
      const card=session?.querySelector<HTMLElement>("[data-final-analysis-card-v2]");
      if(!session||!card||card.classList.contains("awaiting"))return;
      const lines=[...card.querySelectorAll<HTMLElement>(".v2-line")];if(lines.length<8)return;
      const selectedText=text(lines[1]);const selectedAction=(selectedText.split(" ")[0]??"") as PlayerAction;
      if(!ACTIONS.includes(selectedAction))return;
      const state=parseState(session);if(!state)return;
      const solver=evaluateSolverDecision(state,selectedAction);
      if(solver.status==="VALIDATED")return;
      const legal=legalActions(session);if(!legal.includes(selectedAction))legal.push(selectedAction);
      const technical=analyzeTechnicalDecision(state,selectedAction,legal.length?legal:[selectedAction]);
      const mix=[...technical.mix].sort((a,b)=>b.frequency-a.frequency);
      const rows=Array.from({length:4},(_,i)=>mix[i]?`${mix[i].action} ${fmt(mix[i].frequency)}% · ${mix[i].classification}`:"---");
      busy=true;
      lines[0].textContent="AÇÃO REGISTRADA NO HISTÓRICO DO PLAYER DNA";
      lines[1].textContent=selectedText;
      lines[2].textContent="RESULTADO";
      lines[3].textContent=technical.verdict;
      lines[4].textContent=rows[0];
      lines[5].textContent=rows[1];
      lines[6].textContent=rows[2];
      lines[7].textContent=rows[3];
      card.dataset.analysisSource="STACKUP_TECHNICAL_BASELINE";
      card.title=`${technical.summary} · FREQUÊNCIAS DO BASELINE INTERNO; NÃO SÃO EXPORT DE SOLVER EXTERNO.`;
      window.setTimeout(()=>{busy=false},0);
    };
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    const timer=window.setInterval(apply,180);apply();
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
