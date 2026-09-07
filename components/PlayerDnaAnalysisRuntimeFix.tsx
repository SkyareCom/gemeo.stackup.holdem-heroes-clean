"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import type {PlayerAction} from "@/data/player-dna-spots";

function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function num(value:string){const match=value.replace(",",".").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):0}
function cardFrom(el:Element){return`${text(el.querySelector(".rank"))}${text(el.querySelector(".suit"))}`}
function actionFromBadge(value:string){const upper=value.trim().toUpperCase();if(upper.startsWith("ALL-IN"))return"ALL-IN";if(upper.startsWith("RAISE"))return"RAISE";if(upper.startsWith("BET"))return"BET";if(upper.startsWith("CALL"))return"CALL";if(upper.startsWith("CHECK"))return"CHECK";if(upper.startsWith("FOLD"))return"FOLD";return"---"}
function fmt(value:number|undefined,places=2){return value===undefined?"---":value.toFixed(places).replace(/\.00$/,'')}

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

export default function PlayerDnaAnalysisRuntimeFix(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.playerDnaAnalysisRuntimeFix="true";
    style.textContent=`
      .final-analysis-card-v2{border:1px solid #1F5F42!important;overflow:hidden!important}
      .final-analysis-card-v2 .v2-line,.final-analysis-card-v2 .v2-line:last-child{border:0!important;border-bottom:0!important;border-top:0!important;box-shadow:none!important;background:transparent!important}
    `;
    document.head.querySelector("style[data-player-dna-analysis-runtime-fix]")?.remove();
    document.head.appendChild(style);

    let busy=false;
    const apply=()=>{
      if(busy)return;
      const session=document.querySelector<HTMLElement>(".training-session");
      const card=session?.querySelector<HTMLElement>("[data-final-analysis-card-v2]");
      if(!session||!card||card.classList.contains("awaiting"))return;
      const lines=[...card.querySelectorAll<HTMLElement>(".v2-line")];
      if(lines.length<8)return;
      const selectedText=text(lines[1]);
      const selectedAction=(selectedText.split(" ")[0]??"") as PlayerAction;
      if(!["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"].includes(selectedAction))return;
      const state=parseState(session);if(!state)return;
      const result=evaluateSolverDecision(state,selectedAction);
      if(result.status==="VALIDATED")return;
      busy=true;
      lines[2].textContent="RESULTADO";
      lines[3].textContent="ANÁLISE INTERNA · SEM SOLUÇÃO GTO VALIDADA";
      lines[4].textContent=`POT ODDS ${fmt(result.potOddsPct)}% · EQ. MÍNIMA ${fmt(result.requiredEquityPct)}%`;
      lines[5].textContent=`CALL ${fmt(result.toCallBb)} BB · STACK EFETIVO ${fmt(result.effectiveStackBb)} BB`;
      lines[6].textContent=`SPR ${fmt(result.spr)} · AÇÃO ${selectedText}`;
      lines[7].textContent="EV E FREQUÊNCIAS DE AÇÃO SÓ APARECEM COM REFERÊNCIA SOLVER EXATA";
      window.setTimeout(()=>{busy=false},0);
    };
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    const timer=window.setInterval(apply,200);
    apply();
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
