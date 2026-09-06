import type {GameMode,PlayerAction,PlayerDnaSpot} from "@/data/player-dna-spots";
import {buildBalancedSpotSession as buildCoreSession,describeSpot} from "@/lib/player-dna-sampler";

export {describeSpot};

type PriorAnswer={action:PlayerAction};
const OPENING_COUNTER_KEY="stackup.player-dna.opening-matrix-counter.v1";
const OPENING_OFFSET_PREFIX="stackup.player-dna.opening-matrix-offset.";
const OPENING_MATRIX_SIZE=64;

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
  ponto inicial de cada nova sessão por uma matriz de 64 estados para que o
  PRIMEIRO spot também percorra streets, tamanhos de mesa, posições, stacks,
  fases e arquétipos, em vez de começar sempre no mesmo quadrante do espaço.
  O offset fica preso ao seed da sessão, portanto re-renders não mudam a mão.
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
  return generated.slice(offset,offset+count);
}
