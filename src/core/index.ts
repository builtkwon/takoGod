// core 모듈 진입점. 경계: docs/rules/architecture/modules/core.md
export { Game, type GameData, type GameOptions } from './game';
export { createEventBus } from './event-bus';
export { createMemorySessionStore } from './session';
export { createRng } from './rng';
