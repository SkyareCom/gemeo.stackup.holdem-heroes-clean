import type {AiSpotBatch,AiSpotGenerationRequest} from "@/lib/ai-spot-pipeline";
import {availableCredits,canUseAi,releaseCredits,reserveCredits,settleCredits,type StackupCreditWallet,type StackupSubscription,type StackupUsageReservation} from "@/lib/stackup-billing-engine";

export type StackupAiGatewayStore={
  getSubscription(userId:string):Promise<StackupSubscription|null>;
  getWallet(userId:string):Promise<StackupCreditWallet|null>;
  saveWallet(wallet:StackupCreditWallet):Promise<void>;
  hasCompletedRequest?(requestId:string):Promise<boolean>;
  markCompletedRequest?(requestId:string):Promise<void>;
};

export type StackupSpotGenerator=(request:AiSpotGenerationRequest)=>Promise<AiSpotBatch>;
export type StackupAiBillingRejectCode="SUBSCRIPTION_INACTIVE"|"FEATURE_NOT_INCLUDED"|"REQUEST_LIMIT"|"INSUFFICIENT_CREDITS";
export type StackupAiGatewayResult={
  ok:true;
  batch:AiSpotBatch;
  remainingAiCredits:number;
  chargedCredits:number;
}|{
  ok:false;
  code:"SUBSCRIPTION_NOT_FOUND"|"WALLET_NOT_FOUND"|StackupAiBillingRejectCode|"DUPLICATE_REQUEST"|"PROVIDER_ERROR";
  remainingAiCredits?:number;
};

export function estimateSpotGenerationCredits(request:AiSpotGenerationRequest){return Math.max(1,Math.ceil(Math.max(1,request.count)/4))}
export function actualSpotGenerationCredits(batch:AiSpotBatch){return Math.max(1,Math.ceil(Math.max(1,batch.spots.length)/4))}
function billingCode(value:string):StackupAiBillingRejectCode{
  if(value==="SUBSCRIPTION_INACTIVE"||value==="FEATURE_NOT_INCLUDED"||value==="REQUEST_LIMIT"||value==="INSUFFICIENT_CREDITS")return value;
  return"SUBSCRIPTION_INACTIVE";
}

export async function runPaidSpotGeneration(args:{userId:string;requestId:string;request:AiSpotGenerationRequest;store:StackupAiGatewayStore;generate:StackupSpotGenerator}):Promise<StackupAiGatewayResult>{
  const {userId,requestId,request,store,generate}=args;
  if(store.hasCompletedRequest&&await store.hasCompletedRequest(requestId))return{ok:false,code:"DUPLICATE_REQUEST"};
  const subscription=await store.getSubscription(userId);if(!subscription)return{ok:false,code:"SUBSCRIPTION_NOT_FOUND"};
  const wallet=await store.getWallet(userId);if(!wallet)return{ok:false,code:"WALLET_NOT_FOUND"};
  const requestedCredits=estimateSpotGenerationCredits(request);
  const gate=canUseAi(subscription,wallet,"SPOT_GENERATION",requestedCredits);
  if(!gate.ok)return{ok:false,code:billingCode(gate.reason),remainingAiCredits:availableCredits(wallet)};
  const reserved=reserveCredits(wallet,subscription,"SPOT_GENERATION",requestedCredits,requestId);
  if(!reserved.ok)return{ok:false,code:billingCode(reserved.reason),remainingAiCredits:availableCredits(wallet)};
  const reservation:StackupUsageReservation=reserved.reservation;
  await store.saveWallet(reserved.wallet);
  try{
    const batch=await generate(request);
    const chargedCredits=actualSpotGenerationCredits(batch);
    const settled=settleCredits(reserved.wallet,reservation,chargedCredits);
    await store.saveWallet(settled);
    if(store.markCompletedRequest)await store.markCompletedRequest(requestId);
    return{ok:true,batch,remainingAiCredits:availableCredits(settled),chargedCredits:Math.min(reservation.reservedCredits,chargedCredits)};
  }catch{
    const released=releaseCredits(reserved.wallet,reservation);
    await store.saveWallet(released);
    return{ok:false,code:"PROVIDER_ERROR",remainingAiCredits:availableCredits(released)};
  }
}
