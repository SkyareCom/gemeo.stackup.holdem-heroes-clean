import {buildBalancedSpotSession as buildOpeningSession,describeSpot} from "../lib/player-dna-generation";
import {buildBalancedSpotSession as buildCoreSession} from "../lib/player-dna-sampler";
import {exactSpotFingerprint} from "../lib/spot-identity";
import {playerDnaSpots,type GameMode} from "../data/player-dna-spots";

type Store=Map<string,string>;
const store:Store=new Map();
const localStorage={
  getItem(key:string){return store.has(key)?store.get(key)!:null},
  setItem(key:string,value:string){store.set(key,String(value))},
  removeItem(key:string){store.delete(key)},
  clear(){store.clear()},
  key(index:number){return [...store.keys()][index]??null},
  get length(){return store.size},
};
(globalThis as unknown as {window:unknown}).window={localStorage};

const OPENINGS=5000;
const fingerprints=new Set<string>();
for(let i=0;i<OPENINGS;i++){
  const mode:GameMode=i%2===0?"CASH":"TORNEIO";
  const seed=0x100000+i*7919;
  const generated=buildCoreSession(playerDnaSpots,mode,1,seed,[]);
  if(generated.length!==1)throw new Error(`ABERTURA ${i+1}: NENHUM SPOT GERADO`);
  const fingerprint=exactSpotFingerprint(generated[0]);
  if(fingerprints.has(fingerprint))throw new Error(`ABERTURA ${i+1}: FINGERPRINT REPETIDA ${fingerprint}`);
  fingerprints.add(fingerprint);
}

// Segunda fase: valida que o primeiro spot também percorre a matriz estratégica.
store.clear();
const streets=new Set<string>();
const modes=new Set<string>();
const tableSizes=new Set<string>();
const heads=new Set<string>();
const phases=new Set<string>();
const themes=new Set<string>();
let icm=0;
let allIn=0;
let multiway=0;
const MATRIX_OPENINGS=256;
for(let i=0;i<MATRIX_OPENINGS;i++){
  const mode:GameMode=i%2===0?"CASH":"TORNEIO";
  const seed=0x700000+i*3571;
  const generated=buildOpeningSession(playerDnaSpots,mode,1,seed,[]);
  if(generated.length!==1)throw new Error(`MATRIZ ${i+1}: NENHUM SPOT GERADO`);
  const spot=generated[0];
  streets.add(spot.street);modes.add(spot.mode);
  const table=spot.scenario.find(item=>item.endsWith("-MAX"));if(table)tableSizes.add(table);
  const dimensions=describeSpot(spot);
  heads.add(dimensions.heads);phases.add(dimensions.tournamentPhase);themes.add(dimensions.theme);
  if(dimensions.icm)icm++;
  if(spot.players.some(player=>player.action==="ALL-IN"))allIn++;
  if(dimensions.heads==="MULTIWAY")multiway++;
}

function requireCoverage(label:string,actual:Set<string>,required:string[]){
  for(const value of required)if(!actual.has(value))throw new Error(`${label}: COBERTURA AUSENTE ${value}`);
}
requireCoverage("STREETS",streets,["PREFLOP","FLOP","TURN","RIVER"]);
requireCoverage("MODOS",modes,["CASH","TORNEIO"]);
requireCoverage("MESAS",tableSizes,["6-MAX","8-MAX","9-MAX","10-MAX"]);
requireCoverage("HEADS",heads,["HEADS-UP","MULTIWAY"]);
if(icm===0)throw new Error("ICM: NENHUM SPOT ICM FOI GERADO");
if(allIn===0)throw new Error("ALL-IN: NENHUM SPOT COM ALL-IN FOI GERADO");
if(multiway===0)throw new Error("MULTIWAY: NENHUM SPOT MULTIWAY FOI GERADO");

console.log(JSON.stringify({
  persistentOpenings:OPENINGS,
  uniqueFingerprints:fingerprints.size,
  duplicates:OPENINGS-fingerprints.size,
  openingMatrixSample:MATRIX_OPENINGS,
  streets:[...streets].sort(),
  modes:[...modes].sort(),
  tableSizes:[...tableSizes].sort(),
  heads:[...heads].sort(),
  phases:[...phases].sort(),
  themes:[...themes].sort(),
  icmSpots:icm,
  allInSpots:allIn,
  multiwaySpots:multiway,
},null,2));
