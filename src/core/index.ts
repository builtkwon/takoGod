// core 모듈 진입점. 경계: docs/rules/architecture/modules/core.md
export { GameV2, type GameDataV2, type GameOptionsV2 } from './game-v2';
export { BalanceSimulatorV2 } from './sim';
export { createEventBus } from './event-bus';
export { createMemorySessionStore } from './session';
export { createRng } from './rng';
