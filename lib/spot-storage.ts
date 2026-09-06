import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import {exactSpotFingerprint} from "@/lib/spot-identity";

export type SpotHistoryRecord={fingerprint:string;createdAt:number;spot:PlayerDnaSpot};
export interface SpotHistoryAdapter{
  kind:"LOCAL"|"STACKUP_CLOUD"|"CUSTOM_CLOUD";
  isAvailable():boolean|Promise<boolean>;
  listFingerprints():string[]|Promise<string[]>;
  save(record:SpotHistoryRecord):void|Promise<void>;
  list(limit?:number):SpotHistoryRecord[]|Promise<SpotHistoryRecord[]>;
}

const HISTORY_KEY="stackup.player-dna.spot-history.v1";
const CONSENT_KEY="stackup.player-dna.spot-history-consent.v1";

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function parseHistory():SpotHistoryRecord[]{if(!browser())return[];try{const raw=window.localStorage.getItem(HISTORY_KEY);const value=raw?JSON.parse(raw):[];return Array.isArray(value)?value:[]}catch{return[]}}

export function localHistoryConsent(){if(!browser())return false;return window.localStorage.getItem(CONSENT_KEY)==="YES"}
export function setLocalHistoryConsent(allowed:boolean){if(browser())window.localStorage.setItem(CONSENT_KEY,allowed?"YES":"NO")}

export const localSpotHistoryAdapter:SpotHistoryAdapter={
  kind:"LOCAL",
  isAvailable(){return browser()&&localHistoryConsent()},
  listFingerprints(){return parseHistory().map(item=>item.fingerprint)},
  save(record){if(!browser()||!localHistoryConsent())return;const history=parseHistory();if(history.some(item=>item.fingerprint===record.fingerprint))return;history.unshift(record);try{window.localStorage.setItem(HISTORY_KEY,JSON.stringify(history))}catch{}},
  list(limit=500){return parseHistory().slice(0,Math.max(0,limit))},
};

export function rememberSpotLocally(spot:PlayerDnaSpot){if(!localHistoryConsent())return;localSpotHistoryAdapter.save({fingerprint:exactSpotFingerprint(spot),createdAt:Date.now(),spot})}

/*
  FUTURE PAID ADAPTERS:
  - STACKUP_CLOUD: sync by authenticated user + encrypted account storage.
  - CUSTOM_CLOUD: user-owned endpoint/object storage through the same interface.
  The app core must depend only on SpotHistoryAdapter so cloud storage never
  becomes a requirement for spot generation or solver evaluation.
*/
