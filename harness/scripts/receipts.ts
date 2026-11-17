// harness.receipts: 커밋 트레일러 `Skill-Receipt:`를 git log에서 모아 스킬·단계별 사용 횟수를 낸다.
// 형식 원본: docs/rules/collaboration/commits.md#스킬-영수증
//   Skill-Receipt: <name>@v<version> S1,S2,S4 skip=S3(사유),S5(사유)
// harness-compaction의 "6주 이상 영수증에 없는 단계·스킬" 근거로 쓴다.
//   사용법: receipts [--weeks <정수≥1>]   (기본 6주)
// 형식이 틀린 트레일러가 기간 안에 있으면 exit 1.
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT, isMain } from './lib/common.ts';
import { loadModel } from './lib/model.ts';

export const TRAILER_KEY = 'Skill-Receipt';
export const DEFAULT_WEEKS = 6;

export interface Receipt {
  readonly skill: string;
  readonly version: number;
  readonly done: readonly string[];
  readonly skipped: readonly { readonly step: string; readonly reason: string }[];
}

const RECEIPT_RE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)@v([1-9]\d*)(?:\s+(S\d+(?:,S\d+)*))?(?:\s+skip=(.+))?$/;
const SKIP_RE = /^S\d+\([^()]+\)$/;

/** 트레일러 값 하나를 읽는다. 형식 오류면 사유 문자열. */
export function parseReceipt(value: string): Receipt | string {
  const m = RECEIPT_RE.exec(value.trim());
  if (m === null) return `형식 오류: "${value}" (기대: <name>@v<version> S1,S2 skip=S3(사유))`;
  const done = m[3] === undefined ? [] : m[3].split(',');
  const skipped: { step: string; reason: string }[] = [];
  if (m[4] !== undefined) {
    // 사유 안의 쉼표를 허용하려고 "),S" 경계로 나눈다.
    for (const part of m[4].split(/,(?=S\d+\()/)) {
      if (!SKIP_RE.test(part)) return `skip 형식 오류: "${part}" (기대: S3(사유))`;
      const step = part.slice(0, part.indexOf('('));
      skipped.push({ step, reason: part.slice(step.length + 1, -1) });
    }
  }
  if (done.length === 0 && skipped.length === 0) return `단계 없음: "${value}"`;
  const all = [...done, ...skipped.map((s) => s.step)];
  const dup = all.filter((s, i) => all.indexOf(s) !== i);
  if (dup.length > 0) return `단계 중복: ${[...new Set(dup)].join(', ')} in "${value}"`;
  return { skill: m[1] ?? '', version: Number(m[2]), done, skipped };
}

export interface CommitReceipts {
  readonly commit: string;
  readonly values: readonly string[];
}

const FIELD = '\x1f';
const RECORD = '\x1e';

/** since 이후 커밋의 트레일러 값. 커밋이 없는 저장소는 빈 배열, git 저장소가 아니면 오류 문자열. */
export function readTrailers(root: string, since: Date): CommitReceipts[] | string {
  // 판정은 종료코드로만 한다(오류 문구는 git 버전·언어마다 다르다).
  const git = (args: readonly string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const repo = git(['rev-parse', '--git-dir']);
  if (repo.error !== undefined) return `git 실행 실패: ${repo.error.message}`;
  if (repo.status !== 0) return `git 저장소가 아니다: ${root}`;
  if (git(['rev-parse', '--verify', '--quiet', 'HEAD']).status !== 0) return []; // 커밋 없음
  const res = spawnSync(
    'git',
    [
      'log',
      `--since=${since.toISOString()}`,
      `--format=%h${FIELD}%(trailers:key=${TRAILER_KEY},valueonly,separator=%x1d)${RECORD}`,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (res.error !== undefined) return `git 실행 실패: ${res.error.message}`;
  if (res.status !== 0) return `git log 실패(exit ${String(res.status)}): ${res.stderr.trim()}`;
  return res.stdout
    .split(RECORD)
    .map((r) => r.trim())
    .filter((r) => r !== '')
    .map((r) => {
      const [commit = '', raw = ''] = r.split(FIELD);
      return { commit, values: raw.split('\x1d').map((v) => v.trim()).filter((v) => v !== '') };
    })
    .filter((c) => c.values.length > 0);
}

export interface SkillUsage {
  readonly skill: string;
  readonly receipts: number;
  readonly versions: readonly number[];
  /** 단계 → 완료 횟수 */
  readonly done: ReadonlyMap<string, number>;
  /** 단계 → 생략 사유 목록 */
  readonly skipped: ReadonlyMap<string, readonly string[]>;
}

export interface Aggregate {
  readonly usage: readonly SkillUsage[];
  readonly errors: readonly string[];
}

export function aggregate(commits: readonly CommitReceipts[]): Aggregate {
  const errors: string[] = [];
  const by = new Map<string, { receipts: number; versions: Set<number>; done: Map<string, number>; skipped: Map<string, string[]> }>();
  for (const c of commits) {
    for (const v of c.values) {
      const r = parseReceipt(v);
      if (typeof r === 'string') {
        errors.push(`${c.commit}: ${r}`);
        continue;
      }
      const u = by.get(r.skill) ?? { receipts: 0, versions: new Set<number>(), done: new Map(), skipped: new Map() };
      u.receipts += 1;
      u.versions.add(r.version);
      for (const s of r.done) u.done.set(s, (u.done.get(s) ?? 0) + 1);
      for (const s of r.skipped) u.skipped.set(s.step, [...(u.skipped.get(s.step) ?? []), s.reason]);
      by.set(r.skill, u);
    }
  }
  const usage = [...by.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([skill, u]) => ({ skill, receipts: u.receipts, versions: [...u.versions].sort((a, b) => a - b), done: u.done, skipped: u.skipped }));
  return { usage, errors };
}

/** 스킬 목록(현재 frontmatter)과 대조한 미사용 후보. */
export function unusedCandidates(
  skills: readonly { readonly name: string; readonly steps: readonly string[] }[],
  usage: readonly SkillUsage[],
): string[] {
  const out: string[] = [];
  for (const s of skills) {
    const u = usage.find((x) => x.skill === s.name);
    if (u === undefined) {
      out.push(`${s.name}: 영수증 없음`);
      continue;
    }
    const never = s.steps.filter((st) => (u.done.get(st) ?? 0) === 0);
    if (never.length > 0) out.push(`${s.name}: 완료 0회 단계 ${never.join(', ')}`);
  }
  return out;
}

export function parseWeeks(argv: readonly string[]): number | string {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv];
  if (args.length === 0) return DEFAULT_WEEKS;
  const n = Number(args[1]);
  if (args.length !== 2 || args[0] !== '--weeks' || !Number.isInteger(n) || n < 1) return '사용법: receipts [--weeks <정수≥1>]';
  return n;
}

export function runReceipts(root: string, argv: readonly string[], now: Date = new Date()): number {
  const weeks = parseWeeks(argv);
  if (typeof weeks === 'string') {
    console.error(weeks);
    return 1;
  }
  const since = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const commits = readTrailers(root, since);
  if (typeof commits === 'string') {
    console.error(commits);
    return 1;
  }
  const { usage, errors } = aggregate(commits);
  console.log(`기간: 최근 ${weeks}주(${since.toISOString().slice(0, 10)} 이후), 영수증 있는 커밋 ${commits.length}개`);
  for (const u of usage) {
    const done = [...u.done.entries()].sort().map(([s, n]) => `${s}×${n}`).join(' ');
    const skipped = [...u.skipped.entries()].sort().map(([s, rs]) => `${s}×${rs.length}(${[...new Set(rs)].join('; ')})`).join(' ');
    console.log(`  ${u.skill} v${u.versions.join(',v')}: 영수증 ${u.receipts}건 | 완료 ${done || '-'} | 생략 ${skipped || '-'}`);
  }
  const model = loadModel(root);
  const candidates = unusedCandidates(
    model.skills.map((s) => ({ name: s.skill.name, steps: s.skill.steps.map((st) => st.id) })),
    usage,
  );
  console.log(candidates.length === 0 ? '미사용 후보: 없음' : `미사용 후보(메타 스킬 제외):\n  ${candidates.join('\n  ')}`);
  if (errors.length > 0) {
    console.error(`영수증 형식 오류 ${errors.length}건:\n  ${errors.join('\n  ')}`);
    return 1;
  }
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = runReceipts(PROJECT_ROOT, process.argv.slice(2));
}
