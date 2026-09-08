import type {StackupBillingStatus,StackupPlanId,StackupSubscription} from "@/lib/stackup-billing-engine";

export type StackupCheckoutRequest={userId:string;plan:Exclude<StackupPlanId,"FREE">;successUrl:string;cancelUrl:string;customerEmail?:string};
export type StackupCheckoutSession={id:string;url:string};

function priceForPlan(plan:Exclude<StackupPlanId,"FREE">){
  const price=plan==="PRO"?process.env.STRIPE_PRICE_PRO_MONTHLY:process.env.STRIPE_PRICE_ELITE_MONTHLY;
  if(!price?.trim())throw new Error(`STRIPE_PRICE_${plan}_MISSING`);
  return price.trim();
}

export async function createStackupCheckoutSession(input:StackupCheckoutRequest):Promise<StackupCheckoutSession>{
  const secret=process.env.STRIPE_SECRET_KEY?.trim();if(!secret)throw new Error("STRIPE_SECRET_KEY_MISSING");
  const body=new URLSearchParams();
  body.set("mode","subscription");
  body.set("success_url",input.successUrl);
  body.set("cancel_url",input.cancelUrl);
  body.set("line_items[0][price]",priceForPlan(input.plan));
  body.set("line_items[0][quantity]","1");
  body.set("client_reference_id",input.userId);
  body.set("metadata[userId]",input.userId);
  body.set("metadata[plan]",input.plan);
  body.set("subscription_data[metadata][userId]",input.userId);
  body.set("subscription_data[metadata][plan]",input.plan);
  if(input.customerEmail?.trim())body.set("customer_email",input.customerEmail.trim());
  const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/x-www-form-urlencoded"},body});
  if(!response.ok)throw new Error(`STRIPE_CHECKOUT_${response.status}`);
  const payload=await response.json() as {id?:string;url?:string};
  if(!payload.id||!payload.url)throw new Error("STRIPE_CHECKOUT_INVALID_RESPONSE");
  return{id:payload.id,url:payload.url};
}

export type StripeSubscriptionLike={id:string;customer?:string|{id?:string};status:string;current_period_start?:number;current_period_end?:number;metadata?:Record<string,string>};
export type StripeEventLike={id:string;type:string;data?:{object?:StripeSubscriptionLike}};

function mapStatus(status:string):StackupBillingStatus{
  if(status==="active")return"ACTIVE";
  if(status==="trialing")return"TRIALING";
  if(status==="past_due"||status==="unpaid")return"PAST_DUE";
  if(status==="canceled")return"CANCELED";
  return"INCOMPLETE";
}
function iso(seconds:number|undefined){return new Date(Math.max(0,seconds??0)*1000).toISOString()}
function customerId(customer:StripeSubscriptionLike["customer"]){return typeof customer==="string"?customer:customer?.id}

export function subscriptionFromStripeEvent(event:StripeEventLike):StackupSubscription|null{
  if(!event.id||!event.type.startsWith("customer.subscription."))return null;
  const object=event.data?.object;if(!object?.id)return null;
  const userId=object.metadata?.userId?.trim(),plan=object.metadata?.plan as StackupPlanId|undefined;
  if(!userId||(plan!=="PRO"&&plan!=="ELITE"))return null;
  return{userId,plan,status:mapStatus(object.status),periodStart:iso(object.current_period_start),periodEnd:iso(object.current_period_end),providerCustomerId:customerId(object.customer),providerSubscriptionId:object.id};
}

export type StackupStripeWebhookResult={eventId:string;subscription:StackupSubscription|null};
export function parseStackupStripeWebhookPayload(rawBody:string):StackupStripeWebhookResult{
  const event=JSON.parse(rawBody) as StripeEventLike;
  if(!event?.id||!event?.type)throw new Error("STRIPE_WEBHOOK_INVALID_EVENT");
  return{eventId:event.id,subscription:subscriptionFromStripeEvent(event)};
}

// Signature verification must happen at the HTTP boundary before this parser is called.
// Keep STRIPE_WEBHOOK_SECRET server-side and use the hosting runtime/provider's verified raw request bytes.
