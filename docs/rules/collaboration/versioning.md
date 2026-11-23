# 버전 관리

버전은 네 종류다. 앱, 저장 형식, SW 캐시, 하네스. 하네스는 이 문서가 새로 정하지 않는다.

## 앱 버전

- 필수: SemVer `MAJOR.MINOR.PATCH`. 원본은 `package.json`의 `version`이다. git tag·CHANGELOG·화면 표시는 이 값에서 파생한다.
- 기본: 1.0.0 전에는 0.x로 둔다. 1.0.0은 사용자가 공개 출시로 선언할 때 올린다.
- 올림 기준(0.x 기준. 1.0.0 이후는 아래 MAJOR 줄 적용):

| 변경 | 올림 | 예시 |
| --- | --- | --- |
| 저장 형식 변경으로 기존 사용자 값이 버려지거나 변환됨 | MINOR(1.0.0 이후 MAJOR) | session version 1→2 |
| GDD 규칙·수치 변경 | MINOR | 판정 구간, 점수 계산, 만족도 상한 제거 |
| 새 기능·콘텐츠 | MINOR | 새 손님 유형, 새 화면, 새 재료 |
| contracts 변경 | 단독으로는 올리지 않음. 사용자에게 보이는 변화가 있으면 그 변화로 판단 | 타입 주석 정리는 올림 없음 |
| 시각·대사·문구 조정 | PATCH | 색, 모델, 외곽선, 대사 수정 |
| 버그 수정, 성능 개선 | PATCH | 판정 오류, 렌더 최적화 |
| 문서·하네스·테스트만 변경 | 올림 없음 | 규칙 문서, toolset, e2e |

- 금지: 위 표에 없는 사유로 버전을 올리지 않는다. 하네스 변경은 앱 버전과 무관하다.

## 첫 버전

첫 릴리스는 v0.1.0이다(2026-11-23). 그 이전 배포(2026-11-17~21)는 버전이 없고 CHANGELOG 0.1.0 항목에 한 단락으로 요약한다.

## 릴리스

- 기본: 릴리스 단위는 "배포할 묶음"이다. 사용자 승인을 받은 main 배포 시점마다 버전을 올리고, 개별 커밋·병합마다 올리지 않는다.
- 필수: 버전 올림은 PM이 릴리스를 승인하고 integrator가 실행한다. 배포 자체가 사용자 승인 대상이므로([commits.md](commits.md)) 사용자 승인도 받는다.
- 필수: 릴리스 커밋 하나에 `package.json` version 변경과 CHANGELOG 항목을 함께 담는다. 커밋 `chore: release vX.Y.Z`.
- 필수: git tag는 `vX.Y.Z`(주석 태그), 릴리스 커밋에 건다.
- 필수: push(`git push origin main vX.Y.Z`)는 사용자 승인 뒤 PM이 한다. integrator는 push하지 않는다. 릴리스 커밋과 tag는 로컬에서 만들므로 push 전에는 배포되지 않아 tag를 되돌릴 수 있다.
- 금지: push된 tag를 옮기거나 지우지 않는다. 틀렸으면 다음 PATCH로 고친다.

## CHANGELOG

- 필수: 루트 `CHANGELOG.md`. 버전 최신순. 항목 분류는 `추가 / 변경 / 수정 / 저장 형식` 네 가지. 저장 형식은 값이 버려지는 변경을 반드시 적는다.
- 필수: 릴리스 커밋에서 작성한다. 개발 중에는 쓰지 않는다. 재료는 `git log vA..HEAD`의 feat·fix 커밋이다.
- 기본: 문구는 사용자가 보는 변화 중심으로 한 줄씩. 내부 리팩터링·문서·하네스는 적지 않는다.
- 기본: README는 현재 상태를 설명하고 CHANGELOG는 이력을 담는다. README에 이력을 쓰지 않고, 최신 버전 번호도 옮겨 적지 않는다(CHANGELOG 링크만 둔다).

## 화면 표시

- 기본: 타이틀·결과 화면 하단에 `v<version> · <커밋 7자리>`(예: `v0.1.0 · 1a44527`)처럼 작게 표시한다. 버그 제보 때 사용자가 읽어 줄 수 있게 한다.
- 필수: 커밋 값은 Cloudflare Pages 빌드 환경 변수 `CF_PAGES_COMMIT_SHA`를 우선한다. 없으면 `git rev-parse --short=7 HEAD`, 그것도 실패하면 `dev`.
- 필수: 값은 빌드 시 주입한다(Vite `define`: `__APP_VERSION__`, `__APP_COMMIT__`). 런타임에 package.json을 읽지 않는다.
- 필수: 소유. `vite.config.ts` define, 전역 타입 선언, main.ts에서 ui로 문자열 전달 = integrator. 표시 DOM·CSS = ui.

## SW 캐시 이름

- 기본: 캐시 이름 `takoyaki-v<N>`은 앱 버전과 연동하지 않는다. N은 sw.js 로직이나 STATIC 구성이 바뀔 때만 올린다(옛 캐시는 activate가 지운다). 빌드 해시 변경과 앱 버전 올림은 N을 올리지 않는다.
- 이유: 앱 파일은 해시 이름이라 새 배포가 자동으로 갱신되고, 이름을 앱 버전에 묶으면 PATCH마다 전체 캐시를 다시 받는다.

## 저장 형식 version

- 필수: 키마다 정수 `version`을 가진다(`takoyaki:session`, `takoyaki:best`). 원본은 각 ADR이다.
- 필수: 올리는 조건은 읽기 쪽 해석이 달라지는 형식 변경(필드 추가·삭제·의미 변경)뿐이다. 값 범위만 달라지는 변경은 올리지 않는다.
- 필수: version을 올릴 때는 ADR을 고치고 독립 리뷰를 받으며, CHANGELOG의 저장 형식 항목에 적는다.
- 기본: 이전 version 값은 버린다(세션은 새로 시작, 최고 기록은 기록 없음). 기존 동작과 같다.
- 허용: 버리면 사용자 손실이 큰 값(최고 기록)은 변환 코드를 둘 수 있다. 이 경우 변환 테스트를 같은 커밋에 넣고 ADR에 이유를 적는다.

## 하네스 버전

[modules/harness.md](../architecture/modules/harness.md)를 따른다. 이 문서는 새로 정하지 않는다. toolset `version`은 도구 추가·제거 시 올린다. 스킬 `version`(SKILL.md, 영수증 `name@v<version>`)을 올리는 시점은 미정이며 harness 문서에서 정한다.

## contracts

- 필수: contracts는 별도 버전을 두지 않는다. 변경 이력은 `feat(contracts):` 커밋과 [TODO-CONTRACT.md](../../../TODO-CONTRACT.md) 절차가 원본이다([modules/contracts.md](../architecture/modules/contracts.md)).
