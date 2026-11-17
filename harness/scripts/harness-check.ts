// 하네스 검사 CLI. 원본: docs/harness-design.md §7, §8
//   --format --from-hook-stdin   PostToolUse 훅. stdin JSON의 tool_input.file_path 1개. 실패 시 exit 2 + stderr
//   --format --file <path>       수동 실행. 실패 시 exit 2
//   --full [--no-write]          전체 검사. 파일을 쓰지 않는다. 실패 시 exit 1
//   --summary [--read-only]      SessionStart. 파일을 쓰지 않는다. 항상 exit 0
import { readFileSync } from 'node:fs';
import { PROJECT_ROOT, isMain, isRecord, toRel } from './lib/common.ts';
import { checkFormatFile } from './lib/format.ts';
import { formatResults, runFull } from './lib/full.ts';
import { collectSummary, formatSummary } from './lib/summary.ts';

export interface Io {
  readonly readStdin: () => string;
  readonly out: (s: string) => void;
  readonly err: (s: string) => void;
}

const defaultIo: Io = {
  readStdin: () => readFileSync(0, 'utf8'),
  out: (s) => console.log(s),
  err: (s) => console.error(s),
};

const USAGE =
  '사용법: harness-check --format (--from-hook-stdin | --file <path>) | --full [--no-write] | --summary [--read-only]';

/** 훅 stdin JSON에서 file_path를 꺼낸다. */
export function filePathFromHookInput(json: string): string | undefined {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!isRecord(v) || !isRecord(v['tool_input'])) return undefined;
  const p = v['tool_input']['file_path'];
  return typeof p === 'string' ? p : undefined;
}

function runFormat(root: string, path: string, io: Io): number {
  const rel = toRel(root, path);
  if (rel === undefined) return 0;
  const errors = checkFormatFile(root, rel);
  if (errors.length === 0) return 0;
  io.err(`harness format 실패: ${rel}\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  return 2;
}

export function runCheck(root: string, argv: readonly string[], io: Io = defaultIo): number {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv];
  const has = (f: string): boolean => args.includes(f);
  const modes = ['--format', '--full', '--summary'].filter(has);
  const known = new Set(['--format', '--full', '--summary', '--from-hook-stdin', '--file', '--no-write', '--read-only']);
  const fileIdx = args.indexOf('--file');
  const unknown = args.filter((a, i) => !known.has(a) && !(fileIdx >= 0 && i === fileIdx + 1));
  if (modes.length !== 1 || unknown.length > 0) {
    io.err(USAGE);
    return 1;
  }
  const mode = modes[0];
  if (mode === '--format') {
    if (has('--from-hook-stdin') === (fileIdx >= 0)) {
      io.err(USAGE);
      return 1;
    }
    if (fileIdx >= 0) {
      const p = args[fileIdx + 1];
      if (p === undefined || p.startsWith('--')) {
        io.err(USAGE);
        return 1;
      }
      const code = runFormat(root, p, io);
      if (code === 0) io.out(`format OK: ${p}`);
      return code;
    }
    let input: string;
    try {
      input = io.readStdin();
    } catch (e) {
      io.err(`stdin 읽기 실패: ${(e as Error).message}`);
      return 1;
    }
    const p = filePathFromHookInput(input);
    if (p === undefined) return 0; // file_path 없는 도구 호출은 대상 아님
    return runFormat(root, p, io);
  }
  if (mode === '--full') {
    const results = runFull(root);
    io.out(formatResults(results));
    const failed = results.filter((r) => r.status === 'fail').length;
    io.out(failed === 0 ? 'harness full: 통과' : `harness full: 실패 ${failed}건`);
    return failed === 0 ? 0 : 1;
  }
  try {
    io.out(formatSummary(collectSummary(root)));
  } catch (e) {
    io.out(`[harness] summary 실패: ${(e as Error).message}`);
  }
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = runCheck(PROJECT_ROOT, process.argv.slice(2));
}
