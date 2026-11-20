# 0002. 세션 저장 형식

- 상태: 채택
- 날짜: 2026-11-17

대상·파일명 규칙: [docs/rules/architecture/overview.md](../rules/architecture/overview.md#adr)

## 배경

[GDD §제품](../GDD.md#제품)은 세션 점수를 sessionStorage에 저장하고 탭을 닫으면 초기화한다. 튜토리얼은 세션당 1회이고 새로고침하면 건너뛴다([GDD §튜토리얼](../GDD.md#튜토리얼)). 저장하는 값은 튜토리얼 완료 여부, 세션 종료(결과 화면 도달) 여부, 받은 리뷰 목록이다. 저장 형식은 ADR 필수 대상이다.

## 결정 기준

1. 저장 값과 contracts 타입이 어긋나지 않는다.
2. 형식이 바뀔 때 이전 값을 구분할 수 있다.
3. 저장하는 상태를 세션 점수 계산, 튜토리얼 스킵, 결과 화면 재표시에 필요한 것으로 한정한다.

## 검토한 대안

| 대안 | 장점 | 단점 |
| --- | --- | --- |
| A. 필드마다 키를 따로 둔다 | 필드별 읽기·쓰기가 단순하다 | 키가 흩어지고 버전 관리를 한 번에 할 수 없다 |
| B. 리뷰를 별도 저장 전용 타입(persona, phase 포함)으로 둔다 | 저장 값에 진행 정보가 남는다 | contracts `ReviewResult`와 필드명이 어긋나고 변환 코드가 필요하다 |
| C. 키 하나에 version과 contracts `ReviewResult[]` 직렬화를 넣는다 | 타입이 하나라 어긋나지 않는다. version으로 형식을 구분한다 | 페이즈 진행은 저장하지 않는다 |

## 결정

C를 채택한다. 2026-11-17 사용자가 합의한 범위는 아래 값 형식·포트·복원 동작이다. 대안 A·B 비교는 integrator가 정리했다.

1. 키는 `takoyaki:session`이다.
2. 값은 JSON `{version: 1, tutorialCompleted, finished, reviews: ReviewResult[]}`이다. 타입은 contracts `SessionSnapshot`이다. `finished`는 미출시라 version 1에 포함한다.
3. `reviews`는 contracts `ReviewResult`(source, stars, comment, personality)를 그대로 직렬화한다. 튜토리얼 리뷰의 personality는 null이다.
4. phase는 저장하지 않는다.
5. 저장은 contracts 포트 `SessionStore { load(): SessionSnapshot | null; save(s: SessionSnapshot): void }`로만 한다. core에는 테스트용 메모리 구현만 두고, 브라우저 sessionStorage 구현은 main 조립 쪽에 둔다.
6. 복원:
   - 파싱 실패나 version이 1이 아니면 값을 버리고 새로 시작한다.
   - `finished`가 true면 결과 화면을 다시 보여준다.
   - 본게임 도중 새로고침하면 본게임 P1부터 다시 시작하고 튜토리얼 리뷰만 남긴다.

## 영향

- contracts `ReviewResult.personality`는 `Personality | null`(필수)이다.
- 값의 원본은 GDD §제품이다. 형식을 바꾸면 version을 올리고 독립 리뷰를 받는다.
- contracts에 `SessionSnapshot`, `SessionStore`(src/contracts/session.ts)와 `GameState.sessionAverage`를 둔다.

## 재검토 조건

- 페이즈 진행을 새로고침 뒤에도 이어 가야 할 때.
- localStorage 등 세션을 넘는 저장이 필요할 때. (최고 가게 점수는 [ADR 0004](0004-best-shop-score-storage.md)로 분리했고 이 ADR의 세션 저장은 그대로다.)
