---
name: contract-proposal
version: 2
description: 구현 중 필요한 contracts 타입·이벤트가 없거나 owns 밖 파일(설정 포함) 변경이 필요할 때 쓴다. 직접 고치지 않고 TODO-CONTRACT.md 자기 역할 섹션에 제안만 추가한다.
requires: []
consumes: []
produces: [TODO-CONTRACT.md]
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [] }
---
## MUST

- src/contracts와 owns 밖 파일(package.json·tsconfig 등 설정 포함)은 읽기만 한다. 변경은 소유 에이전트가 사용자 합의 후 반영한다.
- TODO-CONTRACT.md는 자기 역할 섹션(`## core-dev` / `## render-dev` / `## ui-dev`) 안, `<!-- end:<역할> -->` 줄 바로 위에만 추가한다.
- 다른 섹션, 끝 표시 줄, `## 양식`은 고치지 않는다(병렬 worktree 머지 충돌 방지).
- 제안 하나에 항목 하나. 기존 항목은 고치지 않고 새 항목으로 낸다.

## 단계

- S1 부족 확인: 필요한 타입·이벤트가 src/contracts에 정말 없는지, owns 밖 파일 변경이 정말 필요한지 본다.
  - 경로별 소유 → .claude/skills/INDEX.md가 아니라 각 에이전트 frontmatter `owns`
  - 파일별 내용 → docs/rules/architecture/modules/contracts.md
  - 기존 타입으로 해결되면 제안하지 않고 그 타입을 쓴다.
- S2 제안 작성: TODO-CONTRACT.md `## 양식`대로 자기 섹션 끝 표시 줄 위에 추가한다(제안 / 이유 / 영향 모듈).
- S3 보고: 제안 항목 제목, 작업 진행 가능 여부(임시 우회 없이 대기 / 무관한 부분 계속)를 완료 보고에 쓴다.
  - contracts를 우회하는 임시 타입을 모듈 안에 만들지 않는다 → docs/rules/architecture/overview.md
