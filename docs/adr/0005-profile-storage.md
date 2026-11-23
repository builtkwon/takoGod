# 0005. 튜토리얼 완료 기기 저장(profile)

- 상태: 채택
- 날짜: 2026-11-23

대상·파일명 규칙: [docs/rules/architecture/overview.md](../rules/architecture/overview.md#adr)

## 배경

[ADR 0002](0002-session-storage.md)의 튜토리얼 완료 플래그는 sessionStorage라 탭을 닫으면 사라지고, 같은 기기에서 다시 접속해도 튜토리얼을 반복한다. 2026-11-23 사용자가 튜토리얼 완료 여부만 기기에 영구 저장하기로 결정했다(A안). 이번 판 점수·리뷰는 지금처럼 sessionStorage에 둔다. 저장 형식은 ADR 필수 대상이다.

## 결정 기준

1. 세션 저장(`takoyaki:session`)의 형식과 동작을 바꾸지 않는다.
2. core와 contracts를 바꾸지 않는다.
3. 저장하는 값을 튜토리얼 완료 여부 하나로 한정한다.
4. 손상된 값이 게임을 막지 않는다.

## 검토한 대안

| 대안 | 장점 | 단점 |
| --- | --- | --- |
| A. ADR 0002에 갱신 절을 추가한다 | 문서가 한 곳이다 | 0002는 sessionStorage 세션 전용이라 수명이 다른 값이 섞인다 |
| B. `takoyaki:session`을 localStorage로 옮긴다 | 키가 늘지 않는다 | 이번 판 점수가 탭을 넘어 남고 GDD(탭 종료 시 초기화)와 어긋난다 |
| C. localStorage에 새 키 `takoyaki:profile`을 둔다 | 세션 저장이 그대로다. 수명이 값에 맞는다 | 키가 하나 늘고 main에서 세션 포트를 감싸야 한다 |

## 결정

C를 채택한다. 새 ADR로 둔 이유는 0002의 대상이 sessionStorage 세션이고, 수명이 다른 영구 값은 ADR 0004와 같은 방식으로 분리하는 것이 선례이기 때문이다.

1. 키는 `takoyaki:profile`(localStorage)이다.
2. 값은 JSON `{version: 1, tutorialCompleted: true}`다. 완료했을 때만 쓰고 `false`는 쓰지 않는다.
3. 손상된 값(파싱 실패, version이 1이 아님, tutorialCompleted가 true가 아님)은 버리고 키를 지운다. 읽기는 "기록 없음"이 된다.
4. 쓰기·접근 실패(쿼터, 비활성)는 무시한다. 게임은 계속하고 기억만 못 한다.
5. core·contracts는 바꾸지 않는다. main이 세션 저장 포트(`SessionStore`)를 감싼다.
   - `load()`: 세션 값이 있으면 그대로 돌려준다. 없고 profile이 완료면 `{version:1, tutorialCompleted:true, finished:false, reviews:[]}`를 돌려준다(core는 튜토리얼 없이 P1부터 시작, 튜토리얼 리뷰 없음).
   - `save(s)`: 세션에 저장하고 `s.tutorialCompleted`가 true면 profile에도 기록한다.
6. 튜토리얼을 마친 기기에서는 타이틀 "튜토리얼" 버튼으로 튜토리얼을 다시 할 수 있다(세션만 지우고 profile·best는 유지). 결과 화면 "다시 하기"도 세션만 지우고 profile·best를 유지한다.

## 영향

- 튜토리얼을 건너뛴 판에는 튜토리얼 5★ 리뷰가 없어 세션 점수(리뷰 평균)에 포함되지 않는다.
- 같은 탭 새로고침 동작(세션 저장값 우선)은 그대로다.
- 값의 원본은 GDD §제품·§튜토리얼이다. 형식을 바꾸면 version을 올리고 독립 리뷰를 받는다.

## 재검토 조건

- 설정 등 기기 단위로 남길 값이 늘 때(튜토리얼 다시 하기는 결정 6으로 이미 있다).
- 기기 간 동기화(계정)가 필요할 때.
