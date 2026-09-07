"use client";

import {useEffect} from "react";

const ACTIONS=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
function txt(el:Element|null){return(el?.textContent??"").trim().toUpperCase()}

export default function PlayerDnaAlwaysActiveActions(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.playerDnaAlwaysActiveActions="true";
    style.textContent=`
      [data-final-player-actions-v2] button{opacity:1!important;filter:none!important;cursor:pointer!important;pointer-events:auto!important}
      [data-final-player-actions-v2] button:disabled{opacity:1!important;filter:none!important;cursor:pointer!important;pointer-events:auto!important}
    `;
    document.head.querySelector("style[data-player-dna-always-active-actions]")?.remove();
    document.head.appendChild(style);

    const normalize=()=>{
      document.querySelectorAll<HTMLButtonElement>("[data-final-player-actions-v2] button").forEach(button=>{
        button.disabled=false;
        button.removeAttribute("disabled");
        button.setAttribute("aria-disabled","false");
      });
    };

    const retryChoice=(proxy:HTMLButtonElement)=>{
      const base=(proxy.dataset.base??"").toUpperCase();
      const size=(proxy.dataset.size??"").toUpperCase();
      if(!ACTIONS.includes(base))return;
      let attempts=0;
      const run=()=>{
        attempts++;
        const session=proxy.closest(".training-session");
        if(!session)return;
        const native=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
          .filter(button=>!button.closest("[data-final-player-actions-v2]"));
        const action=native.find(button=>txt(button)===base);
        if(action&&action.getAttribute("aria-pressed")!=="true")action.click();
        if(size){
          window.setTimeout(()=>{
            const live=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
              .filter(button=>!button.closest("[data-final-player-actions-v2]"));
            const sizing=live.find(button=>txt(button)===size);
            if(sizing&&sizing.getAttribute("aria-pressed")!=="true")sizing.click();
          },40);
        }
        const selected=action?.getAttribute("aria-pressed")==="true";
        if(!selected&&attempts<30)window.setTimeout(run,80);
      };
      run();
    };

    const click=(event:Event)=>{
      const proxy=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-final-player-actions-v2] button[data-base]");
      if(!proxy)return;
      proxy.disabled=false;
      retryChoice(proxy);
    };
    document.addEventListener("click",click,true);
    const observer=new MutationObserver(normalize);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled","aria-disabled"]});
    normalize();
    return()=>{document.removeEventListener("click",click,true);observer.disconnect();style.remove()};
  },[]);
  return null;
}
