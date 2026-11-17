// dialogue.lint: src/data/dialogues.ts의 DialogueLine[]을 검사한다.
//   - good/bad 길이 차: |good − bad| ≤ 30% × max(good, bad)  (GDD §콘텐츠 "두 답 길이가 비슷해야 한다")
//   - 중복: 같은 prompt, 같은 답 문구(문항 간·문항 안 good=bad)
//   - 금지어: harness/scripts/dialogue-banned-words.txt
// 원본: docs/harness-design.md §3, §5. 계약: src/contracts/tooling.ts (DialoguesModule), customer.ts (DialogueLine)
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DialogueLine, Personality } from '../../src/contracts/customer.ts';
import { PROJECT_ROOT, charLength, exists, isMain, isRecord, missingTarget, readText } from './lib/common.ts';

export const DIALOGUES_PATH = 'src/data/dialogues.ts';
export const BANNED_PATH = 'harness/scripts/dialogue-banned-words.txt';
export const MAX_LENGTH_DIFF = 0.3;

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const TEXT_FIELDS = ['prompt', 'good', 'bad'] as const;

export function parseBannedWords(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

/** 모듈 모양 검증. 실패 사유 목록 또는 DialogueLine[]. */
export function validateModule(mod: unknown): DialogueLine[] | string[] {
  if (!isRecord(mod) || !Array.isArray(mod['dialogues'])) return ['dialogues: DialogueLine[] export가 없다'];
  const errors: string[] = [];
  const lines: DialogueLine[] = [];
  mod['dialogues'].forEach((d: unknown, i) => {
    if (!isRecord(d)) {
      errors.push(`#${i}: 객체가 아니다`);
      return;
    }
    let ok = true;
    if (!PERSONALITIES.includes(d['personality'] as Personality)) {
      errors.push(`#${i}: personality는 ${PERSONALITIES.join('|')} (${String(d['personality'])})`);
      ok = false;
    }
    for (const f of TEXT_FIELDS) {
      if (typeof d[f] !== 'string' || (d[f] as string).trim() === '') {
        errors.push(`#${i}: ${f}는 비어 있지 않은 문자열이어야 한다`);
        ok = false;
      }
    }
    if (ok) lines.push(d as unknown as DialogueLine);
  });
  if (lines.length === 0 && errors.length === 0) errors.push('dialogues가 비어 있다');
  return errors.length > 0 ? errors : lines;
}

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ');
const compact = (s: string): string => s.replace(/\s+/g, '').toLowerCase();

export function lengthDiffRatio(a: string, b: string): number {
  const la = charLength(norm(a));
  const lb = charLength(norm(b));
  return Math.abs(la - lb) / Math.max(la, lb);
}

export function lintDialogues(lines: readonly DialogueLine[], banned: readonly string[]): string[] {
  const errors: string[] = [];
  const label = (i: number): string => `#${i}(${lines[i]?.personality ?? '?'})`;
  lines.forEach((l, i) => {
    const r = lengthDiffRatio(l.good, l.bad);
    if (r > MAX_LENGTH_DIFF) {
      errors.push(`${label(i)} 길이 차 ${Math.round(r * 100)}% > ${MAX_LENGTH_DIFF * 100}%: good ${charLength(norm(l.good))}자, bad ${charLength(norm(l.bad))}자`);
    }
    if (norm(l.good) === norm(l.bad)) errors.push(`${label(i)} good과 bad가 같다`);
  });
  const seen = new Map<string, string>();
  lines.forEach((l, i) => {
    const p = `prompt:${norm(l.prompt)}`;
    const prev = seen.get(p);
    if (prev !== undefined) errors.push(`${label(i)} prompt 중복(${prev}): ${norm(l.prompt)}`);
    else seen.set(p, label(i));
  });
  const answers = new Map<string, string>();
  lines.forEach((l, i) => {
    for (const f of ['good', 'bad'] as const) {
      const key = norm(l[f]);
      const prev = answers.get(key);
      if (prev !== undefined && prev !== label(i)) errors.push(`${label(i)}.${f} 답 중복(${prev}): ${key}`);
      else answers.set(key, label(i));
    }
  });
  const bannedCompact = banned.map((w) => [w, compact(w)] as const);
  lines.forEach((l, i) => {
    for (const f of TEXT_FIELDS) {
      const text = compact(l[f]);
      for (const [w, c] of bannedCompact) if (c !== '' && text.includes(c)) errors.push(`${label(i)}.${f} 금지어 "${w}"`);
    }
  });
  return errors;
}

export type Loader = (absPath: string) => Promise<unknown>;
const defaultLoader: Loader = (abs) => import(pathToFileURL(abs).href);

export async function runLint(root: string, load: Loader = defaultLoader): Promise<number> {
  if (!exists(root, DIALOGUES_PATH)) return missingTarget(DIALOGUES_PATH);
  const bannedText = readText(root, BANNED_PATH);
  if (bannedText === undefined) {
    console.error(`금지어 목록 없음: ${BANNED_PATH}`);
    return 1;
  }
  let mod: unknown;
  try {
    mod = await load(join(root, DIALOGUES_PATH));
  } catch (e) {
    console.error(`${DIALOGUES_PATH} import 실패: ${(e as Error).message}`);
    return 1;
  }
  const v = validateModule(mod);
  if (v.length > 0 && typeof v[0] === 'string') {
    console.error(`${DIALOGUES_PATH} 형식 오류:\n  ${(v as string[]).join('\n  ')}`);
    return 1;
  }
  const lines = v as DialogueLine[];
  const errors = lintDialogues(lines, parseBannedWords(bannedText));
  const counts = PERSONALITIES.map((p) => `${p} ${lines.filter((l) => l.personality === p).length}`).join(', ');
  console.log(`문항 ${lines.length}개 (${counts})`);
  if (errors.length > 0) {
    console.error(`dialogue.lint 실패 ${errors.length}건:\n  ${errors.join('\n  ')}`);
    return 1;
  }
  console.log('dialogue.lint: 통과');
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = await runLint(PROJECT_ROOT);
}
