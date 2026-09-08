import type {GameMode,PlayerDnaSpot} from "@/data/player-dna-spots";
import {describeSpot} from "@/lib/player-dna-sampler";
import {exactSpotFingerprint} from "@/lib/spot-identity";
import {isCertifiedTrainingSpot} from "@/lib/player-dna-validated-spot";

const SEEN_REGISTRY_KEY="stackup.player-dna.seen-spots.v2";
const SESSION_SELECTION_PREFIX="stackup.player-dna.analysis-ready-session.v1.";
type SeenRegistry=Record<string,string>;

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function loadSeen():SeenRegistry{if(!browser())return{};try{const raw=window.localStorage.getItem(SEEN_REGISTRY_KEY);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}}
function saveSeen(registry:SeenRegistry){if(!browser())return;try{window.localStorage.setItem(SEEN_REGISTRY_KEY,JSON.stringify(registry))}catch{}}
function sessionKey(mode:GameMode,seed:number){return`${SESSION_SELECTION_PREFIX}${mode}.${seed}`}
function loadSelection(mode:GameMode,seed:number){if(!browser())return[] as string[];try{const raw=window.localStorage.getItem(sessionKey(mode,seed));const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed.filter((value):value is string=>typeof value==="string"):[]}catch{return[]}}
function saveSelection(mode:GameMode,seed:number,fingerprints:string[]){if(!browser())return;try{window.localStorage.setItem(sessionKey(mode,seed),JSON.stringify(fingerprints))}catch{}}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
function dimensionKeys(spot:PlayerDnaSpot){const d=describeSpot(spot);return[`street:${d.street}`,`pos:${d.heroPosition}`,`stack:${d.stackBand}`,`heads:${d.heads}`,`state:${d.positionState}`,`pot:${d.potType}`,`theme:${d.theme}`,`texture:${d.texture}`,`sizing:${d.sizing}`,`phase:${d.tournamentPhase}`,`icm:${d.icm}`,`ante:${d.ante}`,`profile:${d.gameProfile}`,`ante-mode:${d.anteMode}`]}

export function analysisReadyBank(bank:PlayerDnaSpot[],mode?:GameMode){
  return bank.filter(spot=>(!mode||spot.mode===mode)&&isCertifiedTrainingSpot(spot));
}

export function buildAnalysisReadySpotSession(bank:PlayerDnaSpot[],mode:GameMode,count:number,seed=Date.now()):PlayerDnaSpot[]{
  if(count<=0)return[];
  const candidates=analysisReadyBank(bank,mode);
  if(!candidates.length)return[];
  const identity=`ANALYSIS-${seed}`;
  const registry=loadSeen();
  const blocked=new Set(Object.entries(registry).filter(([,owner])=>owner!==identity).map(([fingerprint])=>fingerprint));
  let pool=candidates.map(spot=>({spot,fingerprint:exactSpotFingerprint(spot)})).filter(item=>!blocked.has(item.fingerprint));
  if(!pool.length)pool=candidates.map(spot=>({spot,fingerprint:exactSpotFingerprint(spot)}));
  const byFingerprint=new Map(pool.map(item=>[item.fingerprint,item]));
  const persisted=loadSelection(mode,seed).filter(fingerprint=>byFingerprint.has(fingerprint));
  const selected:PlayerDnaSpot[]=[];
  const selectedFingerprints:string[]=[];
  const selectedSet=new Set<string>();
  const counts=new Map<string,number>();

  for(const fingerprint of persisted.slice(0,count)){
    const item=byFingerprint.get(fingerprint);if(!item)continue;
    selected.push(item.spot);selectedFingerprints.push(fingerprint);selectedSet.add(fingerprint);
    dimensionKeys(item.spot).forEach(key=>counts.set(key,(counts.get(key)??0)+1));
  }

  for(let slot=selected.length;slot<count&&selected.length<pool.length;slot++){
    let best:{spot:PlayerDnaSpot;fingerprint:string}|null=null;
    let bestScore=Number.POSITIVE_INFINITY;
    for(const item of pool){
      if(selectedSet.has(item.fingerprint))continue;
      const balance=dimensionKeys(item.spot).reduce((sum,key)=>sum+(counts.get(key)??0),0);
      const tie=(hashText(`${seed}|${slot}|${item.fingerprint}`)%100000)/1000000;
      const score=balance+tie;
      if(score<bestScore){bestScore=score;best=item}
    }
    if(!best)break;
    selected.push(best.spot);selectedFingerprints.push(best.fingerprint);selectedSet.add(best.fingerprint);
    dimensionKeys(best.spot).forEach(key=>counts.set(key,(counts.get(key)??0)+1));
  }

  if(browser()&&selectedFingerprints.length){selectedFingerprints.forEach(fingerprint=>registry[fingerprint]=identity);saveSeen(registry);saveSelection(mode,seed,selectedFingerprints)}
  return selected;
}
