// artifacts.archive: .artifacts/pm 최상위의 번호·시각이 붙은 일회성 산출물을 archive/<시각>.tar.gz 하나로 묶는다.
//   - 보관 대상(패턴 일치)이 30개를 넘을 때만 동작한다. 넘으면 보호 대상이 아닌 것을 모두 묶는다.
//   - 보호(절대 묶지 않음): 수정 24시간 미만, 진행 중 실행(<역할>.md에 "## <시각> (exit" 줄이 없음),
//     실행 파일(json·err)이 아닌 0바이트 파일. 끝난 실행의 0바이트 json·err는 묶는다.
//     같은 실행의 json·err는 한 쌍이라 하나라도 보호면 둘 다 남긴다.
//   - resume.md·state.md·*.sh·archive/는 어느 패턴에도 걸리지 않아 대상이 아니다.
//   - 순서는 파일 이름의 번호·시각(자연 정렬)이다. mtime은 보호 판정에만 쓴다.
//   - tar 목록을 다시 읽어 모두 들어 있을 때만 archive/<시각>.txt(목록)를 쓰고 원본을 지운 뒤 archive/INDEX.md에 한 줄 덧붙인다.
//     실패하면 tar를 지우고 원본을 보존한 채 exit 1. --dry-run은 아무것도 바꾸지 않는다.
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT, isMain } from './lib/common.ts';

export const PM_DIR = '.artifacts/pm';
export const THRESHOLD = 30;
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;

const RUN = /^(integrator|core|render|ui|gardener)-(\d{8}T\d{6})\.(json|err)$/;
// 현재 문서·도구(resume.md, state.md, prompt-integrator.txt 등)는 어느 패턴에도 걸리지 않는다.
const TARGET_PATTERNS: readonly RegExp[] = [
  /^prompt-integrator\d+[a-z]*\.txt$/,
  /^integrator\d+[a-z]*\.log$/,
  RUN,
  /^.*-verdicts.*\.md$/,
];

export interface Entry {
  readonly name: string;
  readonly path: string;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface Options {
  readonly dir: string;
  readonly dryRun: boolean;
  readonly now: Date;
  /** 테스트용: tar 내용 목록을 읽는 함수를 바꾼다. */
  readonly list?: (tarPath: string) => string[] | undefined;
}

const byName = (a: Entry, b: Entry): number => a.name.localeCompare(b.name, 'en', { numeric: true });

export function plan(dir: string, now: Date): { targets: Entry[]; kept: Entry[]; total: number; files: number } {
  const files = readdirSync(dir)
    .map((f) => ({ f, st: lstatSync(join(dir, f)) }))
    .filter((e) => e.st.isFile())
    .map(({ f, st }): Entry => ({ name: f, path: join(dir, f), mtimeMs: st.mtimeMs, size: st.size }));
  const all = files.filter((e) => TARGET_PATTERNS.some((re) => re.test(e.name))).sort(byName);
  if (all.length <= THRESHOLD) return { targets: [], kept: all, total: all.length, files: files.length };

  const logs = new Map<string, string>();
  const finished = (role: string, ts: string): boolean => {
    if (!logs.has(role)) logs.set(role, existsSync(join(dir, `${role}.md`)) ? readFileSync(join(dir, `${role}.md`), 'utf8') : '');
    return logs.get(role)!.includes(`## ${ts} (exit`);
  };
  const isProtected = (e: Entry): boolean => {
    if (now.getTime() - e.mtimeMs < MIN_AGE_MS) return true;
    const m = RUN.exec(e.name);
    // 끝난 실행의 0바이트 err·json은 정상 결과라 묶는다(사용자 결정 2026-11-20).
    return m === null ? e.size === 0 : !finished(m[1]!, m[2]!);
  };
  const stem = (e: Entry): string => (RUN.test(e.name) ? e.name.replace(/\.(json|err)$/, '') : e.name);
  const protectedStems = new Set(all.filter(isProtected).map(stem));
  const targets = all.filter((e) => !protectedStems.has(stem(e)));
  const kept = all.filter((e) => protectedStems.has(stem(e)));
  return { targets, kept, total: all.length, files: files.length };
}

export function stamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function tarList(tarPath: string): string[] | undefined {
  const r = spawnSync('tar', ['-tzf', tarPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout.split('\n').filter((l) => l !== '') : undefined;
}

export function runArchive(opts: Options): number {
  const { targets, kept, total, files } = plan(opts.dir, opts.now);
  if (targets.length === 0) {
    console.log(`archive: 묶을 파일 0개(보관 대상 ${total}개, 기준 ${THRESHOLD}개 초과, 보호 ${total > THRESHOLD ? kept.length : 0}개)`);
    return 0;
  }
  const s = stamp(opts.now);
  const tarName = `${s}.tar.gz`;
  console.log(`archive: ${targets.length}개 묶음 예정 → archive/${tarName} (최상위 파일 ${files}개, 보관 대상 ${total}개, 보호 ${kept.length}개, 묶은 뒤 최상위 ${files - targets.length}개)`);
  if (opts.dryRun) {
    for (const e of targets) console.log(`  ${e.name}`);
    return 0;
  }
  const archiveDir = join(opts.dir, 'archive');
  mkdirSync(archiveDir, { recursive: true });
  const tarPath = join(archiveDir, tarName);
  if (existsSync(tarPath)) {
    console.error(`archive: ${tarName}이 이미 있어 중단한다(원본 보존)`);
    return 1;
  }
  const names = targets.map((e) => e.name);
  const made = spawnSync('tar', ['-czf', tarPath, '-C', opts.dir, ...names], { encoding: 'utf8' });
  const listed = made.status === 0 ? (opts.list ?? tarList)(tarPath) : undefined;
  const have = new Set(listed);
  const missing = listed === undefined ? names : names.filter((n) => !have.has(n));
  if (missing.length > 0) {
    if (existsSync(tarPath)) unlinkSync(tarPath);
    console.error(`archive: tar 실패 또는 검증 실패(누락 ${missing.length}개, 예: ${missing[0]}). 원본은 지우지 않았다`);
    return 1;
  }
  writeFileSync(join(archiveDir, `${s}.txt`), names.join('\n') + '\n');
  for (const e of targets) unlinkSync(e.path);
  appendFileSync(join(archiveDir, 'INDEX.md'), `- ${s} | ${targets.length}개 | ${tarName}\n`);
  console.log(`archive: ${targets.length}개를 archive/${tarName}에 묶고 원본을 지웠다(목록 archive/${s}.txt)`);
  return 0;
}

if (isMain(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  process.exitCode = runArchive({ dir: join(PROJECT_ROOT, PM_DIR), dryRun, now: new Date() });
}
