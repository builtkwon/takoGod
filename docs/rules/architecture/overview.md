# 아키텍처 개요

## 계층

| 계층 | 위치 | 규칙 |
| --- | --- | --- |
| domain+application | `src/core` | 금지: DOM·Three.js·브라우저 API. 필수: 시간은 주입식 clock(`tick(dt)`), 저장소는 인터페이스 |
| 포트 | `src/contracts` | 필수: 모든 모듈 간 타입·EventBus 이벤트를 여기에 둔다. 구현 세션은 읽기 전용 |
| 어댑터 | `src/render`, `src/ui`, `src/data` | 필수: core와는 contracts로만 통신. 금지: 게임 규칙 구현 |
| bootstrap | `src/main.ts` | 루프·조립·PWA |

모듈별 소유와 세부 규칙은 [modules/](modules/)를 본다.

## 의존 방향

```
main.ts ──▶ core ──▶ contracts
   │                    ▲
   └──▶ render, ui, data ┘
```

- 금지: render·ui·data → core 직접 import.
- 금지: contracts → 다른 모듈·외부 패키지 import. contracts는 리프다.
- 금지: main.ts를 import. 순환 의존.

## 경계 검사

| 검사 | 수단 | 실행 |
| --- | --- | --- |
| import 경계 | `.dependency-cruiser.cjs` | `pnpm depcruise` |
| core·contracts의 DOM·브라우저 전역 사용 | `tsconfig.core.json`(DOM lib 제외) | `pnpm build`에 포함 |

규칙을 바꾸면 이 문서와 두 설정 파일을 같은 커밋에서 바꾼다. 경계 변경은 먼저 합의 대상이다([implementation.md](../collaboration/implementation.md#먼저-합의-vs-자율-진행)).

## ADR

- 필수 대상: 모듈 경계, 기술·라이브러리 선택, 저장 형식.
- 파일: `docs/adr/NNNN-주제.md`. 양식은 [docs/adr/template.md](../../adr/template.md)를 복사한다.
