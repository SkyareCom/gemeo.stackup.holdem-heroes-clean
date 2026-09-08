import {parseStackupStripeWebhookPayload,subscriptionFromStripeEvent} from "../lib/stackup-stripe-billing";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
const event={id:"evt_1",type:"customer.subscription.updated",data:{object:{id:"sub_1",customer:"cus_1",status:"active",current_period_start:1788211200,current_period_end:1790803200,metadata:{userId:"u1",plan:"PRO"}}}};
const subscription=subscriptionFromStripeEvent(event);expect(subscription!==null,"valid Stripe subscription event must map");
if(subscription){expect(subscription.plan==="PRO","plan metadata must be preserved");expect(subscription.status==="ACTIVE","active Stripe status must map to ACTIVE");expect(subscription.providerSubscriptionId==="sub_1","subscription id must be preserved")}
const parsed=parseStackupStripeWebhookPayload(JSON.stringify(event));expect(parsed.eventId==="evt_1"&&parsed.subscription?.userId==="u1","webhook payload parser must preserve event id and user");
const past=subscriptionFromStripeEvent({...event,id:"evt_2",data:{object:{...event.data.object,status:"past_due"}}});expect(past?.status==="PAST_DUE","past_due must block AI through billing status");
const canceled=subscriptionFromStripeEvent({...event,id:"evt_3",data:{object:{...event.data.object,status:"canceled"}}});expect(canceled?.status==="CANCELED","canceled must map to CANCELED");
const missingMetadata=subscriptionFromStripeEvent({...event,id:"evt_4",data:{object:{...event.data.object,metadata:{}}}});expect(missingMetadata===null,"subscription without Stackup metadata must not activate a plan");
console.log("STACKUP STRIPE BILLING: PASS");
