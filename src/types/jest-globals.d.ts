// Ambient jest globals for type-checking test files (e.g. the canonical i18n
// localeSwitching regression test, which uses jest's globals without importing
// them). TypeScript 6 no longer auto-includes @types/jest, so reference it
// explicitly here. Type-only; no runtime effect.
/// <reference types="jest" />
