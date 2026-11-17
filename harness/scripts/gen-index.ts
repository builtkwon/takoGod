// .claude/skills/INDEX.md 생성. 스킬·에이전트 frontmatter가 원본이다.
// 배치 에이전트 열은 agents의 skills를 역산한다. 메타 스킬(harness/meta-skills)은 제외.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PROJECT_ROOT, isMain } from './lib/common.ts';
import { renderIndex } from './lib/index-gen.ts';
import { INDEX_PATH, loadModel } from './lib/model.ts';

export function genIndex(root: string): number {
  const model = loadModel(root);
  if (model.loadErrors.length > 0) {
    console.error(`frontmatter 오류로 INDEX를 만들지 않는다:\n  ${model.loadErrors.join('\n  ')}`);
    return 1;
  }
  const abs = join(root, INDEX_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, renderIndex(model));
  console.log(`${INDEX_PATH} 생성: 스킬 ${model.skills.length}개, 에이전트 ${model.agents.length}개`);
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = genIndex(PROJECT_ROOT);
}
