import Constants from "expo-constants";

function apiUrl(path: string): string {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (configured) return `${configured.replace(/\/$/, "")}${path}`;
  return path;
}

export async function runWorkspaceCommand(command: string): Promise<{ output: string; error?: string }> {
  const response = await fetch(apiUrl("/api/terminal"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  const data = (await response.json()) as { output?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "تعذر تشغيل الأمر");
  return { output: data.output ?? "", error: data.error };
}

export async function installWorkspacePackage(packageName: string): Promise<{ output: string; error?: string }> {
  const response = await fetch(apiUrl("/api/packages/install"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageName }),
  });
  const data = (await response.json()) as { output?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "تعذر تنزيل الحزمة");
  return { output: data.output ?? "", error: data.error };
}
