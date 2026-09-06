"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TournamentNoticeTicker.module.css";

export type TournamentNotice = {
  id: string;
  text: string;
  priority?: number;
};

export type FinalTablePlayer = {
  position: number;
  name: string;
};

export type Payout = {
  place: number;
  amount: string;
};

type Props = {
  notices?: TournamentNotice[];
  finalTablePlayers?: FinalTablePlayer[];
  payouts?: Payout[];
};

const DEFAULT_NOTICES: TournamentNotice[] = [
  { id: "brand", text: "♠ STACKUP HOLD'EM ENTERPRISE", priority: 0 },
];

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export default function TournamentNoticeTicker({
  notices = DEFAULT_NOTICES,
  finalTablePlayers = [],
  payouts = [],
}: Props) {
  const items = useMemo(() => {
    const ordered = [...notices].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const ftGroups = chunk(
      [...finalTablePlayers].sort((a, b) => a.position - b.position),
      4,
    ).map((group, index) => ({
      id: `ft-${index}`,
      text: group.map((player) => `P${String(player.position).padStart(2, "0")} - ${player.name}`).join("   •   "),
      priority: 80,
    }));

    const payoutGroups = chunk(
      [...payouts].sort((a, b) => a.place - b.place),
      5,
    ).map((group, index) => ({
      id: `payout-${index}`,
      text: `PREMIAÇÃO   •   ${group.map((payout) => `${payout.place}º - ${payout.amount}`).join("   •   ")}`,
      priority: 60,
    }));

    return [...ordered, ...ftGroups, ...payoutGroups];
  }, [notices, finalTablePlayers, payouts]);

  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;

    const hold = window.setTimeout(() => setMoving(true), 3000);
    const advance = window.setTimeout(() => {
      setIndex((current) => (current + 1) % items.length);
      setMoving(false);
    }, 3800);

    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(advance);
    };
  }, [index, items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  const current = items[index] ?? DEFAULT_NOTICES[0];

  return (
    <aside className={styles.ticker} aria-live="polite" aria-label="PAINEL DE AVISOS DO TORNEIO">
      <div className={`${styles.item} ${moving ? styles.moving : ""}`} key={`${current.id}-${index}`}>
        {current.text}
      </div>
    </aside>
  );
}
