# 스키마와 상한

원본: docs/harness-design.md §6, §7, §9. 검사 구현: harness/scripts/lib/model.ts, format.ts.

## 스킬

경로: `.claude/skills/<name>/SKILL.md`, 상세는 `.claude/skills/<name>/references/*.md`.

```yaml
---
name: <kebab-case, 디렉터리 이름과 같게>
version: <1 이상 정수. 단계·MUST가 바뀌면 올린다>
description: <언제 쓰는지로 시작, 한 줄, 200자 이하>
requires: []      # 같은 에이전트의 선행 스킬, 최대 2
consumes: []      # 다른 스킬이 produces하는 산출물 경로
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [test.unit] }
---
```

- 일곱 키 모두 필수. 다른 키는 실패.
- steps 키는 S1부터 빠짐없이 연속. 값은 `{ tools: [...] }`만.
- 본문 첫 섹션은 `## MUST`: 본문 첫 20줄 안에서 끝나고 항목 5개 이하(1개 이상).
- `## 단계` 섹션의 줄 머리 S 번호(`- S1 …`, `### S1 …`)가 frontmatter steps와 같은 순서·개수.
- 본문·references에 명령어 문자열 금지. 도구 호출은 `pnpm tool <id>` 형식만 허용(뒤의 `-- 인자`는 허용).
- 단계에는 "조건 → 열 파일"만 쓰고, 상세·예외·예시는 references/로 옮긴다.

| 상한 | 값 | summary 경고(80%) |
| --- | --- | --- |
| SKILL.md | 120줄 | 96줄 |
| references 파일 | 200줄 | 160줄 |
| description | 200자 | 160자 |

## 에이전트

경로: `.claude/agents/<name>.md`.

```yaml
---
name: <kebab-case, 파일 이름과 같게>
description: <한 줄>
tools: Read, Edit, Write, Bash, Grep, Glob
skills: [ ... ]          # .claude/skills의 스킬만. 메타 스킬 금지
allowed_tools: [ ... ]   # toolset ID
owns: [ src/core/** ]
---
```

본문 구성(이 순서):

1. 수정 범위: owns 밖은 읽기만. 경계 변경은 먼저 합의.
2. 시작 시: AGENTS.md → `.claude/skills/INDEX.md`에서 자기 스킬만 확인.
3. 필수·조건부 스킬: 언제 어떤 스킬을 여는지.
4. 완료 보고 형식: 변경 / 실제 실행한 도구·결과 / 미검증 범위 / 영수증.

## 영수증

영수증은 커밋 트레일러다. 형식 원본: docs/rules/collaboration/commits.md#스킬-영수증

```
Skill-Receipt: <name>@v<version> S1,S2,S4 skip=S3(사유)
```

- 적용 스킬마다 한 줄. 완료 보고에 같은 줄을 쓰고, 커밋 메시지 트레일러 블록에 그대로 옮긴다.
- 생성할 verify-and-report 스킬은 완료 보고 단계에 이 트레일러 줄을 포함한다. 다른 스킬도 완료 보고를 안내하면 같다.
- reviewer는 영수증의 도구 단계와 실제 도구 로그를 대조한다. 로그 없는 완료 단계는 필수 수정.
- 집계: `pnpm tool harness.receipts`(git log 트레일러 기준).
