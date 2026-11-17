// summary(SessionStart, 읽기 전용). 원본: docs/harness-design.md §7 summary
import { charLength, countLines, readText } from './common.ts';
import { listFormatTargets } from './format.ts';
import { LIMITS, loadModel } from './model.ts';
import { loadToolset } from './toolset.ts';

export const NEAR_LIMIT_RATIO = 0.8;

export interface NearLimit {
  readonly path: string;
  readonly what: string;
  readonly value: number;
  readonly limit: number;
}

export interface Summary {
  readonly skillCount: number;
  readonly metaSkillCount: number;
  readonly agentCount: number;
  readonly nearLimit: readonly NearLimit[];
  readonly plannedTools: readonly string[];
  readonly problems: readonly string[];
}

export function collectSummary(root: string): Summary {
  const model = loadModel(root);
  const nearLimit: NearLimit[] = [];
  const near = (path: string, what: string, value: number, limit: number): void => {
    if (value >= limit * NEAR_LIMIT_RATIO) nearLimit.push({ path, what, value, limit });
  };
  for (const rel of listFormatTargets(root)) {
    const text = readText(root, rel) ?? '';
    if (rel.endsWith('/SKILL.md')) near(rel, '줄', countLines(text), LIMITS.skillLines);
    else if (rel.includes('/references/')) near(rel, '줄', countLines(text), LIMITS.referenceLines);
  }
  for (const s of [...model.skills, ...model.metaSkills]) {
    near(s.path, 'description 자', charLength(s.skill.description), LIMITS.descriptionChars);
  }
  const ts = loadToolset(root);
  return {
    skillCount: model.skills.length,
    metaSkillCount: model.metaSkills.length,
    agentCount: model.agents.length,
    nearLimit,
    plannedTools: ts.ok ? ts.toolset.tools.filter((t) => t.status === 'planned').map((t) => t.id) : [],
    problems: [...model.loadErrors, ...(ts.ok ? [] : ts.errors.map((e) => `toolset: ${e}`))],
  };
}

export function formatSummary(s: Summary): string {
  const lines = [
    `[harness] 스킬 ${s.skillCount}개, 메타 스킬 ${s.metaSkillCount}개, 에이전트 ${s.agentCount}개`,
    s.nearLimit.length === 0
      ? '[harness] 상한 80% 이상 근접: 없음'
      : `[harness] 상한 80% 이상 근접:\n${s.nearLimit.map((n) => `  ${n.path} ${n.what} ${n.value}/${n.limit}`).join('\n')}`,
    `[harness] planned 도구: ${s.plannedTools.length === 0 ? '없음' : s.plannedTools.join(', ')}`,
  ];
  if (s.problems.length > 0) lines.push(`[harness] 로딩 문제(--full로 확인):\n${s.problems.map((p) => `  ${p}`).join('\n')}`);
  return lines.join('\n');
}
