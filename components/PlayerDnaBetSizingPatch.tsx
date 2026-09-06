"use client";

import {useEffect} from "react";

const BET_SIZES=["33%","66%","POT","125%","150%"] as const;

export default function PlayerDnaBetSizingPatch(){
  useEffect(()=>{
    const apply=()=>{
      const session=document.querySelector<HTMLElement>(".training-session");
      const fixed=session?.querySelector<HTMLElement>("[data-fixed-player-actions]");
      if(!session||!fixed)return;

      const fixedBetButtons=[...fixed.querySelectorAll<HTMLButtonElement>('button[data-base="BET"]')];
      if(fixedBetButtons.length!==BET_SIZES.length)return;

      const nativeButtons=[...session.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
        .filter(button=>!button.closest("[data-fixed-player-actions]"));
      const nativeBet=nativeButtons.find(button=>(button.textContent??"").trim()==="BET");
      const selectedSize=BET_SIZES.find(size=>nativeButtons.some(button=>(button.textContent??"").trim()===size&&button.getAttribute("aria-pressed")==="true"))??null;
      const betSelected=nativeBet?.getAttribute("aria-pressed")==="true";

      fixedBetButtons.forEach((button,index)=>{
        const size=BET_SIZES[index];
        button.dataset.size=size;
        button.textContent=`BET ${size}`;
        button.setAttribute("aria-pressed",betSelected&&selectedSize===size?"true":"false");
      });

      if(betSelected&&selectedSize){
        const comment=session.querySelector<HTMLElement>("[data-player-comment-card] .comment-line");
        if(comment&&comment.textContent?.startsWith("BET:")){
          comment.textContent=comment.textContent.replace(/^BET:/,`BET ${selectedSize}:`);
        }
      }
    };

    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,characterData:true});
    const timer=window.setInterval(apply,100);
    return()=>{observer.disconnect();window.clearInterval(timer)};
  },[]);
  return null;
}
