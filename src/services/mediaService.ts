import RNFS from "react-native-fs";
import { NativeModules } from "react-native";
import { getServer } from "./serverService";

const { DeviceIdModule } = NativeModules as any;

const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/media`;
const MEDIA_ROOT = `${MEDIA_DIR}/files`;
const MANIFEST_PATH = `${MEDIA_DIR}/manifest.json`;
const LIST_CACHE_PATH = `${MEDIA_DIR}/list-cache.json`;
const MEDIA_FETCH_TIMEOUT_MS = 2500;
const DOWNLOAD_CONCURRENCY = 2;
const LIST_REFRESH_MIN_INTERVAL_MS = 1000;
const SMALL_FILE_AWAIT_BYTES = 5 * 1024 * 1024;

type CacheProgress = {
  received: number;
  total: number;
  percent: number;
  updatedAt: number;
};

const progressMap: Record<string, CacheProgress> = {};
const progressListeners = new Set<(path: string, progress: CacheProgress) => void>();

export function subscribeCacheProgress(
  handler: (path: string, progress: CacheProgress) => void
) {
  progressListeners.add(handler);
  return () => progressListeners.delete(handler);
}

export function getCacheProgress(path: string): CacheProgress | null {
  return progressMap[path] || null;
}

function emitProgress(path: string, progress: CacheProgress) {
  progressMap[path] = progress;
  for (const listener of progressListeners) {
    try {
      listener(path, progress);
    } catch {
      // ignore
    }
  }
}
// Short grace period avoids deleting files that might still be in active playback pipeline.
const CACHE_RETENTION_MS = 2 * 60 * 1000;

type MediaItem = {
  name?: string;
  originalName?: string;
  section?: number;
  url?: string;
  type?: string;
  page?: number;
  pageCount?: number;
  size?: number;
  mtimeMs?: number;
  remoteUrl?: string;
  localPath?: string;
};

type ManifestEntry = {
  url: string;
  localPath: string;
  size: number;
  mtimeMs: number;
  lastSeenAt?: number;
};

type ManifestMap = Record<string, ManifestEntry>;

let memoryListCache: MediaItem[] = [];
let memoryListCacheAtMs = 0;
let inFlightListRefresh: Promise<MediaItem[]> | null = null;
const inFlightDownloads = new Map<string, Promise<string | null>>();

function mediaItemFingerprint(item: MediaItem): string {
  return [
    String(item?.url || ""),
    String(item?.remoteUrl || ""),
    String(item?.localPath || ""),
    String(item?.name || ""),
    String(item?.originalName || ""),
    String(item?.type || ""),
    Number(item?.section || 0),
    Number(item?.page || 0),
    Number(item?.pageCount || 0),
    Number(item?.size || 0),
    Number(item?.mtimeMs || 0),
  ].join("|");
}

function sameMediaList(a: MediaItem[], b: MediaItem[]): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (mediaItemFingerprint(a[i]) !== mediaItemFingerprint(b[i])) {
      return false;
    }
  }
  return true;
}

function fetchWithTimeout(url: string, timeoutMs = MEDIA_FETCH_TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("media-fetch-timeout")), timeoutMs)
    ),
  ]);
}

function safeName(value: string, fallback = "media"): string {
  const name = String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return name || fallback;
}

async function ensureMediaDirs() {
  await RNFS.mkdir(MEDIA_DIR);
  await RNFS.mkdir(MEDIA_ROOT);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const exists = await RNFS.exists(filePath);
    if (!exists) return fallback;
    const raw = await RNFS.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, payload: any) {
  await RNFS.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function readManifest(): Promise<ManifestMap> {
  return readJsonFile<ManifestMap>(MANIFEST_PATH, {});
}

async function writeManifest(manifest: ManifestMap) {
  await writeJsonFile(MANIFEST_PATH, manifest);
}

async function readListCache(): Promise<MediaItem[]> {
  const list = await readJsonFile<MediaItem[]>(LIST_CACHE_PATH, []);
  return Array.isArray(list) ? list : [];
}

async function writeListCache(list: MediaItem[]) {
  if (sameMediaList(memoryListCache, list)) {
    memoryListCacheAtMs = Date.now();
    return;
  }
  await writeJsonFile(LIST_CACHE_PATH, list);
  memoryListCache = list;
  memoryListCacheAtMs = Date.now();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

function localUri(path: string): string {
  if (path.startsWith("file://")) return path;
  return `file://${path}`;
}

function hashString(value: string): string {
  let hash = 0;
  const input = String(value || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function localPathFor(remoteUrl: string, section: number, name: string): string {
  const encoded = hashString(remoteUrl);
  const fileName = safeName(`${section}_${encoded}_${name}`);
  return `${MEDIA_ROOT}/${fileName}`;
}

function shouldCacheItem(item: MediaItem): boolean {
  // Offline playback requires every uploaded asset to be available locally.
  // Keep caching unconditional so the last synced content still plays when CMS is offline.
  return !!String(item?.url || "").trim();
}

function getDownloadKey(item: MediaItem): string {
  return `${String(item.url || "")}|${Number(item.size || 0)}|${Number(item.mtimeMs || 0)}`;
}

async function downloadIfNeeded(
  server: string,
  item: MediaItem,
  manifest: ManifestMap
): Promise<string | null> {
  const remotePath = String(item.url || "");
  if (!remotePath) return null;
  const remoteUrl = `${server}${remotePath}`;
  const sourceName = String(item.originalName || item.name || "media.bin");
  const section = Number(item.section || 1);
  const expectedSize = Number(item.size || 0);
  const expectedMtime = Number(item.mtimeMs || 0);
  const entry = manifest[remotePath];

  if (entry && (await fileExists(entry.localPath))) {
    if (entry.size === expectedSize && entry.mtimeMs === expectedMtime) {
      entry.lastSeenAt = Date.now();
      return entry.localPath;
    }
  }

  const targetPath = localPathFor(remoteUrl, section, sourceName);
  emitProgress(remotePath, {
    total: expectedSize || 0,
    received: 0,
    percent: 0,
    updatedAt: Date.now(),
  });
  // If the file already exists locally (manifest missing), reuse it.
  try {
    if (await fileExists(targetPath)) {
      const stat = await RNFS.stat(targetPath);
      const size = Number(stat?.size || 0);
      if (!expectedSize || size === expectedSize) {
        manifest[remotePath] = {
          url: remotePath,
          localPath: targetPath,
          size: expectedSize || size,
          mtimeMs: expectedMtime,
          lastSeenAt: Date.now(),
        };
        emitProgress(remotePath, {
          total: expectedSize || size || 0,
          received: expectedSize || size || 0,
          percent: 100,
          updatedAt: Date.now(),
        });
        return targetPath;
      }
    }
  } catch {
    // continue to download
  }
  try {
    const download = RNFS.downloadFile({
      fromUrl: `${remoteUrl}?ts=${Date.now()}`,
      toFile: targetPath,
      background: true,
      discretionary: false,
      progressInterval: 500,
      progress: (data) => {
        const total = Number(data?.contentLength || 0);
        const received = Number(data?.bytesWritten || 0);
        if (!total) return;
        const percent = Math.max(0, Math.min(100, Math.round((received / total) * 100)));
        emitProgress(remotePath, {
          total,
          received,
          percent,
          updatedAt: Date.now(),
        });
      },
    });
    const result = await download.promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      return entry?.localPath && (await fileExists(entry.localPath)) ? entry.localPath : null;
    }

    const finalStat = await RNFS.stat(targetPath);
    const finalSize = Number(finalStat?.size || 0);
    manifest[remotePath] = {
      url: remotePath,
      localPath: targetPath,
      size: expectedSize || finalSize,
      mtimeMs: expectedMtime,
      lastSeenAt: Date.now(),
    };
    emitProgress(remotePath, {
      total: expectedSize || finalSize || 0,
      received: expectedSize || finalSize || 0,
      percent: 100,
      updatedAt: Date.now(),
    });
    return targetPath;
  } catch {
    return entry?.localPath && (await fileExists(entry.localPath)) ? entry.localPath : null;
  }
}

async function downloadIfNeededDeduped(
  server: string,
  item: MediaItem,
  manifest: ManifestMap
): Promise<string | null> {
  const key = getDownloadKey(item);
  const existing = inFlightDownloads.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      return await downloadIfNeeded(server, item, manifest);
    } finally {
      inFlightDownloads.delete(key);
    }
  })();

  inFlightDownloads.set(key, task);
  return task;
}

async function removeStaleFiles(manifest: ManifestMap, activeUrls: Set<string>) {
  const now = Date.now();
  const activeList = Array.from(activeUrls);
  const activeCachedChecks = await Promise.all(
    activeList.map(async (url) => {
      const entry = manifest[url];
      if (!entry || !entry.localPath) return false;
      return await fileExists(entry.localPath);
    })
  );
  const canPrune = activeCachedChecks.every(Boolean);

  for (const url of Object.keys(manifest)) {
    const entry = manifest[url];
    if (!entry) continue;
    if (activeUrls.has(url)) {
      entry.lastSeenAt = now;
      continue;
    }
    if (!entry.lastSeenAt) {
      entry.lastSeenAt = now;
      continue;
    }
    if (now - Number(entry.lastSeenAt || 0) < CACHE_RETENTION_MS) continue;
    if (!canPrune) continue;

    // Avoid unlinking immediately; a file can still be in active playback pipeline.
    // Delete only after a retention window to reduce playback risk.
    try {
      if (entry.localPath && (await fileExists(entry.localPath))) {
        await RNFS.unlink(entry.localPath);
      }
    } catch {
      // ignore
    }
    delete manifest[url];
  }
}

async function applyManifestToCachedList(list: MediaItem[]): Promise<MediaItem[]> {
  if (!Array.isArray(list) || !list.length) return [];
  try {
    await ensureMediaDirs();
    const manifest = await readManifest();
    let changed = false;

    const mapped = await Promise.all(
      list.map(async (item) => {
        const path = String(item?.url || "");
        if (!path) return item;
        const entry = manifest[path];
        if (!entry || !(await fileExists(entry.localPath))) return item;
        const fileUri = localUri(entry.localPath);
        if (item.remoteUrl !== fileUri || item.localPath !== entry.localPath) {
          changed = true;
          return { ...item, localPath: entry.localPath, remoteUrl: fileUri };
        }
        return item;
      })
    );

    if (changed) {
      await writeListCache(mapped);
      return mapped;
    }

    return mapped;
  } catch {
    return list;
  }
}

async function runTasksWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency = DOWNLOAD_CONCURRENCY
) {
  const safeConcurrency = Math.max(1, Number(concurrency || 1));
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      try {
        await tasks[index]();
      } catch {
        // no-op
      }
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, tasks.length) }, () => worker());
  await Promise.allSettled(workers);
}

async function mapServerListToPlayable(
  serverList: MediaItem[],
  server: string,
  options: { awaitDownloads?: boolean } = {}
): Promise<MediaItem[]> {
  await ensureMediaDirs();
  const manifest = await readManifest();
  const activeUrls = new Set<string>();
  const uniqueByUrl = new Map<string, MediaItem>();

  for (const item of serverList) {
    const path = String(item?.url || "");
    if (!path) continue;
    activeUrls.add(path);
    if (!uniqueByUrl.has(path)) uniqueByUrl.set(path, item);
  }

  const resolvedByUrl: Record<string, string> = {};
  const pendingDownloads: Array<() => Promise<void>> = [];
  for (const [path, item] of uniqueByUrl.entries()) {
    const existing = manifest[path];
    if (existing && (await fileExists(existing.localPath))) {
      const expectedSize = Number(item.size || 0);
      const expectedMtime = Number(item.mtimeMs || 0);
    if (existing.size === expectedSize && existing.mtimeMs === expectedMtime) {
      existing.lastSeenAt = Date.now();
      resolvedByUrl[path] = existing.localPath;
      continue;
    }
    }

    // Keep playback immediate: use remote now, download cache in background.
    // Limit caching to reasonable file sizes to avoid memory pressure on TV devices.
    if (shouldCacheItem(item)) {
      const sizeBytes = Number(item?.size || 0);
      if (sizeBytes > 0 && sizeBytes <= SMALL_FILE_AWAIT_BYTES) {
        const localPathValue = await downloadIfNeededDeduped(server, item, manifest);
        if (localPathValue) {
          resolvedByUrl[path] = localPathValue;
          continue;
        }
      }
      pendingDownloads.push(async () => {
        const localPathValue = await downloadIfNeededDeduped(server, item, manifest);
        if (localPathValue) {
          resolvedByUrl[path] = localPathValue;
        }
      });
    }
  }

  const mapped = serverList.map((item) => {
    const path = String(item?.url || "");
    const localPathValue = resolvedByUrl[path];
    if (localPathValue) {
      return {
        ...item,
        localPath: localPathValue,
        remoteUrl: localUri(localPathValue),
      };
    }
    return {
      ...item,
      remoteUrl: `${server}${path}`,
    };
  });

  await removeStaleFiles(manifest, activeUrls);
  await writeManifest(manifest);
  if (!sameMediaList(memoryListCache, mapped)) {
    await writeListCache(mapped);
  } else {
    memoryListCacheAtMs = Date.now();
  }

  if (!pendingDownloads.length) {
    return mapped;
  }

  const buildRefreshed = () =>
    serverList.map((item) => {
      const path = String(item?.url || "");
      const localPathValue = manifest[path]?.localPath;
      if (localPathValue) {
        return {
          ...item,
          localPath: localPathValue,
          remoteUrl: localUri(localPathValue),
        };
      }
      return {
        ...item,
        remoteUrl: `${server}${path}`,
      };
    });

  if (options.awaitDownloads) {
    await runTasksWithConcurrency(pendingDownloads, DOWNLOAD_CONCURRENCY);
    const refreshed = buildRefreshed();
    await writeManifest(manifest);
    if (sameMediaList(memoryListCache, refreshed)) {
      memoryListCacheAtMs = Date.now();
      return memoryListCache;
    }
    await writeListCache(refreshed);
    return refreshed;
  }

  runTasksWithConcurrency(pendingDownloads, DOWNLOAD_CONCURRENCY)
    .then(async () => {
      const refreshed = buildRefreshed();
      await writeManifest(manifest);
      if (!sameMediaList(memoryListCache, refreshed)) {
        await writeListCache(refreshed);
      } else {
        memoryListCacheAtMs = Date.now();
      }
    })
    .catch(() => {
      // no-op
    });

  return mapped;
}

function sanitizeCachedList(list: MediaItem[]): MediaItem[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => {
    if (!item || typeof item !== "object") return false;
    return !!item.url;
  });
}

async function fetchServerMediaList(server: string): Promise<MediaItem[]> {
  const deviceId = await DeviceIdModule.getDeviceId();
  const res = await fetchWithTimeout(
    `${server}/media-list?deviceId=${deviceId}&ts=${Date.now()}`
  );
  if (!res.ok) {
    throw new Error(`media-http-${res.status}`);
  }
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  return list;
}

async function loadCachedPlayableList(): Promise<MediaItem[]> {
  if (memoryListCache.length) return memoryListCache;
  try {
    const cached = sanitizeCachedList(await readListCache());
    const mapped = await applyManifestToCachedList(cached);
    memoryListCache = mapped;
    memoryListCacheAtMs = Date.now();
    return mapped;
  } catch (e) {
    console.log("Load cached playable list failed", e);
    return [];
  }
}

async function refreshPlayableList(
  options: { blockUntilCached?: boolean; force?: boolean } = {}
): Promise<MediaItem[]> {
  const now = Date.now();
  const server = getServer();
  if (!server) {
    return loadCachedPlayableList();
  }

  const ageMs = now - memoryListCacheAtMs;
  if (!options.force && memoryListCache.length && ageMs < LIST_REFRESH_MIN_INTERVAL_MS) {
    return memoryListCache;
  }

  if (inFlightListRefresh) return inFlightListRefresh;

  inFlightListRefresh = (async () => {
    const list = await fetchServerMediaList(server);
    return mapServerListToPlayable(list, server, {
      awaitDownloads: !!options.blockUntilCached,
    });
  })();

  try {
    return await inFlightListRefresh;
  } finally {
    inFlightListRefresh = null;
  }
}

export async function syncMedia(options: { blockUntilCached?: boolean; force?: boolean } = {}) {
  try {
    await refreshPlayableList(options);
    return true;
  } catch (e) {
    console.log("Media sync failed, using cached list", e);
    await loadCachedPlayableList();
    return false;
  }
}

export async function getMediaFiles(sectionIndex = 0) {
  const sectionNo = sectionIndex + 1;

  try {
    const mapped = await refreshPlayableList();
    return mapped.filter((file) => Number(file.section || 0) === sectionNo);
  } catch (e) {
    console.log("Media list fetch failed, fallback to cache", e);
  }

  const cached = await loadCachedPlayableList();
  return cached.filter((file) => Number(file.section || 0) === sectionNo);
}
