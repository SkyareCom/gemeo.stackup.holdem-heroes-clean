export type WeightedRangeEntry={hand:string;weight:number};
export type WeightedCombo={cards:[string,string];weight:number;source:string};
export type NormalizedRange={combos:WeightedCombo[];totalWeight:number;blockedCombos:number;invalidEntries:string[]};

const RANKS="23456789TJQKA";
const SUITS=["S","H","D","C"] as const;
const CARD_RE=/^(10|[2-9TJQKA])([SHDC♠♥♦♣])$/i;
const CLASS_RE=/^(10|[2-9TJQKA])(10|[2-9TJQKA])([SO])?$/i;
const suitMap:Record<string,string>={"♠":"S","♥":"H","♦":"D","♣":"C"};

export function canonicalCard(raw:string){const value=raw.trim().toUpperCase();const match=value.match(CARD_RE);if(!match)return null;const rank=match[1]==="10"?"T":match[1];const suit=suitMap[match[2]]??match[2];return `${rank}${suit}`}
function rankIndex(rank:string){return RANKS.indexOf(rank)}
function canonicalClass(raw:string){const value=raw.trim().toUpperCase().replace(/10/g,"T");const m=value.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?$/);if(!m)return null;let a=m[1],b=m[2],kind=m[3]??"";if(a===b){if(kind)return null;return `${a}${b}`};if(rankIndex(a)<rankIndex(b))[a,b]=[b,a];if(!kind)return null;return `${a}${b}${kind}`}
function exactCombo(raw:string):[string,string]|null{const clean=raw.trim().toUpperCase().replace(/[,_/\-]+/g," ").replace(/10/g,"T");const parts=clean.split(/\s+/).filter(Boolean);if(parts.length===2){const a=canonicalCard(parts[0]),b=canonicalCard(parts[1]);if(a&&b&&a!==b)return[a,b]};const compact=clean.replace(/\s+/g,"");const m=compact.match(/^([2-9TJQKA][SHDC♠♥♦♣])([2-9TJQKA][SHDC♠♥♦♣])$/);if(!m)return null;const a=canonicalCard(m[1]),b=canonicalCard(m[2]);return a&&b&&a!==b?[a,b]:null}
function comboKey(cards:[string,string]){return [...cards].sort().join("")}
export function expandRangeHand(raw:string):[string,string][]{const exact=exactCombo(raw);if(exact)return[exact];const cls=canonicalClass(raw);if(!cls)return[];const r1=cls[0],r2=cls[1],kind=cls[2]??"";const out:[string,string][]=[];if(r1===r2){for(let i=0;i<SUITS.length;i++)for(let j=i+1;j<SUITS.length;j++)out.push([`${r1}${SUITS[i]}`,`${r2}${SUITS[j]}`]);return out}if(kind==="S"){for(const s of SUITS)out.push([`${r1}${s}`,`${r2}${s}`]);return out}if(kind==="O"){for(const s1 of SUITS)for(const s2 of SUITS)if(s1!==s2)out.push([`${r1}${s1}`,`${r2}${s2}`]);return out}return out}
export function normalizeWeightedRange(entries:WeightedRangeEntry[],deadCards:string[]=[]):NormalizedRange{const dead=new Set(deadCards.map(canonicalCard).filter(Boolean) as string[]),invalidEntries:string[]=[],map=new Map<string,WeightedCombo>(),rawExpanded:WeightedCombo[]=[];for(const entry of entries){if(!Number.isFinite(entry.weight)||entry.weight<=0){invalidEntries.push(entry.hand);continue}const combos=expandRangeHand(entry.hand);if(!combos.length){invalidEntries.push(entry.hand);continue}const perCombo=entry.weight/combos.length;for(const cards of combos)rawExpanded.push({cards,weight:perCombo,source:entry.hand})}let blockedCombos=0;for(const combo of rawExpanded){if(combo.cards.some(card=>dead.has(card))){blockedCombos++;continue}const key=comboKey(combo.cards),prev=map.get(key);if(prev)prev.weight+=combo.weight;else map.set(key,{...combo})}const combos=[...map.values()],totalWeight=combos.reduce((sum,c)=>sum+c.weight,0);if(totalWeight>0)for(const combo of combos)combo.weight/=totalWeight;return{combos,totalWeight,blockedCombos,invalidEntries}}
export function rangeHasValidCombos(entries:WeightedRangeEntry[]|undefined,deadCards:string[]=[]){return Boolean(entries?.length&&normalizeWeightedRange(entries,deadCards).combos.length)}
export function comboContainsBlockedCard(combo:WeightedCombo,deadCards:string[]){const dead=new Set(deadCards.map(canonicalCard).filter(Boolean) as string[]);return combo.cards.some(card=>dead.has(card))}
