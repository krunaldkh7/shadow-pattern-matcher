// three.cjs calls process.emitWarning when required (as @react-three/fiber does),
// which React Native's process object doesn't provide.
const p = globalThis.process as unknown as { emitWarning?: (...args: unknown[]) => void } | undefined;
if (p && typeof p.emitWarning !== 'function') {
  p.emitWarning = () => {};
}

export {};
