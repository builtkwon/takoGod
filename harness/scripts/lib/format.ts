// format 검사(파일 1개). 원본: docs/harness-design.md §6, §7 format
import { countLines, listDirs, listFiles, readText } from './common.ts';
import { AGENTS_DIR, LIMITS, META_SKILLS_DIR, SKILLS_DIR, parseAgent, parseSkill } from './model.ts';

export type Target =
  | { readonly kind: 'skill'; readonly name: string }
  | { readonly kind: 'reference' }
  | { readonly kind: 'agent'; readonly name: string }
  | { readonly kind: 'other-in-scope' }
  | { readonly kind: 'out-of-scope' };

/** 대상 경로: .claude/**, harness/meta-skills/**. 그 외는 즉시 통과. */
export function classify(rel: string): Target {
  if (!rel.startsWith('.claude/') && !rel.startsWith(`${META_SKILLS_DIR}/`)) return { kind: 'out-of-scope' };
  for (const dir of [SKILLS_DIR, META_SKILLS_DIR]) {
    const rest = rel.startsWith(`${dir}/`) ? rel.slice(dir.length + 1).split('/') : undefined;
    if (rest === undefined) continue;
    if (rest.length === 2 && rest[1] === 'SKILL.md') return { kind: 'skill', name: rest[0] ?? '' };
    if (rest.length === 3 && rest[1] === 'references' && rest[2]?.endsWith('.md')) return { kind: 'reference' };
  }
  const agent = new RegExp(`^${AGENTS_DIR.replace('.', '\\.')}/([^/]+)\\.md$`).exec(rel);
  if (agent !== null) return { kind: 'agent', name: agent[1] ?? '' };
  return { kind: 'other-in-scope' };
}

const CMD_RE = /\b(pnpm|npx|tsx|node)\b/;
/** 허용 형식: `pnpm tool <id>`(문자 그대로 또는 실제 ID). 뒤의 `-- 인자`는 명령어 문자열이 아니므로 허용. */
const ALLOWED_TOOL_CALL_RE = /pnpm tool (?:<id>|[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*)/g;

/** 본문에서 명령어 문자열을 찾는다. 반환: "N행: 내용" 목록. */
export function findCommandStrings(body: string): string[] {
  const hits: string[] = [];
  body.split('\n').forEach((line, i) => {
    const stripped = line.replace(ALLOWED_TOOL_CALL_RE, '');
    const m = CMD_RE.exec(stripped);
    if (m !== null) hits.push(`본문 ${i + 1}행에 명령어 문자열 "${m[1]}" — 도구는 pnpm tool <id>로만 부른다`);
  });
  return hits;
}

interface Section {
  readonly start: number;
  /** 마지막 비어 있지 않은 줄(0 기준). */
  readonly lastContent: number;
  readonly lines: readonly string[];
}

function findSection(bodyLines: readonly string[], title: string): Section | undefined {
  const start = bodyLines.findIndex((l) => l.trim() === `## ${title}`);
  if (start < 0) return undefined;
  let end = bodyLines.length;
  for (let i = start + 1; i < bodyLines.length; i++) {
    if (/^##?\s/.test(bodyLines[i] ?? '')) {
      end = i;
      break;
    }
  }
  const lines = bodyLines.slice(start + 1, end);
  let lastContent = start;
  lines.forEach((l, i) => {
    if (l.trim() !== '') lastContent = start + 1 + i;
  });
  return { start, lastContent, lines };
}

const STEP_REF_RE = /^\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)?\**(S\d+)\b/;

export function checkSkillBody(body: string, stepIds: readonly string[]): string[] {
  const errors: string[] = [];
  const lines = body.split('\n');
  const must = findSection(lines, 'MUST');
  if (must === undefined) errors.push('## MUST 섹션 없음');
  else {
    if (must.lastContent >= LIMITS.mustWithinBodyLines) {
      errors.push(`MUST 섹션이 본문 첫 ${LIMITS.mustWithinBodyLines}줄을 넘는다(${must.lastContent + 1}행에서 끝남)`);
    }
    const items = must.lines.filter((l) => /^([-*]|\d+\.)\s+/.test(l)).length;
    if (items === 0) errors.push('MUST 항목 없음');
    if (items > LIMITS.mustMaxItems) errors.push(`MUST 항목 ${items}개 > ${LIMITS.mustMaxItems}개`);
  }
  const stepsSec = findSection(lines, '단계');
  if (stepsSec === undefined) errors.push('## 단계 섹션 없음');
  else {
    const found: string[] = [];
    for (const l of stepsSec.lines) {
      const m = STEP_REF_RE.exec(l);
      if (m?.[1] !== undefined && !found.includes(m[1])) found.push(m[1]);
    }
    if (found.join(',') !== stepIds.join(',')) {
      errors.push(`본문 단계(${found.join(',') || '없음'})가 frontmatter steps(${stepIds.join(',')})와 다르다`);
    }
  }
  errors.push(...findCommandStrings(body));
  return errors;
}

/** 파일 1개 format 검사. 반환: 실패 사유 목록(빈 배열 = 통과). */
export function checkFormatFile(root: string, rel: string): string[] {
  const target = classify(rel);
  if (target.kind === 'out-of-scope' || target.kind === 'other-in-scope') return [];
  const text = readText(root, rel);
  if (text === undefined) return []; // 삭제된 파일
  const lines = countLines(text);
  if (target.kind === 'reference') {
    const errors = lines > LIMITS.referenceLines ? [`${lines}줄 > ${LIMITS.referenceLines}줄`] : [];
    return [...errors, ...findCommandStrings(text)];
  }
  if (target.kind === 'agent') {
    const p = parseAgent(text, target.name);
    return p.ok ? findCommandStrings(p.body) : [...p.errors];
  }
  const errors: string[] = [];
  if (lines > LIMITS.skillLines) errors.push(`SKILL.md ${lines}줄 > ${LIMITS.skillLines}줄`);
  const p = parseSkill(text, target.name);
  if (!p.ok) return [...errors, ...p.errors];
  return [...errors, ...checkSkillBody(p.body, p.value.steps.map((s) => s.id))];
}

/** full 검사에서 쓰는 format 대상 전체. */
export function listFormatTargets(root: string): string[] {
  const out: string[] = [];
  for (const dir of [SKILLS_DIR, META_SKILLS_DIR]) {
    for (const name of listDirs(root, dir)) {
      if (readText(root, `${dir}/${name}/SKILL.md`) !== undefined) out.push(`${dir}/${name}/SKILL.md`);
      for (const f of listFiles(root, `${dir}/${name}/references`)) {
        if (f.endsWith('.md')) out.push(`${dir}/${name}/references/${f}`);
      }
    }
  }
  for (const f of listFiles(root, AGENTS_DIR)) if (f.endsWith('.md')) out.push(`${AGENTS_DIR}/${f}`);
  return out;
}
