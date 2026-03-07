import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";
const FETCH_TIMEOUT = 4000; // TV/slower networks need more time to reach CMS
const SCAN_BATCH_SIZE = 18;

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    ),
  ]);
}

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalhostUrl(value: string): boolean {
  const url = normalizeUrl(value).toLowerCase();
  return url.includes("127.0.0.1") || url.includes("localhost");
}

async function probeCMS(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${url}/config`);
    return !!res?.ok;
  } catch {
    return false;
  }
}

async function saveAndReturn(url: string): Promise<string> {
  SERVER = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
  return url;
}

async function scanSubnet(base: string): Promise<string> {
  const hosts: number[] = [];
  for (let i = 1; i < 255; i += 1) hosts.push(i);

  // Try common gateway-near hosts first for faster discovery.
  const priority = [2, 3, 4, 5, 10, 11, 20, 100, 101, 102, 200];
  const ordered = [
    ...priority.filter((n) => n >= 1 && n <= 254),
    ...hosts.filter((n) => !priority.includes(n)),
  ];

  for (let i = 0; i < ordered.length; i += SCAN_BATCH_SIZE) {
    const batch = ordered.slice(i, i + SCAN_BATCH_SIZE);
    const checks = batch.map(async (host) => {
      const candidate = `http://${base}.${host}:8080`;
      const ok = await probeCMS(candidate);
      return ok ? candidate : "";
    });
    const result = await Promise.all(checks);
    const found = result.find(Boolean);
    if (found) return found;
  }

  return "";
}

export async function findCMS(): Promise<string> {
  // 1) Try in-memory value first.
  if (SERVER) {
    const current = normalizeUrl(SERVER);
    if (current && !isLocalhostUrl(current) && (await probeCMS(current))) {
      return current;
    }
  }

  // 2) Try saved server URL.
  const saved = normalizeUrl(String((await AsyncStorage.getItem(SERVER_KEY)) || ""));
  if (saved) {
    if (!isLocalhostUrl(saved) && (await probeCMS(saved))) {
      return saveAndReturn(saved);
    }
    if (isLocalhostUrl(saved)) {
      await AsyncStorage.removeItem(SERVER_KEY);
    }
  }

  // 3) Auto scan local network.
  try {
    const gateway = await NetworkInfo.getGatewayIPAddress();
    if (!gateway) {
      console.log("Gateway not found");
      return "";
    }

    const lastDot = gateway.lastIndexOf(".");
    if (lastDot === -1) {
      console.log("Invalid gateway format");
      return "";
    }

    const base = gateway.substring(0, lastDot);
    const found = await scanSubnet(base);
    if (found) {
      return saveAndReturn(found);
    }
  } catch (e) {
    console.log("Network scan failed", e);
  }

  return "";
}

export function getServer(): string {
  return SERVER;
}

/** Restore last known server URL from storage so cached media list and URLs work when CMS is offline. */
export async function restoreServerFromStorage(): Promise<string> {
  const saved = normalizeUrl(String((await AsyncStorage.getItem(SERVER_KEY)) || ""));
  if (saved && !isLocalhostUrl(saved)) {
    SERVER = saved;
    return saved;
  }
  return "";
}

export async function setServer(url: string) {
  const normalized = normalizeUrl(url);
  SERVER = normalized;
  await AsyncStorage.setItem(SERVER_KEY, normalized);
}

