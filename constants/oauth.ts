import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as ReactNative from "react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const env = {
  portal: extra.oauthPortalUrl ?? process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: extra.oauthServerUrl ?? process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: extra.appId ?? process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: extra.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;
export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";
export const AUTH_STATE_KEY = "reactide.oauth.state-nonce";

export function getApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) return `${protocol}//${apiHostname}`;
  }
  return "";
}

function getWebRedirectUri(): string {
  if (ReactNative.Platform.OS !== "web") {
    throw new Error("تسجيل الدخول إلى runtime عبر Android غير مفعّل؛ تدفق Manus الحالي لا يوفّر PKCE للهاتف.");
  }
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error("عنوان خدمة المصادقة غير متاح.");
  return `${apiBaseUrl}/api/oauth/callback`;
}

function encodeState(value: string): string {
  const buffer = (globalThis as typeof globalThis & {
    Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } };
  }).Buffer;
  if (buffer) return buffer.from(value, "utf-8").toString("base64");
  return globalThis.btoa(value);
}

async function storeBrowserNonce(nonce: string): Promise<void> {
  if (typeof window === "undefined") throw new Error("جلسة المتصفح غير متاحة.");
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("عنوان خدمة المصادقة غير متاح.");
  const response = await fetch(`${baseUrl}/api/oauth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nonce }),
  });
  if (!response.ok) throw new Error("تعذر إعداد جلسة OAuth الآمنة.");
  window.sessionStorage.setItem(AUTH_STATE_KEY, nonce);
}

export async function getLoginUrl(): Promise<string> {
  if (!OAUTH_PORTAL_URL || !APP_ID) throw new Error("إعداد Manus OAuth غير متاح.");
  const redirectUri = getWebRedirectUri();
  const nonce = Crypto.randomUUID();
  const state = encodeState(JSON.stringify({ redirectUri, nonce }));
  await storeBrowserNonce(nonce);

  const url = new URL(`${OAUTH_PORTAL_URL.replace(/\/$/, "")}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("responseType", "code");
  return url.toString();
}

export async function startOAuthLogin(): Promise<string | null> {
  if (ReactNative.Platform.OS !== "web") {
    throw new Error("تسجيل الدخول إلى runtime غير مفعّل على Android حتى يتوفر تدفق هاتف يدعم PKCE أو رابط HTTPS موثّق.");
  }
  const loginUrl = await getLoginUrl();
  if (typeof window === "undefined") throw new Error("جلسة المتصفح غير متاحة.");
  window.location.assign(loginUrl);
  return null;
}
