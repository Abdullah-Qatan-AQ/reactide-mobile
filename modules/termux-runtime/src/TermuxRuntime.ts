import { LegacyEventEmitter, type EventSubscription } from "expo-modules-core";
import { NativeModules, Platform } from "react-native";

type NativeRuntime = {
  isInstalled(): Promise<boolean>;
  install(): Promise<{ prefix: string; files: number; updateExitCode: number }>;
  prepareShell(): Promise<{ ready: boolean; pty: string }>;
  startShell(cwd?: string): Promise<{ started: boolean; reused: boolean }>;
  writeShell(input: string): Promise<boolean>;
  stopShell(): Promise<boolean>;
  workspacePath(): Promise<string>;
  syncFiles(files: { name: string; content: string }[]): Promise<string>;
  run(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

const native = NativeModules.TermuxRuntime as NativeRuntime | undefined;
const emitter = native ? new LegacyEventEmitter(native as never) : null;

export type TermuxShellOutput = { text: string };
export type TermuxShellExit = { exitCode: number };

export function isRuntimeNativeAvailable() {
  return Platform.OS === "android" && Boolean(native);
}

export async function isRuntimeInstalled() {
  return Boolean(native && (await native.isInstalled()));
}

export async function installRuntime() {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  const result = await native.install();
  await native.prepareShell();
  return result;
}

export async function prepareRuntimeShell() {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.prepareShell();
}

export async function startRuntimeShell(cwd?: string) {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.startShell(cwd);
}

export async function writeRuntimeShell(input: string) {
  if (!native) throw new Error("runtime الأصلي متاح في APK Android فقط.");
  return native.writeShell(input);
}

export async function stopRuntimeShell() {
  if (!native) return false;
  return native.stopShell();
}

export function addRuntimeShellOutputListener(listener: (event: TermuxShellOutput) => void): EventSubscription | null {
  return emitter?.addListener<TermuxShellOutput>("onShellOutput", listener) ?? null;
}

export function addRuntimeShellExitListener(listener: (event: TermuxShellExit) => void): EventSubscription | null {
  return emitter?.addListener<TermuxShellExit>("onShellExit", listener) ?? null;
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
