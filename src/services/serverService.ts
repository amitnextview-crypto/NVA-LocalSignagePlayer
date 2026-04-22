import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";
const LAST_GOOD_SERVER_KEY = "CMS_SERVER_LAST_GOOD";
const SERVER_HISTORY_KEY = "CMS_SERVER_HISTORY_V1";
const FETCH_TIMEOUT = 2500;
const DIRECT_PROBE_TIMEOUT = 900;
const DIRECT_CONFIG_TIMEOUT = 1400;
const SCAN_PROBE_TIMEOUT = 700;
const SCAN_CONFIG_TIMEOUT = 950;
const SCAN_BATCH_SIZE = 96;
const CMS_PORT = 8080;
const SCAN_COOLDOWN_MS = 1200;
const AGGRESSIVE_SCAN_COOLDOWN_MS = 250;
const MAX_SERVER_HISTORY = 8;
const serverListeners = new Set<(url: string) => void>();
let inFlightFindCMS: Promise<string> | null = null;
let lastScanAt = 0;

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller?.abort();
      reject(new Error("timeout"));
    }, timeout);

    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller?.signal,
    })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string): boolean {
  const url = normalizeUrl(value).toLowerCase();
  return url.includes("127.0.0.1") || url.includes("localhost");
}

function notifyServerListeners(url: string) {
  serverListeners.forEach((listener) => {
    try {
      listener(url);
    } catch {
      // ignore listener failures
    }
  });
}

async function probeCMS(
  url: string,
  timeout = FETCH_TIMEOUT,
  configTimeout = timeout + 250
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let completed = 0;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      if (ok) {
        settled = true;
        resolve(true);
        return;
      }
      completed += 1;
      if (completed >= 2) {
        settled = true;
        resolve(false);
      }
    };

    fetchWithTimeout(`${url}/ping?ts=${Date.now()}`, timeout)
      .then((response) => finish(!!response?.ok))
      .catch(() => finish(false));

    fetchWithTimeout(`${url}/config?ts=${Date.now()}`, configTimeout)
      .then((response) => finish(!!response?.ok))
      .catch(() => finish(false));
  });
}

export async function verifyCMS(url: string, timeout = 4000): Promise<{
  normalizedUrl: string;
  ok: boolean;
}> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl || isLocalhostUrl(normalizedUrl)) {
    return { normalizedUrl, ok: false };
  }
  const ok = await probeCMS(normalizedUrl, timeout);
  return { normalizedUrl, ok };
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
  const next = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, MAX_SERVER_HISTORY);
  await AsyncStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(next));
}

async function saveAndReturn(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const changed = normalized !== SERVER;
  SERVER = normalized;
  await AsyncStorage.setItem(SERVER_KEY, normalized);
  await AsyncStorage.setItem(LAST_GOOD_SERVER_KEY, normalized);
  await rememberServer(normalized);
  if (changed) notifyServerListeners(normalized);
  return normalized;
}

async function getDirectCandidates(): Promise<string[]> {
  const saved = normalizeUrl(String((await AsyncStorage.getItem(SERVER_KEY)) || ""));
  const lastGood = normalizeUrl(
    String((await AsyncStorage.getItem(LAST_GOOD_SERVER_KEY)) || "")
  );
  const history = await readServerHistory();
  return Array.from(
    new Set([normalizeUrl(SERVER), saved, lastGood, ...history].filter((value) => value && !isLocalhostUrl(value)))
  );
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
      probeCMS(candidate, SCAN_PROBE_TIMEOUT, SCAN_CONFIG_TIMEOUT)
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

async function findReachableCandidate(
  candidates: string[],
  timeout = DIRECT_PROBE_TIMEOUT
): Promise<string> {
  const uniqueCandidates = Array.from(
    new Set(candidates.map((candidate) => normalizeUrl(candidate)).filter(Boolean))
  );

  return new Promise<string>((resolve) => {
    let settled = false;
    let pending = uniqueCandidates.length;

    if (!pending) {
      resolve("");
      return;
    }

    uniqueCandidates.forEach((candidate) => {
      probeCMS(candidate, timeout, DIRECT_CONFIG_TIMEOUT)
        .then((ok) => {
          if (ok && !settled) {
            settled = true;
            resolve(candidate);
            return;
          }
          pending -= 1;
          if (!pending && !settled) resolve("");
        })
        .catch(() => {
          pending -= 1;
          if (!pending && !settled) resolve("");
        });
    });
  });
}

async function scanSubnet(base: string, hostHints: number[] = []): Promise<string> {
  if (!base) return "";
  const ordered = buildPriorityHosts(hostHints);

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

async function scanAllBases(bases: string[], hostHints: number[]): Promise<string> {
  const uniqueBases = Array.from(new Set(bases.filter(Boolean)));
  return new Promise<string>((resolve) => {
    let settled = false;
    let pending = uniqueBases.length;

    if (!pending) {
      resolve("");
      return;
    }

    uniqueBases.forEach((base) => {
      scanSubnet(base, hostHints)
        .then((found) => {
          if (found && !settled) {
            settled = true;
            resolve(found);
            return;
          }
          pending -= 1;
          if (!pending && !settled) resolve("");
        })
        .catch(() => {
          pending -= 1;
          if (!pending && !settled) resolve("");
        });
    });
  });
}

async function discoverCMS(forceScan = false): Promise<string> {
  const directCandidates = await getDirectCandidates();
  const reachableDirectCandidate = await findReachableCandidate(directCandidates);
  if (reachableDirectCandidate) {
    return saveAndReturn(reachableDirectCandidate);
  }

  const saved = normalizeUrl(String((await AsyncStorage.getItem(SERVER_KEY)) || ""));
  if (saved) {
    if (isLocalhostUrl(saved)) {
      await AsyncStorage.removeItem(SERVER_KEY);
    }
  }

  const scanCooldownMs = directCandidates.length
    ? SCAN_COOLDOWN_MS
    : AGGRESSIVE_SCAN_COOLDOWN_MS;

  if (!forceScan && Date.now() - lastScanAt < scanCooldownMs) {
    return "";
  }

  lastScanAt = Date.now();

  try {
    const { bases, hostHints } = await collectSubnetBases(directCandidates);
    const found = await scanAllBases(bases, hostHints);
    if (found) {
      return saveAndReturn(found);
    }
  } catch (e) {
    console.log("Network scan failed", e);
  }

  return "";
}

export async function findCMS(): Promise<string> {
  if (inFlightFindCMS) return inFlightFindCMS;
  inFlightFindCMS = discoverCMS(false);
  try {
    return await inFlightFindCMS;
  } finally {
    inFlightFindCMS = null;
  }
}

export function getServer(): string {
  return SERVER;
}

export function subscribeToServerChanges(listener: (url: string) => void) {
  serverListeners.add(listener);
  return () => {
    serverListeners.delete(listener);
  };
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

export async function findKnownCMS(): Promise<string> {
  const directCandidates = await getDirectCandidates();
  const reachableDirectCandidate = await findReachableCandidate(
    directCandidates,
    DIRECT_PROBE_TIMEOUT
  );
  if (reachableDirectCandidate) {
    return saveAndReturn(reachableDirectCandidate);
  }
  return "";
}

export async function setServer(
  url: string,
  options: { forceNotify?: boolean } = {}
) {
  const normalized = normalizeUrl(url);
  const changed = normalized !== SERVER;
  SERVER = normalized;
  await AsyncStorage.setItem(SERVER_KEY, normalized);
  await AsyncStorage.setItem(LAST_GOOD_SERVER_KEY, normalized);
  await rememberServer(normalized);
  if (changed || options.forceNotify) notifyServerListeners(normalized);
}

export async function refreshCMSDiscovery(): Promise<string> {
  if (inFlightFindCMS) return inFlightFindCMS;
  inFlightFindCMS = discoverCMS(true);
  try {
    return await inFlightFindCMS;
  } finally {
    inFlightFindCMS = null;
  }
}

