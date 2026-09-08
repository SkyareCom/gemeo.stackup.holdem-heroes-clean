import {evaluateCommercialGtoReadiness,commercialClaimText} from "../lib/gto-commercial-readiness";
import type {BenchmarkCase} from "../lib/gto-benchmark-corpus";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
function sample(id:string,commercial=true):BenchmarkCase{const fingerprint=`stk2-${id}`;return{id,fingerprint,mode:"CASH",street:"RIVER",spotType:"SRP",effectiveStackBb:100,sizingBucket:"75%",icm:false,sourceDetail:"AUTHORIZED_FIXTURE",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{benchmarkSource:"AUTHORIZED_SOLVER_FIXTURE",benchmarkVersion:"1",stateFingerprint:fingerprint,comparedActions:["CHECK","BET"],maxFrequencyDeltaPct:.1,maxEvDeltaBb:.001,bestActionMatch:true,nashDistancePctPot:.1,validatedAt:"2026-09-08T00:00:00Z",usageRights:commercial?"COMMERCIAL_AUTHORIZED":"BENCHMARK_ONLY",rightsDetail:commercial?"COMMERCIAL TEST AUTHORIZATION":"INTERNAL BENCHMARK TEST AUTHORIZATION"}}}

const notReady=evaluateCommercialGtoReadiness({benchmarkCases:[sample("a",false)],activeCommercialReferences:0,quarantinedReferences:1,minimumCases:1,minimumPassRatePct:100,coverage:null});
expect(notReady.status==="NOT_READY","Benchmark-only corpus without active commercial references must not be commercially ready");
expect(notReady.claimLevel==="NO_GTO_FIDELITY_CLAIM","Not-ready state must prohibit fidelity claim");
expect(commercialClaimText(notReady).includes("NÃO CERTIFICADA"),"Not-ready commercial text must be explicit");

const ready=evaluateCommercialGtoReadiness({benchmarkCases:[sample("b",true)],activeCommercialReferences:1,quarantinedReferences:0,minimumCases:1,minimumPassRatePct:100,coverage:null});
expect(ready.status==="READY","Commercially authorized benchmark plus active validated reference should pass relaxed test gate");
expect(ready.claimLevel==="BENCHMARKED_WITHIN_SCOPE","Ready state must only claim benchmarked scope, never universal solver identity");
expect(commercialClaimText(ready).includes("DENTRO DO ESCOPO TESTADO"),"Ready claim must remain scope-limited");

const overActivated=evaluateCommercialGtoReadiness({benchmarkCases:[sample("c",true)],activeCommercialReferences:2,quarantinedReferences:0,minimumCases:1,minimumPassRatePct:100,coverage:null});
expect(overActivated.status==="NOT_READY","Active commercial references cannot exceed commercial evidence coverage");

console.log("GTO COMMERCIAL READINESS: PASS");
