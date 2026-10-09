/** `expo` en jsdom: ningún módulo nativo está disponible (como en web o Expo Go). */
export function requireOptionalNativeModule<T>(_name: string): T | null {
  return null;
}

export function requireNativeModule<T>(name: string): T {
  throw new Error(`Native module ${name} is not available in tests`);
}
