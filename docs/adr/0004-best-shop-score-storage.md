# 0004. 최고 가게 점수 영구 저장

- 상태: 채택
- 날짜: 2026-11-20

대상·파일명 규칙: [docs/rules/architecture/overview.md](../rules/architecture/overview.md#adr)

## 배경

[GDD §가게 점수](../GDD.md#가게-점수)는 별점과 별개의 상한 없는 점수를 두고, 최고 기록을 판이 바뀌어도 남긴다. [ADR 0002](0002-session-storage.md)의 sessionStorage는 탭을 닫으면 사라지고, 그 재검토 조건("localStorage 등 세션을 넘는 저장이 필요할 때")에 해당한다. 저장 형식은 ADR 필수 대상이다.

## 결정 기준

1. 세션 저장(`takoyaki:session`)의 형식과 동작을 바꾸지 않는다.
2. 형식이 바뀔 때 이전 값을 구분할 수 있다.
3. 저장하는 값을 최고 가게 점수 하나로 한정한다(계정·백엔드 없음).
4. 손상된 값이 게임을 막지 않는다.

## 검토한 대안

| 대안 | 장점 | 단점 |
| --- | --- | --- |
| A. `SessionSnapshot`에 best를 넣는다 | 키가 하나다 | sessionStorage라 탭을 닫으면 사라진다. 수명이 다른 값이 섞이고 ADR 0002 형식(version 1)이 바뀐다 |
| B. localStorage에 새 키로 최고 기록만 둔다 | 세션 저장이 그대로다. 수명이 값에 맞는다 | 키가 하나 늘고 포트가 하나 늘어난다 |
| C. localStorage에 모든 판 기록(목록)을 둔다 | 이력 기능으로 확장할 수 있다 | 요구 범위를 넘는다(YAGNI) |

## 결정

B를 채택한다. 2026-11-20 사용자가 승인했다.

1. 키는 `takoyaki:best`(localStorage)다.
2. 값은 JSON `{version: 1, best: number}`이다.
3. 손상된 값(파싱 실패, version이 1이 아님, best가 안전한 0 이상 정수가 아님)은 버린다. 포트는 null(기록 없음)을 돌려준다.
4. 저장은 contracts 포트 `BestScoreStore { load(): number | null; save(best: number): void }`로만 한다. core는 이 타입만 쓰고 브라우저 localStorage 구현은 main 조립 쪽에 둔다.
5. 갱신 시점은 세션 종료(결과 화면 도달)이고 `max(저장값, 이번 판 가게 점수)`다. 판 시작 때 읽은 값이 `GameStateV2.bestShopScore`이며 진행 중에는 바뀌지 않는다.
6. 세션 저장(ADR 0002)은 바꾸지 않는다.

## 영향

- contracts: `BestScoreStore`(src/contracts/session.ts), `GameStateV2.shopScore·bestShopScore·combo`, 이벤트 `score/plate`·`score/new-best`.
- 값의 원본은 GDD §제품·§가게 점수다. 형식을 바꾸면 version을 올리고 독립 리뷰를 받는다.
- localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 구현이 읽기 null·쓰기 무시로 동작해야 한다(조립 쪽 책임).

## 재검토 조건

- 판마다의 이력·순위처럼 최고 기록 말고 기록을 더 남겨야 할 때.
- 기기 간 동기화(계정)가 필요할 때.
