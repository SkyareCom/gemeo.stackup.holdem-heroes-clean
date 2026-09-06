import "server-only";
import {STACKUP_POKER_SYSTEM_PROMPT,StackupAiDepth,StackupAiProvider} from "@/lib/stackup-ai";

export interface StackupAiCompletion{
  text:string;
  provider:StackupAiProvider;
  model:string;
}

function providerOrder():StackupAiProvider[]{
  const raw=process.env.STACKUP_AI_PROVIDER_ORDER||"GEMINI,NVIDIA,OPENAI,ANTHROPIC";
  const valid=new Set(["GEMINI","NVIDIA","OPENAI","ANTHROPIC"]);
  return raw.split(",").map(v=>v.trim().toUpperCase()).filter(v=>valid.has(v)) as StackupAiProvider[];
}

function modelFor(provider:StackupAiProvider,depth:StackupAiDepth){
  const depthKey=`${provider}_MODEL_${depth}`;
  const genericKey=`${provider}_MODEL`;
  const fallback:Record<StackupAiProvider,string>={
    GEMINI:"gemini-2.0-flash",
    NVIDIA:"meta/llama-3.1-70b-instruct",
    OPENAI:"gpt-4.1-mini",
    ANTHROPIC:"claude-3-5-haiku-latest",
  };
  return process.env[depthKey]||process.env[genericKey]||fallback[provider];
}

function keyFor(provider:StackupAiProvider){
  const keys:Record<StackupAiProvider,string|undefined>={
    GEMINI:process.env.GEMINI_API_KEY,
    NVIDIA:process.env.NVIDIA_API_KEY,
    OPENAI:process.env.OPENAI_API_KEY,
    ANTHROPIC:process.env.ANTHROPIC_API_KEY,
  };
  return keys[provider];
}

async function jsonOrThrow(response:Response){
  const json=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`provider_http_${response.status}`);
  return json;
}

async function callGemini(question:string,depth:StackupAiDepth):Promise<StackupAiCompletion>{
  const provider:StackupAiProvider="GEMINI",key=keyFor(provider);if(!key)throw new Error("provider_not_configured");
  const model=modelFor(provider,depth);
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({systemInstruction:{parts:[{text:STACKUP_POKER_SYSTEM_PROMPT}]},contents:[{role:"user",parts:[{text:question}]}],generationConfig:{temperature:.25,maxOutputTokens:depth==="FAST"?700:depth==="SMART"?1300:2200}}),
    signal:AbortSignal.timeout(20000),
  });
  const json=await jsonOrThrow(response) as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>} ;
  const text=json.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();if(!text)throw new Error("empty_provider_response");
  return{text,provider,model};
}

async function callOpenAiCompatible(provider:"NVIDIA"|"OPENAI",question:string,depth:StackupAiDepth):Promise<StackupAiCompletion>{
  const key=keyFor(provider);if(!key)throw new Error("provider_not_configured");const model=modelFor(provider,depth);
  const endpoint=provider==="NVIDIA"?"https://integrate.api.nvidia.com/v1/chat/completions":"https://api.openai.com/v1/chat/completions";
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:STACKUP_POKER_SYSTEM_PROMPT},{role:"user",content:question}],temperature:.25,max_tokens:depth==="FAST"?700:depth==="SMART"?1300:2200}),signal:AbortSignal.timeout(20000)});
  const json=await jsonOrThrow(response) as {choices?:Array<{message?:{content?:string}}>};const text=json.choices?.[0]?.message?.content?.trim();if(!text)throw new Error("empty_provider_response");return{text,provider,model};
}

async function callAnthropic(question:string,depth:StackupAiDepth):Promise<StackupAiCompletion>{
  const provider:StackupAiProvider="ANTHROPIC",key=keyFor(provider);if(!key)throw new Error("provider_not_configured");const model=modelFor(provider,depth);
  const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,system:STACKUP_POKER_SYSTEM_PROMPT,messages:[{role:"user",content:question}],temperature:.25,max_tokens:depth==="FAST"?700:depth==="SMART"?1300:2200}),signal:AbortSignal.timeout(20000)});
  const json=await jsonOrThrow(response) as {content?:Array<{type?:string;text?:string}>};const text=json.content?.filter(c=>c.type==="text").map(c=>c.text||"").join("").trim();if(!text)throw new Error("empty_provider_response");return{text,provider,model};
}

export async function completePokerQuestion(question:string,depth:StackupAiDepth):Promise<StackupAiCompletion>{
  const errors:string[]=[];
  for(const provider of providerOrder()){
    try{
      if(provider==="GEMINI")return await callGemini(question,depth);
      if(provider==="NVIDIA"||provider==="OPENAI")return await callOpenAiCompatible(provider,question,depth);
      return await callAnthropic(question,depth);
    }catch(error){errors.push(`${provider}:${error instanceof Error?error.message:"unknown"}`)}
  }
  throw new Error(`no_ai_provider_available:${errors.join("|")}`);
}
