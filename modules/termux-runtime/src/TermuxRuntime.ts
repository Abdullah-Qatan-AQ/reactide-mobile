import { NativeModules, Platform } from "react-native";

type NativeRuntime = {
  isInstalled(): Promise<boolean>;
  install(url: string): Promise<{ prefix: string; files: number }>;
  run(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

const native = NativeModules.TermuxRuntime as NativeRuntime | undefined;

export const TERMUX_BOOTSTRAP_URLS = {
  arm64: "https://github.com/termux/termux-packages/releases/download/bootstrap-2025.03.28-r1%2Bapt-android-7/bootstrap-aarch64.zip",
  arm: "https://github.com/termux/termux-packages/releases/download/bootstrap-2025.03.28-r1%2Bapt-android-7/bootstrap-arm.zip",
};

export function isRuntimeNativeAvailable() {
  return Platform.OS === "android" && Boolean(native);
}

export async function isRuntimeInstalled() {
  return Boolean(native && (await native.isInstalled()));
}

export async function installRuntime(url: string) {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.install(url);
}

export async function runRuntimeCommand(command: string, cwd?: string) {
  if (!native) throw new Error("runtime الأصلي غير متاح في هذه المنصة.");
  return native.run(command, cwd);
}
