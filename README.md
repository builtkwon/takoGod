# takoyaki-truck

모바일 세로화면 PWA 타코야끼 굽기 게임. 설계: [docs/GDD.md](docs/GDD.md). 작업 안내: [AGENTS.md](AGENTS.md).

## 구현 상태

**스캐폴드.** 빌드·테스트·경계 검사 설정과 `src/contracts` 타입만 있다. core·render·ui·data는 빈 진입점이다. 하네스 기반(`harness/`, `.claude/`)이 있다 → [modules/harness.md](docs/rules/architecture/modules/harness.md).

## 실행

Node 24, pnpm 10(`packageManager`에 고정. corepack 사용 시 `corepack enable pnpm`).

```sh
pnpm install
pnpm dev                          # 개발 서버
pnpm build                        # 타입 검사(tsconfig.json, tsconfig.core.json) + 빌드 → dist/
pnpm vitest run --passWithNoTests # 단위 테스트
pnpm depcruise                    # 모듈 경계 검사
```

## 배포

Cloudflare Pages 정적 배포 예정(`dist/`). 미설정.
