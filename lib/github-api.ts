import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "reactide.github.api-token";
const API_ROOT = "https://api.github.com";

export type GithubViewer = { login: string; name: string | null; avatar_url: string };
export type GithubRepo = { id: number; name: string; full_name: string; private: boolean; html_url: string; default_branch: string };

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status}: ${body.slice(0, 180)}`);
  }
  return (await response.json()) as T;
}

export async function saveGithubToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
}

export async function getGithubToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearGithubToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getGithubViewer(token: string): Promise<GithubViewer> {
  return request<GithubViewer>("/user", token);
}

export async function listGithubRepos(token: string): Promise<GithubRepo[]> {
  return request<GithubRepo[]>("/user/repos?sort=updated&per_page=30", token);
}

export async function createGithubRepo(token: string, name: string): Promise<GithubRepo> {
  return request<GithubRepo>("/user/repos", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, private: true, auto_init: true, description: "React IDE Mobile workspace" }),
  });
}

export async function uploadGithubFile(token: string, owner: string, repo: string, path: string, content: string, message: string): Promise<void> {
  const encoded = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(content))) : Buffer.from(content, "utf8").toString("base64");
  await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded }),
  });
}
