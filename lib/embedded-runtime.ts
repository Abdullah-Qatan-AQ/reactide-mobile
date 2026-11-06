import AsyncStorage from "@react-native-async-storage/async-storage";

export const EMBEDDED_RUNTIME_VERSION = "1.0.0";
export const EMBEDDED_RUNTIME_STORAGE_KEY = "reactide-embedded-runtime-v1";

export type EmbeddedRuntimeState = {
  version: string;
  engine: "embedded-webview-javascript";
  packageRepository: "https://registry.npmjs.org";
  installedAt: number;
  firstRun: boolean;
};

/**
 * Initializes the app-owned JavaScript runtime record. The executable engine is
 * the Android WebView JavaScript engine; no shell, Termux, or system binary is
 * launched. The record makes the bootstrap idempotent and auditable.
 */
export async function ensureEmbeddedRuntime(): Promise<EmbeddedRuntimeState> {
  const raw = await AsyncStorage.getItem(EMBEDDED_RUNTIME_STORAGE_KEY);
  if (raw) {
    try {
      const state = JSON.parse(raw) as EmbeddedRuntimeState;
      if (state.version === EMBEDDED_RUNTIME_VERSION && state.engine === "embedded-webview-javascript") {
        return { ...state, firstRun: false };
      }
    } catch {
      // Recreate an invalid or interrupted bootstrap record below.
    }
  }

  const state: EmbeddedRuntimeState = {
    version: EMBEDDED_RUNTIME_VERSION,
    engine: "embedded-webview-javascript",
    packageRepository: "https://registry.npmjs.org",
    installedAt: Date.now(),
    firstRun: true,
  };
  await AsyncStorage.setItem(EMBEDDED_RUNTIME_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export async function getEmbeddedRuntime(): Promise<EmbeddedRuntimeState | null> {
  const raw = await AsyncStorage.getItem(EMBEDDED_RUNTIME_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EmbeddedRuntimeState;
  } catch {
    return null;
  }
}
