// Balance report (T20 req. 4, used for T18-style tuning). `npm run balance`
// prints it for 50 seeds of the typical dodger; see balance.test.ts for knobs.
import type { Bot } from './bots';
import { runSim, type RunStats, type SimResult } from './harness';

export interface BalanceRun {
  result: SimResult;
  stats: RunStats;
}

/** Hard stop per run, level seconds. The level is ~180 s plus the boss. */
export const BALANCE_MAX_T = 320;

export function playBalance(
  makeBot: () => Bot,
  runs: number,
  seedPrefix = 'bal',
  levelId = 'kessler',
): BalanceRun[] {
  const out: BalanceRun[] = [];
  for (let i = 0; i < runs; i++) {
    // Level 1 keeps its historical seeds so reports stay comparable.
    const seed = levelId === 'kessler' ? `${seedPrefix}${i}` : `${levelId}-${seedPrefix}${i}`;
    const r = runSim(seed, makeBot(), BALANCE_MAX_T, { levelId });
    out.push({ result: r.result, stats: r.stats });
  }
  return out;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

function spread(values: readonly number[], digits = 0): string {
  if (values.length === 0) return '-';
  const s = [...values].sort((a, b) => a - b);
  const f = (v: number) => v.toFixed(digits);
  return `min ${f(s[0]!)} · p25 ${f(quantile(s, 0.25))} · median ${f(quantile(s, 0.5))} · p75 ${f(quantile(s, 0.75))} · max ${f(s[s.length - 1]!)}  (n=${s.length})`;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(n: number, of: number): string {
  return `${((100 * n) / Math.max(1, of)).toFixed(0)}% (${n}/${of})`;
}

const BUCKET = 30;
const BAR_W = 30;

function histogram(runs: readonly BalanceRun[]): string[] {
  const top = Math.ceil(BALANCE_MAX_T / BUCKET);
  const counts = new Array<number>(top).fill(0);
  const wins = new Array<number>(top).fill(0);
  for (const r of runs) {
    const b = Math.min(top - 1, Math.floor(r.result.endT / BUCKET));
    counts[b]!++;
    if (r.result.victory) wins[b]!++;
  }
  const max = Math.max(1, ...counts);
  const lines: string[] = [];
  const first = counts.findIndex((c) => c > 0);
  let last = top - 1;
  while (last > 0 && counts[last] === 0) last--;
  for (let b = Math.max(0, first); b <= last; b++) {
    const c = counts[b]!;
    const bar = '#'.repeat(Math.round((BAR_W * (c - wins[b]!)) / max));
    const win = '='.repeat(Math.round((BAR_W * wins[b]!) / max));
    const lo = String(b * BUCKET).padStart(3);
    const hi = String((b + 1) * BUCKET).padStart(3);
    lines.push(`  ${lo}–${hi} s │${bar}${win} ${c || ''}`);
  }
  lines.push('  (# = death or timeout, = = clear; ends are level time)');
  return lines;
}

function loadoutLine(label: string, sel: readonly RunStats[], at: 'boss' | 'end'): string {
  if (sel.length === 0) return `  ${label}: -`;
  const avgLvl = mean(sel.map((r) => (at === 'boss' ? r.avgLevelAtBoss : r.avgLevelAtEnd)));
  const counts = sel.map((r) => {
    const s = at === 'boss' ? r.weaponsAtBoss : r.weaponsAtEnd;
    return s === '' ? 0 : s.split(' ').length;
  });
  const perWeapon: Record<string, number[]> = {};
  for (const r of sel) {
    const s = at === 'boss' ? r.weaponsAtBoss : r.weaponsAtEnd;
    for (const tok of s.split(' ').filter(Boolean)) {
      const m = /^([a-zA-Z]+)(\d+)$/.exec(tok);
      if (m) (perWeapon[m[1]!] ??= []).push(Number(m[2]));
    }
  }
  const per = Object.entries(perWeapon)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, lv]) => `${id} ${pct(lv.length, sel.length).split(' ')[0]} L${mean(lv).toFixed(1)}`)
    .join(', ');
  return `  ${label}: ${mean(counts).toFixed(1)} weapons, avg level ${avgLvl.toFixed(2)} · held: ${per}`;
}

export function formatBalanceReport(
  botName: string,
  runs: readonly BalanceRun[],
  levelLabel = 'Level 1',
): string {
  const n = runs.length;
  const st = runs.map((r) => r.stats);
  const wins = runs.filter((r) => r.result.victory);
  const deaths = runs.filter((r) => r.result.outcome === 'death');
  const timeouts = runs.filter((r) => r.result.outcome === 'timeout');
  const boss = st.filter((r) => r.reachedBoss);
  const midDeaths = deaths.filter((r) => !r.stats.reachedBoss);
  const bossDeaths = deaths.filter((r) => r.stats.reachedBoss);
  const kinds = new Set<string>();
  for (const r of st) for (const k of Object.keys(r.pickupsCollected)) kinds.add(k);
  const peakPool = (name: string) => Math.max(...st.map((r) => r.pools[name]?.peak ?? 0));
  const dropped = st.reduce(
    (s, r) => s + Object.values(r.pools).reduce((a, u) => a + u.dropped, 0),
    0,
  );
  const causes: Record<string, number> = {};
  for (const r of st)
    for (const [k, v] of Object.entries(r.hitCauses)) causes[k] = (causes[k] ?? 0) + v;

  const lines = [
    `══ Balance report · ${botName} · ${n} seeds · ${levelLabel} (Kestrel, fresh save) ══`,
    '',
    'Outcomes',
    `  reach boss ${pct(boss.length, n)} · clear ${pct(wins.length, n)} · death ${pct(deaths.length, n)} · timeout ${pct(timeouts.length, n)}`,
    `  deaths before the boss ${midDeaths.length} · in the boss fight ${bossDeaths.length}`,
    '',
    'Survival time (level seconds at death; clears included at their end time)',
    `  all:    ${spread(runs.map((r) => r.result.endT))}`,
    `  deaths: ${spread(deaths.map((r) => r.result.endT))}`,
    ...histogram(runs),
    '',
    'Salvage earned (floored, as banked)',
    `  all:            ${spread(st.map((r) => r.salvage))}`,
    `  clear:          ${spread(wins.map((r) => r.stats.salvage))}`,
    `  death mid-level: ${spread(midDeaths.map((r) => r.stats.salvage))}`,
    `  death at boss:  ${spread(bossDeaths.map((r) => r.stats.salvage))}`,
    `  on the clock @45/90/120/150/180 s: ${[45, 90, 120, 150, 180]
      .map((m) =>
        mean(st.filter((r) => r.salvageAt[m] !== undefined).map((r) => r.salvageAt[m]!)).toFixed(0),
      )
      .join(' / ')}`,
    '',
    'Pickups collected per run (mean · max)',
    ...[...kinds].sort().map((k) => {
      const v = st.map((r) => r.pickupsCollected[k] ?? 0);
      return `  ${k.padEnd(10)} ${mean(v).toFixed(1).padStart(5)} · ${Math.max(...v)}`;
    }),
    `  capsules spawned (weapon + upgrade) ${mean(st.map((r) => r.capsulesSpawned)).toFixed(1)} · pod rescued ${pct(st.filter((r) => r.podRescued).length, n)}`,
    '',
    'Weapons',
    loadoutLine('at boss  ', boss, 'boss'),
    loadoutLine(
      'at death ',
      deaths.map((r) => r.stats),
      'end',
    ),
    `  level sum at boss ${spread(boss.map((r) => r.levelSumAtBoss))}`,
    `  weapon count @30/45/60/90/120/180 s: ${[30, 45, 60, 90, 120, 180]
      .map((m) =>
        mean(
          st.filter((r) => r.weaponCountAt[m] !== undefined).map((r) => r.weaponCountAt[m]!),
        ).toFixed(1),
      )
      .join(' / ')}`,
    '',
    'Fight',
    `  hits in first 45 s ${mean(st.map((r) => r.hitsBefore45)).toFixed(2)} · hits per run ${mean(st.map((r) => r.hits)).toFixed(1)} · hits in boss ${mean(boss.map((r) => r.hitsInBoss)).toFixed(1)}`,
    `  boss time on clears: ${spread(wins.map((r) => r.stats.bossTime))}`,
    `  hit causes: ${
      Object.entries(causes)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || '-'
    }`,
    `  peak enemy shots: waves ${Math.max(...st.map((r) => r.peakEnemyShotsLevel))} · boss ${Math.max(...st.map((r) => r.peakEnemyShotsBoss))}`,
    timeouts.length > 0
      ? `  timeouts: ${timeouts.map((r) => `[${r.stats.seed} ${r.stats.weaponsAtBoss} ${r.stats.bossPhaseAtEnd}]`).join(' ')}`
      : '  timeouts: none',
    '',
    'Engine',
    `  pool peaks: ${['playerShots', 'enemyShots', 'enemies', 'asteroids', 'anomalies', 'pickups']
      .map((p) => `${p} ${peakPool(p)}/${st[0]?.pools[p]?.capacity ?? '?'}`)
      .join(' · ')} · dropped spawns ${dropped}`,
    `  tick ms avg ${mean(st.map((r) => r.updateMsAvg)).toFixed(4)} · worst ${Math.max(...st.map((r) => r.updateMsMax)).toFixed(2)}`,
  ];
  return lines.join('\n');
}

export interface SummaryRow {
  label: string;
  runs: readonly BalanceRun[];
}

function median(values: readonly number[]): number {
  return quantile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
}

/** One line per sector (`LEVEL=all`): the numbers the design's difficulty table tracks. */
export function formatSummaryTable(botName: string, rows: readonly SummaryRow[]): string {
  const head = [
    'sector',
    'boss%',
    'clear%',
    'deaths: level · boss by phase',
    'salvage clear (all)',
    'at boss',
    'boss s',
    'peak shots',
    'pod%',
  ];
  const lines = rows.map(({ label, runs }) => {
    const n = runs.length;
    const st = runs.map((r) => r.stats);
    const wins = runs.filter((r) => r.result.victory);
    const deaths = runs.filter((r) => r.result.outcome === 'death');
    const mid = deaths.filter((r) => !r.stats.reachedBoss).length;
    const byPhase: Record<string, number> = {};
    for (const r of deaths)
      if (r.stats.reachedBoss) {
        const ph = r.stats.bossPhaseAtEnd || '?';
        byPhase[ph] = (byPhase[ph] ?? 0) + 1;
      }
    const phases = Object.entries(byPhase)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    const boss = st.filter((r) => r.reachedBoss);
    const count = (s: string) => (s === '' ? 0 : s.split(' ').length);
    const pc = (k: number) => `${Math.round((100 * k) / Math.max(1, n))}`;
    return [
      label,
      pc(boss.length),
      pc(wins.length),
      `${mid} · ${deaths.length - mid}${phases ? ` (${phases})` : ''}`,
      `${wins.length ? median(wins.map((r) => r.stats.salvage)).toFixed(0) : '-'} (${median(st.map((r) => r.salvage)).toFixed(0)})`,
      boss.length
        ? `${mean(boss.map((r) => count(r.weaponsAtBoss))).toFixed(1)} × L${mean(boss.map((r) => r.avgLevelAtBoss)).toFixed(1)}`
        : '-',
      wins.length ? median(wins.map((r) => r.stats.bossTime)).toFixed(0) : '-',
      `${Math.max(...st.map((r) => r.peakEnemyShotsLevel))} / ${Math.max(...st.map((r) => r.peakEnemyShotsBoss))}`,
      pc(st.filter((r) => r.podRescued).length),
    ];
  });
  const all = [head, ...lines];
  const widths = head.map((_, c) => Math.max(...all.map((row) => (row[c] as string).length)));
  const fmt = (row: string[]) => row.map((cell, c) => cell.padEnd(widths[c] as number)).join(' │ ');
  return [
    `══ Campaign summary · ${botName} · ${rows[0]?.runs.length ?? 0} seeds per sector ══`,
    fmt(head),
    widths.map((w) => '─'.repeat(w)).join('─┼─'),
    ...lines.map(fmt),
    '  boss% reached the boss · deaths before the boss · in the fight (boss phase at death)',
    '  salvage: median on a clear (median over all runs) · at boss: weapons × average level',
    '  boss s: median fight on clears · peak shots: waves / boss',
  ].join('\n');
}
