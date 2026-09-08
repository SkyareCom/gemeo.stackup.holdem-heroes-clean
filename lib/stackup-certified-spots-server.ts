import "server-only";
import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import type {AiSpotGenerationRequest} from "@/lib/ai-spot-pipeline";
import type {NormalizedSolveImport} from "@/lib/gto-solve-import";
import {generateStackupAiSpots} from "@/lib/stackup-ai-spots-server";
import {validateAiSpotForAnalysis} from "@/lib/ai-spot-analysis-gate";
import {playerDnaSpotToSolverState} from "@/lib/player-dna-state-adapter";
import {solverFingerprint} from "@/lib/player-dna-solver-v2";
import {solveExactStackupNode} from "@/lib/stackup-solver-service-server";

export type CertifiedSpotGenerationRequest=AiSpotGenerationRequest&{maxCandidateMultiplier?:number};
export type CertifiedSpotGenerationResult={
  spots:PlayerDnaSpot[];
  solves:NormalizedSolveImport[];
  generatedAt:string;
  model?:string;
  audit:{requested:number;candidates:number;integrityRejected:number;solverRejected:number;certified:number};
};

export async function generateCertifiedStackupSpots(request:CertifiedSpotGenerationRequest):Promise<CertifiedSpotGenerationResult>{
  const target=Math.max(1,Math.min(64,Math.floor(request.count)));
  const multiplier=Math.max(1,Math.min(6,Math.floor(request.maxCandidateMultiplier??3)));
  const candidateRequest:{count:number;modes:("CASH"|"TORNEIO")[];forbiddenFingerprints:string[];requiredCoverage:string[]}={
    count:Math.min(96,target*multiplier),
    modes:request.modes,
    forbiddenFingerprints:request.forbiddenFingerprints,
    requiredCoverage:request.requiredCoverage
  };
  const batch=await generateStackupAiSpots(candidateRequest);
  const spots:PlayerDnaSpot[]=[];
  const solves:NormalizedSolveImport[]=[];
  let integrityRejected=0,solverRejected=0;
  for(const spot of batch.spots){
    if(spots.length>=target)break;
    const gate=validateAiSpotForAnalysis(spot);
    if(gate.status!=="PASS"){integrityRejected++;continue}
    const state=playerDnaSpotToSolverState(spot);
    if(!state){integrityRejected++;continue}
    const fingerprint=solverFingerprint(state);
    const solved=await solveExactStackupNode({spot,requiredFingerprint:fingerprint});
    if(solved.status!=="SOLVED"||!solved.solve){solverRejected++;continue}
    if(solved.solve.fingerprint!==fingerprint){solverRejected++;continue}
    spots.push(spot);solves.push(solved.solve);
  }
  return{
    spots,solves,generatedAt:new Date().toISOString(),model:batch.model,
    audit:{requested:target,candidates:batch.spots.length,integrityRejected,solverRejected,certified:spots.length}
  };
}
