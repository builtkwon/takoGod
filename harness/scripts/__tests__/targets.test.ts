// snapshot·simulate·lint-dialogues: 대상 없음 / 형식 오류 / 정상·실패 경로.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DialogueLine } from '../../../src/contracts/customer.ts';
import { PROJECT_ROOT } from '../lib/common.ts';
import { BANNED_PATH, lengthDiffRatio, lintDialogues, parseBannedWords, runLint, validateModule } from '../lint-dialogues.ts';
import { parseArgs, parseTargets, runSimulate } from '../simulate.ts';
import { parseStates, runSnapshot, stateUrl, type SnapshotDeps } from '../snapshot.ts';
import { captureConsole, makeRepo } from './helpers.ts';

const GDD = '## 밸런스 목표\n\n- 전정답 + 완벽 굽기: 평균 5.0\n- 무작위 플레이: 평균 2~3점대\n';

describe('snapshot', () => {
  const fakeDeps = (shots: string[]): SnapshotDeps => ({
    serve: async () => ({ baseUrl: 'http://localhost:5999/', close: async () => {} }),
    openBrowser: async () => ({ shot: async (url, out) => void shots.push(`${url} -> ${out}`), close: async () => {} }),
  });

  it('states.json 없음 → "대상 없음" exit 1', async () => {
    const c = captureConsole();
    expect(await runSnapshot(makeRepo(), fakeDeps([]))).toBe(1);
    expect(c.err()).toBe('대상 없음: src/render/sandbox.states.json');
  });

  it('sandbox.html 없음 → "대상 없음" exit 1', async () => {
    const c = captureConsole();
    expect(await runSnapshot(makeRepo({ 'src/render/sandbox.states.json': '["a"]' }), fakeDeps([]))).toBe(1);
    expect(c.err()).toBe('대상 없음: src/render/sandbox.html');
  });

  it.each([
    ['JSON 오류', '[', 'JSON'],
    ['배열 아님', '{"a":1}', '배열'],
    ['빈 배열', '[]', '비어'],
    ['이름 형식', '["ok","../x"]', '형식 오류'],
    ['중복', '["a","a"]', '중복'],
  ])('states 형식 실패: %s', (_n, text, msg) => {
    const r = parseStates(text);
    expect(!r.ok && r.error).toContain(msg);
  });

  it('상태마다 모바일 캡처를 .artifacts/snapshots/<name>.png로 저장', async () => {
    captureConsole();
    const root = makeRepo({ 'src/render/sandbox.states.json': '["idle","cooking"]', 'src/render/sandbox.html': '<html>' });
    const shots: string[] = [];
    expect(await runSnapshot(root, fakeDeps(shots))).toBe(0);
    expect(shots).toEqual([
      `http://localhost:5999/src/render/sandbox.html?state=idle -> ${join(root, '.artifacts/snapshots/idle.png')}`,
      `http://localhost:5999/src/render/sandbox.html?state=cooking -> ${join(root, '.artifacts/snapshots/cooking.png')}`,
    ]);
  });

  it('브라우저 실행 실패 → 설치 안내와 exit 1, 서버는 닫는다', async () => {
    const c = captureConsole();
    let closed = false;
    const root = makeRepo({ 'src/render/sandbox.states.json': '["a"]', 'src/render/sandbox.html': '' });
    const deps: SnapshotDeps = {
      serve: async () => ({ baseUrl: 'http://x/', close: async () => void (closed = true) }),
      openBrowser: async () => {
        throw new Error("Executable doesn't exist");
      },
    };
    expect(await runSnapshot(root, deps)).toBe(1);
    expect(c.err()).toContain('playwright install chromium');
    expect(closed).toBe(true);
  });

  it('stateUrl은 상태 이름을 인코딩한다', () => {
    expect(stateUrl('http://h:1/', 'a-b')).toBe('http://h:1/src/render/sandbox.html?state=a-b');
  });
});

describe('simulate', () => {
  const sim = (perfect: unknown, random: unknown) => async () => ({
    BalanceSimulator: { run: (s: { kind: string }) => (s.kind === 'perfect' ? perfect : random) },
  });
  const repo = (gdd = GDD): string => makeRepo({ 'src/core/sim.ts': '// fixture', 'docs/GDD.md': gdd });

  it('sim.ts 없음 → "대상 없음" exit 1', async () => {
    const c = captureConsole();
    expect(await runSimulate(makeRepo({ 'docs/GDD.md': GDD }), [], sim(5, 3))).toBe(1);
    expect(c.err()).toBe('대상 없음: src/core/sim.ts');
  });

  it('GDD 목표 파싱: 저장소 GDD와 형식 오류', () => {
    expect(parseTargets(readFileSync(join(PROJECT_ROOT, 'docs/GDD.md'), 'utf8'))).toEqual({
      perfect: 5,
      random: { min: 2, maxExclusive: 4 },
    });
    expect(parseTargets('## 밸런스 목표\n- 대충 좋게\n')).toBeUndefined();
    expect(parseTargets('## 다른 절\n')).toBeUndefined();
  });

  it('목표 충족 → exit 0, 경계값(2.0, 3.99, 4.995)', async () => {
    captureConsole();
    expect(await runSimulate(repo(), [], sim(5, 2.5))).toBe(0);
    expect(await runSimulate(repo(), [], sim(4.996, 2))).toBe(0);
    expect(await runSimulate(repo(), [], sim(5, 3.99))).toBe(0);
  });

  it('목표 미달 → exit 1', async () => {
    const c = captureConsole();
    expect(await runSimulate(repo(), [], sim(4.9, 2.5))).toBe(1);
    expect(await runSimulate(repo(), [], sim(5, 4))).toBe(1);
    expect(await runSimulate(repo(), [], sim(5, 1.99))).toBe(1);
    expect(c.out()).toContain('미달');
  });

  it('잘못된 export·반환값·GDD → exit 1', async () => {
    const c = captureConsole();
    expect(await runSimulate(repo(), [], async () => ({}))).toBe(1);
    expect(await runSimulate(repo(), [], sim(Number.NaN, 3))).toBe(1);
    expect(await runSimulate(repo(), [], sim(6, 3))).toBe(1);
    expect(await runSimulate(repo('# 없음'), [], sim(5, 3))).toBe(1);
    expect(
      await runSimulate(repo(), [], async () => {
        throw new Error('boom');
      }),
    ).toBe(1);
    expect(c.err()).toContain('import 실패: boom');
  });

  it('시나리오 인자를 BalanceSimulator.run에 전달한다', async () => {
    captureConsole();
    const seen: unknown[] = [];
    const load = async () => ({ BalanceSimulator: { run: (s: unknown) => (seen.push(s), 5) } });
    await runSimulate(repo(), ['--', '--sessions', '10', '--seed', '7'], load);
    expect(seen).toEqual([
      { kind: 'perfect', sessions: 10, seed: 7 },
      { kind: 'random', sessions: 10, seed: 7 },
    ]);
    expect(parseArgs(['--sessions', '0'])).toContain('1 이상');
    expect(parseArgs(['--x', '1'])).toContain('사용법');
  });
});

describe('lint-dialogues', () => {
  const line = (over: Partial<DialogueLine> = {}): DialogueLine => ({
    personality: 'grandma',
    prompt: '젊은이, 오늘 날씨 참 좋지?',
    good: '네, 산책하기 딱 좋아요!',
    bad: '날씨요? 전 실내파라서요.',
    ...over,
  });
  const repo = (): string =>
    makeRepo({ 'src/data/dialogues.ts': '// fixture', [BANNED_PATH]: '# 주석\n틀딱\n\n바보 멍청이\n' });

  it('dialogues.ts 없음 → "대상 없음" exit 1', async () => {
    const c = captureConsole();
    expect(await runLint(makeRepo(), async () => ({}))).toBe(1);
    expect(c.err()).toBe('대상 없음: src/data/dialogues.ts');
  });

  it('정상 대사 → exit 0', async () => {
    captureConsole();
    const lines = [line(), line({ personality: 'tourist', prompt: 'Takoyaki, hot?', good: '조심해서 드세요!', bad: '용암 맛이에요!' })];
    expect(await runLint(repo(), async () => ({ dialogues: lines }))).toBe(0);
  });

  it('길이 차 30% 경계: 30% 통과, 31% 이상 실패', () => {
    expect(lengthDiffRatio('가'.repeat(10), '가'.repeat(7))).toBeCloseTo(0.3);
    expect(lintDialogues([line({ good: '가'.repeat(10), bad: '나'.repeat(7) })], [])).toEqual([]);
    expect(lintDialogues([line({ good: '가'.repeat(10), bad: '나'.repeat(6) })], []).join()).toContain('길이 차 40%');
  });

  it('중복: prompt, 문항 간 답, good=bad', () => {
    const errors = lintDialogues(
      [line(), line({ good: '다른 좋은 답입니다', bad: '다른 나쁜 답입니다' }), line({ prompt: '새 질문', good: '같다', bad: '같다' })],
      [],
    ).join('\n');
    expect(errors).toContain('prompt 중복');
    expect(errors).toContain('good과 bad가 같다');
    const answerDup = lintDialogues([line(), line({ prompt: '다른 질문' })], []).join('\n');
    expect(answerDup).toContain('답 중복');
  });

  it('금지어: 공백 무시 부분 일치, 주석·빈 줄 제외', () => {
    const banned = parseBannedWords('# 주석\n틀딱\n\n바보 멍청이\n');
    expect(banned).toEqual(['틀딱', '바보 멍청이']);
    const errors = lintDialogues([line({ bad: '틀 딱이 뭘 알아요?' }), line({ prompt: '질문', good: '바보멍청이야 좋은 답', bad: '그럭저럭 나쁜 답임' })], banned);
    expect(errors.join('\n')).toContain('#0(grandma).bad 금지어 "틀딱"');
    expect(errors.join('\n')).toContain('#1(grandma).good 금지어 "바보 멍청이"');
  });

  it('모듈 형식 오류 → exit 1', async () => {
    const c = captureConsole();
    expect(validateModule({})).toEqual(['dialogues: DialogueLine[] export가 없다']);
    expect(validateModule({ dialogues: [] })).toEqual(['dialogues가 비어 있다']);
    expect((validateModule({ dialogues: [{ personality: 'alien', prompt: '', good: 'a', bad: 'b' }] }) as string[]).join()).toMatch(
      /personality.*prompt/,
    );
    expect(await runLint(repo(), async () => ({ dialogues: 'x' }))).toBe(1);
    expect(c.err()).toContain('형식 오류');
  });

  it('검사 실패 → exit 1', async () => {
    captureConsole();
    expect(await runLint(repo(), async () => ({ dialogues: [line(), line()] }))).toBe(1);
  });

  it('저장소 금지어 목록은 비어 있지 않다', () => {
    expect(parseBannedWords(readFileSync(join(PROJECT_ROOT, BANNED_PATH), 'utf8')).length).toBeGreaterThan(0);
  });
});
