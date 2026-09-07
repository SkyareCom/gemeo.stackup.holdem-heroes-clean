"use client";

import {useEffect} from "react";
import type {PlayerAction} from "@/data/player-dna-spots";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const BET_SIZES=["33%","66%","POT","125%","150%"];
const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];
function text(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}

export default function PlayerDnaAnalysisControllerV2(){
  useEffect(()=>{
    let lastSignature="";
    const apply=()=>{
      const session=document.querySelector<HTMLElement>(".training-session");if(!session){lastSignature="";return}
      const scenarioHeading=[...session.querySelectorAll<HTMLElement>("h4")].find(h=>text(h)==="CENÁRIO");
      const scenarioSection=scenarioHeading?.parentElement as HTMLElement|null;
      if(scenarioSection){scenarioSection.style.setProperty("display","none","important");scenarioSection.setAttribute("aria-hidden","true")}
      const nativeActions=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions-v2]"));if(!nativeActions.length)return;
      const available=[...new Set(nativeActions.map(btn=>text(btn) as PlayerAction))],selected=nativeActions.find(btn=>btn.getAttribute("aria-pressed")==="true"),selectedAction=selected?text(selected) as PlayerAction:"";
      nativeActions[0]?.parentElement?.style.setProperty("display","none","important");
      const sizingBase=available.includes("BET")?"BET":available.includes("RAISE")?"RAISE":"",sizes=sizingBase==="BET"?BET_SIZES:RAISE_SIZES;
      const nativeSizes=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>sizes.includes(text(btn))&&!btn.closest("[data-final-player-actions-v2]")),selectedSize=nativeSizes.find(btn=>btn.getAttribute("aria-pressed")==="true"),selectedSizing=selectedSize?text(selectedSize):"";
      nativeSizes[0]?.parentElement?.style.setProperty("display","none","important");
      const nativeFooter=session.querySelector<HTMLElement>(".training-footer");if(nativeFooter)nativeFooter.style.setProperty("display","none","important");
      const saveNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>text(btn).includes("SALVAR ANÁLISE E SAIR")&&!btn.closest("[data-final-footer-v2]"));
      const nextNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>["PRÓXIMO","PRÓXIMO SPOT"].includes(text(btn))&&!btn.closest("[data-final-footer-v2]"));
      const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');if(!table)return;
      let actions=session.querySelector<HTMLElement>("[data-final-player-actions-v2]");
      if(!actions){actions=document.createElement("div");actions.dataset.finalPlayerActionsV2="true";actions.className="final-player-actions-v2";table.insertAdjacentElement("afterend",actions);actions.addEventListener("click",event=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");if(!target||target.disabled)return;const base=target.dataset.base??"",size=target.dataset.size??"",live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn) as PlayerAction)&&!btn.closest("[data-final-player-actions-v2]")),baseButton=live.find(btn=>text(btn)===base);if(!baseButton)return;if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();if(size)window.setTimeout(()=>{const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>text(btn)===size&&!btn.closest("[data-final-player-actions-v2]"));sizeButton?.click()},80)})}
      let footer=session.querySelector<HTMLElement>("[data-final-footer-v2]");
      if(!footer){footer=document.createElement("div");footer.dataset.finalFooterV2="true";footer.className="final-player-footer-v2";footer.innerHTML='<button type="button" data-save>SALVAR ANÁLISE E SAIR</button><button type="button" data-next>PRÓXIMO SPOT</button>';session.appendChild(footer);footer.querySelector<HTMLButtonElement>("[data-save]")?.addEventListener("click",()=>saveNative?.click());footer.querySelector<HTMLButtonElement>("[data-next]")?.addEventListener("click",()=>nextNative?.click())}
      const signature=[available.join(","),selectedAction,selectedSizing,String(Boolean(nextNative?.disabled))].join("|");if(signature===lastSignature)return;lastSignature=signature;
      const baseForSizing=sizingBase||"RAISE",finalSizes=baseForSizing==="BET"?BET_SIZES:RAISE_SIZES,buttons=[{label:"CHECK",base:"CHECK",size:""},{label:"CALL",base:"CALL",size:""},{label:"FOLD",base:"FOLD",size:""},...finalSizes.map(size=>({label:`${baseForSizing} ${size}`,base:baseForSizing,size})),{label:"ALL-IN",base:"ALL-IN",size:""}];
      actions.innerHTML=buttons.map(item=>{const enabled=item.base===baseForSizing?available.includes(baseForSizing as PlayerAction):available.includes(item.base as PlayerAction),active=item.base===selectedAction&&(!item.size||item.size===selectedSizing);return`<button type="button" data-base="${item.base}" data-size="${item.size}" ${enabled?"":"disabled"} aria-pressed="${active?"true":"false"}">${item.label}</button>`}).join("");
      const saveProxy=footer.querySelector<HTMLButtonElement>("[data-save]"),nextProxy=footer.querySelector<HTMLButtonElement>("[data-next]");if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };
    const style=document.createElement("style");style.dataset.playerDnaAnalysisV2="true";style.textContent=`.final-player-actions-v2{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;margin:4px 0 0!important;position:relative!important;z-index:70!important}.final-player-actions-v2 button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:44px!important;padding:4px 6px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:11px!important}.final-player-actions-v2 button[aria-pressed="true"]{border-color:#B8D7C2!important;box-shadow:inset 0 0 0 1px #B8D7C2!important}.final-player-actions-v2 button:disabled{opacity:.28!important}.final-player-footer-v2{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important;width:100%!important}.final-player-footer-v2 button{width:100%!important;height:44px!important;border:1px solid #1F5F42!important;border-radius:12px!important;background:transparent!important;color:#00b52e!important;-webkit-text-fill-color:#00b52e!important;font-size:11px!important}.final-player-footer-v2 button:disabled{opacity:.28!important}@media(max-width:620px){.final-player-actions-v2 button,.final-player-footer-v2 button{font-size:9px!important}}`;document.head.querySelector("style[data-player-dna-analysis-v2]")?.remove();document.head.appendChild(style);
    const observer=new MutationObserver(()=>window.setTimeout(apply,0));observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","disabled"]});const timer=window.setInterval(apply,150);apply();return()=>{observer.disconnect();window.clearInterval(timer);style.remove()}
  },[]);return null;
}
