import type {GameMode,PlayerDnaSpot} from "@/data/player-dna-spots";
import {validateAiSpotForAnalysis} from "@/lib/ai-spot-analysis-gate";
import {describeSpot} from "@/lib/player-dna-sampler";
import {exactSpotFingerprint} from "@/lib/spot-identity";

const SEEN_REGISTRY_KEY="stackup.player-dna.seen-spots.v2";
type SeenRegistry=Record<string,string>;

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function loadSeen():SeenRegistry{if(!browser())return{};try{const raw=window.localStorage.getItem(SEEN_REGISTRY_KEY);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}}
function saveSeen(registry:SeenRegistry){if(!browser())return;try{window.localStorage.setItem(SEEN_REGISTRY_KEY,JSON.stringify(registry))}catch{}}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
function dimensionKeys(spot:PlayerDnaSpot){const d=describeSpot(spot);return[`street:${d.street}`,`pos:${d.heroPosition}`,`stack:${d.stackBand}`,`heads:${d.heads}`,`state:${d.positionState}`,`pot:${d.potType}`,`theme:${d.theme}`,`texture:${d.texture}`,`sizing:${d.sizing}`,`phase:${d.tournamentPhase}`,`icm:${d.icm}`,`ante:${d.ante}`,`profile:${d.gameProfile}`,`ante-mode:${d.anteMode}`]}

export function analysisReadyBank(bank:PlayerDnaSpot[],mode?:GameMode){
  return bank.filter(spot=>(!mode||spot.mode===mode)&&validateAiSpotForAnalysis(spot).status==="PASS");
}

export function buildAnalysisReadySpotSession(bank:PlayerDnaSpot[],mode:GameMode,count:number,seed=Date.now()):PlayerDnaSpot[]{
  if(count<=0)return[];
  const candidates=analysisReadyBank(bank,mode);
  if(!candidates.length)return[];
  const identity=`ANALYSIS-${seed}`;
  const registry=loadSeen();
  const blocked=new Set(Object.entries(registry).filter(([,owner])=>owner!==identity).map(([fingerprint])=>fingerprint));
  const pool=candidates.map(spot=>({spot,fingerprint:exactSpotFingerprint(spot)})).filter(item=>!blocked.has(item.fingerprint));
  const selected:PlayerDnaSpot[]=[];
  const selectedFingerprints=new Set<string>();
  const counts=new Map<string,number>();
  for(let slot=0;slot<count&&selected.length<pool.length;slot++){
    let best:{spot:PlayerDnaSpot;fingerprint:string}|null=null;
    let bestScore=Number.POSITIVE_INFINITY;
    for(const item of pool){
      if(selectedFingerprints.has(item.fingerprint))continue;
      const balance=dimensionKeys(item.spot).reduce((sum,key)=>sum+(counts.get(key)??0),0);
      const tie=(hashText(`${seed}|${slot}|${item.fingerprint}`)%100000)/1000000;
      const score=balance+tie;
      if(score<bestScore){bestScore=score;best=item}
    }
    if(!best)break;
    selected.push(best.spot);selectedFingerprints.add(best.fingerprint);
    dimensionKeys(best.spot).forEach(key=>counts.set(key,(counts.get(key)??0)+1));
  }
  if(browser()&&selectedFingerprints.size){selectedFingerprints.forEach(fingerprint=>registry[fingerprint]=identity);saveSeen(registry)}
  return selected;
}
