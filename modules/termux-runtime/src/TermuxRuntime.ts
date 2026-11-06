import { NativeModules, Platform } from "react-native";

type NativeRuntime = {
  isInstalled(): Promise<boolean>;
  install(): Promise<{ prefix: string; files: number; updateExitCode: number }>;
  workspacePath(): Promise<string>;
  syncFiles(files: { name: string; content: string }[]): Promise<string>;
  run(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

const native = NativeModules.TermuxRuntime as NativeRuntime | undefined;

export function isRuntimeNativeAvailable() {
  return Platform.OS === "android" && Boolean(native);
}

export async function isRuntimeInstalled() {
  return Boolean(native && (await native.isInstalled()));
}

export async function installRuntime() {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.install();
}

export async function syncRuntimeFiles(files: { name: string; content: string }[]) {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.syncFiles(files);
}

export async function getRuntimeWorkspacePath() {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.workspacePath();
}

export async function runRuntimeCommand(command: string, cwd?: string) {
  if (!native) throw new Error("runtime الأصلي غير متاح في هذه المنصة.");
  return native.run(command, cwd);
}
