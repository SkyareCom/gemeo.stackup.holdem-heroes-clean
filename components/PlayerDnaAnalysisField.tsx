"use client";

import {useEffect} from "react";

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

const RAISE_SIZES=["2X","2.5X","3X","4X","SQUEEZE"];
const BET_SIZES=["25%","33%","50%","66%","75%"];
const ACTION_NAMES=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];

function fallback(actions:string[]):Mix{const pct:Record<string,number>={};const base=Math.floor(100/Math.max(actions.length,1));actions.forEach((action,index)=>pct[action]=index===0?base+(100-base*actions.length):base);return{correct:actions[0]??"---",adjustable:actions[1]??"---",incorrect:actions.slice(2).join(" / ")||"---",percentages:pct}}
function commentFor(selected:string,mix:Mix,sizing:string|null){const label=sizing?`${selected} ${sizing}`:selected;if(mix.correct.split(" / ").includes(selected))return `${label}: AÇÃO NA FAIXA DE MAIOR EV.`;if(mix.adjustable.split(" / ").includes(selected))return `${label}: AÇÃO AJUSTÁVEL, PRÓXIMA DO EV NEUTRO.`;return `${label}: AÇÃO DE EV NEGATIVO NESTE SPOT.`}

export default function PlayerDnaAnalysisField(){
  useEffect(()=>{
    let lastSignature="";
    const apply=()=>{
      const session=document.querySelector<HTMLElement>(".training-session");if(!session){lastSignature="";return}
      const nativeActionButtons=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTION_NAMES.includes((btn.textContent??"").trim())&&!btn.closest("[data-fixed-player-actions]"));if(!nativeActionButtons.length)return;
      const actions=[...new Set(nativeActionButtons.map(btn=>(btn.textContent??"").trim()))];
      const selected=nativeActionButtons.find(btn=>btn.getAttribute("aria-pressed")==="true")?.textContent?.trim()??null;
      const nativeActionContainer=nativeActionButtons[0]?.parentElement as HTMLElement|null;if(nativeActionContainer)nativeActionContainer.style.setProperty("display","none","important");
      const sizingBase=actions.includes("BET")?"BET":"RAISE";const sizingChoices=sizingBase==="BET"?BET_SIZES:RAISE_SIZES;
      const nativeSizingButtons=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>sizingChoices.includes((btn.textContent??"").trim())&&!btn.closest("[data-fixed-player-actions]"));
      const selectedSizing=nativeSizingButtons.find(btn=>btn.getAttribute("aria-pressed")==="true")?.textContent?.trim()??null;
      const nativeSizingContainer=nativeSizingButtons[0]?.parentElement as HTMLElement|null;if(nativeSizingContainer)nativeSizingContainer.style.setProperty("display","none","important");
      const footer=session.querySelector<HTMLElement>(".training-footer");if(footer)footer.style.setProperty("display","none","important");
      const saveNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>(btn.textContent??"").includes("SALVAR ANÁLISE E SAIR")&&!btn.closest("[data-player-footer-controls]"));
      const nextNative=[...session.querySelectorAll<HTMLButtonElement>("button")].find(btn=>(btn.textContent??"").trim()==="PRÓXIMO"&&!btn.closest("[data-player-footer-controls]"));
      const headings=[...session.querySelectorAll<HTMLElement>("h4")];const scenarioSection=(headings.find(h=>h.textContent?.trim()==="CENÁRIO")?.parentElement??headings.find(h=>h.textContent?.trim()==="ANÁLISE")?.parentElement) as HTMLElement|null;
      let scenarioText=scenarioSection?.dataset.scenarioSource??"";if(scenarioSection){if(!scenarioText){scenarioText=[...scenarioSection.querySelectorAll<HTMLElement>("span")].map(el=>el.textContent?.trim()).filter(Boolean).join(" / ");scenarioSection.dataset.scenarioSource=scenarioText}scenarioSection.style.setProperty("display","none","important")}
      const mix=MIXES.find(item=>scenarioText.includes(item.match))?.mix??fallback(actions);
      const table=session.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');if(!table)return;
      let structureChanged=false;let fixed=session.querySelector<HTMLElement>("[data-fixed-player-actions]");
      if(!fixed){structureChanged=true;fixed=document.createElement("div");fixed.dataset.fixedPlayerActions="true";fixed.className="fixed-player-actions";table.insertAdjacentElement("afterend",fixed);fixed.addEventListener("click",event=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-base]");if(!target||target.disabled)return;const base=target.dataset.base??"";const size=target.dataset.size??"";const liveActions=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(btn=>ACTION_NAMES.includes((btn.textContent??"").trim())&&!btn.closest("[data-fixed-player-actions]"));const baseButton=liveActions.find(btn=>(btn.textContent??"").trim()===base);if(!baseButton)return;if(baseButton.getAttribute("aria-pressed")!=="true")baseButton.click();if(size){window.setTimeout(()=>{const sizeButton=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(btn=>(btn.textContent??"").trim()===size&&!btn.closest("[data-fixed-player-actions]"));sizeButton?.click()},100)}})}
      let comment=session.querySelector<HTMLElement>("[data-player-comment-card]");if(!comment){structureChanged=true;comment=document.createElement("div");comment.dataset.playerCommentCard="true";comment.className="player-comment-card";fixed.insertAdjacentElement("afterend",comment)}
      let controls=session.querySelector<HTMLElement>("[data-player-footer-controls]");
      if(!controls){structureChanged=true;controls=document.createElement("div");controls.dataset.playerFooterControls="true";controls.className="player-footer-controls";controls.innerHTML=`<button type="button" data-footer="save">SALVAR ANÁLISE E SAIR</button><button type="button" data-footer="next">PRÓXIMO SPOT</button>`;comment.insertAdjacentElement("afterend",controls);controls.querySelector<HTMLButtonElement>('[data-footer="save"]')?.addEventListener("click",()=>saveNative?.click());controls.querySelector<HTMLButtonElement>('[data-footer="next"]')?.addEventListener("click",()=>nextNative?.click())}
      const signature=`${scenarioText}|${actions.join(",")}|${selected??""}|${selectedSizing??""}|${Boolean(nextNative?.disabled)}`;if(signature===lastSignature&&!structureChanged)return;lastSignature=signature;
      const topActions=["CHECK","CALL","FOLD"];const raiseLabels=sizingChoices.map(size=>({label:`${sizingBase} ${size}`,base:sizingBase,size}));const rows=[...topActions.map(label=>({label,base:label,size:""})),...raiseLabels.slice(0,3),...raiseLabels.slice(3,5),{label:"ALL-IN",base:"ALL-IN",size:""}];
      fixed.innerHTML=rows.map(item=>{const available=item.base===sizingBase?actions.includes(sizingBase):actions.includes(item.base);const active=item.base===selected&&(!item.size||item.size===selectedSizing);return `<button type="button" data-base="${item.base}" data-size="${item.size}" ${available?"":"disabled"} aria-pressed="${active?"true":"false"}">${item.label}</button>`}).join("");
      if(!selected){comment.className="player-comment-card awaiting-comment";comment.innerHTML=`<div class="comment-line comment-wait">AGUARDANDO A AÇÃO DO HERÓI</div><div class="gto-line"></div>`}
      else{comment.className="player-comment-card";const pctOrder=["CHECK","CALL","FOLD",sizingBase,"ALL-IN"].filter((value,index,array)=>array.indexOf(value)===index);const percentages=pctOrder.map(action=>`<span><b>${action}</b><em>${mix.percentages[action]??0}%</em></span>`).join("");comment.innerHTML=`<div class="comment-line">${commentFor(selected,mix,selectedSizing)}</div><div class="gto-line">${percentages}</div>`}
      const saveProxy=controls.querySelector<HTMLButtonElement>('[data-footer="save"]');const nextProxy=controls.querySelector<HTMLButtonElement>('[data-footer="next"]');if(saveProxy)saveProxy.disabled=Boolean(saveNative?.disabled);if(nextProxy)nextProxy.disabled=Boolean(nextNative?.disabled);
    };
    const style=document.createElement("style");style.dataset.playerDnaAnalysisStyle="true";
    style.textContent=`
      .fixed-player-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;margin:4px 0 0!important;width:100%!important;position:relative!important;z-index:30!important;visibility:visible!important;opacity:1!important}
      .fixed-player-actions button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:40px!important;min-height:40px!important;max-height:40px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#ede6db!important;font-size:11px!important;padding:4px!important;text-align:center!important;visibility:visible!important}
      .fixed-player-actions button[aria-pressed="true"]{border-color:#ede6db!important;box-shadow:inset 0 0 0 1px #ede6db!important;color:#009929!important}.fixed-player-actions button:disabled{opacity:.28!important}
      .player-comment-card{height:60px!important;min-height:60px!important;max-height:60px!important;display:grid!important;grid-template-rows:38px 22px!important;margin-top:5px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;overflow:hidden!important}
      .comment-line{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-width:0!important;padding:3px 10px!important;white-space:normal!important;overflow:hidden!important;overflow-wrap:anywhere!important;word-break:normal!important;text-align:center!important;font-size:9.5px!important;line-height:1.15!important;color:#ede6db!important;border-bottom:1px solid rgba(37,80,0,.55)!important}
      .gto-line{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:stretch!important;justify-items:stretch!important;gap:1px!important;min-width:0!important;padding:1px 4px!important;color:#009929!important}
      .gto-line span{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;min-width:0!important;width:100%!important;text-align:center!important;line-height:.95!important;color:#009929!important;white-space:normal!important;overflow:hidden!important;overflow-wrap:anywhere!important}
      .gto-line b,.gto-line em{display:block!important;max-width:100%!important;text-align:center!important;font-style:normal!important;font-weight:700!important;font-size:7px!important;line-height:1!important;white-space:normal!important;overflow-wrap:anywhere!important;color:#009929!important}
      .gto-line em{font-size:7.5px!important;margin-top:1px!important}
      .awaiting-comment{animation:heroCommentBlink 1.05s ease-in-out infinite!important}.awaiting-comment .comment-line{grid-row:1/3!important;border-bottom:0!important;font-size:11px!important;line-height:1.2!important;padding:0 12px!important;text-align:center!important}.awaiting-comment .gto-line{display:none!important}
      @keyframes heroCommentBlink{0%,100%{opacity:1}50%{opacity:.38}}
      .player-footer-controls{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:5px!important}
      .player-footer-controls button{width:100%!important;height:38px!important;min-height:38px!important;max-height:38px!important;border:1px solid #255000!important;border-radius:12px!important;background:transparent!important;color:#009929!important;font-size:11px!important;padding:4px 8px!important;text-align:center!important}.player-footer-controls button:disabled{opacity:.35!important}
    `;
    document.head.appendChild(style);apply();const timer=window.setInterval(apply,120);return()=>{window.clearInterval(timer);style.remove()};
  },[]);
  return null;
}
