// harness/toolset.yaml 로더. 스키마 원본: docs/harness-design.md §5
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { isRecord, readText } from './common.ts';

export const TOOLSET_PATH = 'harness/toolset.yaml';
export const TOOL_ID_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

export type ToolStatus = 'active' | 'planned';

export interface Tool {
  readonly id: string;
  readonly run: string;
  readonly purpose: string;
  readonly side_effect: string;
  readonly status: ToolStatus;
}

export interface Toolset {
  readonly version: number;
  readonly tools: readonly Tool[];
}

export type ToolsetResult =
  | { readonly ok: true; readonly toolset: Toolset }
  | { readonly ok: false; readonly errors: readonly string[] };

const TOOL_KEYS = ['id', 'run', 'purpose', 'side_effect', 'status'] as const;

export function parseToolset(text: string): ToolsetResult {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    return { ok: false, errors: [`YAML 파싱 실패: ${(e as Error).message}`] };
  }
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['최상위가 매핑이 아니다'] };
  for (const k of Object.keys(raw)) {
    if (k !== 'version' && k !== 'tools') errors.push(`알 수 없는 최상위 키: ${k}`);
  }
  if (!Number.isInteger(raw['version']) || (raw['version'] as number) < 1) {
    errors.push('version은 1 이상의 정수여야 한다');
  }
  const toolsRaw = raw['tools'];
  if (!Array.isArray(toolsRaw)) {
    errors.push('tools는 배열이어야 한다');
    return { ok: false, errors };
  }
  const tools: Tool[] = [];
  const seen = new Set<string>();
  toolsRaw.forEach((t: unknown, i) => {
    const at = `tools[${i}]`;
    if (!isRecord(t)) {
      errors.push(`${at}: 매핑이 아니다`);
      return;
    }
    for (const k of Object.keys(t)) {
      if (!(TOOL_KEYS as readonly string[]).includes(k)) errors.push(`${at}: 알 수 없는 키 ${k}`);
    }
    let bad = false;
    for (const k of TOOL_KEYS) {
      if (typeof t[k] !== 'string' || (t[k] as string).trim() === '') {
        errors.push(`${at}: ${k}는 비어 있지 않은 문자열이어야 한다`);
        bad = true;
      }
    }
    if (bad) return;
    const id = t['id'] as string;
    if (!TOOL_ID_RE.test(id)) errors.push(`${at}: id 형식 오류 ${id}`);
    if (seen.has(id)) errors.push(`${at}: 중복 id ${id}`);
    seen.add(id);
    const status = t['status'];
    if (status !== 'active' && status !== 'planned') {
      errors.push(`${at}: status는 active | planned (${String(status)})`);
      return;
    }
    tools.push({
      id,
      run: t['run'] as string,
      purpose: t['purpose'] as string,
      side_effect: t['side_effect'] as string,
      status,
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, toolset: { version: raw['version'] as number, tools } };
}

export function loadToolset(root: string): ToolsetResult {
  const text = readText(root, TOOLSET_PATH);
  if (text === undefined) return { ok: false, errors: [`없음: ${TOOLSET_PATH}`] };
  return parseToolset(text);
}

/** 비교 기준: root 저장소 HEAD의 toolset.yaml 내용. git 저장소가 아니거나 HEAD·파일이 없으면 undefined. */
export function readHeadToolset(root: string): string | undefined {
  const r = spawnSync('git', ['show', `HEAD:${TOOLSET_PATH}`], { cwd: root, encoding: 'utf8' });
  return r.error === undefined && r.status === 0 ? r.stdout : undefined;
}
