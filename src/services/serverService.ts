import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";
const LAST_GOOD_SERVER_KEY = "CMS_SERVER_LAST_GOOD";
const SERVER_HISTORY_KEY = "CMS_SERVER_HISTORY_V1";
const FETCH_TIMEOUT = 1500;
const SCAN_BATCH_SIZE = 48;
const CMS_PORT = 8080;

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
  const checks = await Promise.allSettled([
    fetchWithTimeout(`${url}/ping`, FETCH_TIMEOUT),
    fetchWithTimeout(`${url}/config`, FETCH_TIMEOUT + 500),
  ]);
  return checks.some(
    (item) => item.status === "fulfilled" && !!item.value?.ok
  );
}

async function readServerHistory(): Promise<string[]> {
  try {
    const raw = String((await AsyncStorage.getItem(SERVER_HISTORY_KEY)) || "").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeUrl(String(item || "")))
      .filter((item) => item && !isLocalhostUrl(item));
  } catch {
    return [];
  }
}

async function rememberServer(url: string) {
  const normalized = normalizeUrl(url);
  if (!normalized || isLocalhostUrl(normalized)) return;
  const existing = await readServerHistory();
  const next = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, 8);
  await AsyncStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(next));
}

async function saveAndReturn(url: string): Promise<string> {
  SERVER = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
  await AsyncStorage.setItem(LAST_GOOD_SERVER_KEY, url);
  await rememberServer(url);
  return url;
}

function parseIpv4Parts(value: string): number[] {
  const parts = String(value || "")
    .split(".")
    .map((part) => Number(part));
  if (parts.length !== 4) return [];
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return [];
  return parts;
}

function getSubnetBase(value: string): string {
  const parts = parseIpv4Parts(value);
  if (parts.length !== 4) return "";
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function getHostPart(value: string): number {
  const parts = parseIpv4Parts(value);
  return parts.length === 4 ? parts[3] : 0;
}

function extractHostFromUrl(value: string): number {
  const match = String(value || "").match(/(\d+\.\d+\.\d+\.\d+)/);
  return match ? getHostPart(match[1]) : 0;
}

function buildCandidateUrl(base: string, host: number): string {
  return `http://${base}.${host}:${CMS_PORT}`;
}

function buildPriorityHosts(hints: number[]): number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];

  const push = (value: number) => {
    const host = Number(value || 0);
    if (!Number.isInteger(host) || host < 1 || host > 254 || seen.has(host)) return;
    seen.add(host);
    ordered.push(host);
  };

  for (const hint of hints) {
    push(hint);
    push(hint - 1);
    push(hint + 1);
    push(hint - 2);
    push(hint + 2);
    push(hint - 3);
    push(hint + 3);
    push(hint - 4);
    push(hint + 4);
  }

  [1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 15, 20, 21, 25, 30, 40, 50, 100, 101, 102, 150, 200].forEach(push);
  for (let i = 1; i < 255; i += 1) push(i);
  return ordered;
}

async function runProbeBatch(candidates: string[]): Promise<string> {
  return new Promise<string>((resolve) => {
    let settled = false;
    let pending = candidates.length;

    if (!pending) {
      resolve("");
      return;
    }

    candidates.forEach((candidate) => {
      probeCMS(candidate)
        .then((ok) => {
          if (ok && !settled) {
            settled = true;
            resolve(candidate);
            return;
          }
          pending -= 1;
          if (!pending && !settled) {
            resolve("");
          }
        })
        .catch(() => {
          pending -= 1;
          if (!pending && !settled) {
            resolve("");
          }
        });
    });
  });
}

async function scanSubnet(base: string, hostHints: number[] = []): Promise<string> {
  if (!base) return "";
  const hosts: number[] = [];
  for (let i = 1; i < 255; i += 1) hosts.push(i);

  const ordered = buildPriorityHosts(hostHints.length ? hostHints : hosts);

  for (let i = 0; i < ordered.length; i += SCAN_BATCH_SIZE) {
    const batch = ordered.slice(i, i + SCAN_BATCH_SIZE);
    const candidates = batch.map((host) => buildCandidateUrl(base, host));
    const found = await runProbeBatch(candidates);
    if (found) return found;
  }

  return "";
}

async function collectSubnetBases(savedCandidates: string[]): Promise<{
  bases: string[];
  hostHints: number[];
}> {
  const bases = new Set<string>();
  const hostHints = new Set<number>();

  const addAddress = (value: string) => {
    const base = getSubnetBase(value);
    const host = getHostPart(value);
    if (base) bases.add(base);
    if (host) hostHints.add(host);
  };

  try {
    const gateway = String((await NetworkInfo.getGatewayIPAddress()) || "");
    addAddress(gateway);
  } catch {}

  try {
    const ipv4 =
      typeof (NetworkInfo as any)?.getIPV4Address === "function"
        ? await (NetworkInfo as any).getIPV4Address()
        : "";
    addAddress(String(ipv4 || ""));
  } catch {}

  savedCandidates.forEach((candidate) => {
    const match = String(candidate || "").match(/(\d+\.\d+\.\d+\.\d+)/);
    if (match) addAddress(match[1]);
    const host = extractHostFromUrl(candidate);
    if (host) hostHints.add(host);
  });

  return {
    bases: Array.from(bases),
    hostHints: Array.from(hostHints),
  };
}

export async function findCMS(): Promise<string> {
  // 1) Try in-memory value first.
  if (SERVER) {
    const current = normalizeUrl(SERVER);
    if (current && !isLocalhostUrl(current) && (await probeCMS(current))) {
      return saveAndReturn(current);
    }
  }

  // 2) Try saved server URL.
  const saved = normalizeUrl(String((await AsyncStorage.getItem(SERVER_KEY)) || ""));
  const lastGood = normalizeUrl(
    String((await AsyncStorage.getItem(LAST_GOOD_SERVER_KEY)) || "")
  );
  const history = await readServerHistory();
  const directCandidates = Array.from(
    new Set([saved, lastGood, ...history].filter((value) => value && !isLocalhostUrl(value)))
  );

  for (const candidate of directCandidates) {
    if (await probeCMS(candidate)) {
      return saveAndReturn(candidate);
    }
  }

  if (saved) {
    if (isLocalhostUrl(saved)) {
      await AsyncStorage.removeItem(SERVER_KEY);
    }
  }

  // 3) Auto scan local network.
  try {
    const { bases, hostHints } = await collectSubnetBases(directCandidates);
    for (const base of bases) {
      const found = await scanSubnet(base, hostHints);
      if (found) {
        return saveAndReturn(found);
      }
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
  const lastGood = normalizeUrl(
    String((await AsyncStorage.getItem(LAST_GOOD_SERVER_KEY)) || "")
  );
  if (lastGood && !isLocalhostUrl(lastGood)) {
    SERVER = lastGood;
    return lastGood;
  }
  return "";
}

export async function setServer(url: string) {
  const normalized = normalizeUrl(url);
  SERVER = normalized;
  await AsyncStorage.setItem(SERVER_KEY, normalized);
  await AsyncStorage.setItem(LAST_GOOD_SERVER_KEY, normalized);
  await rememberServer(normalized);
}

