// 용어: 화면에 보이는 "후네"는 모두 "접시"로 바꿨다(코드 식별자 fune·주석은 그대로). 화면 문자열 리터럴에 '후네'가 없어야 한다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as data from '../../data';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : sources(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);

describe('용어: 후네 → 접시', () => {
  it('src/data의 모든 문구에 후네가 없다', () => {
    for (const s of strings(data)) expect(s).not.toContain('후네');
  });
  it('src/ui 코드의 문자열 리터럴에 후네가 없다(주석 제외)', () => {
    for (const file of [...sources('src/ui'), ...sources('src/data')]) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code.match(/(['"`])(?:(?!\1).)*후네(?:(?!\1).)*\1/g) ?? [], file).toEqual([]);
    }
  });
});
