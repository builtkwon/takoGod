# 규칙 목차

규칙은 아래 파일 중 한 곳에만 쓴다. 다른 문서는 해당 파일을 링크한다.

| 영역 | 파일 | 다루는 것 |
| --- | --- | --- |
| 아키텍처 | [architecture/overview.md](architecture/overview.md) | 계층·의존 방향·경계 검사, ADR |
| 모듈 | [architecture/modules/core.md](architecture/modules/core.md) | src/core |
| | [architecture/modules/render.md](architecture/modules/render.md) | src/render |
| | [architecture/modules/ui.md](architecture/modules/ui.md) | src/ui, src/data |
| | [architecture/modules/contracts.md](architecture/modules/contracts.md) | src/contracts, src/*.ts(main.ts 등) |
| | [architecture/modules/harness.md](architecture/modules/harness.md) | harness/, .claude/ (소유, 도구 호출, 검사) |
| 개발 | [development/typescript.md](development/typescript.md) | TypeScript 설정·작성 기준 |
| | [development/testing.md](development/testing.md) | 테스트 위치·범위 |
| 협업 | [collaboration/implementation.md](collaboration/implementation.md) | 합의 범위, 작업 루프, 완료 보고 |
| | [collaboration/review.md](collaboration/review.md) | 리뷰 종류·조건, 체크 5항목, 증거, 영수증 표기, 대화 한도 |
| | [collaboration/ai-execution.md](collaboration/ai-execution.md) | 자동 수정 한도 |
| | [collaboration/commits.md](collaboration/commits.md) | 커밋 타입·승인 |

게임 규칙과 수치는 [GDD](../GDD.md)가 원본이다. 이 폴더에 수치를 옮겨 쓰지 않는다.

## 규칙 표현

규칙 문장은 아래 다섯 표현 중 하나로 강도를 밝힌다.

| 표현 | 의미 |
| --- | --- |
| 필수·금지 | 반드시 준수 |
| 기본·우선 | 특별한 이유가 없으면 따름. 다르면 이유 기록 |
| 허용 | 명시한 조건 안에서 자율 |
| 예시 | 설명용 |
| 미정 | 필요 시 합의. 임의 확정 금지 |
