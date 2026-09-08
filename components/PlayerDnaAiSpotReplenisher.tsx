"use client";

import {useEffect} from "react";
import {playerDnaSpots} from "@/data/player-dna-spots";
import {refreshCertifiedSpotBank} from "@/lib/certified-ai-spot-pipeline";

const SEEN_REGISTRY_KEY="stackup.player-dna.seen-spots.v2";
const REFRESH_MS=2*60*1000;

function seenFingerprints(){
  try{
    const raw=window.localStorage.getItem(SEEN_REGISTRY_KEY);const parsed=raw?JSON.parse(raw):{};
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?Object.keys(parsed):[];
  }catch{return[]}
}

export default function PlayerDnaAiSpotReplenisher(){
  useEffect(()=>{
    let cancelled=false,busy=false;
    const refresh=async()=>{
      if(cancelled||busy)return;busy=true;
      try{
        const result=await refreshCertifiedSpotBank(playerDnaSpots,seenFingerprints());
        if(!cancelled)window.dispatchEvent(new CustomEvent("stackup:player-dna-bank-updated",{detail:result}));
      }catch{
        if(!cancelled)window.dispatchEvent(new CustomEvent("stackup:player-dna-bank-updated",{detail:{source:"ERROR",count:0}}));
      }finally{busy=false}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),REFRESH_MS);
    const online=()=>void refresh();
    const visible=()=>{if(document.visibilityState==="visible")void refresh()};
    const consumed=()=>void refresh();
    window.addEventListener("online",online);
    window.addEventListener("focus",online);
    window.addEventListener("stackup:player-dna-spot-consumed",consumed as EventListener);
    document.addEventListener("visibilitychange",visible);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("online",online);window.removeEventListener("focus",online);window.removeEventListener("stackup:player-dna-spot-consumed",consumed as EventListener);document.removeEventListener("visibilitychange",visible)};
  },[]);
  return null;
}
