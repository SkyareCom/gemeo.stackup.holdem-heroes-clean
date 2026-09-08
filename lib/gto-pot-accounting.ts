import type {SolverSpotState} from "@/lib/player-dna-solver-v2";

export type SidePotLayer={
  index:number;
  from:number;
  to:number;
  amountBb:number;
  contributors:string[];
  eligible:string[];
};

export type PotAccountingResult={
  status:"OK"|"UNAVAILABLE"|"INVALID";
  pots:SidePotLayer[];
  refunds:{position:string;amountBb:number}[];
  totalCommittedBb:number;
  totalPotBb:number;
  declaredPotBb:number;
  reconciliationDeltaBb:number|null;
  issues:string[];
};

const round=(v:number,p=4)=>{const f=10**p;return Math.round(v*f)/f};
const upper=(v:string)=>v.trim().toUpperCase();

export function buildExactPotAccounting(state:SolverSpotState):PotAccountingResult{
  const issues:string[]=[];
  const commitments=state.commitments;
  if(!commitments||!Object.keys(commitments).length)return{status:"UNAVAILABLE",pots:[],refunds:[],totalCommittedBb:0,totalPotBb:0,declaredPotBb:Math.max(0,state.pot)+Math.max(0,...(state.potSides??[]).map(p=>p.value),0),reconciliationDeltaBb:null,issues:["COMMITMENTS TOTAIS POR JOGADOR AUSENTES; SIDE POTS NÃO SÃO INFERIDOS A PARTIR DA AÇÃO DA STREET."]};
  const playerPositions=new Set(state.players.map(p=>upper(p.position)));
  playerPositions.add(upper(state.hero.position));
  const rows=Object.entries(commitments).map(([position,value])=>({position:upper(position),amount:Number(value)}));
  if(rows.some(row=>!playerPositions.has(row.position))){issues.push("COMMITMENT INFORMADO PARA POSIÇÃO QUE NÃO EXISTE NO NÓ.")}
  if(rows.some(row=>!Number.isFinite(row.amount)||row.amount<0))return{status:"INVALID",pots:[],refunds:[],totalCommittedBb:0,totalPotBb:0,declaredPotBb:Math.max(0,state.pot)+(state.potSides??[]).reduce((s,p)=>s+Math.max(0,p.value),0),reconciliationDeltaBb:null,issues:[...issues,"COMMITMENTS DEVEM SER NÚMEROS FINITOS E NÃO NEGATIVOS."]};
  const folded=new Set(state.players.filter(p=>upper(p.action)==="FOLD").map(p=>upper(p.position)));
  const levels=[...new Set(rows.map(r=>round(r.amount)).filter(v=>v>0))].sort((a,b)=>a-b);
  const pots:SidePotLayer[]=[],refunds:{position:string;amountBb:number}[]=[];
  let previous=0;
  for(const level of levels){
    const contributors=rows.filter(row=>row.amount+1e-9>=level).map(row=>row.position);
    const width=level-previous;
    if(width<=0){previous=level;continue}
    const layerAmount=round(width*contributors.length);
    if(contributors.length===1){refunds.push({position:contributors[0],amountBb:layerAmount});previous=level;continue}
    const eligible=contributors.filter(position=>!folded.has(position));
    if(!eligible.length)return{status:"INVALID",pots,refunds,totalCommittedBb:round(rows.reduce((s,r)=>s+r.amount,0)),totalPotBb:round(pots.reduce((s,p)=>s+p.amountBb,0)),declaredPotBb:Math.max(0,state.pot)+(state.potSides??[]).reduce((s,p)=>s+Math.max(0,p.value),0),reconciliationDeltaBb:null,issues:[...issues,`CAMADA ${pots.length+1} NÃO POSSUI JOGADOR ELEGÍVEL AO SHOWDOWN.`]};
    pots.push({index:pots.length,from:round(previous),to:round(level),amountBb:layerAmount,contributors,eligible});
    previous=level;
  }
  const totalCommittedBb=round(rows.reduce((s,r)=>s+r.amount,0));
  const totalPotBb=round(pots.reduce((s,p)=>s+p.amountBb,0));
  const declaredPotBb=round(Math.max(0,state.pot)+(state.potSides??[]).reduce((s,p)=>s+Math.max(0,p.value),0));
  const reconciliationDeltaBb=round(declaredPotBb-totalPotBb);
  if(Math.abs(reconciliationDeltaBb)>.01)issues.push(`POTE DECLARADO (${declaredPotBb.toFixed(2)} BB) NÃO RECONCILIA COM COMMITMENTS APÓS REFUNDS (${totalPotBb.toFixed(2)} BB); DELTA ${reconciliationDeltaBb.toFixed(2)} BB.`);
  if(refunds.length)issues.push(`EXCESSO NÃO CONTESTADO IDENTIFICADO COMO REFUND: ${refunds.map(r=>`${r.position} ${r.amountBb.toFixed(2)} BB`).join(" · ")}.`);
  return{status:"OK",pots,refunds,totalCommittedBb,totalPotBb,declaredPotBb,reconciliationDeltaBb,issues};
}
