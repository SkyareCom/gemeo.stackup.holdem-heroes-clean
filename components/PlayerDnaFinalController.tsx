"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,type SolverSpotState} from "@/lib/solver-engine";
import type {PlayerAction} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const BET_SIZES=["33%","66%","POT","125%","150%"];
const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];

function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function num(value:string){const match=value.replace(",",".").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):0}
function cardFrom(el:Element){return`${text(el.querySelector(".rank"))}${text(el.querySelector(".suit"))}`}
function actionFromBadge(value:string){const upper=value.trim().toUpperCase();if(upper.startsWith("ALL-IN"))return"ALL-IN";if(upper.startsWith("RAISE"))return"RAISE";if(upper.startsWith("BET"))return"BET";if(upper.startsWith("CALL"))return"CALL";if(upper.startsWith("CHECK"))return"CHECK";if(upper.startsWith("FOLD"))return"FOLD";return"---"}

function parseSolverState(table:HTMLElement,scenarioText:string):SolverSpotState|null{
  const root=table.shadowRoot;if(!root)return null;
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
  const scenario=scenarioText.split(" / ").map(item=>item.trim()).filter(Boolean);
  const mode:SolverSpotState["mode"]=scenario.some(item=>item.includes("TORNEIO"))?"TORNEIO":"CASH";
  return{mode,street,hero:{position:heroPosition,stack:heroStack,cards:heroCards},board,pot,players,scenario};
}

function fmt(value:number|undefined,places=2){if(value===undefined)return"---";return value.toFixed(places).replace(/\.00$/,'')}

export default function PlayerDnaFinalController(){
  useEffect(()=>{
    let lastSignature="";
    let scenarioText="";

    const apply=()=>{
      const session=document.querySelector<HTMLElement>(".training-session");
      if(!session){lastSignature="";scenarioText="";return}

      const scenarioHeading=[...session.querySelectorAll<HTMLElement>("h4")].find(h=>text(h)==="CENÁRIO");
      const scenarioSection=scenarioHeading?.parentElement as HTMLElement|null;
      if(scenarioSection){
        if(!scenarioSection.dataset.scenarioSource)scenarioSection.dataset.scenarioSource=[...scenarioSection.querySelectorAll<HTMLElement>("span")].map(el=>text(el)).filter(Boolean).join(" / ");
        scenarioText=scenarioSection.dataset.scenarioSource??scenarioText;
        scenarioSection.style.setProperty("display","none","important");
        scenarioSection.setAttribute("aria-hidden","true");
      }

      const nativeActions=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions]"));
      if(!nativeActions.length)return;
      const available=[...new Set(nativeActions.map(btn=>text(btn) as PlayerAction))];
      const selected=nativeActions.find(btn=>btn.getAttribute("aria-pressed")==="true");
      const selectedAction=selected?text(selected) as PlayerAction:"";
      nativeActions[0]?.parentElement?.style.setProperty("display","none","important");

      const sizingBase=available.includes("BET")?"BET":available.includes("RAISE")?"RAISE":"";
      const sizes=sizingBase==="BET"?BET_SIZES:RAISE_SIZES;
      const nativeSizes=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>sizes.includes(text(btn))&&!btn.closest("[data-final-player-actions]"));
      const selectedSize=nativeSizes.find(btn=>btn.getAttribute("aria-pressed")==="true");
      const selectedSizing=selectedSize?text(selectedSize):"";
      nativeSizes[0]?.parentElement?.style.setProperty("display","none","important");

      const nativeFooter=session.querySelector<HTMLElement>(".training-footer");
      if(nativeFooter)nativeFooter.style.setProperty("display","none","important");
      const saveNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>text(btn).includes("SALVAR ANÁLISE E SAIR")&&!btn.closest("[data-final-footer]"));
      const nextNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>["PRÓXIMO","PRÓXIMO SPOT"].includes(text(btn))&&!btn.closest("[data-final-footer]"));
      const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
      if(!table)return;

      let actions=session.querySelector<HTMLElement>("[data-final-player-actions]");
      if(!actions){
        actions=document.createElement("div");actions.dataset.finalPlayerActions="true";actions.className="final-player-actions";table.insertAdjacentElement("afterend",actions);
        actions.addEventListener("click",event=>{
          const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");if(!target||target.disabled)return;
          const base=target.dataset.base??"";const size=target.dataset.size??"";
          const live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions]"));
          const baseButton=live.find(btn=>text(btn)===base);if(!baseButton)return;
          if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();
          if(size)window.setTimeout(()=>{const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>text(btn)===size&&!btn.closest("[data-final-player-actions]"));sizeButton?.click()},80);
        });
      }

      let analysis=session.querySelector<HTMLElement>("[data-final-analysis-card]");
      if(!analysis){analysis=document.createElement("div");analysis.dataset.finalAnalysisCard="true";analysis.className="final-analysis-card awaiting";actions.insertAdjacentElement("afterend",analysis)}
      let footer=session.querySelector<HTMLElement>("[data-final-footer]");
      if(!footer){
        footer=document.createElement("div");footer.dataset.finalFooter="true";footer.className="final-player-footer";
        footer.innerHTML='<button type="button" data-save>SALVAR ANÁLISE E SAIR</button><button type="button" data-next>PRÓXIMO SPOT</button>';
        analysis.insertAdjacentElement("afterend",footer);
        footer.querySelector<HTMLButtonElement>("[data-save]")?.addEventListener("click",()=>saveNative?.click());
        footer.querySelector<HTMLButtonElement>("[data-next]")?.addEventListener("click",()=>nextNative?.click());
      }

      const state=parseSolverState(table,scenarioText);
      const signature=[scenarioText,available.join(","),selectedAction,selectedSizing,state?JSON.stringify(state):"NO_STATE",String(Boolean(nextNative?.disabled))].join("|");
      if(signature===lastSignature)return;lastSignature=signature;

      const baseForSizing=sizingBase||"RAISE";
      const finalSizes=baseForSizing==="BET"?BET_SIZES:RAISE_SIZES;
      const buttons=[{label:"CHECK",base:"CHECK",size:""},{label:"CALL",base:"CALL",size:""},{label:"FOLD",base:"FOLD",size:""},...finalSizes.map(size=>({label:`${baseForSizing} ${size}`,base:baseForSizing,size})),{label:"ALL-IN",base:"ALL-IN",size:""}];
      actions.innerHTML=buttons.map(item=>{const enabled=item.base===baseForSizing?available.includes(baseForSizing as PlayerAction):available.includes(item.base as PlayerAction);const active=item.base===selectedAction&&(!item.size||item.size===selectedSizing);return`<button type="button" data-base="${item.base}" data-size="${item.size}" ${enabled?"":"disabled"} aria-pressed="${active?"true":"false"}">${item.label}</button>`}).join("");

      if(!selectedAction){
        analysis.className="final-analysis-card awaiting";
        analysis.innerHTML='<div class="analysis-line analysis-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
      }else if(!state){
        analysis.className="final-analysis-card";
        analysis.innerHTML=`<div class="analysis-line"><strong>${selectedAction} · NÃO JULGADA</strong></div><div class="analysis-line">ESTADO DA MÃO INCOMPLETO. NENHUM EV OU FREQUÊNCIA FOI INFERIDO.</div><div class="analysis-line solver-line"><b>SEM SOLUÇÃO VALIDADA</b></div>`;
      }else{
        const chosen=selectedSizing?`${selectedAction} ${selectedSizing}`:selectedAction;
        const result=evaluateSolverDecision(state,selectedAction);
        analysis.className="final-analysis-card";
        if(result.status==="VALIDATED"){
          analysis.innerHTML=`<div class="analysis-line"><strong>${chosen} · ${result.verdict} · ΔEV ${fmt(result.deltaEvBb,3)} BB</strong></div><div class="analysis-line">${result.comment}</div><div class="analysis-line solver-line"><span>FREQ ${fmt(result.frequency)}%</span><span>EV ${fmt(result.evBb,3)} BB</span><span>POT ODDS ${fmt(result.potOddsPct)}%</span><span>SPR ${fmt(result.spr)}</span><span>REF. VALIDADA</span></div>`;
        }else{
          analysis.innerHTML=`<div class="analysis-line"><strong>${chosen} · SOLUÇÃO NÃO VALIDADA</strong></div><div class="analysis-line">${result.comment}</div><div class="analysis-line solver-line"><span>POT ODDS ${fmt(result.potOddsPct)}%</span><span>EQ. REQ. ${fmt(result.requiredEquityPct)}%</span><span>CALL ${fmt(result.toCallBb)} BB</span><span>SPR ${fmt(result.spr)}</span><span>SEM EV/FREQ INVENTADOS</span></div>`;
        }
      }

      const saveProxy=footer.querySelector<HTMLButtonElement>("[data-save]");const nextProxy=footer.querySelector<HTMLButtonElement>("[data-next]");
      if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };

    const style=document.createElement("style");style.dataset.playerDnaFinalController="true";style.textContent=`
      .final-player-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;margin:4px 0 0!important;position:relative!important;z-index:50!important}
      .final-player-actions button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:4px 6px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:11px!important;line-height:1!important;text-align:center!important}
      .final-player-actions button[aria-pressed="true"]{border-color:#B8D7C2!important;box-shadow:inset 0 0 0 1px #B8D7C2!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important}.final-player-actions button:disabled{opacity:.28!important}
      .final-analysis-card{box-sizing:border-box!important;height:60px!important;min-height:60px!important;max-height:60px!important;display:grid!important;grid-template-rows:20px 20px 20px!important;width:100%!important;margin-top:5px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important}
      .final-analysis-card .analysis-line{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;padding:1px 6px!important;border-bottom:1px solid rgba(31,95,66,.48)!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:8px!important;line-height:1!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.final-analysis-card .analysis-line:last-child{border-bottom:0!important}.final-analysis-card .analysis-line strong{color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;font-size:8.5px!important}.final-analysis-card .solver-line{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important}.final-analysis-card .solver-line span,.final-analysis-card .solver-line b{min-width:0!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;font-size:6.8px!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .final-analysis-card.awaiting{grid-template-rows:60px!important;animation:finalHeroBlink 1.05s ease-in-out infinite!important}.final-analysis-card.awaiting .analysis-wait{font-size:11px!important}.final-analysis-card.awaiting .analysis-line{border-bottom:0!important}@keyframes finalHeroBlink{0%,100%{opacity:1}50%{opacity:.38}}
      .final-player-footer{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important;width:100%!important}.final-player-footer button{width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#00b52e!important;-webkit-text-fill-color:#00b52e!important;font-size:11px!important}.final-player-footer button:disabled{opacity:.28!important}
      @media(max-width:620px){.final-player-actions button{font-size:9px!important}.final-analysis-card .analysis-line{font-size:7px!important}.final-analysis-card .solver-line span,.final-analysis-card .solver-line b{font-size:5.8px!important}.final-player-footer button{font-size:9px!important}}
    `;
    document.head.querySelector("style[data-player-dna-final-controller]")?.remove();document.head.appendChild(style);
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","disabled"]});
    const timer=window.setInterval(apply,150);apply();
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
