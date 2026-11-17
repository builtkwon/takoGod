// 하네스 스크립트 공용 유틸. 파일 시스템 접근은 모두 root 인자를 받아 테스트에서 임시 디렉터리를 쓸 수 있게 한다.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 저장소 루트(harness/scripts/lib 기준 세 단계 위). */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** 이 모듈이 CLI로 직접 실행됐는지. */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}

export function readText(root: string, rel: string): string | undefined {
  const abs = join(root, rel);
  return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
}

export function exists(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

/** 하위 디렉터리 이름(정렬). 없으면 빈 배열. */
export function listDirs(root: string, rel: string): string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** 파일 이름(정렬). 없으면 빈 배열. */
export function listFiles(root: string, rel: string): string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

/** 하위 디렉터리까지 포함한 파일 상대 경로(rel 기준, POSIX, 정렬). 없으면 빈 배열. */
export function listFilesRecursive(root: string, rel: string): string[] {
  const out: string[] = [];
  const walk = (sub: string): void => {
    for (const d of readdirSync(join(root, rel, sub), { withFileTypes: true })) {
      const p = sub === '' ? d.name : `${sub}/${d.name}`;
      if (d.isDirectory()) walk(p);
      else if (d.isFile()) out.push(p);
    }
  };
  if (existsSync(join(root, rel)) && statSync(join(root, rel)).isDirectory()) walk('');
  return out.sort();
}

/** 마지막 개행은 줄로 세지 않는다. */
export function countLines(text: string): number {
  if (text === '') return 0;
  return text.replace(/\n$/, '').split('\n').length;
}

/** 코드 포인트 기준 길이(한글·이모지를 1자로). */
export function charLength(text: string): number {
  return [...text].length;
}

/** 심볼릭 링크를 푼 절대 경로. 없는 경로는 가장 가까운 존재하는 상위까지만 풀고 나머지를 붙인다. */
export function realPathLoose(path: string): string {
  const abs = resolve(path);
  let head = abs;
  const tail: string[] = [];
  while (!existsSync(head)) {
    const parent = dirname(head);
    if (parent === head) return abs;
    tail.unshift(head.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
    head = parent;
  }
  return join(realpathSync(head), ...tail);
}

/** root 기준 POSIX 상대 경로. root 밖이면 undefined. 심볼릭 링크(/var → /private/var 등)를 풀어 비교한다. */
export function toRel(root: string, path: string): string | undefined {
  const realRoot = realPathLoose(root);
  const rel = relative(realRoot, realPathLoose(resolve(root, path)));
  if (rel === '' || rel.startsWith('..') || resolve(rel) === rel) return undefined;
  return rel.split(sep).join('/');
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** 대상 모듈이 없을 때의 공통 출력. 종료코드 1. */
export function missingTarget(rel: string): number {
  console.error(`대상 없음: ${rel}`);
  return 1;
}
