/**
 * 모듈 경계 검사. 원본 규칙: docs/rules/architecture/overview.md
 * core의 DOM 금지는 import로 드러나지 않으므로 tsconfig.core.json(DOM lib 제외)이 맡는다.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'core-no-three',
      comment: 'core는 Three.js에 의존하지 않는다.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '(^|/)node_modules/(three|@types/three)/' },
    },
    {
      name: 'core-no-adapters',
      comment: 'core는 render·ui·data·main을 import하지 않는다.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/(render|ui|data)/|^src/main\\.ts$' },
    },
    {
      name: 'core-no-node-builtins',
      comment: 'core는 브라우저·Node 런타임 API에 의존하지 않는다(테스트 파일 제외).',
      severity: 'error',
      from: { path: '^src/core/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'adapters-no-core',
      comment: 'render·ui·data는 core를 직접 import하지 않는다. contracts만 사용한다.',
      severity: 'error',
      from: { path: '^src/(render|ui|data)/' },
      to: { path: '^src/core/' },
    },
    {
      name: 'contracts-is-leaf',
      comment: 'contracts는 다른 모듈과 외부 패키지를 import하지 않는다.',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { pathNot: '^src/contracts/' },
    },
    {
      name: 'no-import-main',
      comment: 'main.ts는 조립 지점이라 누구도 import하지 않는다.',
      severity: 'error',
      from: {},
      to: { path: '^src/main\\.ts$' },
    },
    {
      name: 'session-store-only-contracts',
      comment: 'session-store.ts는 contracts만 import한다(외부 패키지 포함).',
      severity: 'error',
      from: { path: '^src/session-store\\.ts$' },
      to: { pathNot: '^src/(contracts/|session-store\\.ts$)' },
    },
    {
      name: 'session-store-only-main',
      comment: 'session-store.ts는 main만 import한다(테스트 파일 제외).',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/(main|session-store)(\\.test)?\\.ts$' },
      to: { path: '^src/session-store\\.ts$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
