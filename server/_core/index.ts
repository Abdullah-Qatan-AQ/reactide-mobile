import express from "express";
import { createServer } from "http";
import { spawn } from "node:child_process";

const ALLOWED_BINARIES = new Set(["pwd", "ls", "node", "python3", "python", "pnpm", "npm", "git", "whoami", "uname", "echo"]);

function tokenizeCommand(command: string): string[] {
  if (!command || command.length > 180 || /[;&|><`$\\]/.test(command)) return [];
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => part.replace(/^['"]|['"]$/g, "")) ?? [];
}

function runWorkspaceProcess(command: string, timeoutMs = 20_000): Promise<{ output: string; code: number }> {
  const parts = tokenizeCommand(command);
  if (!parts.length || !ALLOWED_BINARIES.has(parts[0])) return Promise.reject(new Error("الأمر غير مسموح. استخدم أمرًا من القائمة الآمنة."));
  const child = spawn(parts[0], parts.slice(1), { cwd: process.cwd(), shell: false, env: { ...process.env, CI: "1" } });
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("انتهت مهلة الأمر")); }, timeoutMs);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ output: output.slice(-20_000), code: code ?? 1 }); });
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);


  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));


  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.post("/api/terminal", async (req, res) => {
    try {
      const result = await runWorkspaceProcess(String(req.body?.command ?? ""));
      res.status(result.code === 0 ? 200 : 422).json({ output: result.output, error: result.code === 0 ? undefined : "انتهى الأمر برمز خطأ" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "تعذر تشغيل الأمر" });
    }
  });
  app.post("/api/packages/install", async (req, res) => {
    const packageName = String(req.body?.packageName ?? "").trim();
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@[a-z0-9._-]+)?$/i.test(packageName)) {
      res.status(400).json({ error: "اسم الحزمة غير صالح" });
      return;
    }
    try {
      const result = await runWorkspaceProcess(`pnpm add --ignore-scripts ${packageName}`, 120_000);
      res.status(result.code === 0 ? 200 : 422).json({ output: result.output, error: result.code === 0 ? undefined : "فشل تثبيت الحزمة" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "تعذر تثبيت الحزمة" });
    }
  });



  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log("[api] server listening");
  });
}

startServer().catch(() => {
  console.error("[api] server failed to start");
});
