import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { Platform } from "react-native";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export type SafeWorkspaceCommand = "pwd" | "node --version" | "npm --version" | "pnpm --version" | "python3 --version";
export type WorkspaceStatus = {
  available: boolean;
  label: string;
  persistence: "temporary";
  maxStorageBytes: number;
  expiresAfterHours: number;
  packages: string[];
};

let client: ReturnType<typeof createTRPCProxyClient<AppRouter>> | undefined;

function requireWebPreview() {
  if (Platform.OS !== "web") {
    throw new Error("طرفية Manus متاحة في معاينة الويب فقط في هذا الإصدار.");
  }
}

function getWorkspaceClient() {
  requireWebPreview();
  if (client) return client;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("عنوان runtime غير مضبوط لهذا الإصدار.");
  client = createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({
      url: `${baseUrl.replace(/\/$/, "")}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await Auth.getSessionToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    })],
  });
  return client;
}

export async function getWorkspaceStatus(): Promise<WorkspaceStatus> {
  requireWebPreview();
  return getWorkspaceClient().workspace.status.query();
}

export async function runWorkspaceCommand(command: SafeWorkspaceCommand): Promise<{ output: string; error?: string }> {
  requireWebPreview();
  return getWorkspaceClient().workspace.command.mutate({ command });
}

export async function installWorkspacePackage(packageName: string): Promise<{ output: string; note: string; packages: string[] }> {
  requireWebPreview();
  return getWorkspaceClient().workspace.installPackage.mutate({ packageName });
}
