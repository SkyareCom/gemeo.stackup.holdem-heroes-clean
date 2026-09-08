import {parseNormalizedSolveImport,parseNormalizedSolveJson,type NormalizedSolveImport} from "../lib/gto-solve-import";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
function fixture(overrides:Partial<NormalizedSolveImport>={}):NormalizedSolveImport{return{schemaVersion:"STACKUP_GTO_SOLVE_V1",fingerprint:"stk2-fixture-node",source:{name:"AUTHORIZED_REFERENCE",version:"1",exportId:"EXP-001",exportedAt:"2026-09-08T00:00:00Z",usageRights:"COMMERCIAL_AUTHORIZED",rightsDetail:"COMMERCIAL LICENSE FIXTURE"},node:{mode:"CASH",street:"RIVER",effectiveStackBb:100,spotType:"SRP",sizingBucket:"75%",icm:false},solution:{actions:[{action:"CHECK",frequencyPct:40,evBb:3.2},{action:"BET",frequencyPct:60,evBb:3.25}],sizings:[{key:"BET 75%",frequencyPct:60,evBb:3.25}],nashDistancePctPot:.1},benchmark:{maxFrequencyDeltaPct:.2,maxEvDeltaBb:.005,bestActionMatch:true,validatedAt:"2026-09-08T00:00:00Z"},...overrides}}

const ok=parseNormalizedSolveImport(fixture());
expect(ok.status==="ACCEPTED","valid normalized solve must be accepted");
expect(ok.reference?.fingerprint==="stk2-fixture-node","reference fingerprint mismatch");
expect(ok.reference?.benchmark?.usageRights==="COMMERCIAL_AUTHORIZED","usage rights must survive normalization");
expect(ok.reference?.actions.BET?.frequency===60,"action frequency must be preserved exactly");

const badSum=fixture();badSum.solution={...badSum.solution,actions:[{action:"CHECK",frequencyPct:20,evBb:1},{action:"BET",frequencyPct:20,evBb:2}]};
const badSumResult=parseNormalizedSolveImport(badSum);
expect(badSumResult.status==="REJECTED"&&badSumResult.issues.some(x=>x.includes("FREQUÊNCIAS SOMAM")),"invalid strategy sum must be rejected");

const duplicate=fixture();duplicate.solution={...duplicate.solution,actions:[{action:"BET",frequencyPct:50,evBb:1},{action:"BET",frequencyPct:50,evBb:1}]};
const duplicateResult=parseNormalizedSolveImport(duplicate);
expect(duplicateResult.status==="REJECTED"&&duplicateResult.issues.some(x=>x.includes("DUPLICADA")),"duplicate actions must be rejected");

const noRights=fixture();noRights.source={...noRights.source,usageRights:"UNKNOWN",rightsDetail:""};
const noRightsResult=parseNormalizedSolveImport(noRights);
expect(noRightsResult.status==="REJECTED","missing rights detail must reject import before catalog admission");

const broken=parseNormalizedSolveJson("{broken");
expect(broken.status==="REJECTED"&&broken.issues.some(x=>x.includes("JSON")),"corrupted JSON must be rejected");

console.log("GTO SOLVE IMPORT: PASS");
