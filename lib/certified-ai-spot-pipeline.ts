import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import {parseNormalizedSolveImport,type NormalizedSolveImport} from "@/lib/gto-solve-import";
import {addSolverReferences,solverFingerprint} from "@/lib/player-dna-solver-v2";
import {playerDnaSpotToSolverState} from "@/lib/player-dna-state-adapter";
import {isCertifiedTrainingSpot} from "@/lib/player-dna-validated-spot";
import {exactSpotFingerprint} from "@/lib/spot-identity";
import {canUseStackupAi,stackupAiAuthHeaders} from "@/lib/stackup-ai-subscription";

const CACHE_KEY="stackup.player-dna.certified-supply.v2";
const TARGET=192;
const MAX_ROUNDS=8;
const REQUIRED_COVERAGE=["PREFLOP","FLOP","TURN","RIVER","HEADS-UP","MULTIWAY","6-MAX","8-MAX","9-MAX","10-MAX","SRP","3-BET","4-BET","SQUEEZE","BLIND WAR","ALL-IN","SIDE POT","OVERBET","IP","OOP","SHORT","MEDIUM","DEEP","EARLY","MID","BOLHA","ITM","FT","ICM"];

type CertifiedPackage={spots:PlayerDnaSpot[];solves:NormalizedSolveImport[];model?:string;generatedAt?:string};
type CachedCertifiedSupply={spots:PlayerDnaSpot[];solves:NormalizedSolveImport[];savedAt:number};

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function gateway(){return process.env.NEXT_PUBLIC_STACKUP_AI_GATEWAY_URL?.trim().replace(/\/$/,"")??""}
function requiredSolverFingerprint(spot:PlayerDnaSpot){const state=playerDnaSpotToSolverState(spot);return state?solverFingerprint(state):null}
function requiredSolverFingerprints(spots:PlayerDnaSpot[]){return new Set(spots.map(requiredSolverFingerprint).filter((value):value is string=>Boolean(value)))}

function activateSolves(solves:NormalizedSolveImport[],allowedFingerprints:Set<string>){
  const references=[];
  for(const solve of solves){
    if(!allowedFingerprints.has(solve.fingerprint))continue;
    if(solve.source.usageRights!=="COMMERCIAL_AUTHORIZED")continue;
    const parsed=parseNormalizedSolveImport(solve);
    if(parsed.status==="ACCEPTED"&&parsed.reference&&parsed.reference.fingerprint===solve.fingerprint)references.push(parsed.reference);
  }
  if(references.length)addSolverReferences(references);
  return references.length;
}

function certifiedOnly(spots:PlayerDnaSpot[]){
  const unique=new Map<string,PlayerDnaSpot>();
  for(const spot of spots){if(isCertifiedTrainingSpot(spot))unique.set(exactSpotFingerprint(spot),spot)}
  return [...unique.values()];
}

export function loadCachedCertifiedSupply(){
  if(!browser())return{spots:[] as PlayerDnaSpot[],solves:[] as NormalizedSolveImport[]};
  try{
    const raw=window.localStorage.getItem(CACHE_KEY);const parsed=raw?JSON.parse(raw) as CachedCertifiedSupply:null;
    if(!parsed||!Array.isArray(parsed.spots)||!Array.isArray(parsed.solves))return{spots:[],solves:[]};
    const allowed=requiredSolverFingerprints(parsed.spots);
    const boundSolves=parsed.solves.filter(solve=>allowed.has(solve.fingerprint));
    activateSolves(boundSolves,allowed);
    const spots=certifiedOnly(parsed.spots);
    const certifiedFingerprints=requiredSolverFingerprints(spots);
    return{spots,solves:boundSolves.filter(solve=>certifiedFingerprints.has(solve.fingerprint))};
  }catch{return{spots:[],solves:[]}}
}

function saveCertifiedSupply(spots:PlayerDnaSpot[],solves:NormalizedSolveImport[]){
  if(!browser())return;
  const allowed=requiredSolverFingerprints(spots);
  const boundSolves=solves.filter(solve=>allowed.has(solve.fingerprint));
  try{window.localStorage.setItem(CACHE_KEY,JSON.stringify({spots,solves:boundSolves,savedAt:Date.now()} satisfies CachedCertifiedSupply))}catch{}
}

async function requestCertifiedPackage(count:number,forbiddenFingerprints:string[]):Promise<CertifiedPackage|null>{
  const base=gateway();
  if(!base)return null;
  if(browser()&&!canUseStackupAi("spotGeneration"))return null;
  const response=await fetch(`${base}/v1/spots/generate-certified`,{
    method:"POST",
    headers:{"content-type":"application/json",...stackupAiAuthHeaders()},
    body:JSON.stringify({
      count,
      modes:["CASH","TORNEIO"],
      forbiddenFingerprints:forbiddenFingerprints.slice(-20000),
      requiredCoverage:REQUIRED_COVERAGE,
      validationPolicy:{
        requireExactNodeFingerprint:true,
        requireSolverSolution:true,
        requireOneExactSolvePerNode:true,
        requireCommercialAuthorizedRights:true,
        requireBenchmark:true,
        rejectAiEstimatedEv:true,
        rejectAiEstimatedFrequency:true,
        rejectUnsolvedCandidate:true,
        rejectUnmatchedSolve:true
      },
      workflow:[
        "AI GENERATES CANDIDATE STATE ONLY",
        "SERVER CANONICALIZES THE CANDIDATE AND COMPUTES THE STACKUP SOLVER FINGERPRINT",
        "SOLVER SERVICE SOLVES OR MATCHES THAT EXACT CANONICAL NODE",
        "NORMALIZED SOLVE FINGERPRINT MUST EQUAL THE CANDIDATE SOLVER FINGERPRINT",
        "BENCHMARK/PROVENANCE LAYER VALIDATES THE SOLUTION",
        "RETURN THE SPOT ONLY TOGETHER WITH ITS NORMALIZED STACKUP_GTO_SOLVE_V1 EVIDENCE",
        "NEVER LET THE LANGUAGE MODEL INVENT EV, FREQUENCY, BEST ACTION OR SOLVER OUTPUT"
      ]
    })
  });
  if(!response.ok)throw new Error(`CERTIFIED_SPOT_GATEWAY_${response.status}`);
  const data=await response.json() as Partial<CertifiedPackage>;
  if(!Array.isArray(data.spots)||!Array.isArray(data.solves))return null;
  return{spots:data.spots,solves:data.solves,model:data.model,generatedAt:data.generatedAt};
}

export async function refreshCertifiedSpotBank(runtimeBank:PlayerDnaSpot[],forbiddenFingerprints:string[]=[]){
  const cached=loadCachedCertifiedSupply();
  const spotMap=new Map(cached.spots.map(spot=>[exactSpotFingerprint(spot),spot]));
  const solveMap=new Map(cached.solves.map(solve=>[solve.fingerprint,solve]));
  const forbidden=new Set([...forbiddenFingerprints,...spotMap.keys()]);
  let rounds=0,accepted=spotMap.size,rejected=0,unmatchedSolves=0,model:string|undefined;
  while(spotMap.size<TARGET&&rounds<MAX_ROUNDS){
    rounds++;
    const pkg=await requestCertifiedPackage(Math.min(64,TARGET-spotMap.size),[...forbidden]);
    if(!pkg)break;
    model=pkg.model??model;
    const candidateSolverFingerprints=requiredSolverFingerprints(pkg.spots);
    const packageSolves=new Map<string,NormalizedSolveImport>();
    for(const solve of pkg.solves){
      const parsed=parseNormalizedSolveImport(solve);
      if(parsed.status!=="ACCEPTED"||solve.source.usageRights!=="COMMERCIAL_AUTHORIZED"||!candidateSolverFingerprints.has(solve.fingerprint)){unmatchedSolves++;continue}
      packageSolves.set(solve.fingerprint,solve);
    }
    for(const [fingerprint,solve] of packageSolves)solveMap.set(fingerprint,solve);
    activateSolves([...packageSolves.values()],candidateSolverFingerprints);
    let added=0;
    for(const spot of pkg.spots){
      const fingerprint=exactSpotFingerprint(spot);
      const solverFp=requiredSolverFingerprint(spot);
      if(forbidden.has(fingerprint)||!solverFp||!packageSolves.has(solverFp)){rejected++;continue}
      if(!isCertifiedTrainingSpot(spot)){rejected++;continue}
      forbidden.add(fingerprint);spotMap.set(fingerprint,spot);added++;
    }
    accepted=spotMap.size;
    if(!added)break;
  }
  const spots=[...spotMap.values()].slice(0,TARGET);
  const allowed=requiredSolverFingerprints(spots);
  const solves=[...solveMap.values()].filter(solve=>allowed.has(solve.fingerprint));
  if(spots.length){runtimeBank.splice(0,runtimeBank.length,...spots);saveCertifiedSupply(spots,solves)}
  else runtimeBank.splice(0,runtimeBank.length);
  return{source:spots.length?"CERTIFIED":"EMPTY" as const,count:spots.length,accepted,rejected,unmatchedSolves,rounds,model:model??null};
}
