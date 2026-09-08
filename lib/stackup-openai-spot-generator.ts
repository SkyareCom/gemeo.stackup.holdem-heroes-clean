import type {AiSpotGenerationRequest,AiSpotBatch} from "@/lib/ai-spot-pipeline";

function extractOutputText(payload:any){
  if(typeof payload?.output_text==="string")return payload.output_text;
  const chunks:string[]=[];
  for(const item of payload?.output??[])for(const content of item?.content??[])if(typeof content?.text==="string")chunks.push(content.text);
  return chunks.join("\n");
}

function parseJsonEnvelope(text:string){
  const trimmed=text.trim();
  const unfenced=trimmed.startsWith("```")?trimmed.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""):trimmed;
  return JSON.parse(unfenced);
}

export async function generateStackupAiSpotsWithOpenAi(request:AiSpotGenerationRequest):Promise<AiSpotBatch>{
  const apiKey=process.env.OPENAI_API_KEY?.trim();
  if(!apiKey)throw new Error("OPENAI_API_KEY_MISSING");
  const model=process.env.OPENAI_MODEL_FAST?.trim()||"gpt-5.6-luna";
  const system=[
    "YOU GENERATE TRAINING STATES FOR STACKUP HOLD'EM HEROES.",
    "OUTPUT STRICT JSON ONLY.",
    "NEVER OUTPUT GTO EV, GTO FREQUENCY OR BEST ACTION.",
    "THE APP'S SEPARATE ANALYSIS ENGINE JUDGES THE PLAYER ACTION.",
    "EVERY STATE MUST BE INTERNALLY COHERENT AND ANALYSIS-READY.",
    "USE ONLY NO-LIMIT TEXAS HOLD'EM.",
    "INCLUDE EXACT HERO TO-CALL, CURRENT BET, LEGAL ACTIONS, ACTION HISTORY, TOTAL COMMITMENTS AND WEIGHTED RANGES.",
    "CASH REQUIRES RAKE PERCENTAGE. ICM SPOTS REQUIRE PAYOUTS AND FIELD STACKS.",
    "MULTIWAY REQUIRES COMPLETE COMMITMENTS AND RECONCILABLE MAIN/SIDE POTS.",
    "DO NOT REUSE ANY FORBIDDEN FINGERPRINT.",
    "RETURN {\"spots\":[...],\"model\":\"...\",\"generatedAt\":\"ISO-8601\"}."
  ].join(" ");
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({
      model,
      reasoning:{effort:"low"},
      input:[
        {role:"system",content:system},
        {role:"user",content:JSON.stringify(request)}
      ]
    })
  });
  if(!response.ok)throw new Error(`OPENAI_RESPONSES_${response.status}`);
  const payload=await response.json();
  const text=extractOutputText(payload);
  if(!text)throw new Error("OPENAI_EMPTY_OUTPUT");
  const parsed=parseJsonEnvelope(text) as AiSpotBatch;
  if(!parsed||!Array.isArray(parsed.spots))throw new Error("OPENAI_INVALID_SPOT_BATCH");
  return{...parsed,model:parsed.model||model,generatedAt:parsed.generatedAt||new Date().toISOString()};
}
