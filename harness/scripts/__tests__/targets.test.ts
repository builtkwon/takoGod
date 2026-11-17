// snapshot·simulate·lint-dialogues: 대상 없음 / 형식 오류 / 정상·실패 경로.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DialogueLine } from '../../../src/contracts/customer.ts';
import { PROJECT_ROOT } from '../lib/common.ts';
import { TOOL_ENTRY_PATHS } from '../../../src/contracts/tooling.ts';
import {
  BANNED_PATH,
  DIALOGUES_PATH,
  containsBanned,
  lengthDiffRatio,
  lintDialogues,
  parseBannedWords,
  runLint,
  validateModule,
  type BannedList,
} from '../lint-dialogues.ts';
import { PERFECT_EPSILON, SIM_PATH, parseArgs, parseTargets, runSimulate } from '../simulate.ts';
import { SANDBOX_PAGE, STATES_PATH, parseStates, runSnapshot, stateUrl, type SnapshotDeps } from '../snapshot.ts';
import { captureConsole, makeRepo } from './helpers.ts';

describe('대상 경로 단일 출처', () => {
  it('세 스크립트의 경로는 contracts TOOL_ENTRY_PATHS와 같다', () => {
    expect([SIM_PATH, SANDBOX_PAGE, STATES_PATH, DIALOGUES_PATH]).toEqual([
      TOOL_ENTRY_PATHS.sim,
      TOOL_ENTRY_PATHS.sandboxPage,
      TOOL_ENTRY_PATHS.sandboxStates,
      TOOL_ENTRY_PATHS.dialogues,
    ]);
  });

  it('스크립트 소스에 대상 경로 문자열을 복제하지 않는다', () => {
    for (const f of ['simulate.ts', 'snapshot.ts', 'lint-dialogues.ts']) {
      const src = readFileSync(join(PROJECT_ROOT, 'harness/scripts', f), 'utf8');
      for (const p of Object.values(TOOL_ENTRY_PATHS)) expect(src).not.toContain(`'${p}'`);
    }
  });
});

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

  it('평균 5.0 허용 오차는 1e-9: 경계 안 통과, 밖 미달', async () => {
    const c = captureConsole();
    expect(PERFECT_EPSILON).toBe(1e-9);
    expect(await runSimulate(repo(), [], sim(5, 2.5))).toBe(0);
    expect(await runSimulate(repo(), [], sim(5 - 1e-10, 2))).toBe(0);
    expect(await runSimulate(repo(), [], sim(0.1 * 3 * (5 / 0.3), 2))).toBe(0); // 부동소수 누적 오차
    expect(await runSimulate(repo(), [], sim(5 - 1e-8, 2.5))).toBe(1);
    expect(await runSimulate(repo(), [], sim(5 + 1e-8, 2.5))).toBe(1);
    expect(await runSimulate(repo(), [], sim(4.996, 2.5))).toBe(1);
    expect(c.out()).toContain('미달(실제값 4.996)');
  });

  it('무작위 경계값(2.0 통과, 3.99 통과)', async () => {
    captureConsole();
    expect(await runSimulate(repo(), [], sim(5, 2))).toBe(0);
    expect(await runSimulate(repo(), [], sim(5, 3.99))).toBe(0);
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
  const PERS = ['salaryman', 'grandma', 'gourmet', 'tourist'] as const;
  const line = (over: Partial<DialogueLine> = {}): DialogueLine => ({
    personality: 'grandma',
    prompt: '젊은이, 오늘 날씨 참 좋지?',
    good: '네, 산책하기 딱 좋아요!',
    bad: '날씨요? 전 실내파라서요.',
    ...over,
  });
  /** 성격당 10문항, 총 40문항의 정상 대사. 모두 서로 다른 문구. */
  const full = (): DialogueLine[] =>
    PERS.flatMap((p) =>
      Array.from({ length: 10 }, (_, i) => ({ personality: p, prompt: `${p} 질문 ${i}`, good: `${p} 좋은 답 ${i}`, bad: `${p} 나쁜 답 ${i}` })),
    );
  const NONE = { words: [], exceptions: [] };
  const errs = (lines: readonly DialogueLine[], banned: BannedList = NONE): string => lintDialogues(lines, banned).errors.join('\n');
  const repo = (): string =>
    makeRepo({ 'src/data/dialogues.ts': '// fixture', [BANNED_PATH]: '# 주석\n틀딱\n\n바보 멍청이\n' });

  it('dialogues.ts 없음 → "대상 없음" exit 1', async () => {
    const c = captureConsole();
    expect(await runLint(makeRepo(), async () => ({}))).toBe(1);
    expect(c.err()).toBe('대상 없음: src/data/dialogues.ts');
  });

  it('정상 대사(성격당 10, 총 40) → exit 0', async () => {
    const c = captureConsole();
    expect(lintDialogues(full(), NONE)).toEqual({ errors: [], warnings: [] });
    expect(await runLint(repo(), async () => ({ dialogues: full() }))).toBe(0);
    expect(c.out()).toContain('문항 40개 (salaryman 10, grandma 10, gourmet 10, tourist 10)');
  });

  it('문항 수: 성격당 10개가 아니거나 총 40개가 아니면 실패', () => {
    const lines = full();
    expect(errs(lines.slice(1))).toContain('salaryman 문항 9개 ≠ 10개');
    expect(errs(lines.slice(1))).toContain('총 문항 39개 ≠ 40개');
    const extra = [...lines, line({ prompt: '추가 질문', good: '추가 좋은 답', bad: '추가 나쁜 답' })];
    expect(errs(extra)).toContain('grandma 문항 11개 ≠ 10개');
    expect(errs(extra)).toContain('총 문항 41개 ≠ 40개');
  });

  it('길이 차 30% 경계: 30% 통과, 31% 이상 실패', () => {
    expect(lengthDiffRatio('가'.repeat(10), '가'.repeat(7))).toBeCloseTo(0.3);
    const with0 = (l: DialogueLine): DialogueLine[] => [l, ...full().slice(1)];
    expect(errs(with0(line({ personality: 'salaryman', good: '가'.repeat(10), bad: '나'.repeat(7) })))).toBe('');
    expect(errs(with0(line({ personality: 'salaryman', good: '가'.repeat(10), bad: '나'.repeat(6) })))).toContain('길이 차 40%');
  });

  it('중복: prompt·good=bad는 실패, 다른 문항의 같은 답은 경고(exit 0)', async () => {
    const lines = full();
    lines[1] = { ...lines[1]!, prompt: lines[0]!.prompt };
    lines[2] = { ...lines[2]!, good: '같다', bad: '같다' };
    expect(errs(lines)).toContain('prompt 중복');
    expect(errs(lines)).toContain('good과 bad가 같다');

    const dupAnswer = full();
    dupAnswer[5] = { ...dupAnswer[5]!, good: dupAnswer[0]!.good };
    const r = lintDialogues(dupAnswer, NONE);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toContain('#5(salaryman).good 다른 문항과 같은 답(#0(salaryman).good)');
    const c = captureConsole();
    expect(await runLint(repo(), async () => ({ dialogues: dupAnswer }))).toBe(0);
    expect(c.out()).toContain('dialogue.lint 경고 1건');
  });

  it('금지어 2글자 이하: 토큰이 이 말로 시작하면 검출', () => {
    for (const [text, w] of [
      ['한남은 몰라요', '한남'],
      ['꼰대가 왔네', '꼰대'],
      ['지랄하네 진짜', '지랄'],
      ['틀딱은 빠져요', '틀딱'],
      ['애자?', '애자'],
      ['"애자"라니', '애자'],
      ['ㅅㅂ…진짜', 'ㅅㅂ'],
    ] as const) {
      expect([text, containsBanned(text, w)]).toEqual([text, true]);
    }
    for (const [text, w] of [
      ['한 남자가 왔어요', '한남'],
      ['애 자랑 좀 할게요', '애자'],
      ['우리 남한남부', '한남'], // 토큰 중간은 검출하지 않는다
      ['abba 노래', 'ba'],
    ] as const) {
      expect([text, containsBanned(text, w)]).toEqual([text, false]);
    }
  });

  it('예외 토큰(!<토큰>)은 완전 일치일 때만 통과', () => {
    const ex = ['한남동', '한남대교'];
    expect(containsBanned('한남동 맛집이에요', '한남', ex)).toBe(false);
    expect(containsBanned('한남대교 건너서', '한남', ex)).toBe(false);
    expect(containsBanned('한남동에서 왔어요', '한남', ex)).toBe(true); // 조사가 붙으면 예외 아님(완전 일치 규칙)
    expect(containsBanned('한남동 한남은', '한남', ex)).toBe(true); // 다른 토큰이 걸리면 검출
    expect(containsBanned('한남동', '한남')).toBe(true); // 예외 없으면 앞부분 일치로 검출
  });

  it('금지어 3글자 이상: 부분 문자열(공백은 지우지 않음), 대소문자 무시', () => {
    expect(containsBanned('이 노인네가 참', '노인네')).toBe(true);
    expect(containsBanned('노인네들', '노인네')).toBe(true);
    expect(containsBanned('노 인 네', '노인네')).toBe(false);
    expect(containsBanned('바보  멍청이야', '바보 멍청이')).toBe(true);
    expect(containsBanned('바보멍청이야', '바보 멍청이')).toBe(false);
    expect(containsBanned('Yankee go', 'yankee')).toBe(true);
  });

  it('저장소 금지어 목록: "한남동", "한 남자", "애 자랑" 통과, "한남은"·"꼰대가"·"지랄하네"·"틀딱은" 검출', () => {
    const banned = parseBannedWords(readFileSync(join(PROJECT_ROOT, BANNED_PATH), 'utf8'));
    expect(banned.exceptions).toEqual(expect.arrayContaining(['한남동', '한남대교']));
    const lines = full();
    lines[0] = { ...lines[0]!, prompt: '한남동 맛집 아세요?', good: '한 남자가 추천했죠', bad: '애 자랑 좀 할게요' };
    expect(errs(lines, banned)).toBe('');
    const bad = ['한남은 몰라요', '꼰대가 왔네', '지랄하네 진짜', '틀딱은 빠져요'];
    bad.forEach((b, i) => (lines[i + 1] = { ...lines[i + 1]!, bad: b }));
    const e = errs(lines, banned);
    for (const [i, w] of [[1, '한남'], [2, '꼰대'], [3, '지랄'], [4, '틀딱']] as const) {
      expect(e).toContain(`#${i}(salaryman).bad 금지어 "${w}"`);
    }
  });

  it('금지어 목록: 주석·빈 줄 제외, !예외 분리, 필드별로 보고', () => {
    const banned = parseBannedWords('# 주석\n틀딱\n\n바보 멍청이\n!틀딱이\n!\n');
    expect(banned).toEqual({ words: ['틀딱', '바보 멍청이'], exceptions: ['틀딱이'] });
    const lines = full();
    lines[0] = { ...lines[0]!, bad: '틀딱 소리 마요' };
    lines[1] = { ...lines[1]!, good: '바보 멍청이야 좋은 답' };
    lines[2] = { ...lines[2]!, good: '틀딱이 좋은 답' };
    expect(errs(lines, banned)).toContain('#0(salaryman).bad 금지어 "틀딱"');
    expect(errs(lines, banned)).toContain('#1(salaryman).good 금지어 "바보 멍청이"');
    expect(errs(lines, banned)).not.toContain('#2(salaryman).good 금지어');
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
    expect(parseBannedWords(readFileSync(join(PROJECT_ROOT, BANNED_PATH), 'utf8')).words.length).toBeGreaterThan(0);
  });
});
