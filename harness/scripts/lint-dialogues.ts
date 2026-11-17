// dialogue.lint: src/data/dialogues.ts의 DialogueLine[]을 검사한다.
//   - 문항 수: 성격당 10문항, 총 40문항 (GDD §콘텐츠)
//   - good/bad 길이 차: |good − bad| ≤ 30% × max(good, bad)  (GDD §콘텐츠 "두 답 길이가 비슷해야 한다")
//   - 중복: 같은 prompt, 문항 안 good=bad → 실패. 서로 다른 문항의 같은 답 → 경고(exit 0)
//   - 금지어: harness/scripts/dialogue-banned-words.txt
//       2글자 이하: 공백·문장부호로 나눈 토큰과 완전히 같을 때만("한남동", "한 남자", "애 자랑"은 통과)
//       3글자 이상: 부분 문자열(공백은 지우지 않는다)
// 원본: docs/harness-design.md §3, §5. 계약: src/contracts/tooling.ts (DialoguesModule), customer.ts (DialogueLine)
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DialogueLine, Personality } from '../../src/contracts/customer.ts';
import { TOOL_ENTRY_PATHS } from '../../src/contracts/tooling.ts';
import { PROJECT_ROOT, charLength, exists, isMain, isRecord, missingTarget, readText } from './lib/common.ts';

export const DIALOGUES_PATH = TOOL_ENTRY_PATHS.dialogues;
export const BANNED_PATH = 'harness/scripts/dialogue-banned-words.txt';
export const MAX_LENGTH_DIFF = 0.3;
/** GDD §콘텐츠 "각 10문항(총 40)". */
export const LINES_PER_PERSONALITY = 10;
/** 이 글자 수 이하 금지어는 토큰 완전 일치로만 잡는다. */
export const SHORT_BANNED_MAX = 2;

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
const lower = (s: string): string => norm(s).toLowerCase();
/** 공백·문장부호·기호로 나눈 토큰. */
export const tokens = (s: string): string[] => lower(s).split(/[\s\p{P}\p{S}]+/u).filter((t) => t !== '');

export function lengthDiffRatio(a: string, b: string): number {
  const la = charLength(norm(a));
  const lb = charLength(norm(b));
  return Math.abs(la - lb) / Math.max(la, lb);
}

/** 금지어가 text에 있는지. 짧은 말은 토큰 완전 일치, 긴 말은 부분 문자열. */
export function containsBanned(text: string, word: string): boolean {
  const w = lower(word);
  if (w === '') return false;
  if (charLength(w) <= SHORT_BANNED_MAX) return tokens(text).includes(w);
  return lower(text).includes(w);
}

export interface LintResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function lintDialogues(lines: readonly DialogueLine[], banned: readonly string[]): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const label = (i: number): string => `#${i}(${lines[i]?.personality ?? '?'})`;
  for (const p of PERSONALITIES) {
    const n = lines.filter((l) => l.personality === p).length;
    if (n !== LINES_PER_PERSONALITY) errors.push(`${p} 문항 ${n}개 ≠ ${LINES_PER_PERSONALITY}개`);
  }
  const total = PERSONALITIES.length * LINES_PER_PERSONALITY;
  if (lines.length !== total) errors.push(`총 문항 ${lines.length}개 ≠ ${total}개`);
  lines.forEach((l, i) => {
    const r = lengthDiffRatio(l.good, l.bad);
    if (r > MAX_LENGTH_DIFF) {
      errors.push(`${label(i)} 길이 차 ${Math.round(r * 100)}% > ${MAX_LENGTH_DIFF * 100}%: good ${charLength(norm(l.good))}자, bad ${charLength(norm(l.bad))}자`);
    }
    if (norm(l.good) === norm(l.bad)) errors.push(`${label(i)} good과 bad가 같다`);
  });
  const seen = new Map<string, string>();
  lines.forEach((l, i) => {
    const p = norm(l.prompt);
    const prev = seen.get(p);
    if (prev !== undefined) errors.push(`${label(i)} prompt 중복(${prev}): ${p}`);
    else seen.set(p, label(i));
  });
  const answers = new Map<string, string>();
  lines.forEach((l, i) => {
    for (const f of ['good', 'bad'] as const) {
      const key = norm(l[f]);
      const prev = answers.get(key);
      if (prev === undefined) answers.set(key, `${label(i)}.${f}`);
      else if (!prev.startsWith(`${label(i)}.`)) warnings.push(`${label(i)}.${f} 다른 문항과 같은 답(${prev}): ${key}`);
    }
  });
  lines.forEach((l, i) => {
    for (const f of TEXT_FIELDS) {
      for (const w of banned) if (containsBanned(l[f], w)) errors.push(`${label(i)}.${f} 금지어 "${w}"`);
    }
  });
  return { errors, warnings };
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
  const { errors, warnings } = lintDialogues(lines, parseBannedWords(bannedText));
  const counts = PERSONALITIES.map((p) => `${p} ${lines.filter((l) => l.personality === p).length}`).join(', ');
  console.log(`문항 ${lines.length}개 (${counts})`);
  if (warnings.length > 0) console.log(`dialogue.lint 경고 ${warnings.length}건:\n  ${warnings.join('\n  ')}`);
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
