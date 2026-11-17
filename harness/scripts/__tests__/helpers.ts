// 테스트 픽스처: 임시 저장소와 SKILL.md·에이전트 생성기.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, vi } from 'vitest';

const created: string[] = [];

afterEach(() => {
  while (created.length > 0) rmSync(created.pop() as string, { recursive: true, force: true });
  vi.restoreAllMocks();
});

export function makeRepo(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'harness-test-'));
  created.push(root);
  writeFiles(root, files);
  return root;
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

export const TOOLSET = `version: 1
tools:
  - id: test.unit
    run: echo unit
    purpose: 단위 테스트
    side_effect: none
    status: active
  - id: build
    run: echo build
    purpose: 빌드
    side_effect: none
    status: active
  - id: test.e2e
    run: echo e2e
    purpose: E2E
    side_effect: none
    status: planned
`;

export interface SkillSpec {
  name: string;
  version?: number;
  description?: string;
  requires?: string[];
  consumes?: string[];
  produces?: string[];
  steps?: Record<string, string[]>;
  must?: string[];
  /** 지정하면 본문 전체를 대체한다. */
  body?: string;
  /** MUST 앞에 넣을 빈 줄 수(20줄 규칙 검사용). */
  padBeforeMust?: number;
  /** 단계 뒤에 붙일 줄 수(줄 수 상한 검사용). */
  padAfter?: number;
}

const list = (xs: readonly string[]): string => `[${xs.join(', ')}]`;

export function skillMd(spec: SkillSpec): string {
  const steps = spec.steps ?? { S1: [], S2: ['test.unit'] };
  const fm = [
    '---',
    `name: ${spec.name}`,
    `version: ${spec.version ?? 1}`,
    `description: ${spec.description ?? `${spec.name}가 필요할 때 쓴다.`}`,
    `requires: ${list(spec.requires ?? [])}`,
    `consumes: ${list(spec.consumes ?? [])}`,
    `produces: ${list(spec.produces ?? [])}`,
    'steps:',
    ...Object.entries(steps).map(([k, tools]) => `  ${k}: { tools: ${list(tools)} }`),
    '---',
  ];
  const body =
    spec.body ??
    [
      ...Array<string>(spec.padBeforeMust ?? 0).fill(''),
      '## MUST',
      '',
      ...(spec.must ?? ['결과를 영수증으로 남긴다.']).map((m) => `- ${m}`),
      '',
      '## 단계',
      '',
      ...Object.keys(steps).map((k) => `- ${k} 작업. 도구는 pnpm tool test.unit 으로 부른다.`),
      ...Array<string>(spec.padAfter ?? 0).fill('추가 설명'),
    ].join('\n');
  return `${fm.join('\n')}\n${body}\n`;
}

export interface AgentSpec {
  name: string;
  skills?: string[];
  allowed_tools?: string[];
  owns?: string[];
  body?: string;
  extra?: string;
}

export function agentMd(spec: AgentSpec): string {
  return [
    '---',
    `name: ${spec.name}`,
    `description: ${spec.name} 에이전트`,
    'tools: Read, Edit, Write, Bash, Grep, Glob',
    `skills: ${list(spec.skills ?? [])}`,
    `allowed_tools: ${list(spec.allowed_tools ?? [])}`,
    `owns: ${list(spec.owns ?? ['src/core/**'])}`,
    ...(spec.extra !== undefined ? [spec.extra] : []),
    '---',
    spec.body ?? '## 수정 범위\n\nsrc/core만 수정한다.',
    '',
  ].join('\n');
}

/** console.log·error 출력을 모은다. */
export function captureConsole(): { out: () => string; err: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void err.push(a.join(' ')));
  return { out: () => out.join('\n'), err: () => err.join('\n') };
}
