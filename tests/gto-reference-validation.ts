import {validateCommercialSolverReference,COMMERCIAL_GTO_THRESHOLDS} from "../lib/gto-reference-validation";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
const fingerprint="stk2-testnode";
const valid=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{benchmarkSource:"AUTHORIZED_REFERENCE",benchmarkVersion:"1",stateFingerprint:fingerprint,comparedActions:["FOLD","CALL","RAISE"],maxFrequencyDeltaPct:COMMERCIAL_GTO_THRESHOLDS.maxFrequencyDeltaPct,maxEvDeltaBb:COMMERCIAL_GTO_THRESHOLDS.maxEvDeltaBb,bestActionMatch:true,nashDistancePctPot:COMMERCIAL_GTO_THRESHOLDS.maxNashDistancePctPot,validatedAt:"2026-09-08T00:00:00Z"}});
expect(valid.status==="VALIDATED","reference at all commercial thresholds must validate");
const wrongFingerprint=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{benchmarkSource:"AUTHORIZED_REFERENCE",stateFingerprint:"stk2-other",comparedActions:["FOLD","CALL"],maxFrequencyDeltaPct:.1,maxEvDeltaBb:.001,bestActionMatch:true,nashDistancePctPot:.1,validatedAt:"2026-09-08T00:00:00Z"}});
expect(wrongFingerprint.status==="REJECTED","mismatched state fingerprint must be rejected");
const fakePrecision=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{benchmarkSource:"AUTHORIZED_REFERENCE",stateFingerprint:fingerprint,comparedActions:["FOLD","CALL"],maxFrequencyDeltaPct:.8,maxEvDeltaBb:.02,bestActionMatch:false,nashDistancePctPot:.5,validatedAt:"2026-09-08T00:00:00Z"}});
expect(fakePrecision.status==="REJECTED","reference outside fidelity limits must be rejected");
expect(fakePrecision.issues.length>=4,"all material benchmark failures should be reported");
const noEvidence=validateCommercialSolverReference({fingerprint,sourceDetail:"AUTHORIZED_SOLVER_EXPORT",verifiedAt:"2026-09-08T00:00:00Z"});
expect(noEvidence.status==="REJECTED","reference without benchmark evidence must be quarantined");
console.log("GTO REFERENCE VALIDATION: PASS");
