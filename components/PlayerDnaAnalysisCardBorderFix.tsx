"use client";

import {useEffect} from "react";

export default function PlayerDnaAnalysisCardBorderFix(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.playerDnaAnalysisCardBorderFix="true";
    style.textContent=`
      .final-analysis-card-v2{
        border:1px solid #1F5F42!important;
        overflow:hidden!important;
      }
      .final-analysis-card-v2 .v2-line{
        border-bottom:0!important;
        border-top:0!important;
        border-left:0!important;
        border-right:0!important;
      }
    `;
    document.head.querySelector("style[data-player-dna-analysis-card-border-fix]")?.remove();
    document.head.appendChild(style);
    return()=>style.remove();
  },[]);
  return null;
}
