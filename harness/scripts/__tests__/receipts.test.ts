import { describe, expect, it } from 'vitest';
import { aggregate, parseReceipt, parseWeeks, readTrailers, runReceipts, unusedCandidates } from '../receipts.ts';
import { captureConsole, git, makeGitRepo, makeRepo, skillMd, writeFiles } from './helpers.ts';

const NOW = new Date('2026-11-17T00:00:00Z');
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 86_400_000).toISOString();

/** 날짜를 지정한 커밋. trailers는 메시지 끝 트레일러 블록. */
function commit(root: string, subject: string, trailers: readonly string[], date: string): void {
  writeFiles(root, { [`f-${subject}.txt`]: subject });
  git(root, ['add', '-A']);
  const msg = trailers.length === 0 ? subject : `${subject}\n\n본문\n\n${trailers.join('\n')}`;
  git(root, ['commit', '-q', '-m', msg], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
}

describe('parseReceipt', () => {
  it('정상 형식', () => {
    expect(parseReceipt('verify-and-report@v1 S1,S2,S4 skip=S3(문서만 변경)')).toEqual({
      skill: 'verify-and-report',
      version: 1,
      done: ['S1', 'S2', 'S4'],
      skipped: [{ step: 'S3', reason: '문서만 변경' }],
    });
    expect(parseReceipt('a@v12 S1')).toMatchObject({ version: 12, done: ['S1'], skipped: [] });
    expect(parseReceipt('a@v1 skip=S1(없음),S2(사유, 쉼표 포함)')).toMatchObject({
      done: [],
      skipped: [
        { step: 'S1', reason: '없음' },
        { step: 'S2', reason: '사유, 쉼표 포함' },
      ],
    });
  });

  it.each([
    ['버전 없음', 'a S1'],
    ['v0', 'a@v0 S1'],
    ['공백 구분 단계', 'a@v1 S1, S2'],
    ['가운뎃점(옛 형식)', 'a@v1 — S1·S2 완료'],
    ['단계 없음', 'a@v1'],
    ['skip 사유 없음', 'a@v1 S1 skip=S2'],
    ['skip 괄호 중첩', 'a@v1 S1 skip=S2(a(b))'],
    ['단계 중복', 'a@v1 S1,S2 skip=S2(x)'],
    ['대문자 이름', 'Verify@v1 S1'],
  ])('형식 오류: %s', (_n, v) => {
    expect(typeof parseReceipt(v)).toBe('string');
  });
});

describe('aggregate / unusedCandidates', () => {
  it('스킬·단계별 완료·생략을 센다, 형식 오류는 커밋과 함께 보고', () => {
    const a = aggregate([
      { commit: 'c1', values: ['x@v1 S1,S2 skip=S3(사유A)', 'y@v1 S1'] },
      { commit: 'c2', values: ['x@v2 S1 skip=S3(사유A),S2(사유B)', 'bad'] },
    ]);
    expect(a.errors).toEqual([expect.stringContaining('c2: 형식 오류: "bad"')]);
    const x = a.usage.find((u) => u.skill === 'x');
    expect(x?.receipts).toBe(2);
    expect(x?.versions).toEqual([1, 2]);
    expect(Object.fromEntries(x?.done ?? [])).toEqual({ S1: 2, S2: 1 });
    expect(Object.fromEntries(x?.skipped ?? [])).toEqual({ S3: ['사유A', '사유A'], S2: ['사유B'] });
    expect(
      unusedCandidates(
        [
          { name: 'x', steps: ['S1', 'S2', 'S3'] },
          { name: 'y', steps: ['S1'] },
          { name: 'z', steps: ['S1'] },
        ],
        a.usage,
      ),
    ).toEqual(['x: 완료 0회 단계 S3', 'z: 영수증 없음']);
  });

  it('parseWeeks: 기본 6, --weeks N, 오류', () => {
    expect(parseWeeks([])).toBe(6);
    expect(parseWeeks(['--', '--weeks', '2'])).toBe(2);
    for (const bad of [['--weeks', '0'], ['--weeks'], ['--x', '1'], ['--weeks', '1.5']]) expect(typeof parseWeeks(bad)).toBe('string');
  });
});

describe('git log 트레일러 집계', () => {
  it('기간 안 커밋의 Skill-Receipt 트레일러만 읽는다', () => {
    const root = makeGitRepo();
    commit(root, 'old', ['Skill-Receipt: x@v1 S1'], daysAgo(50));
    commit(root, 'none', [], daysAgo(10));
    commit(root, 'two', ['Skill-Receipt: x@v1 S1,S2', 'Skill-Receipt: y@v1 skip=S1(사유)', 'Co-Authored-By: a <a@example.invalid>'], daysAgo(3));
    const since = new Date(NOW.getTime() - 42 * 86_400_000);
    const r = readTrailers(root, since);
    expect(Array.isArray(r) && r.map((c) => c.values)).toEqual([['x@v1 S1,S2', 'y@v1 skip=S1(사유)']]);
  });

  it('runReceipts: 6주 기본, 미사용 후보, 형식 오류는 exit 1', () => {
    const root = makeGitRepo({
      '.claude/skills/x/SKILL.md': skillMd({ name: 'x', steps: { S1: [], S2: [] } }),
      '.claude/skills/z/SKILL.md': skillMd({ name: 'z' }),
    });
    commit(root, 'a', ['Skill-Receipt: x@v1 S1 skip=S2(문서만)'], daysAgo(5));
    const c = captureConsole();
    expect(runReceipts(root, [], NOW)).toBe(0);
    expect(c.out()).toContain('최근 6주');
    expect(c.out()).toContain('영수증 있는 커밋 1개');
    expect(c.out()).toContain('x v1: 영수증 1건 | 완료 S1×1 | 생략 S2×1(문서만)');
    expect(c.out()).toContain('x: 완료 0회 단계 S2');
    expect(c.out()).toContain('z: 영수증 없음');

    commit(root, 'b', ['Skill-Receipt: x@v1 — S1·S2 완료'], daysAgo(1));
    expect(runReceipts(root, [], NOW)).toBe(1);
    expect(c.err()).toContain('영수증 형식 오류 1건');
    // 기간 밖으로 밀면 다시 통과
    expect(runReceipts(root, ['--', '--weeks', '1'], new Date(NOW.getTime() + 30 * 86_400_000))).toBe(0);
  });

  it('커밋 없는 저장소는 빈 결과, git 저장소 아님은 exit 1', () => {
    const c = captureConsole();
    expect(readTrailers(makeGitRepo(), NOW)).toEqual([]);
    expect(runReceipts(makeRepo(), [], NOW)).toBe(1);
    expect(c.err()).toContain('git log 실패');
  });
});
