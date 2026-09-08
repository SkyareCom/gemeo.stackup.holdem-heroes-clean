import {commercialBenchmarkGate,validateBenchmarkCorpus,type BenchmarkCase} from "../lib/gto-benchmark-corpus";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
function sample(id:string,overrides:Partial<BenchmarkCase>={}):BenchmarkCase{const fingerprint=`stk2-${id}`;return{id,fingerprint,mode:"CASH",street:"RIVER",spotType:"SRP",effectiveStackBb:100,sizingBucket:"75%",icm:false,sourceDetail:"AUTHORIZED_REFERENCE_FIXTURE",verifiedAt:"2026-09-08T00:00:00Z",benchmark:{benchmarkSource:"AUTHORIZED_SOLVER_FIXTURE",benchmarkVersion:"1",stateFingerprint:fingerprint,comparedActions:["CHECK","BET"],maxFrequencyDeltaPct:.2,maxEvDeltaBb:.005,bestActionMatch:true,nashDistancePctPot:.1,validatedAt:"2026-09-08T00:00:00Z",usageRights:"BENCHMARK_ONLY",rightsDetail:"FIXTURE AUTHORIZED FOR INTERNAL BENCHMARK TESTING"},...overrides}}

const clean=[sample("a"),sample("b",{mode:"TORNEIO",street:"PREFLOP",spotType:"3BET",effectiveStackBb:25,sizingBucket:"2.5X",icm:true})];
const report=validateBenchmarkCorpus(clean);
expect(report.total===2,"Corpus total mismatch");
expect(report.validated===2&&report.rejected===0,"Clean fixtures must validate");
expect(report.byMode.length===2,"Mode buckets missing");
expect(report.byIcm.some(x=>x.key==="ICM"&&x.validated===1),"ICM bucket missing");
expect(report.benchmarkOnlyCases===2,"Benchmark-only rights bucket mismatch");

const bad=sample("bad");bad.benchmark={...bad.benchmark,maxEvDeltaBb:.5,bestActionMatch:false};
const badReport=validateBenchmarkCorpus([bad]);
expect(badReport.rejected===1,"Out-of-tolerance benchmark must be rejected");
expect(badReport.rejectedCases[0].issues.some(x=>x.includes("EV")),"Rejected case must explain EV failure");

const unknown=sample("unknown");unknown.benchmark={...unknown.benchmark,usageRights:"UNKNOWN",rightsDetail:"NO VERIFIED RIGHTS"};
expect(validateBenchmarkCorpus([unknown]).rejected===1,"Unknown source rights must be rejected from benchmark corpus");

const duplicate=validateBenchmarkCorpus([sample("dup"),sample("dup")]);
expect(duplicate.rejected===1,"Duplicate id/fingerprint must quarantine duplicate case");

const smallGate=commercialBenchmarkGate(clean,1000,99);
expect(smallGate.status==="FAIL"&&smallGate.issues.some(x=>x.includes("CORPUS INSUFICIENTE")),"Commercial gate must reject undersized corpus");
expect(smallGate.issues.some(x=>x.includes("STREET FLOP")),"Commercial gate must reject missing street coverage");
const permissiveGate=commercialBenchmarkGate(clean,2,100,null);
expect(permissiveGate.status==="PASS","Clean fixture corpus should pass when coverage policy is explicitly disabled for unit test");

console.log("GTO BENCHMARK CORPUS: PASS");
