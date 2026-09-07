import type {GameMode,PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";
import {buildBalancedSpotSession as buildCoreSession,describeSpot} from "./player-dna-sampler";

export {describeSpot};

type PriorAnswer={action:PlayerAction};
type SpotWithLegalActions=PlayerDnaSpot&{legalActions?:PlayerAction[]};
const ALL_ACTIONS:PlayerAction[]=["FOLD","CHECK","CALL","BET","RAISE","ALL-IN"];
const OPENING_COUNTER_KEY="stackup.player-dna.opening-matrix-counter.v1";
const OPENING_OFFSET_PREFIX="stackup.player-dna.opening-matrix-offset.";
const OPENING_MATRIX_SIZE=16;

function browserStorage(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}

function openingOffset(seed:number){
  if(!browserStorage())return Math.abs(seed)%OPENING_MATRIX_SIZE;
  const key=`${OPENING_OFFSET_PREFIX}${seed}`;
  const existing=window.localStorage.getItem(key);
  if(existing!==null)return Number(existing)||0;
  let counter=0;
  try{counter=Number(window.localStorage.getItem(OPENING_COUNTER_KEY)??"0")||0}catch{}
  const offset=counter%OPENING_MATRIX_SIZE;
  try{
    window.localStorage.setItem(OPENING_COUNTER_KEY,String(counter+1));
    window.localStorage.setItem(key,String(offset));
  }catch{}
  return offset;
}

/*
  O sampler central já impede fingerprints repetidas. Esta camada desloca o
  ponto inicial de cada nova sessão por uma matriz de 16 estados para que o
  PRIMEIRO spot percorra os quatro streets, os quatro tamanhos de mesa e os
  oito arquétipos básicos sem começar sempre no mesmo quadrante do espaço.
  O offset fica preso ao seed da sessão, portanto re-renders não mudam a mão.

  REGRA DE UX DO PLAYER DNA: AS SEIS AÇÕES DEVEM SEMPRE SER MOSTRADAS AO
  USUÁRIO, SEM ENTREGAR QUAIS SÃO AS AÇÕES LEGAIS/RECOMENDADAS DO SPOT.
  O CONJUNTO LEGAL REAL É PRESERVADO EM legalActions EXCLUSIVAMENTE PARA O
  MOTOR DE DIAGNÓSTICO JULGAR A ESCOLHA DEPOIS DA RESPOSTA.
*/
export function buildBalancedSpotSession(
  bank:PlayerDnaSpot[],
  mode:GameMode,
  count:number,
  seed=Date.now(),
  answers:PriorAnswer[]=[]
):PlayerDnaSpot[]{
  if(count<=0)return[];
  const offset=openingOffset(seed);
  const padding:PriorAnswer[]=Array.from({length:offset},()=>({action:"CHECK" as PlayerAction}));
  const generated=buildCoreSession(bank,mode,count+offset,seed,[...padding,...answers]);
  return generated.slice(offset,offset+count).map(spot=>{
    const original=spot as SpotWithLegalActions;
    const legalActions=[...(original.legalActions??spot.actions)];
    return {...spot,actions:[...ALL_ACTIONS],legalActions} as SpotWithLegalActions;
  });
}
