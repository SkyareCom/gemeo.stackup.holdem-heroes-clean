"use client";

import {useEffect} from "react";

const LEGACY_MARKERS=["NÃO JULGADA","SEM MIX VALIDADO PARA ESTE SPOT","AGUARDANDO REFERÊNCIA EXATA VALIDADA","PORCENTAGENS NÃO INFERIDAS","EV NÃO INFERIDO"];

export default function PlayerDnaLegacyCardGuard(){
  useEffect(()=>{
    let reloading=false;
    const check=()=>{
      if(reloading)return;
      const card=document.querySelector<HTMLElement>("[data-final-analysis-card-v2]");
      if(!card)return;
      const content=(card.textContent??"").toUpperCase();
      if(!LEGACY_MARKERS.some(marker=>content.includes(marker)))return;
      const url=new URL(window.location.href);
      if(url.searchParams.get("diag")!=="v4"){
        reloading=true;
        url.searchParams.set("diag","v4");
        url.searchParams.set("cb",Date.now().toString());
        window.location.replace(url.toString());
      }
    };
    const observer=new MutationObserver(check);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    const timer=window.setInterval(check,250);
    check();
    return()=>{observer.disconnect();window.clearInterval(timer)};
  },[]);
  return null;
}
