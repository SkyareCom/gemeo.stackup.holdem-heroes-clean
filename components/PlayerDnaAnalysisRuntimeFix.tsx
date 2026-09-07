"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import {analyzeTechnicalDecision} from "@/lib/player-dna-technical-analysis";
import type {PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function parseStructuredState(session:HTMLElement):{state:SolverSpotState;spot:PlayerDnaSpot}|null{
  const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
  const raw=table?.dataset.playerDnaSpot;if(!raw)return null;
  try{
    const spot=JSON.parse(raw) as PlayerDnaSpot;const hero=spot.players.find(p=>p.hero)??spot.players[0];if(!hero)return null;
    return{spot,state:{mode:spot.mode,street:spot.street,hero:{position:hero.position,stack:hero.stack,cards:spot.heroCards.split(" ").filter(Boolean)},board:(spot.board??"").split(" ").filter(Boolean),pot:spot.pot.main,potSides:spot.pot.sides,players:spot.players.map(p=>({position:p.position,stack:p.stack,action:p.action,value:p.value})),scenario:spot.scenario,actionHistory:spot.actionHistory,heroToCall:spot.heroToCall,currentBet:spot.currentBet,legalActions:spot.legalActions??spot.actions,rakePct:spot.rakePct,anteBb:spot.anteBb,payouts:spot.payouts,fieldStacks:spot.fieldStacks,bounties:spot.bounties}};
  }catch{return null}
}
function selectedSizing(selectedText:string,action:PlayerAction){if(action!=="BET"&&action!=="RAISE")return undefined;const rest=selectedText.slice(action.length).trim();return rest||undefined}
export default function PlayerDnaAnalysisRuntimeFix(){
  useEffect(()=>{
    const style=document.createElement("style");style.dataset.playerDnaAnalysisRuntimeFix="true";style.textContent=`.final-analysis-card-v2{border:1px solid #1F5F42!important;overflow:hidden!important;padding:5px 7px!important;row-gap:2px!important}.final-analysis-card-v2 .v2-line,.final-analysis-card-v2 .v2-line:last-child{border:0!important;border-bottom:0!important;border-top:0!important;box-shadow:none!important;background:transparent!important;min-height:18px!important;padding:1px 4px!important}`;document.head.querySelector("style[data-player-dna-analysis-runtime-fix]")?.remove();document.head.appendChild(style);
    let busy=false;
    const apply=()=>{if(busy)return;const session=document.querySelector<HTMLElement>(".training-session");const card=session?.querySelector<HTMLElement>("[data-final-analysis-card-v2]");if(!session||!card||card.classList.contains("awaiting"))return;const lines=[...card.querySelectorAll<HTMLElement>(".v2-line")];if(lines.length<8)return;const selectedText=text(lines[1]);const selectedAction=(selectedText.split(" ")[0]??"") as PlayerAction;if(!ACTIONS.includes(selectedAction))return;const parsed=parseStructuredState(session);if(!parsed)return;const {state,spot}=parsed;const sizing=selectedSizing(selectedText,selectedAction);const solver=evaluateSolverDecision(state,selectedAction,sizing);busy=true;lines[0].textContent="AÇÃO REGISTRADA NO HISTÓRICO DO PLAYER DNA";lines[1].textContent=selectedText;lines[2].textContent="RESULTADO";
      if(solver.status==="VALIDATED"){
        lines[3].textContent=solver.verdict==="CORRETA"?"AÇÃO CORRETA (+EV)":solver.verdict==="MISTA"?"AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)":"AÇÃO INCORRETA (-EV)";
        const rows=solver.actionMix.slice(0,4);for(let i=0;i<4;i++){const row=rows[i];lines[4+i].textContent=row?`${row.action} ${row.frequency}% · ${row.classification} · EV ${row.evBb} BB`:"---"}card.dataset.analysisSource="VALIDATED_SOLVER_REFERENCE";
      }else{
        const legal=spot.legalActions??spot.actions;const technical=analyzeTechnicalDecision(state,selectedAction,legal.length?legal:[selectedAction]);lines[3].textContent=technical.verdict;lines[4].textContent=technical.summary;lines[5].textContent=`POT ODDS ${technical.potOdds}% · SPR ${technical.spr}`;lines[6].textContent=`ANÁLISE GTO DIAGNÓSTICA · ${state.street} · ${state.scenario.includes("MULTIWAY")?"MULTIWAY":"HEADS-UP"}`;lines[7].textContent="BASE TEÓRICA DE SOLVERS + MATEMÁTICA DO SPOT · SEM DEPENDÊNCIA DE BANCO DE DADOS";card.dataset.analysisSource="STACKUP_GTO_DIAGNOSTIC";
      }
      window.setTimeout(()=>{busy=false},0)
    };
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});const timer=window.setInterval(apply,180);apply();return()=>{observer.disconnect();window.clearInterval(timer);style.remove()}
  },[]);return null;
}
