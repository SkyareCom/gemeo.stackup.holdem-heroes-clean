import {validateCommercialSolverReference,validateBenchmarkOnlyEvidence,COMMERCIAL_GTO_THRESHOLDS} from "../lib/gto-reference-validation";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
const fingerprint="stk2-testnode";
const baseBenchmark={benchmarkSource:"AUTHORIZED_REFERENCE",benchmarkVersion:"1",stateFingerprint:fingerprint,comparedActions:["FOLD","CALL","RAISE"] as const,maxFrequencyDeltaPct:COMMERCIAL_GTO_THRESHOLDS.maxFrequencyDeltaPct,maxEvDeltaBb:COMMERCIAL_GTO_THRESHOLDS.maxEvDeltaBb,bestActionMatch:true,nashDistancePctPot:COMMERCIAL_GTO_THRESHOLDS.maxNashDistancePctPot,validatedAt:"2026-09-08T00:00:00Z",rightsDetail:"COMMERCIAL LICENSE / EXPORT AUTHORIZATION RECORDED"};
const valid=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,comparedActions:[...baseBenchmark.comparedActions],usageRights:"COMMERCIAL_AUTHORIZED"}});
expect(valid.status==="VALIDATED","reference at all commercial thresholds with explicit rights must validate");
const benchmarkOnly=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,comparedActions:[...baseBenchmark.comparedActions],usageRights:"BENCHMARK_ONLY"}});
expect(benchmarkOnly.status==="REJECTED","benchmark-only evidence must not activate a commercial solver reference");
const benchmarkOnlyAllowed=validateBenchmarkOnlyEvidence({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,comparedActions:[...baseBenchmark.comparedActions],usageRights:"BENCHMARK_ONLY"}});
expect(benchmarkOnlyAllowed.status==="VALIDATED","benchmark-only evidence may enter the internal benchmark corpus when rights are documented");
const unknownRights=validateBenchmarkOnlyEvidence({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,comparedActions:[...baseBenchmark.comparedActions],usageRights:"UNKNOWN"}});
expect(unknownRights.status==="REJECTED","unknown source rights must be rejected even from benchmark corpus");
const wrongFingerprint=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,stateFingerprint:"stk2-other",comparedActions:["FOLD","CALL"],maxFrequencyDeltaPct:.1,maxEvDeltaBb:.001,nashDistancePctPot:.1,usageRights:"COMMERCIAL_AUTHORIZED"}});
expect(wrongFingerprint.status==="REJECTED","mismatched state fingerprint must be rejected");
const fakePrecision=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{...baseBenchmark,comparedActions:["FOLD","CALL"],maxFrequencyDeltaPct:.8,maxEvDeltaBb:.02,bestActionMatch:false,nashDistancePctPot:.5,usageRights:"COMMERCIAL_AUTHORIZED"}});
expect(fakePrecision.status==="REJECTED","reference outside fidelity limits must be rejected");
expect(fakePrecision.issues.length>=4,"all material benchmark failures should be reported");
const noEvidence=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z"});
expect(noEvidence.status==="REJECTED","reference without benchmark evidence must be quarantined");
console.log("GTO REFERENCE VALIDATION: PASS");
