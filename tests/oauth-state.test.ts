import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "../server/_core/sdk";

const nonce = "0123456789abcdef";
const stateFor = (redirectUri: string) =>
  Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64");

beforeEach(() => {
  vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://3000-sandbox.example.test");
  vi.stubEnv("EXPO_PACKAGER_PROXY_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Manus OAuth redirect URI allowlist", () => {
  it("accepts the exact HTTPS API callback origin and path", () => {
    const state = stateFor("https://3000-sandbox.example.test/api/oauth/callback");
    expect(sdk.getOAuthState(state)).toEqual({
      redirectUri: "https://3000-sandbox.example.test/api/oauth/callback",
      nonce,
    });
  });

  it("accepts loopback HTTP only when it is the configured local API origin", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const state = stateFor("http://localhost:3000/api/oauth/callback");
    expect(sdk.getOAuthState(state).redirectUri).toBe(
      "http://localhost:3000/api/oauth/callback",
    );
  });

  it("derives the expected API origin from the paired Expo packager origin", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("EXPO_PACKAGER_PROXY_URL", "https://8081-sandbox.example.test");
    const state = stateFor("https://3000-sandbox.example.test/api/oauth/callback");
    expect(sdk.getOAuthState(state).redirectUri).toBe(
      "https://3000-sandbox.example.test/api/oauth/callback",
    );
  });

  it.each([
    "manus186839434358518://oauth/callback",
    "exp://127.0.0.1:8081/--/oauth/callback",
    "https://other.example.test/api/oauth/callback",
    "https://3000-sandbox.example.test/elsewhere",
    "https://3000-sandbox.example.test/api/oauth/callback?next=/",
    "https://user@3000-sandbox.example.test/api/oauth/callback",
  ])("rejects an unapproved callback URI: %s", (redirectUri) => {
    expect(() => sdk.getOAuthState(stateFor(redirectUri))).toThrow(
      "Invalid OAuth redirect URI",
    );
  });

  it("rejects callbacks when no public API origin is configured", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    const state = stateFor("https://3000-sandbox.example.test/api/oauth/callback");
    expect(() => sdk.getOAuthState(state)).toThrow("Invalid OAuth redirect URI");
  });
});
