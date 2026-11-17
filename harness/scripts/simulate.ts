// sim.balance: src/core/sim.ts의 BalanceSimulator로 전정답·무작위 시나리오 평균 별점을 내고 GDD 밸런스 목표와 비교한다.
// 원본: docs/harness-design.md §3, §5. 계약: src/contracts/tooling.ts (SimModule, BalanceScenario)
// 목표 수치는 docs/GDD.md §밸런스 목표에서 읽는다(여기에 복제하지 않는다).
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BalanceScenario, BalanceSimulator } from '../../src/contracts/tooling.ts';
import { PROJECT_ROOT, exists, isMain, isRecord, missingTarget, readText } from './lib/common.ts';

export const SIM_PATH = 'src/core/sim.ts';
export const GDD_PATH = 'docs/GDD.md';
export const DEFAULTS = { sessions: 1000, seed: 1 } as const;
/** "평균 5.0" 비교 허용 오차(소수 둘째 자리 반올림 기준). */
export const PERFECT_EPSILON = 0.005;

export interface BalanceTargets {
  /** 전정답 + 완벽 굽기 평균. */
  readonly perfect: number;
  /** 무작위 플레이 평균 범위 [min, maxExclusive). "2~3점대" → [2, 4). */
  readonly random: { readonly min: number; readonly maxExclusive: number };
}

export function parseTargets(gdd: string): BalanceTargets | undefined {
  const sec = /^## 밸런스 목표\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(gdd)?.[1];
  if (sec === undefined) return undefined;
  const perfect = /전정답[^\n]*?평균\s*(\d+(?:\.\d+)?)/.exec(sec)?.[1];
  const random = /무작위[^\n]*?평균\s*(\d+)\s*~\s*(\d+)\s*점대/.exec(sec);
  if (perfect === undefined || random?.[1] === undefined || random[2] === undefined) return undefined;
  const lo = Number(random[1]);
  const hi = Number(random[2]);
  if (lo > hi) return undefined;
  return { perfect: Number(perfect), random: { min: lo, maxExclusive: hi + 1 } };
}

export interface SimOptions {
  readonly sessions: number;
  readonly seed: number;
}

export function parseArgs(argv: readonly string[]): SimOptions | string {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv];
  const opts = { sessions: DEFAULTS.sessions as number, seed: DEFAULTS.seed as number };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const n = Number(args[i + 1]);
    if ((key !== '--sessions' && key !== '--seed') || !Number.isInteger(n)) {
      return '사용법: simulate [--sessions <정수≥1>] [--seed <정수>]';
    }
    if (key === '--sessions') {
      if (n < 1) return '--sessions는 1 이상';
      opts.sessions = n;
    } else opts.seed = n;
  }
  return opts;
}

export type Loader = (absPath: string) => Promise<unknown>;
const defaultLoader: Loader = (abs) => import(pathToFileURL(abs).href);

function asSimulator(mod: unknown): BalanceSimulator | undefined {
  if (!isRecord(mod)) return undefined;
  const sim = mod['BalanceSimulator'];
  return isRecord(sim) && typeof sim['run'] === 'function' ? (sim as unknown as BalanceSimulator) : undefined;
}

const fmt = (n: number): string => n.toFixed(2);

export async function runSimulate(root: string, argv: readonly string[], load: Loader = defaultLoader): Promise<number> {
  if (!exists(root, SIM_PATH)) return missingTarget(SIM_PATH);
  const opts = parseArgs(argv);
  if (typeof opts === 'string') {
    console.error(opts);
    return 1;
  }
  const targets = parseTargets(readText(root, GDD_PATH) ?? '');
  if (targets === undefined) {
    console.error(`${GDD_PATH} §밸런스 목표를 읽지 못함(형식: "전정답 ...: 평균 N", "무작위 ...: 평균 A~B점대")`);
    return 1;
  }
  let sim: BalanceSimulator | undefined;
  try {
    sim = asSimulator(await load(join(root, SIM_PATH)));
  } catch (e) {
    console.error(`${SIM_PATH} import 실패: ${(e as Error).message}`);
    return 1;
  }
  if (sim === undefined) {
    console.error(`${SIM_PATH}: BalanceSimulator { run(scenario): number } export가 없다`);
    return 1;
  }
  const scenario = (kind: BalanceScenario['kind']): BalanceScenario => ({ kind, sessions: opts.sessions, seed: opts.seed });
  let perfect: number;
  let random: number;
  try {
    perfect = sim.run(scenario('perfect'));
    random = sim.run(scenario('random'));
  } catch (e) {
    console.error(`BalanceSimulator.run 실패: ${(e as Error).message}`);
    return 1;
  }
  for (const [k, v] of [['perfect', perfect], ['random', random]] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 5) {
      console.error(`${k}: 평균 별점은 1~5 사이 유한수여야 한다(${String(v)})`);
      return 1;
    }
  }
  const perfectOk = Math.abs(perfect - targets.perfect) < PERFECT_EPSILON;
  const randomOk = random >= targets.random.min && random < targets.random.maxExclusive;
  console.log(`시나리오: sessions=${opts.sessions}, seed=${opts.seed}`);
  console.log(`전정답+완벽 굽기: ${fmt(perfect)} (목표 ${fmt(targets.perfect)}) ${perfectOk ? 'OK' : '미달'}`);
  console.log(
    `무작위 플레이: ${fmt(random)} (목표 ${targets.random.min}~${targets.random.maxExclusive - 1}점대) ${randomOk ? 'OK' : '미달'}`,
  );
  return perfectOk && randomOk ? 0 : 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = await runSimulate(PROJECT_ROOT, process.argv.slice(2));
}
