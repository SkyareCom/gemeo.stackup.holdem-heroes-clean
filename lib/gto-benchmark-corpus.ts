import type {PlayerAction} from "@/data/player-dna-spots";
import {COMMERCIAL_GTO_THRESHOLDS,validateBenchmarkOnlyEvidence,type SolverBenchmarkEvidence,type SolverBenchmarkUsageRights} from "@/lib/gto-reference-validation";

export type BenchmarkStreet="PREFLOP"|"FLOP"|"TURN"|"RIVER";
export type BenchmarkMode="CASH"|"TORNEIO";
export type BenchmarkCase={
  id:string;
  fingerprint:string;
  mode:BenchmarkMode;
  street:BenchmarkStreet;
  spotType:string;
  effectiveStackBb:number;
  sizingBucket?:string;
  icm:boolean;
  sourceDetail:string;
  verifiedAt:string;
  benchmark:SolverBenchmarkEvidence;
};

export type BenchmarkBucket={key:string;total:number;validated:number;rejected:number;passRatePct:number};
export type BenchmarkCorpusReport={
  total:number;
  validated:number;
  rejected:number;
  passRatePct:number;
  maxObservedFrequencyDeltaPct:number|null;
  maxObservedEvDeltaBb:number|null;
  maxObservedNashDistancePctPot:number|null;
  bestActionMatchRatePct:number|null;
  distinctSources:number;
  commercialAuthorizedCases:number;
  benchmarkOnlyCases:number;
  byMode:BenchmarkBucket[];
  byStreet:BenchmarkBucket[];
  bySpotType:BenchmarkBucket[];
  byStack:BenchmarkBucket[];
  bySizing:BenchmarkBucket[];
  byIcm:BenchmarkBucket[];
  byRights:BenchmarkBucket[];
  rejectedCases:{id:string;fingerprint:string;issues:string[]}[];
};

function pct(n:number,d:number){return d?Math.round((n/d)*10000)/100:0}
function stackBucket(bb:number){if(bb<=15)return"≤15BB";if(bb<=30)return"16-30BB";if(bb<=60)return"31-60BB";if(bb<=100)return"61-100BB";return">100BB"}
function group(cases:{key:string;pass:boolean}[]):BenchmarkBucket[]{const map=new Map<string,{total:number;validated:number}>();for(const item of cases){const row=map.get(item.key)??{total:0,validated:0};row.total++;if(item.pass)row.validated++;map.set(item.key,row)}return[...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({key,total:row.total,validated:row.validated,rejected:row.total-row.validated,passRatePct:pct(row.validated,row.total)}))}

export function validateBenchmarkCorpus(cases:BenchmarkCase[]):BenchmarkCorpusReport{
  const seenIds=new Set<string>(),seenFingerprints=new Set<string>(),rejectedCases:{id:string;fingerprint:string;issues:string[]}[]=[],evaluated:{item:BenchmarkCase;pass:boolean}[]=[];
  for(const item of cases){const issues:string[]=[];
    if(!item.id.trim())issues.push("ID DO CASO AUSENTE.");
    if(seenIds.has(item.id))issues.push("ID DE CASO DUPLICADO.");else seenIds.add(item.id);
    if(seenFingerprints.has(item.fingerprint))issues.push("FINGERPRINT DUPLICADO NO CORPUS.");else seenFingerprints.add(item.fingerprint);
    if(!Number.isFinite(item.effectiveStackBb)||item.effectiveStackBb<=0)issues.push("STACK EFETIVO INVÁLIDO.");
    if(item.benchmark.stateFingerprint!==item.fingerprint)issues.push("FINGERPRINT DO CASO DIVERGE DO BENCHMARK.");
    const validation=validateBenchmarkOnlyEvidence({fingerprint:item.fingerprint,sourceDetail:item.sourceDetail,verifiedAt:item.verifiedAt,benchmark:item.benchmark});
    issues.push(...validation.issues);
    const pass=issues.length===0;evaluated.push({item,pass});if(!pass)rejectedCases.push({id:item.id,fingerprint:item.fingerprint,issues});
  }
  const valid=evaluated.filter(x=>x.pass),total=evaluated.length;
  const finiteMax=(xs:number[])=>xs.length?Math.max(...xs):null;
  const sourceSet=new Set(valid.map(x=>`${x.item.benchmark.benchmarkSource}::${x.item.benchmark.benchmarkVersion??""}`));
  return{
    total,validated:valid.length,rejected:total-valid.length,passRatePct:pct(valid.length,total),
    maxObservedFrequencyDeltaPct:finiteMax(evaluated.map(x=>x.item.benchmark.maxFrequencyDeltaPct).filter(Number.isFinite)),
    maxObservedEvDeltaBb:finiteMax(evaluated.map(x=>x.item.benchmark.maxEvDeltaBb).filter(Number.isFinite)),
    maxObservedNashDistancePctPot:finiteMax(evaluated.map(x=>x.item.benchmark.nashDistancePctPot).filter(Number.isFinite)),
    bestActionMatchRatePct:total?pct(evaluated.filter(x=>x.item.benchmark.bestActionMatch===true).length,total):null,
    distinctSources:sourceSet.size,
    commercialAuthorizedCases:valid.filter(x=>x.item.benchmark.usageRights==="COMMERCIAL_AUTHORIZED").length,
    benchmarkOnlyCases:valid.filter(x=>x.item.benchmark.usageRights==="BENCHMARK_ONLY").length,
    byMode:group(evaluated.map(x=>({key:x.item.mode,pass:x.pass}))),
    byStreet:group(evaluated.map(x=>({key:x.item.street,pass:x.pass}))),
    bySpotType:group(evaluated.map(x=>({key:x.item.spotType.trim().toUpperCase()||"UNSPECIFIED",pass:x.pass}))),
    byStack:group(evaluated.map(x=>({key:stackBucket(x.item.effectiveStackBb),pass:x.pass}))),
    bySizing:group(evaluated.map(x=>({key:(x.item.sizingBucket??"N/A").trim().toUpperCase(),pass:x.pass}))),
    byIcm:group(evaluated.map(x=>({key:x.item.icm?"ICM":"CHIP_EV",pass:x.pass}))),
    byRights:group(evaluated.map(x=>({key:x.item.benchmark.usageRights,pass:x.pass}))),
    rejectedCases,
  };
}

export type BenchmarkCoveragePolicy={
  requireModes:BenchmarkMode[];
  requireStreets:BenchmarkStreet[];
  requireIcmAndChipEv:boolean;
  minimumSpotTypes:number;
  minimumStackBuckets:number;
  minimumDistinctSources:number;
};
export const DEFAULT_COMMERCIAL_COVERAGE:BenchmarkCoveragePolicy={requireModes:["CASH","TORNEIO"],requireStreets:["PREFLOP","FLOP","TURN","RIVER"],requireIcmAndChipEv:true,minimumSpotTypes:8,minimumStackBuckets:4,minimumDistinctSources:1};
export type CommercialBenchmarkGate={status:"PASS"|"FAIL";issues:string[];report:BenchmarkCorpusReport};
export function commercialBenchmarkGate(cases:BenchmarkCase[],minimumCases=1000,minimumPassRatePct=99,coverage:BenchmarkCoveragePolicy|null=DEFAULT_COMMERCIAL_COVERAGE):CommercialBenchmarkGate{
  const report=validateBenchmarkCorpus(cases),issues:string[]=[];
  if(report.total<minimumCases)issues.push(`CORPUS INSUFICIENTE: ${report.total}/${minimumCases} CASOS.`);
  if(report.passRatePct<minimumPassRatePct)issues.push(`TAXA DE APROVAÇÃO ${report.passRatePct.toFixed(2)}% ABAIXO DO MÍNIMO ${minimumPassRatePct.toFixed(2)}%.`);
  if(report.maxObservedFrequencyDeltaPct!==null&&report.maxObservedFrequencyDeltaPct>COMMERCIAL_GTO_THRESHOLDS.maxFrequencyDeltaPct)issues.push("CORPUS CONTÉM DELTA DE FREQUÊNCIA ACIMA DO LIMITE COMERCIAL.");
  if(report.maxObservedEvDeltaBb!==null&&report.maxObservedEvDeltaBb>COMMERCIAL_GTO_THRESHOLDS.maxEvDeltaBb)issues.push("CORPUS CONTÉM DELTA DE EV ACIMA DO LIMITE COMERCIAL.");
  if(report.maxObservedNashDistancePctPot!==null&&report.maxObservedNashDistancePctPot>COMMERCIAL_GTO_THRESHOLDS.maxNashDistancePctPot)issues.push("CORPUS CONTÉM NASH DISTANCE ACIMA DO LIMITE COMERCIAL.");
  if(coverage){
    for(const mode of coverage.requireModes)if(!report.byMode.some(x=>x.key===mode&&x.validated>0))issues.push(`COBERTURA AUSENTE PARA MODO ${mode}.`);
    for(const street of coverage.requireStreets)if(!report.byStreet.some(x=>x.key===street&&x.validated>0))issues.push(`COBERTURA AUSENTE PARA STREET ${street}.`);
    if(coverage.requireIcmAndChipEv){if(!report.byIcm.some(x=>x.key==="ICM"&&x.validated>0))issues.push("COBERTURA ICM AUSENTE.");if(!report.byIcm.some(x=>x.key==="CHIP_EV"&&x.validated>0))issues.push("COBERTURA CHIP EV AUSENTE.")}
    if(report.bySpotType.filter(x=>x.validated>0).length<coverage.minimumSpotTypes)issues.push(`DIVERSIDADE DE SPOT TYPES INSUFICIENTE: ${report.bySpotType.filter(x=>x.validated>0).length}/${coverage.minimumSpotTypes}.`);
    if(report.byStack.filter(x=>x.validated>0).length<coverage.minimumStackBuckets)issues.push(`COBERTURA DE STACKS INSUFICIENTE: ${report.byStack.filter(x=>x.validated>0).length}/${coverage.minimumStackBuckets} FAIXAS.`);
    if(report.distinctSources<coverage.minimumDistinctSources)issues.push(`FONTES DE BENCHMARK INSUFICIENTES: ${report.distinctSources}/${coverage.minimumDistinctSources}.`);
  }
  return{status:issues.length?"FAIL":"PASS",issues,report};
}

export function benchmarkEvidenceFromActions(args:{source:string;version?:string;fingerprint:string;validatedAt:string;actions:PlayerAction[];maxFrequencyDeltaPct:number;maxEvDeltaBb:number;bestActionMatch:boolean;nashDistancePctPot:number;usageRights:SolverBenchmarkUsageRights;rightsDetail:string}):SolverBenchmarkEvidence{return{benchmarkSource:args.source,benchmarkVersion:args.version,stateFingerprint:args.fingerprint,comparedActions:[...args.actions],maxFrequencyDeltaPct:args.maxFrequencyDeltaPct,maxEvDeltaBb:args.maxEvDeltaBb,bestActionMatch:args.bestActionMatch,nashDistancePctPot:args.nashDistancePctPot,validatedAt:args.validatedAt,usageRights:args.usageRights,rightsDetail:args.rightsDetail}}
