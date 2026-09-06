"use client";

import {useEffect} from "react";

export default function PlayerDnaVisualFixes(){
  useEffect(()=>{
    const apply=()=>{
      const tableHost=document.querySelector<HTMLElement>('[aria-label="MESA DE POKER ANIMADA PLAYER DNA"]');
      const root=tableHost?.shadowRoot;
      if(root){
        let style=root.querySelector<HTMLStyleElement>('style[data-player-dna-card-color-fix]');
        if(!style){
          style=document.createElement("style");
          style.dataset.playerDnaCardColorFix="true";
          root.appendChild(style);
        }
        style.textContent=`
          .card{background:#fff!important;border-color:#f7f7f7!important}
          .card.blackc,.card.blackc .rank,.card.blackc .suit{
            color:#000!important;
            -webkit-text-fill-color:#000!important;
            font-family:Arial Black,Arial,Helvetica,sans-serif!important;
            text-shadow:none!important;
          }
          .card.redc,.card.redc .rank,.card.redc .suit{
            color:#e60012!important;
            -webkit-text-fill-color:#e60012!important;
            font-family:Arial Black,Arial,Helvetica,sans-serif!important;
            text-shadow:none!important;
          }
          .rank{font-weight:900!important}
          .suit{font-weight:900!important}
        `;
      }

      const card=document.querySelector<HTMLElement>('[data-player-comment-card]');
      if(card){
        card.style.setProperty("box-sizing","border-box","important");
        card.style.setProperty("height","60px","important");
        card.style.setProperty("min-height","60px","important");
        card.style.setProperty("max-height","60px","important");
        card.style.setProperty("block-size","60px","important");
        card.style.setProperty("min-block-size","60px","important");
        card.style.setProperty("max-block-size","60px","important");
        card.style.setProperty("padding","0","important");
        card.style.setProperty("overflow","hidden","important");
        card.style.setProperty("display","grid","important");
        card.style.setProperty("grid-template-rows","36px 24px","important");

        const comment=card.querySelector<HTMLElement>(".comment-line");
        if(comment){
          comment.style.setProperty("display","flex","important");
          comment.style.setProperty("align-items","center","important");
          comment.style.setProperty("justify-content","center","important");
          comment.style.setProperty("height","36px","important");
          comment.style.setProperty("min-height","0","important");
          comment.style.setProperty("padding","3px 10px","important");
          comment.style.setProperty("text-align","center","important");
          comment.style.setProperty("white-space","normal","important");
          comment.style.setProperty("overflow-wrap","anywhere","important");
          comment.style.setProperty("word-break","break-word","important");
          comment.style.setProperty("overflow","hidden","important");
          comment.style.setProperty("line-height","1.1","important");
        }

        const gto=card.querySelector<HTMLElement>(".gto-line");
        if(gto){
          gto.style.setProperty("height","24px","important");
          gto.style.setProperty("min-height","0","important");
          gto.style.setProperty("padding","1px 4px","important");
          gto.style.setProperty("overflow","hidden","important");
        }

        if(card.classList.contains("awaiting-comment")&&comment){
          comment.style.setProperty("grid-row","1 / 3","important");
          comment.style.setProperty("height","60px","important");
        }
      }
    };

    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
    const timer=window.setInterval(apply,250);
    return()=>{observer.disconnect();window.clearInterval(timer)};
  },[]);
  return null;
}
