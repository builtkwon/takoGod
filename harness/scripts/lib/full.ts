// full 검사(쓰기 없음). 원본: docs/harness-design.md §7 full
import { listFiles, readText } from './common.ts';
import { checkFormatFile, listFormatTargets } from './format.ts';
import { renderIndex } from './index-gen.ts';
import { INDEX_PATH, PROPOSALS_DIR, loadModel, LIMITS, type HarnessModel, type LoadedSkill } from './model.ts';
import { loadToolset, type Toolset } from './toolset.ts';

export type Status = 'ok' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  readonly name: string;
  readonly status: Status;
  readonly messages: readonly string[];
}

function result(name: string, failures: readonly string[], level: 'fail' | 'warn' = 'fail'): CheckResult {
  return { name, status: failures.length > 0 ? level : 'ok', messages: failures };
}

function allSkills(model: HarnessModel): LoadedSkill[] {
  return [...model.skills, ...model.metaSkills];
}

export function checkAgentSkills(model: HarnessModel): CheckResult {
  const names = new Set(model.skills.map((s) => s.skill.name));
  const metaNames = new Set(model.metaSkills.map((s) => s.skill.name));
  const out: string[] = [];
  for (const { agent } of model.agents) {
    for (const s of agent.skills) {
      if (metaNames.has(s)) out.push(`${agent.name}: 메타 스킬 ${s}은 skills에 넣지 않는다(본문에 경로로 안내)`);
      else if (!names.has(s)) out.push(`${agent.name}: 없는 스킬 ${s}`);
    }
  }
  return result('agent → skill', out);
}

export function checkSkillTools(model: HarnessModel, toolset: Toolset): CheckResult {
  const ids = new Set(toolset.tools.map((t) => t.id));
  const out: string[] = [];
  for (const { skill } of allSkills(model)) {
    for (const step of skill.steps) {
      for (const t of step.tools) if (!ids.has(t)) out.push(`${skill.name}.${step.id}: toolset에 없는 ID ${t}`);
    }
  }
  for (const { agent } of model.agents) {
    for (const t of agent.allowed_tools) if (!ids.has(t)) out.push(`${agent.name}.allowed_tools: toolset에 없는 ID ${t}`);
  }
  return result('skill → tool', out);
}

export function checkToolPermission(model: HarnessModel): CheckResult {
  const byName = new Map(model.skills.map((s) => [s.skill.name, s.skill]));
  const out: string[] = [];
  for (const { agent } of model.agents) {
    const used = new Set<string>();
    for (const name of agent.skills) for (const step of byName.get(name)?.steps ?? []) step.tools.forEach((t) => used.add(t));
    const missing = [...used].filter((t) => !agent.allowed_tools.includes(t)).sort();
    if (missing.length > 0) out.push(`${agent.name}: 스킬이 쓰는 도구 ${missing.join(', ')} ⊄ allowed_tools`);
  }
  return result('도구 허용', out);
}

export function checkRequires(model: HarnessModel): CheckResult {
  const skills = allSkills(model);
  const byName = new Map(skills.map((s) => [s.skill.name, s]));
  const out: string[] = [];
  for (const { skill, meta } of skills) {
    if (skill.requires.length > LIMITS.requiresMax) out.push(`${skill.name}: requires ${skill.requires.length}개(최대 ${LIMITS.requiresMax})`);
    for (const r of skill.requires) {
      const dep = byName.get(r);
      if (dep === undefined) out.push(`${skill.name}: 없는 스킬 requires ${r}`);
      else if (dep.meta !== meta) out.push(`${skill.name}: 메타/일반 경계를 넘는 requires ${r}`);
    }
  }
  // 순환: DFS
  const state = new Map<string, 'visiting' | 'done'>();
  const reported = new Set<string>();
  const visit = (name: string, path: string[]): void => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      const cycle = [...path.slice(path.indexOf(name)), name];
      const key = [...cycle].slice(0, -1).sort().join(',');
      if (!reported.has(key)) {
        reported.add(key);
        out.push(`순환: ${cycle.join(' → ')}`);
      }
      return;
    }
    state.set(name, 'visiting');
    for (const r of byName.get(name)?.skill.requires ?? []) if (byName.has(r)) visit(r, [...path, name]);
    state.set(name, 'done');
  };
  for (const { skill } of skills) visit(skill.name, []);
  // 같은 에이전트 안에서만
  for (const { agent } of model.agents) {
    for (const s of agent.skills) {
      for (const r of byName.get(s)?.skill.requires ?? []) {
        if (!agent.skills.includes(r)) out.push(`${agent.name}: ${s}가 requires하는 ${r}이 같은 에이전트에 없다(다른 에이전트 스킬)`);
      }
    }
  }
  return result('requires', out);
}

export function checkConsumes(model: HarnessModel): CheckResult {
  const skills = allSkills(model);
  const produced = new Set(skills.flatMap((s) => s.skill.produces));
  const out: string[] = [];
  for (const { skill } of skills) {
    for (const c of skill.consumes) if (!produced.has(c)) out.push(`${skill.name}: consumes ${c}의 생산자 없음`);
  }
  return result('consumes', out);
}

export function checkIndexFresh(root: string, model: HarnessModel): CheckResult {
  const committed = readText(root, INDEX_PATH);
  if (committed === undefined) {
    if (model.skills.length === 0) return { name: 'INDEX 최신성', status: 'ok', messages: ['INDEX 없음(스킬 0개라 대상 없음)'] };
    return result('INDEX 최신성', [`${INDEX_PATH} 없음 — pnpm tool harness.index 로 생성`]);
  }
  if (committed !== renderIndex(model)) {
    return result('INDEX 최신성', [`${INDEX_PATH}가 frontmatter와 다르다 — pnpm tool harness.index 로 재생성`]);
  }
  return result('INDEX 최신성', []);
}

export function checkOrphans(model: HarnessModel): CheckResult {
  const placed = new Set(model.agents.flatMap((a) => a.agent.skills));
  const out = model.skills.filter((s) => !placed.has(s.skill.name)).map((s) => `배치 안 된 스킬: ${s.skill.name}`);
  return result('고아', out, 'warn');
}

/** 제안표의 배치표: 헤더에 `에이전트`와 `skills` 열이 있는 첫 마크다운 표. (meta) 항목은 제외. */
export function parsePlacement(markdown: string): Map<string, string[]> | undefined {
  const lines = markdown.split('\n');
  const cells = (l: string): string[] => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim().startsWith('|')) continue;
    const header = cells(line);
    const agentCol = header.indexOf('에이전트');
    const skillsCol = header.indexOf('skills');
    if (agentCol < 0 || skillsCol < 0) continue;
    const map = new Map<string, string[]>();
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').trim().startsWith('|'); j++) {
      const row = cells(lines[j] ?? '');
      const agent = (row[agentCol] ?? '').replace(/`/g, '');
      if (agent === '') continue;
      const raw = (row[skillsCol] ?? '').replace(/`/g, '');
      const skills = raw.startsWith('(meta)')
        ? []
        : raw.split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== '-');
      map.set(agent, skills);
    }
    return map;
  }
  return undefined;
}

export function latestProposal(root: string): string | undefined {
  const files = listFiles(root, PROPOSALS_DIR).filter((f) => /^\d{4}-.+\.md$/.test(f));
  const last = files.sort().at(-1);
  return last === undefined ? undefined : `${PROPOSALS_DIR}/${last}`;
}

export function checkProposalDiff(root: string, model: HarnessModel): CheckResult {
  const name = '승인안 diff';
  const path = latestProposal(root);
  if (path === undefined) return { name, status: 'skip', messages: ['제안표 없음'] };
  const placement = parsePlacement(readText(root, path) ?? '');
  if (placement === undefined) return result(name, [`${path}: 배치표(에이전트·skills 열)를 찾지 못함`], 'warn');
  const out: string[] = [];
  const actual = new Map(model.agents.map((a) => [a.agent.name, a.agent.skills]));
  for (const [agent, want] of placement) {
    const have = actual.get(agent);
    if (have === undefined) {
      out.push(`${agent}: 제안표에 있으나 생성되지 않음`);
      continue;
    }
    const missing = want.filter((s) => !have.includes(s));
    const extra = have.filter((s) => !want.includes(s));
    if (missing.length > 0) out.push(`${agent}: 제안표 대비 누락 ${missing.join(', ')}`);
    if (extra.length > 0) out.push(`${agent}: 제안표에 없는 스킬 ${extra.join(', ')}`);
  }
  for (const agent of actual.keys()) if (!placement.has(agent)) out.push(`${agent}: 제안표에 없는 에이전트`);
  return result(name, out.map((m) => `${path} — ${m}`), 'warn');
}

export function runFull(root: string): CheckResult[] {
  const formatErrors = listFormatTargets(root).flatMap((rel) => checkFormatFile(root, rel).map((e) => `${rel}: ${e}`));
  const model = loadModel(root);
  const loadOnly = model.loadErrors.filter((e) => e.includes('SKILL.md 없음'));
  const results: CheckResult[] = [result('format', [...loadOnly, ...formatErrors])];
  const ts = loadToolset(root);
  if (!ts.ok) results.push(result('toolset', [...ts.errors]));
  else {
    results.push(result('toolset', []));
    results.push(checkSkillTools(model, ts.toolset));
  }
  results.push(
    checkAgentSkills(model),
    checkToolPermission(model),
    checkRequires(model),
    checkConsumes(model),
    checkIndexFresh(root, model),
    checkOrphans(model),
    checkProposalDiff(root, model),
  );
  return results;
}

export function formatResults(results: readonly CheckResult[]): string {
  const tag: Record<Status, string> = { ok: 'OK  ', fail: 'FAIL', warn: 'WARN', skip: 'SKIP' };
  return results
    .map((r) => [`[${tag[r.status]}] ${r.name}`, ...r.messages.map((m) => `       ${m}`)].join('\n'))
    .join('\n');
}
