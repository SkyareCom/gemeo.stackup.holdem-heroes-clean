import {availableCredits,newPeriodWallet,reserveCredits,settleCredits,releaseCredits,type StackupCreditWallet,type StackupSubscription} from "../lib/stackup-billing-engine";
import {runPaidSpotGeneration} from "../lib/stackup-ai-commercial-gateway";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}

async function main(){
  const start="2026-09-01T00:00:00.000Z",end="2099-10-01T00:00:00.000Z";
  const pro:StackupSubscription={userId:"u1",plan:"PRO",status:"ACTIVE",periodStart:start,periodEnd:end};
  const free:StackupSubscription={...pro,plan:"FREE"};
  const pastDue:StackupSubscription={...pro,status:"PAST_DUE"};
  const wallet:StackupCreditWallet={userId:"u1",periodStart:start,periodEnd:end,granted:100,used:10,reserved:0};
  expect(newPeriodWallet(pro).granted===3000,"PRO period must grant configured monthly credits");
  expect(newPeriodWallet(free).granted===0,"FREE period must grant zero AI credits");
  const reserved=reserveCredits(wallet,pro,"SPOT_GENERATION",20,"r1");expect(reserved.ok,"PRO reservation should succeed");
  if(reserved.ok){expect(availableCredits(reserved.wallet)===70,"reservation must reduce available credits");const settled=settleCredits(reserved.wallet,reserved.reservation,7);expect(settled.used===17&&settled.reserved===0,"settlement must charge actual usage and release reserve")}
  const reserved2=reserveCredits(wallet,pro,"SPOT_GENERATION",20,"r2");if(reserved2.ok){const released=releaseCredits(reserved2.wallet,reserved2.reservation);expect(availableCredits(released)===90,"provider failure must release reserved credits")}
  expect(!reserveCredits(wallet,free,"SPOT_GENERATION",1,"free").ok,"FREE cannot reserve remote AI credits");
  expect(!reserveCredits(wallet,pastDue,"SPOT_GENERATION",1,"past").ok,"PAST_DUE cannot reserve AI credits");
  let storedWallet={...wallet};const completed=new Set<string>();
  const store={async getSubscription(){return pro},async getWallet(){return storedWallet},async saveWallet(next:StackupCreditWallet){storedWallet=next},async hasCompletedRequest(id:string){return completed.has(id)},async markCompletedRequest(id:string){completed.add(id)}};
  const ok=await runPaidSpotGeneration({userId:"u1",requestId:"req-1",request:{count:8,modes:["CASH"],forbiddenFingerprints:[],requiredCoverage:["PREFLOP"]},store,generate:async()=>({spots:[{} as never,{} as never,{} as never,{} as never,{} as never,{} as never,{} as never,{} as never]})});
  expect(ok.ok,"paid gateway must settle successful provider call");if(ok.ok)expect(ok.chargedCredits===2,"eight generated spots should consume two internal credits");
  const duplicate=await runPaidSpotGeneration({userId:"u1",requestId:"req-1",request:{count:8,modes:["CASH"],forbiddenFingerprints:[],requiredCoverage:[]},store,generate:async()=>({spots:[]})});
  expect(!duplicate.ok&&duplicate.code==="DUPLICATE_REQUEST","completed request id must be idempotently rejected");
  const beforeFailure=availableCredits(storedWallet);const failed=await runPaidSpotGeneration({userId:"u1",requestId:"req-2",request:{count:4,modes:["CASH"],forbiddenFingerprints:[],requiredCoverage:[]},store,generate:async()=>{throw new Error("provider")}});expect(!failed.ok&&failed.code==="PROVIDER_ERROR","provider failure must surface");expect(availableCredits(storedWallet)===beforeFailure,"provider failure must refund reservation");
  console.log("STACKUP BILLING ENGINE: PASS");
}

main().catch(error=>{console.error(error);process.exit(1)});
