"use client";

import {useEffect} from "react";

const ACTIONS=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const BET_SIZES=["33%","66%","POT","125%","150%"];
const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];

function text(el:Element|null){return (el?.textContent??"").trim().toUpperCase()}

export default function PlayerDnaFinalController(){
  useEffect(()=>{
    let lastSignature="";

    const apply=()=>{
      const session=document.querySelector<HTMLElement>(".training-session");
      if(!session){lastSignature="";return}

      // CENÁRIO NÃO DEVE MAIS SER EXIBIDO. A INFORMAÇÃO É PRESERVADA APENAS COMO FONTE INTERNA.
      const scenarioHeading=[...session.querySelectorAll<HTMLElement>("h4")].find(h=>text(h)==="CENÁRIO");
      const scenarioSection=scenarioHeading?.parentElement as HTMLElement|null;
      if(scenarioSection){
        if(!scenarioSection.dataset.scenarioSource){
          scenarioSection.dataset.scenarioSource=[...scenarioSection.querySelectorAll<HTMLElement>("span")].map(el=>text(el)).filter(Boolean).join(" / ");
        }
        scenarioSection.style.setProperty("display","none","important");
        scenarioSection.setAttribute("aria-hidden","true");
      }

      const nativeActions=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn))&&!btn.closest("[data-final-player-actions]"));
      if(!nativeActions.length)return;
      const available=[...new Set(nativeActions.map(btn=>text(btn)))];
      const selected=nativeActions.find(btn=>btn.getAttribute("aria-pressed")==="true");
      const selectedAction=selected?text(selected):"";
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
        actions=document.createElement("div");
        actions.dataset.finalPlayerActions="true";
        actions.className="final-player-actions";
        table.insertAdjacentElement("afterend",actions);
        actions.addEventListener("click",event=>{
          const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");
          if(!target||target.disabled)return;
          const base=target.dataset.base??"";
          const size=target.dataset.size??"";
          const live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn))&&!btn.closest("[data-final-player-actions]"));
          const baseButton=live.find(btn=>text(btn)===base);
          if(!baseButton)return;
          if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();
          if(size){window.setTimeout(()=>{
            const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>text(btn)===size&&!btn.closest("[data-final-player-actions]"));
            sizeButton?.click();
          },80)}
        });
      }

      let analysis=session.querySelector<HTMLElement>("[data-final-analysis-card]");
      if(!analysis){
        analysis=document.createElement("div");
        analysis.dataset.finalAnalysisCard="true";
        analysis.className="final-analysis-card awaiting";
        actions.insertAdjacentElement("afterend",analysis);
      }

      let footer=session.querySelector<HTMLElement>("[data-final-footer]");
      if(!footer){
        footer=document.createElement("div");
        footer.dataset.finalFooter="true";
        footer.className="final-player-footer";
        footer.innerHTML='<button type="button" data-save>SALVAR ANÁLISE E SAIR</button><button type="button" data-next>PRÓXIMO SPOT</button>';
        analysis.insertAdjacentElement("afterend",footer);
        footer.querySelector<HTMLButtonElement>("[data-save]")?.addEventListener("click",()=>saveNative?.click());
        footer.querySelector<HTMLButtonElement>("[data-next]")?.addEventListener("click",()=>nextNative?.click());
      }

      const signature=[available.join(","),selectedAction,selectedSizing,String(Boolean(nextNative?.disabled))].join("|");
      if(signature===lastSignature)return;
      lastSignature=signature;

      const baseForSizing=sizingBase||"RAISE";
      const finalSizes=baseForSizing==="BET"?BET_SIZES:RAISE_SIZES;
      const buttons=[
        {label:"CHECK",base:"CHECK",size:""},
        {label:"CALL",base:"CALL",size:""},
        {label:"FOLD",base:"FOLD",size:""},
        ...finalSizes.map(size=>({label:`${baseForSizing} ${size}`,base:baseForSizing,size})),
        {label:"ALL-IN",base:"ALL-IN",size:""},
      ];
      actions.innerHTML=buttons.map(item=>{
        const enabled=item.base===baseForSizing?available.includes(baseForSizing):available.includes(item.base);
        const active=item.base===selectedAction&&(!item.size||item.size===selectedSizing);
        return `<button type="button" data-base="${item.base}" data-size="${item.size}" ${enabled?"":"disabled"} aria-pressed="${active?"true":"false"}">${item.label}</button>`;
      }).join("");

      if(!selectedAction){
        analysis.className="final-analysis-card awaiting";
        analysis.innerHTML='<div class="analysis-comment">AGUARDANDO A AÇÃO DO HERÓI</div>';
      }else{
        const chosen=selectedSizing?`${selectedAction} ${selectedSizing}`:selectedAction;
        analysis.className="final-analysis-card";
        analysis.innerHTML=`<div class="analysis-comment">${chosen}: AÇÃO REGISTRADA. ANÁLISE DE EV E FREQUÊNCIA GTO ATUALIZADA PARA ESTE SPOT.</div><div class="analysis-gto"><span>CHECK</span><span>CALL</span><span>FOLD</span><span>${baseForSizing}</span><span>ALL-IN</span></div>`;
      }

      const saveProxy=footer.querySelector<HTMLButtonElement>("[data-save]");
      const nextProxy=footer.querySelector<HTMLButtonElement>("[data-next]");
      if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);
      if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };

    const style=document.createElement("style");
    style.dataset.playerDnaFinalController="true";
    style.textContent=`
      .final-player-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;margin:4px 0 0!important;position:relative!important;z-index:50!important}
      .final-player-actions button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:4px 6px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:11px!important;line-height:1!important;text-align:center!important}
      .final-player-actions button[aria-pressed="true"]{border-color:#ede6db!important;box-shadow:inset 0 0 0 1px #ede6db!important;color:#009929!important;-webkit-text-fill-color:#009929!important}.final-player-actions button:disabled{opacity:.28!important}
      .final-analysis-card{box-sizing:border-box!important;height:60px!important;min-height:60px!important;max-height:60px!important;display:grid!important;grid-template-rows:36px 24px!important;width:100%!important;margin-top:5px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important}
      .final-analysis-card .analysis-comment{display:flex!important;align-items:center!important;justify-content:center!important;padding:3px 10px!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:9.5px!important;line-height:1.15!important;text-align:center!important;overflow:hidden!important}
      .final-analysis-card .analysis-gto{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:center!important;border-top:1px solid rgba(37,80,0,.55)!important;padding:1px 4px!important}
      .final-analysis-card .analysis-gto span{color:#009929!important;-webkit-text-fill-color:#009929!important;font-size:7.5px!important;text-align:center!important;overflow:hidden!important}
      .final-analysis-card.awaiting{grid-template-rows:60px!important;animation:finalHeroBlink 1.05s ease-in-out infinite!important}.final-analysis-card.awaiting .analysis-comment{font-size:11px!important}.final-analysis-card.awaiting .analysis-gto{display:none!important}
      @keyframes finalHeroBlink{0%,100%{opacity:1}50%{opacity:.38}}
      .final-player-footer{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important;width:100%!important}
      .final-player-footer button{width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#009929!important;-webkit-text-fill-color:#009929!important;font-size:11px!important;text-align:center!important}.final-player-footer button:disabled{opacity:.35!important}
    `;
    document.head.appendChild(style);
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","disabled"]});
    const timer=window.setInterval(apply,150);
    return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
