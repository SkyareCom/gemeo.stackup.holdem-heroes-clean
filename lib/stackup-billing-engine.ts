export type StackupPlanId="FREE"|"PRO"|"ELITE";
export type StackupBillingStatus="ACTIVE"|"TRIALING"|"PAST_DUE"|"CANCELED"|"INCOMPLETE";
export type StackupAiFeature="SPOT_GENERATION"|"POKER_ASSISTANT"|"HAND_REVIEW"|"DEEP_ANALYSIS";

export type StackupPlan={
  id:StackupPlanId;
  aiCreditsMonthly:number;
  maxCreditsPerRequest:number;
  features:StackupAiFeature[];
};

// Credits are an internal commercial unit, deliberately decoupled from provider tokens/pricing.
// This lets Stackup change AI providers/models without changing the customer contract.
export const STACKUP_PLANS:Record<StackupPlanId,StackupPlan>={
  FREE:{id:"FREE",aiCreditsMonthly:0,maxCreditsPerRequest:0,features:[]},
  PRO:{id:"PRO",aiCreditsMonthly:3000,maxCreditsPerRequest:60,features:["SPOT_GENERATION","POKER_ASSISTANT","HAND_REVIEW"]},
  ELITE:{id:"ELITE",aiCreditsMonthly:12000,maxCreditsPerRequest:180,features:["SPOT_GENERATION","POKER_ASSISTANT","HAND_REVIEW","DEEP_ANALYSIS"]}
};

export type StackupSubscription={
  userId:string;
  plan:StackupPlanId;
  status:StackupBillingStatus;
  periodStart:string;
  periodEnd:string;
  providerCustomerId?:string;
  providerSubscriptionId?:string;
};

export type StackupCreditWallet={
  userId:string;
  periodStart:string;
  periodEnd:string;
  granted:number;
  used:number;
  reserved:number;
};

export type StackupUsageReservation={
  id:string;
  userId:string;
  feature:StackupAiFeature;
  reservedCredits:number;
  createdAt:string;
};

export function subscriptionAllowsAi(subscription:StackupSubscription,now=new Date()){
  const active=subscription.status==="ACTIVE"||subscription.status==="TRIALING";
  return active&&subscription.plan!=="FREE"&&now>=new Date(subscription.periodStart)&&now<new Date(subscription.periodEnd);
}

export function availableCredits(wallet:StackupCreditWallet){return Math.max(0,wallet.granted-wallet.used-wallet.reserved)}

export function canUseAi(subscription:StackupSubscription,wallet:StackupCreditWallet,feature:StackupAiFeature,requestedCredits:number){
  const plan=STACKUP_PLANS[subscription.plan];
  if(!subscriptionAllowsAi(subscription))return{ok:false as const,reason:"SUBSCRIPTION_INACTIVE"};
  if(!plan.features.includes(feature))return{ok:false as const,reason:"FEATURE_NOT_INCLUDED"};
  if(!Number.isFinite(requestedCredits)||requestedCredits<=0||requestedCredits>plan.maxCreditsPerRequest)return{ok:false as const,reason:"REQUEST_LIMIT"};
  if(availableCredits(wallet)<requestedCredits)return{ok:false as const,reason:"INSUFFICIENT_CREDITS"};
  return{ok:true as const,reason:"OK"};
}

export function reserveCredits(wallet:StackupCreditWallet,subscription:StackupSubscription,feature:StackupAiFeature,credits:number,reservationId:string){
  const gate=canUseAi(subscription,wallet,feature,credits);if(!gate.ok)return{ok:false as const,reason:gate.reason,wallet};
  return{ok:true as const,reservation:{id:reservationId,userId:wallet.userId,feature,reservedCredits:credits,createdAt:new Date().toISOString()},wallet:{...wallet,reserved:wallet.reserved+credits}};
}

export function settleCredits(wallet:StackupCreditWallet,reservation:StackupUsageReservation,actualCredits:number){
  const actual=Math.max(0,Math.min(reservation.reservedCredits,Math.ceil(actualCredits)));
  return{...wallet,reserved:Math.max(0,wallet.reserved-reservation.reservedCredits),used:wallet.used+actual};
}

export function releaseCredits(wallet:StackupCreditWallet,reservation:StackupUsageReservation){return{...wallet,reserved:Math.max(0,wallet.reserved-reservation.reservedCredits)}}

export function newPeriodWallet(subscription:StackupSubscription):StackupCreditWallet{
  return{userId:subscription.userId,periodStart:subscription.periodStart,periodEnd:subscription.periodEnd,granted:STACKUP_PLANS[subscription.plan].aiCreditsMonthly,used:0,reserved:0};
}
