import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import {exactSpotFingerprint} from "@/lib/spot-identity";

export type AiSpotBatch={spots:PlayerDnaSpot[];model?:string;generatedAt?:string};
export type AiSpotGenerationRequest={
  count:number;
  modes:("CASH"|"TORNEIO")[];
  forbiddenFingerprints:string[];
  requiredCoverage:string[];
};

const CACHE_KEY="stackup.player-dna.ai-spot-cache.v1";
const AI_SOURCE_KEY="stackup.player-dna.ai-source-status.v1";
const MAX_CACHE=192;

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function text(value:unknown){return typeof value==="string"?value.trim():""}
function num(value:unknown){return typeof value==="number"&&Number.isFinite(value)?value:NaN}
function uniqueCards(cards:string[]){return new Set(cards.map(card=>card.toUpperCase())).size===cards.length}

export function validateAiSpot(value:unknown):value is PlayerDnaSpot{
  if(!value||typeof value!=="object")return false;
  const spot=value as PlayerDnaSpot;
  if(!["CASH","TORNEIO"].includes(spot.mode))return false;
  if(!["PREFLOP","FLOP","TURN","RIVER"].includes(spot.street))return false;
  if(!text(spot.id)||!text(spot.heroCards)||!Array.isArray(spot.players)||spot.players.length<2||spot.players.length>10)return false;
  if(!spot.pot||!Number.isFinite(num(spot.pot.main))||spot.pot.main<=0)return false;
  if(!Array.isArray(spot.scenario)||!Array.isArray(spot.actions)||spot.actions.length===0)return false;
  if(spot.players.filter(player=>player.hero).length!==1)return false;
  if(spot.players.some(player=>!text(player.position)||!Number.isFinite(num(player.stack))||player.stack<=0||!Number.isFinite(num(player.value))))return false;
  const heroCards=spot.heroCards.split(" ").filter(Boolean);if(heroCards.length!==2||!uniqueCards(heroCards))return false;
  const board=(spot.board??"").split(" ").filter(Boolean);
  const expected=spot.street==="PREFLOP"?0:spot.street==="FLOP"?3:spot.street==="TURN"?4:5;
  if(board.length!==expected||!uniqueCards([...heroCards,...board]))return false;
  return true;
}

export function loadCachedAiSpots():PlayerDnaSpot[]{
  if(!browser())return[];
  try{
    const raw=window.localStorage.getItem(CACHE_KEY);const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed.filter(validateAiSpot):[];
  }catch{return[]}
}

export function cacheAiSpots(spots:PlayerDnaSpot[]){
  if(!browser())return;
  const unique=new Map<string,PlayerDnaSpot>();
  for(const spot of [...spots,...loadCachedAiSpots()])if(validateAiSpot(spot))unique.set(exactSpotFingerprint(spot),spot);
  const next=[...unique.values()].slice(0,MAX_CACHE);
  try{window.localStorage.setItem(CACHE_KEY,JSON.stringify(next))}catch{}
}

export function applyAiRuntimeBank(runtimeBank:PlayerDnaSpot[],offlineBank:PlayerDnaSpot[],aiSpots:PlayerDnaSpot[]){
  const valid=aiSpots.filter(validateAiSpot);
  if(!valid.length){runtimeBank.splice(0,runtimeBank.length,...offlineBank);return"OFFLINE" as const}
  const unique=new Map<string,PlayerDnaSpot>();for(const spot of valid)unique.set(exactSpotFingerprint(spot),spot);
  runtimeBank.splice(0,runtimeBank.length,...unique.values());
  return"AI" as const;
}

export async function requestAiSpotBatch(request:AiSpotGenerationRequest):Promise<AiSpotBatch|null>{
  if(typeof navigator!=="undefined"&&!navigator.onLine)return null;
  const endpoint=process.env.NEXT_PUBLIC_STACKUP_SPOT_AI_ENDPOINT?.trim();
  if(!endpoint)return null;
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    ...request,
    contract:{
      task:"GENERATE_UNSEEN_POKER_TRAINING_SPOTS",
      rules:[
        "RETURN ONLY INTERNALLY COHERENT NO-LIMIT HOLD'EM STATES",
        "VARY POSITIONS STACKS STREETS BOARDS ACTION HISTORIES SIZINGS AND TOURNAMENT CONTEXT",
        "DO NOT INVENT SOLVER EV OR GTO FREQUENCIES",
        "EVALUATION IS PERFORMED SEPARATELY BY THE STACKUP SOLVER ENGINE",
        "NEVER RETURN A FORBIDDEN FINGERPRINT OR DUPLICATE STATE"
      ]
    }
  })});
  if(!response.ok)throw new Error(`STACKUP AI SPOT ENDPOINT ${response.status}`);
  const data=await response.json() as AiSpotBatch;
  if(!data||!Array.isArray(data.spots))return null;
  const spots=data.spots.filter(validateAiSpot);
  return{...data,spots};
}

export async function refreshAiSpotBank(runtimeBank:PlayerDnaSpot[],offlineBank:PlayerDnaSpot[],forbiddenFingerprints:string[]=[]){
  const cached=loadCachedAiSpots();if(cached.length)applyAiRuntimeBank(runtimeBank,offlineBank,cached);
  try{
    const batch=await requestAiSpotBatch({
      count:96,
      modes:["CASH","TORNEIO"],
      forbiddenFingerprints:forbiddenFingerprints.slice(-2500),
      requiredCoverage:["PREFLOP","FLOP","TURN","RIVER","HEADS-UP","MULTIWAY","6-MAX","8-MAX","9-MAX","10-MAX","SRP","3-BET","4-BET","SQUEEZE","BLIND WAR","ALL-IN","SIDE POT","OVERBET","IP","OOP","SHORT","MEDIUM","DEEP","EARLY","MID","BOLHA","ITM","FT","ICM"]
    });
    if(!batch?.spots.length){if(!cached.length)applyAiRuntimeBank(runtimeBank,offlineBank,[]);return{source:cached.length?"CACHE":"OFFLINE",count:cached.length}}
    cacheAiSpots(batch.spots);const source=applyAiRuntimeBank(runtimeBank,offlineBank,batch.spots);
    if(browser())window.localStorage.setItem(AI_SOURCE_KEY,JSON.stringify({source,count:batch.spots.length,at:Date.now(),model:batch.model??null}));
    return{source,count:batch.spots.length};
  }catch{
    if(!cached.length)applyAiRuntimeBank(runtimeBank,offlineBank,[]);
    return{source:cached.length?"CACHE":"OFFLINE",count:cached.length};
  }
}
