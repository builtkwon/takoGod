// 스킬·에이전트 frontmatter 로딩과 스키마 검증. 스키마 원본: docs/harness-design.md §6
import { parse } from 'yaml';
import { charLength, isRecord, isStringArray, listDirs, listFiles, readText } from './common.ts';
import { TOOL_ID_RE } from './toolset.ts';

export const SKILLS_DIR = '.claude/skills';
export const META_SKILLS_DIR = 'harness/meta-skills';
export const AGENTS_DIR = '.claude/agents';
export const INDEX_PATH = '.claude/skills/INDEX.md';
export const PROPOSALS_DIR = 'harness/proposals';
/** 메타 스킬의 소속 에이전트(도구 허용·본문 도구 호출 대조 기준). */
export const META_SKILL_OWNER = 'harness-gardener';

export const LIMITS = {
  skillLines: 120,
  referenceLines: 200,
  descriptionChars: 200,
  mustWithinBodyLines: 20,
  mustMaxItems: 5,
  requiresMax: 2,
} as const;

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export interface SplitDoc {
  readonly frontmatter: string;
  readonly body: string;
}

/** `---` 로 감싼 frontmatter와 본문을 나눈다. 없으면 undefined. */
export function splitFrontmatter(text: string): SplitDoc | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (m === null) return undefined;
  return { frontmatter: m[1] ?? '', body: text.slice(m[0].length) };
}

export interface Skill {
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly requires: readonly string[];
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
  /** S1..Sn 순서. */
  readonly steps: readonly { readonly id: string; readonly tools: readonly string[] }[];
}

export interface Agent {
  readonly name: string;
  readonly description: string;
  readonly tools: string;
  readonly skills: readonly string[];
  readonly allowed_tools: readonly string[];
  readonly owns: readonly string[];
}

export type Parsed<T> =
  | { readonly ok: true; readonly value: T; readonly body: string }
  | { readonly ok: false; readonly errors: readonly string[] };

function parseYamlFrontmatter(text: string): { raw: Record<string, unknown>; body: string } | string {
  const split = splitFrontmatter(text);
  if (split === undefined) return 'frontmatter(---) 없음';
  let raw: unknown;
  try {
    raw = parse(split.frontmatter);
  } catch (e) {
    return `frontmatter YAML 파싱 실패: ${(e as Error).message}`;
  }
  if (!isRecord(raw)) return 'frontmatter가 매핑이 아니다';
  return { raw, body: split.body };
}

function checkKeys(raw: Record<string, unknown>, allowed: readonly string[], errors: string[]): void {
  for (const k of Object.keys(raw)) if (!allowed.includes(k)) errors.push(`알 수 없는 frontmatter 키: ${k}`);
  for (const k of allowed) if (!(k in raw)) errors.push(`frontmatter 키 누락: ${k}`);
}

function checkDescription(v: unknown, errors: string[]): void {
  if (typeof v !== 'string' || v.trim() === '') {
    errors.push('description은 비어 있지 않은 문자열이어야 한다');
    return;
  }
  if (v.includes('\n')) errors.push('description은 한 줄이어야 한다');
  const n = charLength(v);
  if (n > LIMITS.descriptionChars) errors.push(`description ${n}자 > ${LIMITS.descriptionChars}자`);
}

function checkName(v: unknown, expected: string, errors: string[]): void {
  if (typeof v !== 'string' || !KEBAB_RE.test(v)) errors.push(`name은 kebab-case여야 한다: ${String(v)}`);
  else if (v !== expected) errors.push(`name(${v})이 경로 이름(${expected})과 다르다`);
}

function stringList(raw: Record<string, unknown>, key: string, errors: string[]): string[] {
  const v = raw[key];
  if (v === undefined) return [];
  if (!isStringArray(v)) {
    errors.push(`${key}는 문자열 배열이어야 한다`);
    return [];
  }
  return v;
}

const SKILL_KEYS = ['name', 'version', 'description', 'requires', 'consumes', 'produces', 'steps'] as const;

export function parseSkill(text: string, dirName: string): Parsed<Skill> {
  const fm = parseYamlFrontmatter(text);
  if (typeof fm === 'string') return { ok: false, errors: [fm] };
  const { raw, body } = fm;
  const errors: string[] = [];
  checkKeys(raw, SKILL_KEYS, errors);
  checkName(raw['name'], dirName, errors);
  const version = raw['version'];
  if (!Number.isInteger(version) || (version as number) < 1) errors.push('version은 1 이상의 정수여야 한다');
  checkDescription(raw['description'], errors);
  const requires = stringList(raw, 'requires', errors);
  if (requires.length > LIMITS.requiresMax) errors.push(`requires ${requires.length}개 > ${LIMITS.requiresMax}개`);
  const consumes = stringList(raw, 'consumes', errors);
  const produces = stringList(raw, 'produces', errors);

  const steps: { id: string; tools: string[] }[] = [];
  const stepsRaw = raw['steps'];
  if (!isRecord(stepsRaw) || Object.keys(stepsRaw).length === 0) {
    errors.push('steps는 S1부터 시작하는 비어 있지 않은 매핑이어야 한다');
  } else {
    Object.entries(stepsRaw).forEach(([key, val], i) => {
      const want = `S${i + 1}`;
      if (key !== want) errors.push(`steps 키는 S1..Sn 연속이어야 한다: ${i + 1}번째가 ${key}(기대 ${want})`);
      if (!isRecord(val) || Object.keys(val).some((k) => k !== 'tools') || !isStringArray(val['tools'])) {
        errors.push(`steps.${key}는 { tools: [도구 ID...] } 형식이어야 한다`);
        return;
      }
      for (const t of val['tools']) if (!TOOL_ID_RE.test(t)) errors.push(`steps.${key}: 도구 ID 형식 오류 ${t}`);
      steps.push({ id: key, tools: val['tools'] });
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    body,
    value: {
      name: raw['name'] as string,
      version: version as number,
      description: raw['description'] as string,
      requires,
      consumes,
      produces,
      steps,
    },
  };
}

const AGENT_KEYS = ['name', 'description', 'tools', 'skills', 'allowed_tools', 'owns'] as const;

export function parseAgent(text: string, fileBase: string): Parsed<Agent> {
  const fm = parseYamlFrontmatter(text);
  if (typeof fm === 'string') return { ok: false, errors: [fm] };
  const { raw, body } = fm;
  const errors: string[] = [];
  checkKeys(raw, AGENT_KEYS, errors);
  checkName(raw['name'], fileBase, errors);
  checkDescription(raw['description'], errors);
  if (typeof raw['tools'] !== 'string' || raw['tools'].trim() === '') {
    errors.push('tools는 쉼표로 구분한 문자열이어야 한다(예: Read, Edit)');
  }
  const skills = stringList(raw, 'skills', errors);
  const allowed = stringList(raw, 'allowed_tools', errors);
  for (const t of allowed) if (!TOOL_ID_RE.test(t)) errors.push(`allowed_tools: 도구 ID 형식 오류 ${t}`);
  const owns = stringList(raw, 'owns', errors);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    body,
    value: {
      name: raw['name'] as string,
      description: raw['description'] as string,
      tools: raw['tools'] as string,
      skills,
      allowed_tools: allowed,
      owns,
    },
  };
}

export interface LoadedSkill {
  readonly path: string;
  readonly meta: boolean;
  readonly skill: Skill;
}

export interface LoadedAgent {
  readonly path: string;
  readonly agent: Agent;
}

export interface HarnessModel {
  readonly skills: readonly LoadedSkill[];
  readonly metaSkills: readonly LoadedSkill[];
  readonly agents: readonly LoadedAgent[];
  /** 파싱 실패 등 로딩 중 발견한 문제(경로: 사유). */
  readonly loadErrors: readonly string[];
}

function loadSkillsFrom(root: string, dir: string, meta: boolean, errors: string[]): LoadedSkill[] {
  const out: LoadedSkill[] = [];
  for (const name of listDirs(root, dir)) {
    const path = `${dir}/${name}/SKILL.md`;
    const text = readText(root, path);
    if (text === undefined) {
      errors.push(`${dir}/${name}/: SKILL.md 없음`);
      continue;
    }
    const p = parseSkill(text, name);
    if (p.ok) out.push({ path, meta, skill: p.value });
    else errors.push(...p.errors.map((e) => `${path}: ${e}`));
  }
  return out;
}

export function loadModel(root: string): HarnessModel {
  const errors: string[] = [];
  const skills = loadSkillsFrom(root, SKILLS_DIR, false, errors);
  const metaSkills = loadSkillsFrom(root, META_SKILLS_DIR, true, errors);
  const agents: LoadedAgent[] = [];
  for (const file of listFiles(root, AGENTS_DIR).filter((f) => f.endsWith('.md'))) {
    const path = `${AGENTS_DIR}/${file}`;
    const p = parseAgent(readText(root, path) ?? '', file.replace(/\.md$/, ''));
    if (p.ok) agents.push({ path, agent: p.value });
    else errors.push(...p.errors.map((e) => `${path}: ${e}`));
  }
  return { skills, metaSkills, agents, loadErrors: errors };
}
