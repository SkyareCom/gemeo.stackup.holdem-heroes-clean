import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverReference} from "@/lib/player-dna-solver-v2";
import type {SolverBenchmarkEvidence,SolverBenchmarkUsageRights} from "@/lib/gto-reference-validation";

const ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];

export type NormalizedSolveAction={action:PlayerAction;frequencyPct:number;evBb:number};
export type NormalizedSolveSizing={key:string;frequencyPct:number;evBb:number};
export type NormalizedSolveImport={
  schemaVersion:"STACKUP_GTO_SOLVE_V1";
  fingerprint:string;
  source:{name:string;version?:string;exportId?:string;exportedAt:string;usageRights:SolverBenchmarkUsageRights;rightsDetail:string};
  node:{mode:"CASH"|"TORNEIO";street:"PREFLOP"|"FLOP"|"TURN"|"RIVER";effectiveStackBb:number;spotType:string;sizingBucket?:string;icm:boolean};
  solution:{actions:NormalizedSolveAction[];sizings?:NormalizedSolveSizing[];nashDistancePctPot:number};
  benchmark:{maxFrequencyDeltaPct:number;maxEvDeltaBb:number;bestActionMatch:boolean;validatedAt:string};
};

export type SolveImportResult={status:"ACCEPTED"|"REJECTED";issues:string[];reference?:SolverReference;normalized?:NormalizedSolveImport};

function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}
function finite(value:unknown){return typeof value==="number"&&Number.isFinite(value)}
function date(value:unknown){return typeof value==="string"&&value.length>0&&!Number.isNaN(Date.parse(value))}
function text(value:unknown){return typeof value==="string"&&value.trim().length>0}
function action(value:unknown):value is PlayerAction{return typeof value==="string"&&ACTIONS.includes(value.toUpperCase() as PlayerAction)}
function rights(value:unknown):value is SolverBenchmarkUsageRights{return value==="COMMERCIAL_AUTHORIZED"||value==="BENCHMARK_ONLY"||value==="UNKNOWN"}

export function parseNormalizedSolveImport(raw:unknown):SolveImportResult{
  const issues:string[]=[];
  if(!record(raw))return{status:"REJECTED",issues:["ARQUIVO DE SOLVE DEVE SER UM OBJETO JSON."]};
  if(raw.schemaVersion!=="STACKUP_GTO_SOLVE_V1")issues.push("SCHEMA VERSION AUSENTE OU NÃO SUPORTADA.");
  if(!text(raw.fingerprint))issues.push("FINGERPRINT DO NÓ AUSENTE.");
  const source=record(raw.source)?raw.source:null,node=record(raw.node)?raw.node:null,solution=record(raw.solution)?raw.solution:null,benchmark=record(raw.benchmark)?raw.benchmark:null;
  if(!source)issues.push("BLOCO SOURCE AUSENTE.");
  if(!node)issues.push("BLOCO NODE AUSENTE.");
  if(!solution)issues.push("BLOCO SOLUTION AUSENTE.");
  if(!benchmark)issues.push("BLOCO BENCHMARK AUSENTE.");
  if(source){if(!text(source.name))issues.push("NOME DA FONTE AUSENTE.");if(!date(source.exportedAt))issues.push("DATA DE EXPORTAÇÃO DA FONTE INVÁLIDA.");if(!rights(source.usageRights))issues.push("DIREITOS DE USO INVÁLIDOS.");if(!text(source.rightsDetail))issues.push("DETALHE DOCUMENTAL DOS DIREITOS DE USO AUSENTE.");}
  if(node){if(node.mode!=="CASH"&&node.mode!=="TORNEIO")issues.push("MODE DO NÓ INVÁLIDO.");if(!["PREFLOP","FLOP","TURN","RIVER"].includes(String(node.street)))issues.push("STREET DO NÓ INVÁLIDA.");if(!finite(node.effectiveStackBb)||Number(node.effectiveStackBb)<=0)issues.push("STACK EFETIVO INVÁLIDO.");if(!text(node.spotType))issues.push("TIPO DE SPOT AUSENTE.");if(typeof node.icm!=="boolean")issues.push("FLAG ICM INVÁLIDA.");}
  const actionRows=solution&&Array.isArray(solution.actions)?solution.actions:[];
  if(!actionRows.length)issues.push("SOLUÇÃO NÃO CONTÉM AÇÕES.");
  const seen=new Set<string>();let frequencySum=0;
  for(const row of actionRows){if(!record(row)){issues.push("AÇÃO DE SOLVE INVÁLIDA.");continue}const key=typeof row.action==="string"?row.action.toUpperCase():"";if(!action(key))issues.push(`AÇÃO NÃO SUPORTADA: ${key||"N/A"}.`);if(seen.has(key))issues.push(`AÇÃO DUPLICADA: ${key}.`);seen.add(key);if(!finite(row.frequencyPct)||Number(row.frequencyPct)<0||Number(row.frequencyPct)>100)issues.push(`FREQUÊNCIA INVÁLIDA EM ${key||"AÇÃO"}.`);else frequencySum+=Number(row.frequencyPct);if(!finite(row.evBb))issues.push(`EV INVÁLIDO EM ${key||"AÇÃO"}.`)}
  if(actionRows.length&&Math.abs(frequencySum-100)>1)issues.push(`FREQUÊNCIAS SOMAM ${frequencySum.toFixed(2)}%; ESPERADO APROXIMADAMENTE 100%.`);
  if(solution&&!finite(solution.nashDistancePctPot))issues.push("NASH DISTANCE AUSENTE OU INVÁLIDA.");
  if(benchmark){if(!finite(benchmark.maxFrequencyDeltaPct)||Number(benchmark.maxFrequencyDeltaPct)<0)issues.push("DELTA DE FREQUÊNCIA DO BENCHMARK INVÁLIDO.");if(!finite(benchmark.maxEvDeltaBb)||Number(benchmark.maxEvDeltaBb)<0)issues.push("DELTA DE EV DO BENCHMARK INVÁLIDO.");if(typeof benchmark.bestActionMatch!=="boolean")issues.push("BEST ACTION MATCH DO BENCHMARK INVÁLIDO.");if(!date(benchmark.validatedAt))issues.push("DATA DE VALIDAÇÃO DO BENCHMARK INVÁLIDA.");}
  if(issues.length)return{status:"REJECTED",issues};
  const normalized=raw as unknown as NormalizedSolveImport;
  const comparedActions=normalized.solution.actions.map(row=>row.action.toUpperCase() as PlayerAction);
  const evidence:SolverBenchmarkEvidence={benchmarkSource:normalized.source.name,benchmarkVersion:normalized.source.version,stateFingerprint:normalized.fingerprint,comparedActions,maxFrequencyDeltaPct:normalized.benchmark.maxFrequencyDeltaPct,maxEvDeltaBb:normalized.benchmark.maxEvDeltaBb,bestActionMatch:normalized.benchmark.bestActionMatch,nashDistancePctPot:normalized.solution.nashDistancePctPot,validatedAt:normalized.benchmark.validatedAt,usageRights:normalized.source.usageRights,rightsDetail:normalized.source.rightsDetail};
  const actions=Object.fromEntries(normalized.solution.actions.map(row=>[row.action.toUpperCase(),{frequency:row.frequencyPct,evBb:row.evBb}])) as SolverReference["actions"];
  const sizings=normalized.solution.sizings?.length?Object.fromEntries(normalized.solution.sizings.map(row=>[row.key.trim().toUpperCase(),{frequency:row.frequencyPct,evBb:row.evBb}])):undefined;
  const reference:SolverReference={fingerprint:normalized.fingerprint,source:"IMPORTED_REFERENCE",sourceDetail:`${normalized.source.name}${normalized.source.version?` ${normalized.source.version}`:""}${normalized.source.exportId?` · EXPORT ${normalized.source.exportId}`:""}`,actions,sizings,exploitabilityBb:undefined,verifiedAt:normalized.benchmark.validatedAt,benchmark:evidence};
  return{status:"ACCEPTED",issues:[],reference,normalized};
}

export function parseNormalizedSolveJson(json:string):SolveImportResult{try{return parseNormalizedSolveImport(JSON.parse(json))}catch{return{status:"REJECTED",issues:["JSON DE SOLVE INVÁLIDO OU CORROMPIDO."]}}}
