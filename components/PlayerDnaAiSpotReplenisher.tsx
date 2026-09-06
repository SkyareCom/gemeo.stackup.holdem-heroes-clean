"use client";

import {useEffect} from "react";
import {playerDnaSpots} from "@/data/player-dna-spots";
import {refreshAiSpotBank} from "@/lib/ai-spot-pipeline";

const OFFLINE_BANK=[...playerDnaSpots];
const SEEN_REGISTRY_KEY="stackup.player-dna.seen-spots.v2";
const REFRESH_MS=15*60*1000;

function seenFingerprints(){
  try{
    const raw=window.localStorage.getItem(SEEN_REGISTRY_KEY);const parsed=raw?JSON.parse(raw):{};
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?Object.keys(parsed):[];
  }catch{return[]}
}

export default function PlayerDnaAiSpotReplenisher(){
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{if(cancelled)return;await refreshAiSpotBank(playerDnaSpots,OFFLINE_BANK,seenFingerprints())};
    void refresh();
    const timer=window.setInterval(()=>void refresh(),REFRESH_MS);
    const online=()=>void refresh();window.addEventListener("online",online);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("online",online)};
  },[]);
  return null;
}
