import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THRESHOLD, plan, runArchive } from '../archive-artifacts.ts';
import { captureConsole, makeRepo } from './helpers.ts';

const NOW = new Date(2026, 10, 20, 12, 0, 0);
const OLD = new Date(2026, 0, 1);

/** n개의 prompt-integrator<번호>.txt(오래됨, 내용 있음)를 만든다. */
function setup(n: number, extra: readonly string[] = []): string {
  const dir = makeRepo();
  mkdirSync(join(dir, 'archive'));
  for (let i = 1; i <= n; i++) put(dir, `prompt-integrator${i}.txt`);
  for (const f of extra) put(dir, f);
  return dir;
}
function put(dir: string, rel: string, content: string = rel, mtime: Date = OLD): void {
  writeFileSync(join(dir, rel), content);
  utimesSync(join(dir, rel), mtime, mtime);
}
const opts = (dir: string, dryRun = false) => ({ dir, dryRun, now: NOW });
const top = (dir: string): string[] => readdirSync(dir).filter((f) => f !== 'archive').sort();

describe('archive-artifacts', () => {
  it('30개 이하면 아무것도 하지 않는다', () => {
    const dir = setup(THRESHOLD);
    const c = captureConsole();
    expect(runArchive(opts(dir))).toBe(0);
    expect(c.out()).toContain('묶을 파일 0개');
    expect(top(dir)).toHaveLength(THRESHOLD);
  });

  it('30개 초과면 보호 대상이 아닌 것을 모두 묶고 목록 txt와 INDEX 한 줄을 남긴다', () => {
    const dir = setup(THRESHOLD + 1);
    expect(runArchive(opts(dir))).toBe(0);
    expect(top(dir)).toEqual([]);
    expect(readdirSync(join(dir, 'archive')).sort()).toEqual(['20261120T120000.tar.gz', '20261120T120000.txt', 'INDEX.md']);
    expect(readFileSync(join(dir, 'archive', 'INDEX.md'), 'utf8')).toBe('- 20261120T120000 | 31개 | 20261120T120000.tar.gz\n');
    const txt = readFileSync(join(dir, 'archive', '20261120T120000.txt'), 'utf8').trim().split('\n');
    expect(txt).toHaveLength(31);
  });

  it('INDEX.md가 있으면 덧붙인다', () => {
    const dir = setup(THRESHOLD + 1);
    put(dir, 'archive/INDEX.md', '- 이전 줄\n');
    expect(runArchive(opts(dir))).toBe(0);
    expect(readFileSync(join(dir, 'archive', 'INDEX.md'), 'utf8')).toBe('- 이전 줄\n- 20261120T120000 | 31개 | 20261120T120000.tar.gz\n');
  });

  it('--dry-run은 파일을 바꾸지 않는다', () => {
    const dir = setup(THRESHOLD + 1);
    const c = captureConsole();
    expect(runArchive(opts(dir, true))).toBe(0);
    expect(c.out()).toContain('31개 묶음 예정');
    expect(top(dir)).toHaveLength(THRESHOLD + 1);
    expect(readdirSync(join(dir, 'archive'))).toEqual([]);
  });

  it('제외 목록(현재 문서·도구·번호 없는 템플릿)은 대상이 아니다', () => {
    const keep = ['resume.md', 'state.md', 'state-archive.md', 'integrator.md', 'core.md', 'redesign-v2.md', 'run-integrator.sh', 'shot.mjs', 'prompt-common.txt', 'prompt-integrator.txt', 'prompt-core.txt'];
    const dir = setup(THRESHOLD + 1, keep);
    expect(runArchive(opts(dir))).toBe(0);
    expect(top(dir)).toEqual([...keep].sort());
  });

  it('번호·시각 패턴(접미 b, .log, 시각 json/err, verdicts)을 대상으로 본다', () => {
    const dir = setup(0, ['prompt-integrator41b.txt', 'integrator33.log', 'core-20261117T173805.json', 'ui-20261117T173805.err', 'stage5-verdicts.md', 'core-verdicts-r1.md']);
    expect(plan(dir, NOW).total).toBe(6);
  });

  it('archive/ 안의 파일은 건드리지 않는다', () => {
    const dir = setup(THRESHOLD + 1);
    put(dir, 'archive/old-1.json');
    mkdirSync(join(dir, 'archive', 'sub'));
    expect(runArchive(opts(dir))).toBe(0);
    expect(readdirSync(join(dir, 'archive')).sort()).toEqual(['20261120T120000.tar.gz', '20261120T120000.txt', 'INDEX.md', 'old-1.json', 'sub']);
  });

  it('24시간 미만과 0바이트 파일은 묶지 않는다', () => {
    const dir = setup(THRESHOLD + 1);
    put(dir, 'prompt-integrator40.txt', 'x', new Date(NOW.getTime() - 23 * 3600 * 1000));
    put(dir, 'prompt-integrator41.txt', '');
    put(dir, 'prompt-integrator42.txt', 'x', new Date(NOW.getTime() - 25 * 3600 * 1000));
    expect(runArchive(opts(dir))).toBe(0);
    expect(top(dir)).toEqual(['prompt-integrator40.txt', 'prompt-integrator41.txt']);
  });

  it('json·err 쌍은 하나라도 보호면 둘 다 남기고, 진행 중 실행(<역할>.md에 헤더 없음)도 남긴다', () => {
    const dir = setup(THRESHOLD + 1);
    put(dir, 'integrator.md', '\n## 20261101T000000 (exit 0)\n\n## 20261102T000000 (exit 0)\n');
    put(dir, 'integrator-20261101T000000.json', '{}');
    put(dir, 'integrator-20261101T000000.err', 'warn');
    put(dir, 'integrator-20261102T000000.json', '{}');
    put(dir, 'integrator-20261102T000000.err', '');
    put(dir, 'integrator-20261103T000000.json', '{}');
    put(dir, 'integrator-20261103T000000.err', 'warn');
    expect(runArchive(opts(dir))).toBe(0);
    expect(top(dir)).toEqual([
      'integrator-20261102T000000.err',
      'integrator-20261102T000000.json',
      'integrator-20261103T000000.err',
      'integrator-20261103T000000.json',
      'integrator.md',
    ]);
  });

  it('순서는 mtime이 아니라 파일 이름의 번호·시각이다', () => {
    const dir = setup(0);
    for (let i = 1; i <= THRESHOLD + 1; i++) put(dir, `prompt-integrator${i}.txt`, 'x', new Date(2026, 0, 1, 0, 0, 60 - i));
    put(dir, 'prompt-integrator2b.txt');
    expect(plan(dir, NOW).targets.slice(0, 4).map((e) => e.name)).toEqual([
      'prompt-integrator1.txt',
      'prompt-integrator2.txt',
      'prompt-integrator2b.txt',
      'prompt-integrator3.txt',
    ]);
    expect(runArchive(opts(dir))).toBe(0);
    const txt = readFileSync(join(dir, 'archive', '20261120T120000.txt'), 'utf8').trim().split('\n');
    expect(txt.at(-1)).toBe('prompt-integrator31.txt');
  });

  it('tar 검증이 실패하면 원본을 지우지 않고 exit 1, tar도 남기지 않는다', () => {
    const dir = setup(THRESHOLD + 1);
    const c = captureConsole();
    expect(runArchive({ ...opts(dir), list: () => ['prompt-integrator1.txt'] })).toBe(1);
    expect(c.err()).toContain('검증 실패');
    expect(top(dir)).toHaveLength(THRESHOLD + 1);
    expect(readdirSync(join(dir, 'archive'))).toEqual([]);
  });

  it('tar 실행이 실패하면(archive/ 쓰기 불가) 원본을 지우지 않고 exit 1', () => {
    const dir = setup(THRESHOLD + 1);
    chmodSync(join(dir, 'archive'), 0o500);
    const c = captureConsole();
    try {
      expect(runArchive(opts(dir))).toBe(1);
    } finally {
      chmodSync(join(dir, 'archive'), 0o755);
    }
    expect(c.err()).toContain('tar 실패');
    expect(top(dir)).toHaveLength(THRESHOLD + 1);
    expect(existsSync(join(dir, 'archive', 'INDEX.md'))).toBe(false);
  });
});
