"use client";

import {useEffect} from "react";
import {evaluateSolverDecision,loadSolverReferenceCatalog,type SolverSpotState} from "@/lib/player-dna-solver-v2";
import type {PlayerAction} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const BET_SIZES=["33%","66%","POT","125%","150%"];
const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];

function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}
function num(value:string){const match=value.replace(",",".").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):0}
function cardFrom(el:Element){return`${text(el.querySelector(".rank"))}${text(el.querySelector(".suit"))}`}
function actionFromBadge(value:string){const upper=value.trim().toUpperCase();if(upper.startsWith("ALL-IN"))return"ALL-IN";if(upper.startsWith("RAISE"))return"RAISE";if(upper.startsWith("BET"))return"BET";if(upper.startsWith("CALL"))return"CALL";if(upper.startsWith("CHECK"))return"CHECK";if(upper.startsWith("FOLD"))return"FOLD";return"---"}
function fmt(value:number|undefined,places=2){if(value===undefined)return"---";return value.toFixed(places).replace(/\.00$/,'')}

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

function analysisRows(result:ReturnType<typeof evaluateSolverDecision>){
  if(result.status!=="VALIDATED"||!result.actionMix.length){
    return[
      "SEM MIX VALIDADO PARA ESTE SPOT",
      "PORCENTAGENS NÃO INFERIDAS",
      "EV NÃO INFERIDO",
      "AGUARDANDO REFERÊNCIA EXATA VALIDADA",
    ];
  }
  const rows=result.actionMix.map(item=>`${item.action} ${fmt(item.frequency)}% · ${item.classification}`);
  return Array.from({length:4},(_,index)=>rows[index]??"");
}

export default function PlayerDnaAnalysisControllerV2(){
  useEffect(()=>{
    const catalogUrl=process.env.NEXT_PUBLIC_STACKUP_SOLVER_REFERENCE_URL??"";
    if(catalogUrl)loadSolverReferenceCatalog(catalogUrl).catch(()=>{});

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

      const nativeActions=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions-v2]"));
      if(!nativeActions.length)return;
      const available=[...new Set(nativeActions.map(btn=>text(btn) as PlayerAction))];
      const selected=nativeActions.find(btn=>btn.getAttribute("aria-pressed")==="true");
      const selectedAction=selected?text(selected) as PlayerAction:"";
      nativeActions[0]?.parentElement?.style.setProperty("display","none","important");

      const sizingBase=available.includes("BET")?"BET":available.includes("RAISE")?"RAISE":"";
      const sizes=sizingBase==="BET"?BET_SIZES:RAISE_SIZES;
      const nativeSizes=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>sizes.includes(text(btn))&&!btn.closest("[data-final-player-actions-v2]"));
      const selectedSize=nativeSizes.find(btn=>btn.getAttribute("aria-pressed")==="true");
      const selectedSizing=selectedSize?text(selectedSize):"";
      nativeSizes[0]?.parentElement?.style.setProperty("display","none","important");

      const nativeFooter=session.querySelector<HTMLElement>(".training-footer");
      if(nativeFooter)nativeFooter.style.setProperty("display","none","important");
      const saveNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>text(btn).includes("SALVAR ANÁLISE E SAIR")&&!btn.closest("[data-final-footer-v2]"));
      const nextNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>["PRÓXIMO","PRÓXIMO SPOT"].includes(text(btn))&&!btn.closest("[data-final-footer-v2]"));
      const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
      if(!table)return;

      let actions=session.querySelector<HTMLElement>("[data-final-player-actions-v2]");
      if(!actions){
        actions=document.createElement("div");actions.dataset.finalPlayerActionsV2="true";actions.className="final-player-actions-v2";table.insertAdjacentElement("afterend",actions);
        actions.addEventListener("click",event=>{
          const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");if(!target||target.disabled)return;
          const base=target.dataset.base??"";const size=target.dataset.size??"";
          const live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions-v2]"));
          const baseButton=live.find(btn=>text(btn)===base);if(!baseButton)return;
          if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();
          if(size)window.setTimeout(()=>{const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>text(btn)===size&&!btn.closest("[data-final-player-actions-v2]"));sizeButton?.click()},80);
        });
      }

      let analysis=session.querySelector<HTMLElement>("[data-final-analysis-card-v2]");
      if(!analysis){analysis=document.createElement("div");analysis.dataset.finalAnalysisCardV2="true";analysis.className="final-analysis-card-v2 awaiting";actions.insertAdjacentElement("afterend",analysis)}
      let footer=session.querySelector<HTMLElement>("[data-final-footer-v2]");
      if(!footer){
        footer=document.createElement("div");footer.dataset.finalFooterV2="true";footer.className="final-player-footer-v2";
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
        analysis.className="final-analysis-card-v2 awaiting";
        analysis.innerHTML='<div class="v2-line v2-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
      }else{
        const chosen=selectedSizing?`${selectedAction} ${selectedSizing}`:selectedAction;
        const result=state?evaluateSolverDecision(state,selectedAction,selectedSizing):null;
        const resultLabel=!state?"NÃO JULGADA":result?.status==="VALIDATED"?`${result.verdict}${result.deltaEvBb!==undefined?` · ΔEV ${fmt(result.deltaEvBb,3)} BB`:""}`:"NÃO JULGADA";
        const rows=result?analysisRows(result):["ESTADO DA MÃO INCOMPLETO","PORCENTAGENS NÃO INFERIDAS","EV NÃO INFERIDO","AGUARDANDO ESTADO COMPLETO"];
        analysis.className="final-analysis-card-v2";
        analysis.innerHTML=`
          <div class="v2-line v2-head">AÇÃO REGISTRADA NO HISTÓRICO DO PLAYER DNA</div>
          <div class="v2-line v2-value">${chosen}</div>
          <div class="v2-line v2-head">RESULTADO</div>
          <div class="v2-line v2-value">${resultLabel}</div>
          ${rows.map((row,index)=>`<div class="v2-line v2-analysis" data-row="${index+1}">${row||"---"}</div>`).join("")}
        `;
      }

      const saveProxy=footer.querySelector<HTMLButtonElement>("[data-save]");
      const nextProxy=footer.querySelector<HTMLButtonElement>("[data-next]");
      if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);
      if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };

    const style=document.createElement("style");style.dataset.playerDnaAnalysisV2="true";style.textContent=`
      .final-player-actions-v2{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;margin:4px 0 0!important;position:relative!important;z-index:70!important}
      .final-player-actions-v2 button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:4px 6px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:11px!important;line-height:1!important;text-align:center!important}
      .final-player-actions-v2 button[aria-pressed="true"]{border-color:#B8D7C2!important;box-shadow:inset 0 0 0 1px #B8D7C2!important;color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important}.final-player-actions-v2 button:disabled{opacity:.28!important}
      .final-analysis-card-v2{box-sizing:border-box!important;min-height:160px!important;height:auto!important;display:grid!important;grid-template-rows:repeat(8,minmax(20px,auto))!important;width:100%!important;margin-top:5px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important}
      .final-analysis-card-v2 .v2-line{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;min-height:20px!important;padding:2px 8px!important;border-bottom:1px solid rgba(31,95,66,.48)!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:8px!important;line-height:1.2!important;text-align:center!important;white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere!important;word-break:normal!important}
      .final-analysis-card-v2 .v2-line:last-child{border-bottom:0!important}.final-analysis-card-v2 .v2-head{color:#B8D7C2!important;-webkit-text-fill-color:#B8D7C2!important;font-size:7.5px!important}.final-analysis-card-v2 .v2-value{font-size:9px!important;font-weight:700!important}.final-analysis-card-v2 .v2-analysis{font-size:8px!important}
      .final-analysis-card-v2.awaiting{min-height:60px!important;height:60px!important;grid-template-rows:60px!important;animation:v2HeroBlink 1.05s ease-in-out infinite!important}.final-analysis-card-v2.awaiting .v2-wait{font-size:11px!important;border-bottom:0!important}@keyframes v2HeroBlink{0%,100%{opacity:1}50%{opacity:.38}}
      .final-player-footer-v2{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important;width:100%!important}.final-player-footer-v2 button{width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#00b52e!important;-webkit-text-fill-color:#00b52e!important;font-size:11px!important}.final-player-footer-v2 button:disabled{opacity:.28!important}
      @media(max-width:620px){.final-player-actions-v2 button{font-size:9px!important}.final-analysis-card-v2 .v2-line{font-size:7px!important}.final-analysis-card-v2 .v2-value{font-size:8px!important}.final-player-footer-v2 button{font-size:9px!important}}
    `;
    document.head.querySelector("style[data-player-dna-analysis-v2]")?.remove();document.head.appendChild(style);
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","disabled"]});
    const timer=window.setInterval(apply,150);apply();
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
