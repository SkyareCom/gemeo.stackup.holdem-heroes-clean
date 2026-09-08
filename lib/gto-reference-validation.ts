import type {PlayerAction} from "@/data/player-dna-spots";

export type SolverBenchmarkUsageRights="COMMERCIAL_AUTHORIZED"|"BENCHMARK_ONLY"|"UNKNOWN";
export type SolverBenchmarkEvidence={
  benchmarkSource:string;
  benchmarkVersion?:string;
  stateFingerprint:string;
  comparedActions:PlayerAction[];
  maxFrequencyDeltaPct:number;
  maxEvDeltaBb:number;
  bestActionMatch:boolean;
  nashDistancePctPot:number;
  validatedAt:string;
  usageRights:SolverBenchmarkUsageRights;
  rightsDetail?:string;
};

export type SolverReferenceValidationInput={
  fingerprint:string;
  sourceDetail?:string;
  verifiedAt?:string;
  benchmark?:SolverBenchmarkEvidence;
};

export type SolverReferenceValidationResult={
  status:"VALIDATED"|"REJECTED";
  issues:string[];
  thresholds:{maxFrequencyDeltaPct:number;maxEvDeltaBb:number;maxNashDistancePctPot:number};
};

export const COMMERCIAL_GTO_THRESHOLDS={
  maxFrequencyDeltaPct:.5,
  maxEvDeltaBb:.01,
  maxNashDistancePctPot:.3,
} as const;

function validDate(value:string|undefined){return Boolean(value&&!Number.isNaN(Date.parse(value)))}

export function validateCommercialSolverReference(reference:SolverReferenceValidationInput):SolverReferenceValidationResult{
  const issues:string[]=[];
  const benchmark=reference.benchmark;
  if(!reference.sourceDetail?.trim())issues.push("FONTE/PROVENIÊNCIA DA SOLUÇÃO AUSENTE.");
  if(!validDate(reference.verifiedAt))issues.push("DATA DE VERIFICAÇÃO DA REFERÊNCIA AUSENTE OU INVÁLIDA.");
  if(!benchmark){issues.push("EVIDÊNCIA DE BENCHMARK CONTRA SOLVER DE REFERÊNCIA AUSENTE.");return{status:"REJECTED",issues,thresholds:COMMERCIAL_GTO_THRESHOLDS}}
  if(!benchmark.benchmarkSource?.trim())issues.push("SOLVER/FONTE DO BENCHMARK NÃO IDENTIFICADO.");
  if(benchmark.stateFingerprint!==reference.fingerprint)issues.push("FINGERPRINT DO BENCHMARK NÃO CORRESPONDE AO NÓ DA REFERÊNCIA.");
  if(!benchmark.comparedActions?.length)issues.push("BENCHMARK NÃO COMPÕE AÇÕES COMPARADAS.");
  if(!validDate(benchmark.validatedAt))issues.push("DATA DO BENCHMARK AUSENTE OU INVÁLIDA.");
  if(benchmark.usageRights!=="COMMERCIAL_AUTHORIZED")issues.push("USO COMERCIAL DA REFERÊNCIA NÃO ESTÁ EXPLICITAMENTE AUTORIZADO; DADO RESTRITO A BENCHMARK/QUARENTENA.");
  if(benchmark.usageRights==="COMMERCIAL_AUTHORIZED"&&!benchmark.rightsDetail?.trim())issues.push("DETALHE/AUDITORIA DA AUTORIZAÇÃO COMERCIAL AUSENTE.");
  if(!Number.isFinite(benchmark.maxFrequencyDeltaPct)||benchmark.maxFrequencyDeltaPct<0||benchmark.maxFrequencyDeltaPct>COMMERCIAL_GTO_THRESHOLDS.maxFrequencyDeltaPct)issues.push(`DELTA MÁXIMO DE FREQUÊNCIA EXCEDE ${COMMERCIAL_GTO_THRESHOLDS.maxFrequencyDeltaPct.toFixed(2)} P.P.`);
  if(!Number.isFinite(benchmark.maxEvDeltaBb)||benchmark.maxEvDeltaBb<0||benchmark.maxEvDeltaBb>COMMERCIAL_GTO_THRESHOLDS.maxEvDeltaBb)issues.push(`DELTA MÁXIMO DE EV EXCEDE ${COMMERCIAL_GTO_THRESHOLDS.maxEvDeltaBb.toFixed(3)} BB.`);
  if(benchmark.bestActionMatch!==true)issues.push("MELHOR AÇÃO NÃO COINCIDE COM O SOLVER DE REFERÊNCIA.");
  if(!Number.isFinite(benchmark.nashDistancePctPot)||benchmark.nashDistancePctPot<0||benchmark.nashDistancePctPot>COMMERCIAL_GTO_THRESHOLDS.maxNashDistancePctPot)issues.push(`NASH DISTANCE EXCEDE ${COMMERCIAL_GTO_THRESHOLDS.maxNashDistancePctPot.toFixed(2)}% DO POTE.`);
  return{status:issues.length?"REJECTED":"VALIDATED",issues,thresholds:COMMERCIAL_GTO_THRESHOLDS};
}

export function validateBenchmarkOnlyEvidence(reference:SolverReferenceValidationInput):SolverReferenceValidationResult{
  const benchmark=reference.benchmark;
  if(!benchmark)return validateCommercialSolverReference(reference);
  return validateCommercialSolverReference({...reference,benchmark:{...benchmark,usageRights:"COMMERCIAL_AUTHORIZED",rightsDetail:benchmark.rightsDetail||"BENCHMARK_ONLY_VALIDATION_PATH"}});
}
