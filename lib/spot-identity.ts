import type {PlayerDnaSpot} from "@/data/player-dna-spots";

type HistoryItem={position:string;action:string;value:number};
type SpotWithHistory=PlayerDnaSpot&{actionHistory?:HistoryItem[];heroToCall?:number;currentBet?:number};

function n(value:number){return Number.isFinite(value)?Math.round(value*10000)/10000:0}
function t(value:string|undefined){return(value??"").trim().toUpperCase()}
function fnv64(value:string,offset:bigint){let hash=offset;const prime=1099511628211n;for(let i=0;i<value.length;i++){hash^=BigInt(value.charCodeAt(i));hash=BigInt.asUintN(64,hash*prime)}return hash.toString(16).padStart(16,"0")}

export function canonicalSpotState(spot:PlayerDnaSpot){
  const extended=spot as SpotWithHistory;
  const hero=spot.players.find(player=>player.hero)??spot.players[0];
  const players=spot.players.map(player=>({position:t(player.position),stack:n(player.stack),action:t(player.action),value:n(player.value),hero:Boolean(player.hero)}));
  const history=(extended.actionHistory??spot.players.filter(player=>!player.hero&&t(player.action)!=="---").map(player=>({position:player.position,action:player.action,value:player.value}))).map(item=>({position:t(item.position),action:t(item.action),value:n(item.value)}));
  const sides=(spot.pot.sides??[]).map(side=>({value:n(side.value),players:[...side.players].map(t).sort()}));
  return{
    mode:spot.mode,
    profile:t(spot.gameProfile),
    anteMode:t(spot.anteMode),
    street:spot.street,
    hero:{position:t(hero?.position),stack:n(hero?.stack??0),cards:t(spot.heroCards)},
    board:t(spot.board),
    players,
    pot:{main:n(spot.pot.main),sides},
    history,
    heroToCall:n(extended.heroToCall??0),
    currentBet:n(extended.currentBet??0),
    legalActions:[...spot.actions].map(t).sort(),
    scenario:[...spot.scenario].map(t).sort(),
  };
}

export function exactSpotFingerprint(spot:PlayerDnaSpot){
  const canonical=JSON.stringify(canonicalSpotState(spot));
  return`spot-${fnv64(canonical,14695981039346656037n)}${fnv64(canonical,1099511628211n)}`;
}
