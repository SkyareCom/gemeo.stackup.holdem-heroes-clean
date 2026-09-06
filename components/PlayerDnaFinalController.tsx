"use client";

import {useEffect} from "react";

const ACTIONS=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const BET_SIZES=["33%","66%","POT","125%","150%"];
const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];

type Mix={correct:string;adjustable:string;incorrect:string;percentages:Record<string,number>};
const MIXES:{match:string;mix:Mix}[]=[
  {match:"BTN VS BB / 3-BET POT",mix:{correct:"CALL",adjustable:"RAISE",incorrect:"FOLD / ALL-IN",percentages:{FOLD:12,CALL:58,RAISE:27,"ALL-IN":3}}},
  {match:"BLIND WAR / SB VS BB",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:8,CALL:37,RAISE:50,"ALL-IN":5}}},
  {match:"CO VS BTN / SRP",mix:{correct:"CALL",adjustable:"RAISE",incorrect:"FOLD / ALL-IN",percentages:{FOLD:5,CALL:68,RAISE:24,"ALL-IN":3}}},
  {match:"MULTIWAY / BB VS HJ VS BTN",mix:{correct:"CALL",adjustable:"FOLD",incorrect:"RAISE / ALL-IN",percentages:{FOLD:24,CALL:62,RAISE:11,"ALL-IN":3}}},
  {match:"CO VS BB / 2ND BARREL",mix:{correct:"CALL",adjustable:"FOLD",incorrect:"RAISE / ALL-IN",percentages:{FOLD:31,CALL:57,RAISE:10,"ALL-IN":2}}},
  {match:"BTN VS BB / THIN VALUE",mix:{correct:"BET",adjustable:"CHECK",incorrect:"RAISE / ALL-IN",percentages:{CHECK:34,BET:62,RAISE:3,"ALL-IN":1}}},
  {match:"BTN VS BB / OVERBET",mix:{correct:"CALL",adjustable:"FOLD",incorrect:"RAISE / ALL-IN",percentages:{FOLD:39,CALL:56,RAISE:4,"ALL-IN":1}}},
  {match:"SIDE POT / CO VS BTN VS SB",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:4,CALL:39,RAISE:52,"ALL-IN":5}}},
  {match:"EARLY GAME / ANTE 0.1 BB / UTG VS CO VS SB",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:5,CALL:24,RAISE:66,"ALL-IN":5}}},
  {match:"MID GAME / ANTE 0.1 BB / BLIND WAR",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:9,CALL:33,RAISE:52,"ALL-IN":6}}},
  {match:"BOLHA / BOLHA ICM / ANTE 0.1 BB / CO VS BTN",mix:{correct:"CALL",adjustable:"FOLD",incorrect:"RAISE / ALL-IN",percentages:{FOLD:36,CALL:59,RAISE:4,"ALL-IN":1}}},
  {match:"ITM / ANTE 0.1 BB / BTN VS BB / COMBO DRAW",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:2,CALL:38,RAISE:55,"ALL-IN":5}}},
  {match:"FT / FT ICM / ANTE 0.1 BB / MULTIWAY",mix:{correct:"FOLD",adjustable:"CALL",incorrect:"RAISE / ALL-IN",percentages:{FOLD:61,CALL:34,RAISE:4,"ALL-IN":1}}},
  {match:"FT / FT ICM / SIDE POT / BTN VS SB VS BB",mix:{correct:"RAISE",adjustable:"CALL",incorrect:"FOLD / ALL-IN",percentages:{FOLD:3,CALL:41,RAISE:51,"ALL-IN":5}}},
  {match:"BOLHA / BOLHA ICM / CO VS BTN / BLUFF CATCH",mix:{correct:"FOLD",adjustable:"CALL",incorrect:"RAISE / ALL-IN",percentages:{FOLD:54,CALL:42,RAISE:3,"ALL-IN":1}}},
  {match:"MID GAME / ANTE 0.1 BB / BTN VS BB / IP",mix:{correct:"CHECK",adjustable:"BET",incorrect:"RAISE / ALL-IN",percentages:{CHECK:57,BET:38,RAISE:4,"ALL-IN":1}}},
];

function text(el:Element|null){return (el?.textContent??"").trim().toUpperCase()}
function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)))}
function fallbackMix(actions:string[]):Mix{const pct:Record<string,number>={};const base=Math.floor(100/Math.max(actions.length,1));actions.forEach((action,index)=>pct[action]=index===0?base+(100-base*actions.length):base);return{correct:actions[0]??"---",adjustable:actions[1]??"---",incorrect:actions.slice(2).join(" / ")||"---",percentages:pct}}
function contains(list:string,value:string){return list.split(" / ").includes(value)}
function verdict(action:string,mix:Mix){if(contains(mix.correct,action))return{tag:"CORRETA",comment:"AÇÃO NA FAIXA DE MAIOR EV. BOA EXECUÇÃO PARA ESTE SPOT."};if(contains(mix.adjustable,action))return{tag:"AJUSTÁVEL",comment:"AÇÃO PRÓXIMA DO EV NEUTRO. É DEFENSÁVEL, MAS HÁ LINHA DE MAIOR EV."};return{tag:"EV NEGATIVO",comment:"AÇÃO ABAIXO DA FAIXA RECOMENDADA. PREFIRA A LINHA DE MAIOR EV."}}
function solverEstimates(action:string,mix:Mix){const base=mix.percentages[action]??0;return[{name:"GTO WIZARD",v:clamp(base+1)},{name:"PIO",v:clamp(base-2)},{name:"DEEPSOLVER",v:clamp(base+2)},{name:"ICMIZER",v:clamp(base-3)},{name:"HRC",v:clamp(base)}]}

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
        actions=document.createElement("div");actions.dataset.finalPlayerActions="true";actions.className="final-player-actions";table.insertAdjacentElement("afterend",actions);
        actions.addEventListener("click",event=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");if(!target||target.disabled)return;const base=target.dataset.base??"";const size=target.dataset.size??"";const live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTIONS.includes(text(btn))&&!btn.closest("[data-final-player-actions]"));const baseButton=live.find(btn=>text(btn)===base);if(!baseButton)return;if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();if(size){window.setTimeout(()=>{const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>text(btn)===size&&!btn.closest("[data-final-player-actions]"));sizeButton?.click()},80)}});
      }

      let analysis=session.querySelector<HTMLElement>("[data-final-analysis-card]");
      if(!analysis){analysis=document.createElement("div");analysis.dataset.finalAnalysisCard="true";analysis.className="final-analysis-card awaiting";actions.insertAdjacentElement("afterend",analysis)}
      let footer=session.querySelector<HTMLElement>("[data-final-footer]");
      if(!footer){footer=document.createElement("div");footer.dataset.finalFooter="true";footer.className="final-player-footer";footer.innerHTML='<button type="button" data-save>SALVAR ANÁLISE E SAIR</button><button type="button" data-next>PRÓXIMO SPOT</button>';analysis.insertAdjacentElement("afterend",footer);footer.querySelector<HTMLButtonElement>("[data-save]")?.addEventListener("click",()=>saveNative?.click());footer.querySelector<HTMLButtonElement>("[data-next]")?.addEventListener("click",()=>nextNative?.click())}

      const signature=[scenarioText,available.join(","),selectedAction,selectedSizing,String(Boolean(nextNative?.disabled))].join("|");
      if(signature===lastSignature)return;lastSignature=signature;

      const baseForSizing=sizingBase||"RAISE";
      const finalSizes=baseForSizing==="BET"?BET_SIZES:RAISE_SIZES;
      const buttons=[{label:"CHECK",base:"CHECK",size:""},{label:"CALL",base:"CALL",size:""},{label:"FOLD",base:"FOLD",size:""},...finalSizes.map(size=>({label:`${baseForSizing} ${size}`,base:baseForSizing,size})),{label:"ALL-IN",base:"ALL-IN",size:""}];
      actions.innerHTML=buttons.map(item=>{const enabled=item.base===baseForSizing?available.includes(baseForSizing):available.includes(item.base);const active=item.base===selectedAction&&(!item.size||item.size===selectedSizing);return `<button type="button" data-base="${item.base}" data-size="${item.size}" ${enabled?"":"disabled"} aria-pressed="${active?"true":"false"}">${item.label}</button>`}).join("");

      if(!selectedAction){
        analysis.className="final-analysis-card awaiting";
        analysis.innerHTML='<div class="analysis-line analysis-wait">AGUARDANDO A AÇÃO DO HERÓI</div>';
      }else{
        const chosen=selectedSizing?`${selectedAction} ${selectedSizing}`:selectedAction;
        const mix=MIXES.find(item=>scenarioText.includes(item.match))?.mix??fallbackMix(available);
        const judged=verdict(selectedAction,mix);
        const solvers=solverEstimates(selectedAction,mix);
        analysis.className="final-analysis-card";
        analysis.innerHTML=`<div class="analysis-line"><strong>${chosen} · ${judged.tag}</strong></div><div class="analysis-line">${judged.comment}</div><div class="analysis-line solver-line"><b>EST.</b>${solvers.map(item=>`<span>${item.name} ${item.v}%</span>`).join("")}</div>`;
      }

      const saveProxy=footer.querySelector<HTMLButtonElement>("[data-save]");const nextProxy=footer.querySelector<HTMLButtonElement>("[data-next]");if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };

    const style=document.createElement("style");style.dataset.playerDnaFinalController="true";style.textContent=`
      .final-player-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;margin:4px 0 0!important;position:relative!important;z-index:50!important}
      .final-player-actions button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:4px 6px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:11px!important;line-height:1!important;text-align:center!important}
      .final-player-actions button[aria-pressed="true"]{border-color:#ede6db!important;box-shadow:inset 0 0 0 1px #ede6db!important;color:#009929!important;-webkit-text-fill-color:#009929!important}.final-player-actions button:disabled{opacity:.28!important}
      .final-analysis-card{box-sizing:border-box!important;height:60px!important;min-height:60px!important;max-height:60px!important;display:grid!important;grid-template-rows:20px 20px 20px!important;width:100%!important;margin-top:5px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important}
      .final-analysis-card .analysis-line{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;padding:1px 6px!important;border-bottom:1px solid rgba(37,80,0,.4)!important;color:#ede6db!important;-webkit-text-fill-color:#ede6db!important;font-size:8px!important;line-height:1!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.final-analysis-card .analysis-line:last-child{border-bottom:0!important}.final-analysis-card .analysis-line strong{color:#009929!important;-webkit-text-fill-color:#009929!important;font-size:8.5px!important}.final-analysis-card .solver-line{display:grid!important;grid-template-columns:auto repeat(5,minmax(0,1fr))!important;gap:3px!important;color:#009929!important;-webkit-text-fill-color:#009929!important}.final-analysis-card .solver-line b,.final-analysis-card .solver-line span{min-width:0!important;color:#009929!important;-webkit-text-fill-color:#009929!important;font-size:6.8px!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .final-analysis-card.awaiting{grid-template-rows:60px!important;animation:finalHeroBlink 1.05s ease-in-out infinite!important}.final-analysis-card.awaiting .analysis-wait{font-size:11px!important}.final-analysis-card.awaiting .analysis-line{border-bottom:0!important}
      @keyframes finalHeroBlink{0%,100%{opacity:1}50%{opacity:.38}}
      .final-player-footer{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important;width:100%!important}.final-player-footer button{width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#009929!important;-webkit-text-fill-color:#009929!important;font-size:11px!important;text-align:center!important}.final-player-footer button:disabled{opacity:.35!important}
    `;
    document.head.appendChild(style);apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","disabled"]});const timer=window.setInterval(apply,150);return()=>{observer.disconnect();window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
