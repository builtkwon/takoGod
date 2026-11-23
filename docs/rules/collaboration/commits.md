# 커밋

- 필수: 타입은 `feat` / `fix` / `refactor` / `perf` / `test` / `docs` / `chore` 중 하나. 형식 `<타입>: <요약>`.
- 필수: 기능과 테스트는 같은 커밋.
- 필수: 커밋 전 변경 내용·검증 결과·제안 메시지를 보여주고 사용자 승인을 받는다.
- 필수: 릴리스 커밋 형식은 [versioning.md](versioning.md#릴리스)를 따른다.
- 필수: 사용자가 위임한 범위(검증 통과, 사용자 결정 항목 없음, 영수증 유효)에서는 PM 승인으로 사용자 승인을 대신한다. 위임 밖 항목(GDD 수치, contracts, 라이브러리, 규칙 문서, ADR, main 병합, 배포)은 사용자 승인을 받는다.

## 스킬 영수증

스킬을 적용한 작업의 커밋은 영수증을 커밋 트레일러로 남긴다. 이 트레일러가 영수증의 보관 위치다.

```
Skill-Receipt: <name>@v<version> S1,S2,S4 skip=S3(사유)
```

- 필수: 적용한 스킬마다 한 줄. 메시지 끝 트레일러 블록(빈 줄 뒤, `Co-Authored-By` 등과 같은 블록)에 둔다.
- 필수: 완료 단계는 쉼표로 잇고 공백 없이 쓴다. 생략 단계는 `skip=S3(사유)`, 여럿이면 `skip=S3(사유),S5(사유)`. 사유에 괄호를 쓰지 않는다.
- 필수: 완료 보고의 영수증 줄과 같은 내용이다([implementation.md](implementation.md#완료-보고)).
- 집계: `pnpm tool harness.receipts`(기본 최근 6주, `-- --weeks <N>`). 형식 오류 트레일러가 있으면 exit 1.
- 예시: `Skill-Receipt: verify-and-report@v1 S1,S2 skip=S3(문서만 변경)`
