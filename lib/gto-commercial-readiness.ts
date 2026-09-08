import {commercialBenchmarkGate,type BenchmarkCase,type BenchmarkCoveragePolicy,DEFAULT_COMMERCIAL_COVERAGE} from "@/lib/gto-benchmark-corpus";

export type CommercialReadinessInput={
  benchmarkCases:BenchmarkCase[];
  activeCommercialReferences:number;
  quarantinedReferences:number;
  minimumCases?:number;
  minimumPassRatePct?:number;
  coverage?:BenchmarkCoveragePolicy|null;
};

export type CommercialReadinessReport={
  status:"READY"|"NOT_READY";
  claimLevel:"NO_GTO_FIDELITY_CLAIM"|"BENCHMARKED_WITHIN_SCOPE";
  issues:string[];
  metrics:{
    benchmarkCases:number;
    validatedCases:number;
    passRatePct:number;
    activeCommercialReferences:number;
    quarantinedReferences:number;
    distinctSources:number;
    commercialAuthorizedBenchmarkCases:number;
  };
};

export function evaluateCommercialGtoReadiness(input:CommercialReadinessInput):CommercialReadinessReport{
  const gate=commercialBenchmarkGate(input.benchmarkCases,input.minimumCases??1000,input.minimumPassRatePct??99,input.coverage===undefined?DEFAULT_COMMERCIAL_COVERAGE:input.coverage);
  const issues=[...gate.issues];
  if(!Number.isInteger(input.activeCommercialReferences)||input.activeCommercialReferences<=0)issues.push("NENHUMA REFERÊNCIA GTO COM DIREITO COMERCIAL ESTÁ ATIVA NO CATÁLOGO.");
  if(!Number.isInteger(input.quarantinedReferences)||input.quarantinedReferences<0)issues.push("CONTAGEM DE REFERÊNCIAS EM QUARENTENA INVÁLIDA.");
  if(gate.report.commercialAuthorizedCases<=0)issues.push("CORPUS NÃO CONTÉM CASOS COM AUTORIZAÇÃO COMERCIAL DOCUMENTADA.");
  if(gate.report.validated>0&&input.activeCommercialReferences>gate.report.commercialAuthorizedCases)issues.push("HÁ MAIS REFERÊNCIAS COMERCIAIS ATIVAS DO QUE EVIDÊNCIAS COMERCIAIS VALIDADAS NO CORPUS.");
  const status=issues.length?"NOT_READY":"READY";
  return{
    status,
    claimLevel:status==="READY"?"BENCHMARKED_WITHIN_SCOPE":"NO_GTO_FIDELITY_CLAIM",
    issues,
    metrics:{
      benchmarkCases:gate.report.total,
      validatedCases:gate.report.validated,
      passRatePct:gate.report.passRatePct,
      activeCommercialReferences:input.activeCommercialReferences,
      quarantinedReferences:input.quarantinedReferences,
      distinctSources:gate.report.distinctSources,
      commercialAuthorizedBenchmarkCases:gate.report.commercialAuthorizedCases,
    },
  };
}

export function commercialClaimText(report:CommercialReadinessReport){
  if(report.status!=="READY")return"ANÁLISE GTO NÃO CERTIFICADA PARA ALEGAÇÃO COMERCIAL DE FIDELIDADE.";
  return`BENCHMARK VALIDADO DENTRO DO ESCOPO TESTADO: ${report.metrics.validatedCases} CASOS · ${report.metrics.passRatePct.toFixed(2)}% DENTRO DAS TOLERÂNCIAS DEFINIDAS.`;
}
