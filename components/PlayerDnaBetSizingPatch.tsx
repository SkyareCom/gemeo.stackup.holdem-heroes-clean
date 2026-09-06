"use client";

import {useEffect} from "react";

const BET_SIZES=["33%","66%","POT","125%","150%"];

export default function PlayerDnaBetSizingPatch(){
  useEffect(()=>{
    const apply=()=>{
      const fixed=document.querySelector<HTMLElement>("[data-fixed-player-actions]");
      if(!fixed)return;
      const buttons=[...fixed.querySelectorAll<HTMLButtonElement>('button[data-base="BET"]')];
      if(buttons.length!==5)return;
      buttons.forEach((button,index)=>{
        const size=BET_SIZES[index];
        button.dataset.size=size;
        button.textContent=`BET ${size}`;
      });
    };
    apply();
    const timer=window.setInterval(apply,120);
    return()=>window.clearInterval(timer);
  },[]);
  return null;
}
