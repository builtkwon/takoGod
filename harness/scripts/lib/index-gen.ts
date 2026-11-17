// .claude/skills/INDEX.md 렌더링. 배치 에이전트는 agents의 skills를 역산한다. 메타 스킬은 제외.
import type { HarnessModel } from './model.ts';

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function list(items: readonly string[]): string {
  return items.length === 0 ? '-' : items.join(', ');
}

/** 결정적 출력(정렬, 타임스탬프 없음). full 검사가 커밋된 파일과 문자열 비교한다. */
export function renderIndex(model: HarnessModel): string {
  const skills = [...model.skills].sort((a, b) => byName(a.skill.name, b.skill.name));
  const agents = [...model.agents].sort((a, b) => byName(a.agent.name, b.agent.name));
  const placedIn = (skill: string): string[] =>
    agents.filter((a) => a.agent.skills.includes(skill)).map((a) => a.agent.name);

  const out: string[] = [
    '<!-- 생성물: pnpm tool harness.index 로 재생성한다. 직접 수정 금지. -->',
    '# 스킬 INDEX',
    '',
    '## 스킬',
    '',
  ];
  if (skills.length === 0) out.push('스킬 없음.');
  else {
    out.push('| 스킬 | 버전 | 설명 | 배치 에이전트 | requires | 도구 | 경로 |');
    out.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const { path, skill } of skills) {
      const tools = [...new Set(skill.steps.flatMap((s) => s.tools))].sort();
      out.push(
        `| ${skill.name} | v${skill.version} | ${cell(skill.description)} | ${list(placedIn(skill.name))} | ${list(skill.requires)} | ${list(tools)} | ${path} |`,
      );
    }
  }
  out.push('', '## 에이전트', '');
  if (agents.length === 0) out.push('에이전트 없음.');
  else {
    out.push('| 에이전트 | 스킬 | allowed_tools |');
    out.push('| --- | --- | --- |');
    for (const { agent } of agents) {
      out.push(`| ${agent.name} | ${list(agent.skills)} | ${list(agent.allowed_tools)} |`);
    }
  }
  return `${out.join('\n')}\n`;
}
