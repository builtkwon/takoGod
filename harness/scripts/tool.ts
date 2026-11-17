// pnpm tool <id> [-- 인자]: toolset.yaml의 ID로 run을 실행한다. 원본: docs/harness-design.md §5
// planned·미등록 ID는 실행하지 않는다.
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { PROJECT_ROOT, isMain } from './lib/common.ts';
import { loadToolset, type Tool, type Toolset } from './lib/toolset.ts';

export type Resolution =
  | { readonly kind: 'run'; readonly tool: Tool }
  | { readonly kind: 'planned'; readonly tool: Tool }
  | { readonly kind: 'unknown'; readonly id: string };

export function resolveTool(toolset: Toolset, id: string): Resolution {
  const tool = toolset.tools.find((t) => t.id === id);
  if (tool === undefined) return { kind: 'unknown', id };
  return tool.status === 'planned' ? { kind: 'planned', tool } : { kind: 'run', tool };
}

/** pnpm이 넘기는 선두 `--`를 제거한다. */
export function normalizeArgs(args: readonly string[]): string[] {
  return args[0] === '--' ? args.slice(1) : [...args];
}

function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function buildCommand(tool: Tool, args: readonly string[]): string {
  return [tool.run, ...args.map(shellQuote)].join(' ');
}

function listing(toolset: Toolset): string {
  return toolset.tools.map((t) => `  ${t.id.padEnd(16)} ${t.status.padEnd(8)} ${t.purpose}`).join('\n');
}

export function runTool(root: string, argv: readonly string[]): number {
  const loaded = loadToolset(root);
  if (!loaded.ok) {
    console.error(`toolset.yaml 오류:\n  ${loaded.errors.join('\n  ')}`);
    return 1;
  }
  const { toolset } = loaded;
  const [id, ...rest] = argv;
  if (id === undefined || id === '--' || id.startsWith('-')) {
    console.error(`사용법: pnpm tool <id> [-- 인자]\n등록 도구:\n${listing(toolset)}`);
    return 1;
  }
  const r = resolveTool(toolset, id);
  if (r.kind === 'unknown') {
    console.error(`미등록 도구 ID: ${id}\n등록 도구:\n${listing(toolset)}`);
    return 1;
  }
  if (r.kind === 'planned') {
    console.error(`실행 거부: ${id}는 planned 상태다(${r.tool.purpose}). active 전환은 toolset.yaml 소유자가 한다.`);
    return 1;
  }
  const command = buildCommand(r.tool, normalizeArgs(rest));
  const env = { ...process.env, PATH: [join(root, 'node_modules', '.bin'), process.env['PATH'] ?? ''].join(delimiter) };
  const res = spawnSync(command, { cwd: root, env, shell: true, stdio: 'inherit' });
  if (res.error !== undefined) {
    console.error(`실행 실패: ${res.error.message}`);
    return 1;
  }
  return res.status ?? 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = runTool(PROJECT_ROOT, process.argv.slice(2));
}
