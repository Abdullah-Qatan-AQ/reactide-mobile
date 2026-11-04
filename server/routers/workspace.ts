import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, lstat, mkdir, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";

const SAFE_COMMANDS = {
  pwd: ["pwd", []],
  "node --version": ["node", ["--version"]],
  "npm --version": ["npm", ["--version"]],
  "pnpm --version": ["pnpm", ["--version"]],
  "python3 --version": ["python3", ["--version"]],
} as const;

type SafeCommand = keyof typeof SAFE_COMMANDS;
const packageSpecPattern = /^(?:@[a-z0-9][a-z0-9._-]{0,39}\/)?[a-z0-9][a-z0-9._-]{0,79}(?:@[a-z0-9^~><=*|.+-]{1,40})?$/i;
const installLocks = new Set<string>();
const activeWorkspaceDirectories = new Set<string>();
const lastInstallAt = new Map<string, number>();
const MAX_OUTPUT_BYTES = 12_000;
const INSTALL_TIMEOUT_MS = 90_000;
const MAX_WORKSPACE_BYTES = 100 * 1024 * 1024;
const WORKSPACE_RETENTION_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_ROOT = path.join(os.tmpdir(), "reactide-user-workspaces");
let lastCleanupAt = 0;

function workspaceFor(openId: string): string {
  const opaqueId = createHash("sha256").update(openId).digest("hex").slice(0, 32);
  return path.join(WORKSPACE_ROOT, opaqueId);
}

async function directoryBytes(directory: string, stopAfter = MAX_WORKSPACE_BYTES): Promise<number> {
  let total = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    try {
      const info = await lstat(entryPath);
      if (info.isDirectory() && !info.isSymbolicLink()) {
        total += await directoryBytes(entryPath, stopAfter - total);
      } else {
        total += info.size;
      }
      if (total > stopAfter) return total;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return total;
}

async function cleanupStaleWorkspaces(currentDirectory: string): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  let entries;
  try {
    entries = await readdir(WORKSPACE_ROOT, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(WORKSPACE_ROOT, entry.name);
    if (directory === currentDirectory || activeWorkspaceDirectories.has(directory)) continue;
    try {
      const info = await stat(directory);
      if (now - info.mtimeMs > WORKSPACE_RETENTION_MS) {
        await rm(directory, { recursive: true, force: true });
      }
    } catch {
      // A concurrent cleanup or temporary filesystem error must not block a new session.
    }
  }
}

async function ensureWorkspace(openId: string): Promise<string> {
  const directory = workspaceFor(openId);
  await mkdir(WORKSPACE_ROOT, { recursive: true, mode: 0o700 });
  await chmod(WORKSPACE_ROOT, 0o700);
  await cleanupStaleWorkspaces(directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const now = new Date();
  await utimes(directory, now, now);
  return directory;
}

async function clearWorkspace(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

function cleanEnvironment(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: home,
    TMPDIR: home,
    NODE_ENV: "production",
    CI: "1",
    NO_COLOR: "1",
    npm_config_registry: "https://registry.npmjs.org",
    npm_config_ignore_scripts: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
  };
}

function runProcess(
  binary: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  maxCwdBytes?: number,
): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: cleanEnvironment(cwd),
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let outputBytes = 0;
    let timedOut = false;
    let sizeLimitExceeded = false;
    let settled = false;
    let sizeCheckInProgress = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (sizeTimer) clearInterval(sizeTimer);
    };
    const terminate = () => {
      if (child.pid && process.platform !== "win32") {
        try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      } else {
        child.kill("SIGTERM");
      }
      forceKillTimer = setTimeout(() => {
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
        } else {
          child.kill("SIGKILL");
        }
      }, 1_500);
      forceKillTimer.unref();
    };
    const append = (chunk: Buffer) => {
      if (outputBytes >= MAX_OUTPUT_BYTES) return;
      const remaining = MAX_OUTPUT_BYTES - outputBytes;
      const accepted = chunk.subarray(0, remaining);
      output += accepted.toString("utf8");
      outputBytes += accepted.length;
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    const sizeTimer = maxCwdBytes
      ? setInterval(() => {
          if (settled || sizeCheckInProgress || sizeLimitExceeded) return;
          sizeCheckInProgress = true;
          void directoryBytes(cwd, maxCwdBytes)
            .then((bytes) => {
              if (!settled && bytes > maxCwdBytes) {
                sizeLimitExceeded = true;
                terminate();
              }
            })
            .catch(() => undefined)
            .finally(() => { sizeCheckInProgress = false; });
        }, 5_000)
      : undefined;
    sizeTimer?.unref();

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimers();
      const boundedOutput = output.trim().slice(-MAX_OUTPUT_BYTES);
      if (sizeLimitExceeded) {
        reject(new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "تجاوز runtime حد التخزين 100 MB؛ أوقفت الخدمة التنزيل وستمسح المساحة المؤقتة." }));
      } else if (timedOut) {
        reject(new TRPCError({ code: "TIMEOUT", message: "انتهت مهلة العملية؛ أوقفتها الخدمة." }));
      } else if (code === 0) {
        resolve({ output: boundedOutput || "(لا يوجد ناتج)" });
      } else {
        resolve({ output: boundedOutput || "تعذر تشغيل العملية.", error: `exit_${code ?? 1}` });
      }
    });
  });
}

async function packageNames(directory: string): Promise<string[]> {
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")) as {
      dependencies?: Record<string, unknown>;
    };
    return Object.keys(manifest.dependencies ?? {}).slice(0, 100);
  } catch {
    return [];
  }
}

export const workspaceRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const directory = await ensureWorkspace(ctx.user.openId);
    return {
      available: true,
      label: "~/reactide-workspace",
      persistence: "temporary",
      maxStorageBytes: MAX_WORKSPACE_BYTES,
      expiresAfterHours: 24,
      packages: await packageNames(directory),
    } as const;
  }),

  command: protectedProcedure
    .input(z.object({ command: z.enum(Object.keys(SAFE_COMMANDS) as [SafeCommand, ...SafeCommand[]]) }))
    .mutation(async ({ ctx, input }) => {
      const directory = await ensureWorkspace(ctx.user.openId);
      const [binary, args] = SAFE_COMMANDS[input.command];
      try {
        const result = await runProcess(binary, [...args], directory, 8_000);
        const output = input.command === "pwd" ? "~/reactide-workspace" : result.output;
        return { output, error: result.error };
      } catch {
        return { output: "الأمر غير متاح في runtime الحالي.", error: "runtime_command_unavailable" };
      }
    }),

  installPackage: protectedProcedure
    .input(z.object({ packageName: z.string().trim().min(1).max(140).regex(packageSpecPattern) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.openId;
      if (installLocks.has(userId)) {
        throw new TRPCError({ code: "CONFLICT", message: "هناك عملية تنزيل جارية لهذا المستخدم." });
      }
      const now = Date.now();
      if (now - (lastInstallAt.get(userId) ?? 0) < 5_000) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "انتظر قليلًا قبل تنزيل حزمة أخرى." });
      }
      installLocks.add(userId);
      lastInstallAt.set(userId, now);
      let directory: string | undefined;
      try {
        directory = await ensureWorkspace(userId);
        activeWorkspaceDirectories.add(directory);
        const currentSize = await directoryBytes(directory);
        if (currentSize >= MAX_WORKSPACE_BYTES) {
          await clearWorkspace(directory);
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "تجاوزت مساحة runtime حد 100 MB؛ مُسحت الحزم المؤقتة." });
        }
        const result = await runProcess(
          "pnpm",
          ["add", "--ignore-scripts", "--save-exact", input.packageName],
          directory,
          INSTALL_TIMEOUT_MS,
          MAX_WORKSPACE_BYTES,
        );
        if (result.error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "فشل تنزيل الحزمة من سجل npm.", cause: result.output });
        }
        const installedSize = await directoryBytes(directory);
        if (installedSize > MAX_WORKSPACE_BYTES) {
          await clearWorkspace(directory);
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "تجاوز runtime حد 100 MB؛ مُسحت المساحة المؤقتة." });
        }
        return {
          output: result.output,
          packageName: input.packageName,
          packages: await packageNames(directory),
          note: "الحزمة أضيفت إلى runtime المؤقت لهذا المستخدم؛ لم تُشغَّل scripts الخاصة بها.",
        };
      } catch (error) {
        if (
          directory &&
          error instanceof TRPCError &&
          error.code === "PAYLOAD_TOO_LARGE"
        ) {
          await clearWorkspace(directory);
        }
        throw error;
      } finally {
        if (directory) activeWorkspaceDirectories.delete(directory);
        installLocks.delete(userId);
      }
    }),
});
