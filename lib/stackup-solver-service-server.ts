import "server-only";
import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import type {NormalizedSolveImport} from "@/lib/gto-solve-import";
import {parseNormalizedSolveImport} from "@/lib/gto-solve-import";
import {playerDnaSpotToSolverState} from "@/lib/player-dna-state-adapter";
import {solverFingerprint} from "@/lib/player-dna-solver-v2";

export type SolverServiceRequest={spot:PlayerDnaSpot;requiredFingerprint:string};
export type SolverServiceResult={status:"SOLVED"|"REJECTED";solve?:NormalizedSolveImport;reason?:string};

function serviceUrl(){return process.env.STACKUP_SOLVER_SERVICE_URL?.trim().replace(/\/$/,"")??""}
function serviceToken(){return process.env.STACKUP_SOLVER_SERVICE_TOKEN?.trim()??""}

export async function solveExactStackupNode(input:SolverServiceRequest):Promise<SolverServiceResult>{
  const url=serviceUrl();
  const token=serviceToken();
  if(!url)return{status:"REJECTED",reason:"SOLVER_SERVICE_NOT_CONFIGURED"};
  if(!token)return{status:"REJECTED",reason:"SOLVER_SERVICE_TOKEN_NOT_CONFIGURED"};
  const state=playerDnaSpotToSolverState(input.spot);
  if(!state)return{status:"REJECTED",reason:"SPOT_STATE_INVALID"};
  const canonicalFingerprint=solverFingerprint(state);
  if(canonicalFingerprint!==input.requiredFingerprint)return{status:"REJECTED",reason:"REQUEST_FINGERPRINT_MISMATCH"};
  const response=await fetch(`${url}/v1/solve`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${token}`},
    body:JSON.stringify({schema:"STACKUP_SOLVER_REQUEST_V1",fingerprint:canonicalFingerprint,state})
  });
  if(!response.ok)return{status:"REJECTED",reason:`SOLVER_SERVICE_HTTP_${response.status}`};
  const raw=await response.json();
  const parsed=parseNormalizedSolveImport(raw);
  if(parsed.status!=="ACCEPTED"||!parsed.normalized)return{status:"REJECTED",reason:`SOLVER_IMPORT_REJECTED:${parsed.issues.join("|")}`};
  const solve=parsed.normalized;
  if(solve.fingerprint!==canonicalFingerprint)return{status:"REJECTED",reason:"SOLVER_RESPONSE_FINGERPRINT_MISMATCH"};
  if(solve.source.usageRights!=="COMMERCIAL_AUTHORIZED")return{status:"REJECTED",reason:"SOLVER_RIGHTS_NOT_COMMERCIAL_AUTHORIZED"};
  return{status:"SOLVED",solve};
}
