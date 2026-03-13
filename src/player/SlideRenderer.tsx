import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { ViewType } from "react-native-video";
import { WebView } from "react-native-webview";
import RNFS from "react-native-fs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMediaFiles,
  getCacheProgress,
  subscribeCacheProgress,
  setDownloadConcurrencyOverride,
  prefetchMediaItems,
} from "../services/mediaService";
import { getServer } from "../services/serverService";
import NativeVideoPlayer from "./NativeVideoPlayer";

const SOURCE_TYPES = {
  multimedia: "multimedia",
  web: "web",
  youtube: "youtube",
};
const VIDEO_FILE_RE = /\.(mp4|m4v|mov|mkv|webm)(\?.*)?$/i;
const LARGE_VIDEO_STREAM_THRESHOLD_BYTES = 300 * 1024 * 1024;
const HOLD_LARGE_VIDEO_UNTIL_CACHED = false;

function normalizeWebUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function extractYoutubeId(url: string) {
  const value = String(url || "").trim();
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function normalizeYoutubeEmbedUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return "";
  const id = extractYoutubeId(value);
  if (!id) return "";
  // On some Android WebView builds, embedded YouTube can throw Error 153.
  // Using watch URL is more reliable there while still allowing autoplay muted playback.
  return `https://www.youtube.com/watch?v=${id}&autoplay=1&mute=1&playsinline=1`;
}

function buildPdfViewerUrl(fileUrl: string, page: number, nonce?: string | number) {
  const safePage = Math.max(1, Number(page || 1));
  if (/^file:\/\//i.test(String(fileUrl || ""))) {
    return String(fileUrl || "");
  }
  const match = String(fileUrl || "").match(/^(https?:\/\/[^/]+)/i);
  const origin = match?.[1] || "";
  const stamp = nonce ? `&r=${encodeURIComponent(String(nonce))}` : "";
  if (origin) {
    return `${origin}/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}${stamp}`;
  }
  return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}${stamp}`;
}

function normalizeMediaUri(value: string) {
  const uri = String(value || "").trim();
  if (!uri) return "";
  if (/^https?:\/\//i.test(uri)) {
    try {
      return encodeURI(uri);
    } catch {
      return uri;
    }
  }
  return uri;
}

function buildRemoteMediaUri(server: string, pathValue: string, versionHint?: string | number) {
  const base = normalizeMediaUri(`${String(server || "").trim()}${String(pathValue || "").trim()}`);
  if (!base) return "";
  const stamp = String(versionHint || "").trim();
  if (!stamp) return base;
  return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(stamp)}`;
}

function isVideoFile(item: any) {
  const mime = String(item?.type || "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  const value = String(
    item?.originalName || item?.name || item?.url || item?.remoteUrl || ""
  );
  return VIDEO_FILE_RE.test(value);
}

function getMediaIdentity(item: any) {
  return [
    String(item?.url || ""),
    String(item?.originalName || item?.name || ""),
    String(item?.type || ""),
    String(item?.remoteUrl || ""),
    Number(item?.mtimeMs || 0),
    Number(item?.size || 0),
    Number(item?.page || 0),
  ].join("|");
}

function getMediaContentIdentity(item: any) {
  return [
    String(item?.url || ""),
    String(item?.originalName || item?.name || ""),
    String(item?.type || ""),
    Number(item?.mtimeMs || 0),
    Number(item?.size || 0),
    Number(item?.page || 0),
  ].join("|");
}

function getMediaStableIdentity(item: any) {
  return [
    String(item?.url || ""),
    String(item?.originalName || item?.name || ""),
    String(item?.type || ""),
    Number(item?.page || 0),
  ].join("|");
}

function getMediaCacheIdentity(item: any) {
  return [
    String(item?.localPath || ""),
    String(item?.remoteUrl || ""),
  ].join("|");
}

function buildListSignature(list: any[]) {
  if (!Array.isArray(list) || !list.length) return "empty";
  const first = getMediaStableIdentity(list[0]);
  const last = getMediaStableIdentity(list[list.length - 1]);
  return `${list.length}|${first}|${last}`;
}

function areMediaListsEqual(a: any[], b: any[]) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (getMediaStableIdentity(a[i]) !== getMediaStableIdentity(b[i])) {
      return false;
    }
    if (getMediaCacheIdentity(a[i]) !== getMediaCacheIdentity(b[i])) {
      return false;
    }
  }
  return true;
}

function findMatchingIndex(list: any[], current: any, fallbackIndex = 0) {
  if (!Array.isArray(list) || !list.length) return 0;
  if (!current) return Math.min(fallbackIndex, list.length - 1);
  const currentIdentity = getMediaStableIdentity(current);
  const safeFallback = Math.min(Math.max(0, fallbackIndex), list.length - 1);
  if (getMediaStableIdentity(list[safeFallback]) === currentIdentity) {
    return safeFallback;
  }
  const matchedIndexes = list
    .map((item, idx) => (getMediaStableIdentity(item) === currentIdentity ? idx : -1))
    .filter((idx) => idx >= 0);
  if (matchedIndexes.length) {
    let closest = matchedIndexes[0];
    let bestDelta = Math.abs(matchedIndexes[0] - safeFallback);
    for (const idx of matchedIndexes) {
      const delta = Math.abs(idx - safeFallback);
      if (delta < bestDelta) {
        bestDelta = delta;
        closest = idx;
      }
    }
    return closest;
  }
  return Math.min(fallbackIndex, list.length - 1);
}

export default function SlideRenderer({
  config,
  sectionIndex,
  mediaVersion,
  processingMessage,
  processingCount,
  onPlaybackChange,
  onPlaybackError,
}: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [uri, setUri] = useState("");
  const [videoReloadToken, setVideoReloadToken] = useState(0);
  const [videoViewType, setVideoViewType] = useState(
    ViewType.TEXTURE
  );
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [showBufferIndicator, setShowBufferIndicator] = useState(false);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [textContent, setTextContent] = useState("");
  const [pdfSlotUrls, setPdfSlotUrls] = useState<{ a: string; b: string }>({ a: "", b: "" });
  const [pdfSlotLoaded, setPdfSlotLoaded] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [pdfVisibleSlot, setPdfVisibleSlot] = useState<"a" | "b">("a");
  const [pdfReloadToken, setPdfReloadToken] = useState(0);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [cacheProgressByPath, setCacheProgressByPath] = useState<Record<string, number>>({});
  const [imageSlotUrls, setImageSlotUrls] = useState<{ a: string; b: string }>({ a: "", b: "" });
  const [imageSlotLoaded, setImageSlotLoaded] = useState<{ a: boolean; b: boolean }>({
    a: false,
    b: false,
  });
  const [imageVisibleSlot, setImageVisibleSlot] = useState<"a" | "b">("a");
  const [forceLocalRestart, setForceLocalRestart] = useState(false);
  const server = getServer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const videoFade = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesRef = useRef<any[]>([]);
  const indexRef = useRef(0);
  const pinnedMediaUriRef = useRef<{ identity: string; uri: string } | null>(null);
  const pinnedContentIdentityRef = useRef<string>("");
  const lastGoodUriByIdentityRef = useRef<Record<string, string>>({});
  const pdfSlotUrlsRef = useRef({ a: "", b: "" });
  const isMountedRef = useRef(true);
  const emptyFetchCountRef = useRef(0);
  const videoRetryCountRef = useRef(0);
  const pdfPendingSlotRef = useRef<"a" | "b" | null>(null);
  const pdfPendingUrlRef = useRef("");
  const pdfDesiredSlotRef = useRef<"a" | "b">("a");
  const pdfRetryCountRef = useRef(0);
  const pendingLocalSwitchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoTransientErrorRef = useRef<Record<string, number>>({});
  const badMediaRef = useRef<Record<string, number>>({});
  const skipLoopGuardRef = useRef(0);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoReadyRef = useRef(false);
  const lastRestoreSignatureRef = useRef<string>("");
  const imageDesiredSlotRef = useRef<"a" | "b">("a");
  const cachePathSetRef = useRef<Set<string>>(new Set());
  const cacheRefreshDoneRef = useRef<Set<string>>(new Set());
  const lastIndexChangeAtRef = useRef(Date.now());
  const videoGateLoopRef = useRef(0);
  const prefetchKeyRef = useRef<string>("");
  const EMPTY_FETCH_CLEAR_THRESHOLD = 3;
  const MAX_SINGLE_VIDEO_RETRY = 3;
  const MAX_TRANSIENT_VIDEO_RETRY = 2;
  const MAX_BAD_MEDIA_RETRY = 3;
  const VIDEO_READY_TIMEOUT_MS = 8000;
  const MAX_PDF_RETRY = 3;

  const sectionConfig = config?.sections?.[sectionIndex] || {};
  const sourceType = sectionConfig?.sourceType || SOURCE_TYPES.multimedia;
  const sourceUrl = sectionConfig?.sourceUrl || "";
  const isMultiPaneLayout = config?.layout === "grid2" || config?.layout === "grid3";
  const mediaRotateLayerStyle = styles.fillLayer;

  useEffect(() => {
    filesRef.current = files;
    indexRef.current = index;
    setForceLocalRestart(false);
    lastIndexChangeAtRef.current = Date.now();
    videoGateLoopRef.current = 0;
  }, [files, index]);

  useEffect(() => {
    if (!files.length) return;
    const allowed = new Set(files.map((item) => getMediaStableIdentity(item)));
    const nextBad: Record<string, number> = {};
    for (const key of Object.keys(badMediaRef.current)) {
      if (allowed.has(key)) nextBad[key] = badMediaRef.current[key];
    }
    badMediaRef.current = nextBad;
  }, [files]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const signature = buildListSignature(files);
    if (lastRestoreSignatureRef.current === signature) return;
    lastRestoreSignatureRef.current = signature;
    const key = `playback:last:section:${sectionIndex}`;

    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw || cancelled) return;
        const saved = JSON.parse(String(raw || "{}"));
        const savedIdentity = String(saved?.identity || "");
        const savedIndex = Number(saved?.index || 0);
        if (savedIdentity) {
          const match = files.findIndex(
            (item) => getMediaStableIdentity(item) === savedIdentity
          );
          if (match >= 0) {
            setIndex(match);
            return;
          }
        }
        if (Number.isFinite(savedIndex) && savedIndex >= 0 && savedIndex < files.length) {
          setIndex(savedIndex);
        }
      } catch {
        // ignore restore errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, sourceType, sectionIndex]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const current = files[index];
    if (!current) return;
    const key = `playback:last:section:${sectionIndex}`;
    const payload = {
      identity: getMediaStableIdentity(current),
      index,
      updatedAt: new Date().toISOString(),
    };
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {
      // ignore save errors
    });
  }, [files, index, sourceType, sectionIndex]);

  useEffect(() => {
    pdfSlotUrlsRef.current = pdfSlotUrls;
  }, [pdfSlotUrls]);

  const imageSlotUrlsRef = useRef({ a: "", b: "" });
  useEffect(() => {
    imageSlotUrlsRef.current = imageSlotUrls;
  }, [imageSlotUrls]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    if (files.length < 2) return;
    const current = files[index];
    if (!current) return;
    const identity = getMediaStableIdentity(current);
    if ((badMediaRef.current[identity] || 0) < MAX_BAD_MEDIA_RETRY) {
      skipLoopGuardRef.current = 0;
      return;
    }
    skipLoopGuardRef.current += 1;
    if (skipLoopGuardRef.current >= files.length) return;
    setTimeout(() => {
      if (!isMountedRef.current) return;
      goNext();
    }, 0);
  }, [files, index, sourceType]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (pendingLocalSwitchRef.current) clearTimeout(pendingLocalSwitchRef.current);
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.2,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [livePulse]);

  const scheduleRetryLoad = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        const list = await getMediaFiles(sectionIndex);
        if (!isMountedRef.current) return;
        if (Array.isArray(list) && list.length) {
          setFiles((prev) => (areMediaListsEqual(prev, list) ? prev : list));
          setIndex(findMatchingIndex(list, filesRef.current[indexRef.current], indexRef.current));
        }
      } catch (_e) {
      }
    }, 4000);
  };

  const handleRenderError = () => {
    const activeFile = files[index];
    const isActiveVideo = isVideoFile(activeFile);
    const errorKey = getMediaStableIdentity(activeFile);

    console.log("Media render error", {
      sectionIndex,
      name: activeFile?.name || activeFile?.originalName || "",
      uri,
      videoViewType,
    });

    if (isActiveVideo && errorKey) {
      const currentCount = videoTransientErrorRef.current[errorKey] || 0;
      if (currentCount < MAX_TRANSIENT_VIDEO_RETRY) {
        videoTransientErrorRef.current[errorKey] = currentCount + 1;
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setVideoReloadToken((prev) => prev + 1);
        }, 600 + currentCount * 400);
        return;
      }
      const badCount = (badMediaRef.current[errorKey] || 0) + 1;
      badMediaRef.current[errorKey] = badCount;
      if (badCount >= MAX_BAD_MEDIA_RETRY && files.length > 1) {
        goNext();
        return;
      }
    }

    if (
      isActiveVideo &&
      /^file:\/\//i.test(uri) &&
      server &&
      activeFile?.url
    ) {
      setUri(buildRemoteMediaUri(server, activeFile.url, activeFile?.mtimeMs || mediaVersion));
      setVideoReloadToken((prev) => prev + 1);
      return;
    }

    if (isActiveVideo && isMultiPaneLayout) {
      const alternateViewType =
        videoViewType === ViewType.TEXTURE ? ViewType.SURFACE : ViewType.TEXTURE;
      setVideoViewType(alternateViewType);
      setVideoReloadToken((prev) => prev + 1);
      return;
    }

    if (isActiveVideo && files.length === 1) {
    if (videoRetryCountRef.current < MAX_SINGLE_VIDEO_RETRY) {
      videoRetryCountRef.current += 1;
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setVideoReloadToken((prev) => prev + 1);
      }, 900);
      return;
    }
    videoRetryCountRef.current = 0;
    }

    videoRetryCountRef.current = 0;
    if (typeof onPlaybackError === "function") {
      onPlaybackError({
        section: sectionIndex + 1,
        name: activeFile?.name || activeFile?.originalName || "",
        mediaType: activeFile?.type || "",
        uri,
        viewType: String(videoViewType),
        message: "Media could not be played",
      });
    }
    if (files.length > 1) {
      goNext();
      return;
    }
    scheduleRetryLoad();
  };

  const handlePdfError = () => {
    if (pdfRetryCountRef.current < MAX_PDF_RETRY) {
      pdfRetryCountRef.current += 1;
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPdfReloadToken((prev) => prev + 1);
      }, 1200 * pdfRetryCountRef.current);
      return;
    }

    if (typeof onPlaybackError === "function") {
      onPlaybackError({
        section: sectionIndex + 1,
        name: files[index]?.name || files[index]?.originalName || "",
        mediaType: "pdf",
        message: "PDF could not be displayed",
      });
    }
    scheduleRetryLoad();
  };

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) {
      setFiles([]);
      setIndex(0);
      if (sourceType === SOURCE_TYPES.web) {
        setUri(normalizeWebUrl(sourceUrl));
      } else if (sourceType === SOURCE_TYPES.youtube) {
        setUri(normalizeYoutubeEmbedUrl(sourceUrl));
      } else {
        setUri("");
      }
      return;
    }

    // Load media even when server is "" – getMediaFiles falls back to cached list.
    const load = async () => {
      try {
        const list = await getMediaFiles(sectionIndex);
        if (Array.isArray(list) && list.length > 0) {
          emptyFetchCountRef.current = 0;
          setFiles((prev) => (areMediaListsEqual(prev, list) ? prev : list));
          setIndex(findMatchingIndex(list, filesRef.current[indexRef.current], indexRef.current));
          return;
        }

        // Avoid brief "No Media Found" flicker on transient empty responses.
        emptyFetchCountRef.current += 1;
        if (emptyFetchCountRef.current >= EMPTY_FETCH_CLEAR_THRESHOLD) {
          setFiles([]);
          setIndex(0);
        }
        scheduleRetryLoad();
      } catch (error) {
        console.log("Media load error:", error);
        scheduleRetryLoad();
      }
    };
    load();
  }, [sectionIndex, server, mediaVersion, sourceType, sourceUrl]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!isMountedRef.current) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      try {
        const list = await getMediaFiles(sectionIndex);
        if (!isMountedRef.current) return;
        if (Array.isArray(list) && list.length) {
          setFiles((prev) => (areMediaListsEqual(prev, list) ? prev : list));
          setIndex(findMatchingIndex(list, filesRef.current[indexRef.current], indexRef.current));
        }
      } catch (_e) {
        // ignore
      }
    };

    timer = setInterval(refresh, 9000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sectionIndex, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    videoRetryCountRef.current = 0;
    setVideoReloadToken(0);
    setVideoViewType(ViewType.TEXTURE);

    const file = files[index];
    const identity = getMediaIdentity(file);
    const contentIdentity = getMediaContentIdentity(file);
    const fileSize = Number(file?.size || 0);
    // Prefer HTTP streaming for large videos to avoid OOM, unless we are waiting for cache.
    const isVideo = isVideoFile(file);
    const isLargeVideo = isVideo && fileSize > LARGE_VIDEO_STREAM_THRESHOLD_BYTES;
    const localPlayableUri = normalizeMediaUri(String(file?.remoteUrl || ""));
    const hasLocalPlayableUri = /^file:\/\//i.test(localPlayableUri);
    const holdForCache =
      HOLD_LARGE_VIDEO_UNTIL_CACHED &&
      isLargeVideo &&
      !hasLocalPlayableUri &&
      !!server &&
      !!file?.url;

    let nextUri = "";
    if (holdForCache) {
      nextUri = "";
    } else if (hasLocalPlayableUri) {
      nextUri = localPlayableUri;
    } else if (isLargeVideo && server && file?.url) {
      nextUri = buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion);
    } else if (server && file?.url) {
      nextUri = buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion);
    } else if (file.remoteUrl) {
      nextUri = localPlayableUri;
    }

    if (!nextUri) {
      if (file?.remoteUrl) {
        nextUri = normalizeMediaUri(String(file.remoteUrl || ""));
      } else if (server && file?.url) {
        nextUri = buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion);
      }
    }

    const pinned = pinnedMediaUriRef.current;
    if (
      isVideo &&
      pinned &&
      pinned.identity === identity &&
      /^https?:\/\//i.test(pinned.uri) &&
      /^file:\/\//i.test(nextUri)
    ) {
      // Avoid switching from remote to local mid-playback (causes pause on some TVs).
      nextUri = pinned.uri;
    } else {
      pinnedMediaUriRef.current = nextUri ? { identity, uri: nextUri } : null;
    }

    // Avoid swapping the current media source mid-playback when only cache state changes.
    if (
      indexRef.current === index &&
      pinnedContentIdentityRef.current === contentIdentity &&
      uri &&
      nextUri &&
      nextUri !== uri &&
      server
    ) {
      return;
    }

    pinnedContentIdentityRef.current = contentIdentity;
    if (!nextUri && uri && pinnedContentIdentityRef.current === contentIdentity) {
      // Avoid dropping to blank when source is temporarily unavailable.
      return;
    }
    if (!nextUri) {
      const cachedUri = lastGoodUriByIdentityRef.current[contentIdentity];
      if (cachedUri) {
        setUri(cachedUri);
        return;
      }
    }
    if (nextUri) {
      lastGoodUriByIdentityRef.current[contentIdentity] = nextUri;
    }
    setUri(nextUri || "");
  }, [files, index, server, sourceType, mediaVersion]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) {
      setCacheProgress(0);
      setCacheProgressByPath({});
      pdfRetryCountRef.current = 0;
      setPdfReloadToken(0);
      setForceLocalRestart(false);
      setImageSlotUrls({ a: "", b: "" });
      setImageSlotLoaded({ a: false, b: false });
      setImageVisibleSlot("a");
      return;
    }
    const active = files[index];
    const pathKey = String(active?.url || "");
    if (!pathKey) {
      setCacheProgress(0);
      setForceLocalRestart(false);
      return;
    }

    const initial = getCacheProgress(pathKey);
    setCacheProgress(initial?.percent || 0);

    const unsubscribe = subscribeCacheProgress((path, progress) => {
      if (path !== pathKey) return;
      setCacheProgress(progress?.percent || 0);
    });

    return () => {
      unsubscribe();
    };
  }, [files, index, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    const current = files[index];
    if (!current) return;
    const fileType = String(current?.type || "").toLowerCase();
    const isVideo = isVideoFile(current);
    const isPdf = fileType === "pdf" || /\.pdf$/i.test(current?.originalName || current?.name || "");
    const isText = fileType === "text" || /\.txt$/i.test(current?.originalName || current?.name || "");
    const isImage = !isVideo && !isPdf && !isText;
    if (!isImage) return;

    const buildPlayableUri = (entry: any, fallback = "") => {
      if (!entry) return fallback;
      const localUri = normalizeMediaUri(String(entry?.remoteUrl || ""));
      if (/^file:\/\//i.test(localUri)) return localUri;
      if (server && entry?.url) {
        return buildRemoteMediaUri(server, entry.url, entry?.mtimeMs || mediaVersion);
      }
      return localUri || fallback;
    };

    const currentUri = buildPlayableUri(current, uri);
    const nextIndex = (index + 1) % files.length;
    const nextFile = files[nextIndex];
    const nextFileType = String(nextFile?.type || "").toLowerCase();
    const nextIsVideo = isVideoFile(nextFile);
    const nextIsPdf = nextFileType === "pdf" || /\.pdf$/i.test(nextFile?.originalName || nextFile?.name || "");
    const nextIsText = nextFileType === "text" || /\.txt$/i.test(nextFile?.originalName || nextFile?.name || "");
    const nextIsImage = nextFile && !nextIsVideo && !nextIsPdf && !nextIsText;
    const nextUri = nextIsImage ? buildPlayableUri(nextFile) : "";

    const activeSlot = imageVisibleSlot;
    const hiddenSlot: "a" | "b" = activeSlot === "a" ? "b" : "a";
    imageDesiredSlotRef.current = activeSlot;

    setImageSlotUrls((prev) => {
      const next = { ...prev };
      let changed = false;
      if (next[activeSlot] !== currentUri) {
        next[activeSlot] = currentUri;
        changed = true;
      }
      if (next[hiddenSlot] !== nextUri) {
        next[hiddenSlot] = nextUri;
        changed = true;
      }
      return changed ? next : prev;
    });

    setImageSlotLoaded((prev) => {
      const next = { ...prev };
      if (imageSlotUrlsRef.current[activeSlot] !== currentUri) next[activeSlot] = false;
      if (imageSlotUrlsRef.current[hiddenSlot] !== nextUri) next[hiddenSlot] = false;
      if (next.a === prev.a && next.b === prev.b) return prev;
      return next;
    });
  }, [files, index, uri, sourceType, server, mediaVersion, imageVisibleSlot]);

  const getSlideDurationMs = () => {
    const raw =
      config?.sections?.[sectionIndex]?.slideDuration ||
      config?.slideDuration ||
      5;
    return Math.max(1, Number(raw || 5)) * 1000;
  };

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const active = files[index];
    if (isVideoFile(active)) return;
    const watchdog = setInterval(() => {
      if (!filesRef.current.length || filesRef.current.length === 1) return;
      const elapsed = Date.now() - lastIndexChangeAtRef.current;
      if (elapsed > getSlideDurationMs() * 1.6) {
        goNext();
      }
    }, 1200);
    return () => clearInterval(watchdog);
  }, [files, index, sourceType, config, sectionIndex]);

  const getNextIndexForPlayback = () => {
    if (!files.length) return indexRef.current;
    if (files.length === 1) return indexRef.current;
    const total = filesRef.current.length;
    const start = (indexRef.current + 1) % total;
    const HEAVY_VIDEO_GATE_BYTES = 30 * 1024 * 1024;
    for (let step = 0; step < total; step += 1) {
      const idx = (start + step) % total;
      const file = filesRef.current[idx];
      if (!file) continue;
      if (!isVideoFile(file)) return idx;
      const size = Number(file?.size || 0);
      if (size <= HEAVY_VIDEO_GATE_BYTES) return idx;
      const pathKey = String(file?.url || "");
      const progress = pathKey ? Number(cacheProgressByPath[pathKey] || 0) : 0;
      const hasLocalPath = !!String(file?.localPath || "").trim();
      const hasLocalUri = /^file:\/\//i.test(String(file?.remoteUrl || ""));
      const hasLocal = hasLocalPath || hasLocalUri || progress >= 100;
      if (hasLocal || progress >= 5) return idx;
    }
    return indexRef.current;
  };

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const total = files.length;
    const indices = [index, (index + 1) % total].filter((i, pos, arr) => arr.indexOf(i) === pos);
    const items = indices.map((i) => files[i]).filter(Boolean);
    const key = items.map((item) => getMediaStableIdentity(item)).join("|");
    if (!key || key === prefetchKeyRef.current) return;
    prefetchKeyRef.current = key;
    prefetchMediaItems(items);
  }, [files, index, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    const paths = new Set<string>();
    const initial: Record<string, number> = {};
    files.forEach((file) => {
      const pathKey = String(file?.url || "");
      if (!pathKey) return;
      paths.add(pathKey);
      const existing = getCacheProgress(pathKey);
      if (existing?.percent) {
        initial[pathKey] = existing.percent;
      }
    });
    cachePathSetRef.current = paths;
    cacheRefreshDoneRef.current = new Set(
      Array.from(cacheRefreshDoneRef.current).filter((path) => paths.has(path))
    );
    setCacheProgressByPath(initial);

    const unsubscribe = subscribeCacheProgress((path, progress) => {
      if (!cachePathSetRef.current.has(path)) return;
      const percent = Number(progress?.percent || 0);
      setCacheProgressByPath((prev) => {
        if (prev[path] === percent) return prev;
        return { ...prev, [path]: percent };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [files, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const active = files[index];
    const pathKey = String(active?.url || "");
    if (!pathKey) return;
    if (cacheProgress < 100) return;
    if (cacheRefreshDoneRef.current.has(pathKey)) return;

    cacheRefreshDoneRef.current.add(pathKey);
    let cancelled = false;
    (async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 500;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          const list = await getMediaFiles(sectionIndex);
          if (cancelled || !isMountedRef.current) return;
          if (Array.isArray(list) && list.length) {
            setFiles((prev) => (areMediaListsEqual(prev, list) ? prev : list));
            setIndex(findMatchingIndex(list, filesRef.current[indexRef.current], indexRef.current));
            const activeItem = list.find(
              (entry) =>
                getMediaStableIdentity(entry) === getMediaStableIdentity(active)
            );
            if (activeItem) {
              const localUri = normalizeMediaUri(String(activeItem?.remoteUrl || ""));
              if (/^file:\/\//i.test(localUri) && localUri !== uri) {
                const localPath = localUri.replace(/^file:\/\//i, "");
                const exists = await RNFS.exists(localPath);
                if (exists) {
                  if (isVideoFile(activeItem)) {
                    setUri(localUri);
                    setVideoReloadToken((prev) => prev + 1);
                  } else {
                    setUri(localUri);
                  }
                  return;
                }
              } else if (localUri && localUri === uri) {
                return;
              }
            }
          }
        } catch {
          // ignore refresh failures
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheProgress, files, index, sectionIndex, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;

    const file = files[index];
    const isVideo = isVideoFile(file);
    if (!isVideo) return;

    const localPlayableUri = normalizeMediaUri(String(file?.remoteUrl || ""));
    const hasLocalPlayableUri = /^file:\/\//i.test(localPlayableUri);
    const usingRemote = /^https?:\/\//i.test(uri);

    if (!hasLocalPlayableUri || !usingRemote) return;

    if (cacheProgress >= 100) {
      // Prefer switching at a safe boundary to avoid mid-play glitches.
      setForceLocalRestart(true);
      return;
    }

    if (pendingLocalSwitchRef.current) return;

    // When cache finishes, switch once to local at the next natural end (avoid mid-play glitch).
    pendingLocalSwitchRef.current = setTimeout(() => {
      pendingLocalSwitchRef.current = null;
      if (!isMountedRef.current) return;
      // Avoid mid-playback glitch: allow restart at end to switch to local.
      setForceLocalRestart(true);
    }, 3000);

    return () => {
      if (pendingLocalSwitchRef.current) {
        clearTimeout(pendingLocalSwitchRef.current);
        pendingLocalSwitchRef.current = null;
      }
    };
  }, [files, index, uri, sourceType, cacheProgress]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const file = files[index];
    if (!isVideoFile(file)) return;
    videoFade.setValue(0);
  }, [files, index, uri, sourceType, videoFade]);

  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      setDownloadConcurrencyOverride(null);
    };
  }, []);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    const file = files[index];
    if (!isVideoFile(file)) return;
    videoReadyRef.current = false;
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    readyTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (videoReadyRef.current) return;
      handleRenderError();
    }, VIDEO_READY_TIMEOUT_MS);
    return () => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    };
  }, [files, index, uri, sourceType]);

  useEffect(() => {
    const animationType = config?.animation || "slide";
    const direction =
      config?.sections?.[sectionIndex]?.slideDirection || "left";

    if (animationType === "fade") {
      translateX.setValue(0);
      translateY.setValue(0);
      rotateY.setValue(0);
      scale.setValue(1);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (animationType === "zoom") {
      translateX.setValue(0);
      translateY.setValue(0);
      rotateY.setValue(0);
      opacity.setValue(0.9);
      scale.setValue(1.08);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (animationType === "flip") {
      translateX.setValue(0);
      translateY.setValue(0);
      scale.setValue(1);
      opacity.setValue(0.92);
      rotateY.setValue(14);
      Animated.parallel([
        Animated.timing(rotateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (animationType === "none") {
      translateX.setValue(0);
      translateY.setValue(0);
      opacity.setValue(1);
      rotateY.setValue(0);
      scale.setValue(1);
      return;
    }

    // Slide intro animation for next media, tuned for smoother motion.
    const distance = 140;
    opacity.setValue(0.94);
    scale.setValue(1);
    rotateY.setValue(0);
    translateX.setValue(0);
    translateY.setValue(0);
    if (direction === "left") translateX.setValue(distance);
    if (direction === "right") translateX.setValue(-distance);
    if (direction === "top") translateY.setValue(distance);
    if (direction === "bottom") translateY.setValue(-distance);

    Animated.parallel([
      Animated.timing(
        direction === "left" || direction === "right" ? translateX : translateY,
        {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }
      ),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, config?.animation, config?.sections, sectionIndex, opacity, rotateY, scale, translateX, translateY]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    const file = files[index];
    const isVideo = isVideoFile(file);
    if (!isVideo) {
      const duration =
        (config?.sections?.[sectionIndex]?.slideDuration ||
          config?.slideDuration ||
          5) * 1000;
      timerRef.current = setTimeout(goNext, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, files, config, sectionIndex, sourceType]);

  const goNext = () => {
    if (!files.length) return;
    if (files.length === 1) return;
    const nextIndex = getNextIndexForPlayback();
    setIndex(nextIndex);
  };

  // Keep playback simple: always advance when a video ends.

  const currentFile = files[index] || null;
  const currentFileType = String(currentFile?.type || "").toLowerCase();
  const isCurrentTextFile =
    sourceType === SOURCE_TYPES.multimedia &&
    !!currentFile &&
    (currentFileType === "text" ||
      /\.txt$/i.test(currentFile?.originalName || currentFile?.name || "")) &&
    !!uri;
  const currentFileSize = Number(currentFile?.size || 0);
  const currentIsVideo = isVideoFile(currentFile);
  const currentLocalPlayableUri = normalizeMediaUri(String(currentFile?.remoteUrl || ""));
  const currentHasLocalPlayableUri = /^file:\/\//i.test(currentLocalPlayableUri);
  const holdLargeVideo =
    sourceType === SOURCE_TYPES.multimedia &&
    HOLD_LARGE_VIDEO_UNTIL_CACHED &&
    currentIsVideo &&
    currentFileSize > LARGE_VIDEO_STREAM_THRESHOLD_BYTES &&
    !currentHasLocalPlayableUri &&
    !!server &&
    !!currentFile?.url;

  useEffect(() => {
    let cancelled = false;
    if (!isCurrentTextFile) {
      setTextContent("");
      return () => {
        cancelled = true;
      };
    }

    const loadText = async () => {
      try {
        let txt = "";
        if (/^file:\/\//i.test(uri)) {
          const localPath = uri.replace(/^file:\/\//i, "");
          txt = await RNFS.readFile(localPath, "utf8");
        } else {
          const res = await fetch(uri);
          txt = await res.text();
        }
        if (!cancelled) setTextContent(txt || "");
      } catch (_e) {
        if (!cancelled) setTextContent("Unable to load text file.");
      }
    };
    loadText();

    return () => {
      cancelled = true;
    };
  }, [isCurrentTextFile, uri, index]);

  useEffect(() => {
    if (typeof onPlaybackChange !== "function") return;
    if (sourceType !== SOURCE_TYPES.multimedia) {
      onPlaybackChange({
        section: sectionIndex + 1,
        sourceType,
        title: sourceUrl || "URL Source",
        uri,
        cacheStatus: "Live",
      });
      return;
    }

    if (!files.length) {
      const offline = !server;
      onPlaybackChange({
        section: sectionIndex + 1,
        sourceType: "multimedia",
        title: offline ? "Offline - no cached media" : "No media uploaded",
        mediaType: "",
        uri: "",
        cacheStatus: offline ? "Offline" : "Empty",
      });
      return;
    }

    const active = files[index];
    if (!active) return;
    const localPlayableUri = normalizeMediaUri(String(active?.remoteUrl || ""));
    const hasLocalPlayableUri = /^file:\/\//i.test(localPlayableUri);
    const hasLocalFile = !!String(active?.localPath || "").trim();
    const isCached = /^file:\/\//i.test(uri);
    const isMarkedCached = isCached || hasLocalFile || hasLocalPlayableUri;
    const cacheStatus = !uri
      ? ""
      : isMarkedCached
      ? "Cached"
      : server
      ? "Streaming"
      : "Offline";
    onPlaybackChange({
      section: sectionIndex + 1,
      sourceType: "multimedia",
      title: active.originalName || active.name || "Unknown media",
      mediaType: active.type || "",
      uri,
      page: active.page || 0,
      cacheStatus,
    });
  }, [files, index, sectionIndex, sourceType, sourceUrl, uri, onPlaybackChange]);

  useEffect(() => {
    const resetPdfState = () => {
      pdfPendingSlotRef.current = null;
      pdfPendingUrlRef.current = "";
      setPdfVisibleSlot("a");
      setPdfSlotUrls((prev) => (prev.a || prev.b ? { a: "", b: "" } : prev));
      setPdfSlotLoaded((prev) => (prev.a || prev.b ? { a: false, b: false } : prev));
    };

    if (sourceType !== SOURCE_TYPES.multimedia || !files.length) {
      resetPdfState();
      return;
    }

    const current = files[index];
    const currentIsPdf =
      String(current?.type || "").toLowerCase() === "pdf" ||
      /\.pdf$/i.test(current?.originalName || current?.name || "");
    if (!currentIsPdf) {
      resetPdfState();
      return;
    }
    pdfRetryCountRef.current = 0;

    const currentPdfUrl = buildPdfViewerUrl(uri, Number(current?.page || 1), pdfReloadToken);
    const nextIndex = files.length > 1 ? (index + 1) % files.length : -1;
    const nextFile = nextIndex >= 0 ? files[nextIndex] : null;
    const nextIsPdf =
      !!nextFile &&
      (String(nextFile?.type || "").toLowerCase() === "pdf" ||
        /\.pdf$/i.test(nextFile?.originalName || nextFile?.name || ""));
    const nextPdfUrl =
      nextIsPdf && nextFile?.remoteUrl
        ? buildPdfViewerUrl(
            normalizeMediaUri(String(nextFile.remoteUrl || "")),
            Number(nextFile?.page || 1),
            pdfReloadToken
          )
        : nextIsPdf && server && nextFile?.url
        ? buildPdfViewerUrl(
            buildRemoteMediaUri(server, nextFile.url, nextFile?.mtimeMs || mediaVersion),
            Number(nextFile?.page || 1),
            pdfReloadToken
          )
        : "";

    setPdfSlotUrls((prev) => {
      const activeSlot: "a" | "b" =
        prev.a === currentPdfUrl ? "a" : prev.b === currentPdfUrl ? "b" : pdfVisibleSlot;
      const hiddenSlot: "a" | "b" = activeSlot === "a" ? "b" : "a";
      const nextUrls = { ...prev };
      let changed = false;

      if (nextUrls[activeSlot] !== currentPdfUrl) {
        nextUrls[activeSlot] = currentPdfUrl;
        changed = true;
      }

      if (nextUrls[hiddenSlot] !== nextPdfUrl) {
        nextUrls[hiddenSlot] = nextPdfUrl;
        changed = true;
      }

      pdfDesiredSlotRef.current = activeSlot;
      const shouldSwitchVisible =
        pdfVisibleSlot !== activeSlot && !!pdfSlotLoaded[activeSlot];
      if (shouldSwitchVisible) {
        setPdfVisibleSlot(activeSlot);
      }

      if (nextPdfUrl) {
        pdfPendingSlotRef.current = hiddenSlot;
        pdfPendingUrlRef.current = nextPdfUrl;
      } else {
        pdfPendingSlotRef.current = null;
        pdfPendingUrlRef.current = "";
      }

      if (!changed) return prev;
      return nextUrls;
    });

    setPdfSlotLoaded((prev) => {
      const nextLoaded = {
        a: pdfSlotUrlsRef.current.a === currentPdfUrl ? prev.a : false,
        b: pdfSlotUrlsRef.current.b === currentPdfUrl ? prev.b : false,
      };

      if (nextPdfUrl) {
        if (pdfSlotUrlsRef.current.a === nextPdfUrl) nextLoaded.a = prev.a;
        if (pdfSlotUrlsRef.current.b === nextPdfUrl) nextLoaded.b = prev.b;
      }

      if (nextLoaded.a === prev.a && nextLoaded.b === prev.b) return prev;
      return nextLoaded;
    });
  }, [files, index, uri, sourceType, server, mediaVersion, pdfVisibleSlot]);

  const handlePdfLoadEnd = (slot: "a" | "b") => {
    pdfRetryCountRef.current = 0;
    setPdfSlotLoaded((prev) => ({ ...prev, [slot]: true }));
    if (pdfDesiredSlotRef.current === slot) {
      setPdfVisibleSlot(slot);
    }
  };

  const handleImageLoadEnd = (slot: "a" | "b") => {
    setImageSlotLoaded((prev) => ({ ...prev, [slot]: true }));
    if (imageDesiredSlotRef.current === slot) {
      setImageVisibleSlot(slot);
    }
  };

  if (sourceType !== SOURCE_TYPES.multimedia) {
    if (!uri) {
      return (
        <View style={styles.center}>
          <Text style={{ color: "#fff" }}>No URL Configured</Text>
        </View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            transform: [
              { perspective: 1000 },
              { translateX },
              { translateY },
              { scale },
              {
                rotateY: rotateY.interpolate({
                  inputRange: [-180, 180],
                  outputRange: ["-180deg", "180deg"],
                }),
              },
            ],
          },
        ]}
      >
        <View style={mediaRotateLayerStyle}>
          <WebView
            source={{ uri }}
            style={styles.media}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            onError={handleRenderError}
          />
        </View>
      </Animated.View>
    );
  }

  if (!files.length) {
    const offline = sourceType === SOURCE_TYPES.multimedia && !server;
    const emptyTitle = offline ? "Offline Content" : "No Media Uploaded";
    const emptySubtitle = offline
      ? "No cached media for this section."
      : "Upload files to start playback.";
    const emptyHint = offline
      ? "Connect to CMS to sync content."
      : "Open CMS and upload media to this grid.";
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyBadge}>
            <Text style={styles.emptyBadgeText}>SECTION {sectionIndex + 1}</Text>
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
          <View style={styles.emptyHintBox}>
            <Text style={styles.emptyHintText}>{emptyHint}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!uri) {
    if (holdLargeVideo) {
      return (
        <View style={styles.downloadHoldWrap}>
          <ActivityIndicator size="large" color="#7fffd4" />
          <Text style={styles.downloadHoldTitle}>Downloading Video For Smooth Playback</Text>
          <Text style={styles.downloadHoldText}>
            {cacheProgress > 0 ? `Progress: ${Math.round(cacheProgress)}%` : "Starting download..."}
          </Text>
        </View>
      );
    }
    return <View style={styles.container} />;
  }
  const file = currentFile;
  const fileType = String(file?.type || "").toLowerCase();
  const isVideo = isVideoFile(file);
  const isText = fileType === "text" || /\.txt$/i.test(file.originalName || file.name || "");
  const isPdf = fileType === "pdf" || /\.pdf$/i.test(file.originalName || file.name || "");
  const pdfPage = Number(file?.page || 1);
  const uploadTotal = Number(processingCount?.total || 0);
  const uploadDone = Number(processingCount?.uploaded || 0);
  const showProcessingOverlay =
    !!String(processingMessage || "").trim() || (uploadTotal > 0 && uploadDone >= 0);
  const isCached = /^file:\/\//i.test(uri);
  const hasLocalFile = !!String(file?.localPath || "").trim();
  const isMarkedCached = isCached || hasLocalFile || /^file:\/\//i.test(String(file?.remoteUrl || ""));
  const totalFiles = files.length;
  const cachedCount = totalFiles
    ? files.reduce((count, entry) => {
        const pathKey = String(entry?.url || "");
        const progress = pathKey ? Number(cacheProgressByPath[pathKey] || 0) : 0;
        const hasLocalPath = !!String(entry?.localPath || "").trim();
        const hasLocalUri = /^file:\/\//i.test(String(entry?.remoteUrl || ""));
        const cached = hasLocalPath || hasLocalUri || progress >= 100;
        return cached ? count + 1 : count;
      }, 0)
    : 0;
  const streamingCount = Math.max(0, totalFiles - cachedCount);
  const aggregateProgress = totalFiles
    ? files.reduce((sum, entry) => {
        const pathKey = String(entry?.url || "");
        const progress = pathKey ? Number(cacheProgressByPath[pathKey] || 0) : 0;
        const hasLocalPath = !!String(entry?.localPath || "").trim();
        const hasLocalUri = /^file:\/\//i.test(String(entry?.remoteUrl || ""));
        const cached = hasLocalPath || hasLocalUri || progress >= 100;
        return sum + (cached ? 100 : Math.max(0, Math.min(100, progress)));
      }, 0) / totalFiles
    : 0;
  const cacheStatus = !uri
    ? ""
    : sourceType !== SOURCE_TYPES.multimedia
    ? "Live"
    : cachedCount > 0 && cachedCount >= totalFiles
    ? "Cached"
    : server
    ? "Streaming"
    : "Offline";
  const showCacheBadge = sourceType === SOURCE_TYPES.multimedia && !!cacheStatus;
  const showCacheProgress =
    cacheStatus === "Streaming" && streamingCount > 0 && aggregateProgress > 0 && aggregateProgress < 100;
  const showLiveBadge = !!uri;
  const bufferingReason = (() => {
    if (!currentFile || sourceType !== SOURCE_TYPES.multimedia) return "";
    if (!server) return "CMS is offline — network unavailable.";
    if (cacheStatus === "Streaming") return "Internet is slow — video is buffering.";
    if (!uri) return "Video source is not loading.";
    return "Video is buffering.";
  })();
  const effectiveVideoUri =
    isVideo
      ? uri ||
        normalizeMediaUri(String(file?.remoteUrl || "")) ||
        (server && file?.url
          ? buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion)
          : "")
      : "";

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [
            { perspective: 1000 },
            { translateX },
            { translateY },
            { scale },
            {
              rotateY: rotateY.interpolate({
                inputRange: [-180, 180],
                outputRange: ["-180deg", "180deg"],
              }),
            },
          ],
        },
      ]}
    >
      {showLiveBadge ? (
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : null}
      {showCacheBadge ? (
        <View
          style={[
            styles.cacheBadge,
            cacheStatus === "Offline" ? styles.cacheBadgeOffline : null,
          ]}
        >
          {cacheStatus === "Streaming" && showCacheProgress ? (
            <View
              style={[
                styles.cacheBadgeProgress,
                { width: `${Math.round(aggregateProgress)}%` },
              ]}
            />
          ) : null}
          <View style={styles.cacheBadgeContent}>
            <Text style={styles.cacheBadgeText}>
              {cacheStatus === "Streaming" && totalFiles
                ? `Streaming ${cachedCount}/${totalFiles}`
                : cacheStatus}
            </Text>
          </View>
        </View>
      ) : null}
      {showProcessingOverlay ? (
        <View style={styles.processingWrap}>
          <ActivityIndicator size="large" color="#7fffd4" />
          <Text style={styles.processingTitle}>Updating Section</Text>
          <Text style={styles.processingText}>
            {String(processingMessage || "Uploading... Please wait.")}
          </Text>
          {uploadTotal > 0 ? (
            <Text style={styles.processingCountText}>
              {`Uploading files: ${Math.min(uploadDone || 0, uploadTotal)}/${uploadTotal}`}
            </Text>
          ) : null}
          {files.length ? (
            <Text style={styles.processingCountText}>
              {`Files in section: ${files.length}`}
            </Text>
          ) : null}
        </View>
      ) : isVideo ? (
        <View style={mediaRotateLayerStyle}>
          <Animated.View style={[styles.media, { opacity: videoFade }]}>
            <NativeVideoPlayer
              key={`${file.name}-${index}-${videoReloadToken}-${String(videoViewType)}`}
              src={effectiveVideoUri}
              style={styles.media}
              rotation={0}
              muted
              resizeMode="stretch"
              repeat={files.length === 1 && !forceLocalRestart}
              onEnd={() => {
                if (forceLocalRestart) {
                  const localPlayableUri = normalizeMediaUri(String(file?.remoteUrl || ""));
                  if (/^file:\/\//i.test(localPlayableUri)) {
                    pinnedMediaUriRef.current = {
                      identity: getMediaIdentity(file),
                      uri: localPlayableUri,
                    };
                    setUri(localPlayableUri);
                    setVideoReloadToken((prev) => prev + 1);
                  }
                  setForceLocalRestart(false);
                  return;
                }
                if (files.length > 1) {
                  const nextIndex = (indexRef.current + 1) % filesRef.current.length;
                  const nextFile = filesRef.current[nextIndex];
                  if (nextFile && isVideoFile(nextFile)) {
                    const pathKey = String(nextFile?.url || "");
                    const progress = pathKey ? Number(cacheProgressByPath[pathKey] || 0) : 0;
                    const hasLocalPath = !!String(nextFile?.localPath || "").trim();
                    const hasLocalUri = /^file:\/\//i.test(String(nextFile?.remoteUrl || ""));
                    const hasLocal = hasLocalPath || hasLocalUri || progress >= 100;
                    if (!hasLocal && progress < 5 && videoGateLoopRef.current < 2) {
                      // Keep current video for up to two extra loops to avoid blank/black while next buffers.
                      videoGateLoopRef.current += 1;
                      setVideoReloadToken((prev) => prev + 1);
                      return;
                    }
                  }
                  goNext();
                }
              }}
              onReady={() => {
                videoRetryCountRef.current = 0;
                videoReadyRef.current = true;
                setVideoBuffering(false);
                setShowBufferIndicator(false);
                if (bufferTimerRef.current) {
                  clearTimeout(bufferTimerRef.current);
                  bufferTimerRef.current = null;
                }
                setDownloadConcurrencyOverride(null);
                if (readyTimeoutRef.current) {
                  clearTimeout(readyTimeoutRef.current);
                  readyTimeoutRef.current = null;
                }
                const fileKey = getMediaStableIdentity(file);
                if (fileKey && videoTransientErrorRef.current[fileKey]) {
                  delete videoTransientErrorRef.current[fileKey];
                }
                Animated.timing(videoFade, {
                  toValue: 1,
                  duration: 140,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start();
              }}
              onBuffering={(event) => {
                const buffering = !!event?.nativeEvent?.buffering;
                const localUri = normalizeMediaUri(String(file?.remoteUrl || ""));
                const hasLocalPlayable = /^file:\/\//i.test(localUri) || /^file:\/\//i.test(uri);
                if (hasLocalPlayable) {
                  if (buffering && /^https?:\/\//i.test(String(uri || "")) && /^file:\/\//i.test(localUri)) {
                    // If cached file exists, switch to local immediately to avoid buffering.
                    setUri(localUri);
                    setVideoReloadToken((prev) => prev + 1);
                  }
                  setVideoBuffering(false);
                  setShowBufferIndicator(false);
                  if (bufferTimerRef.current) {
                    clearTimeout(bufferTimerRef.current);
                    bufferTimerRef.current = null;
                  }
                  setDownloadConcurrencyOverride(null);
                  return;
                }
                setVideoBuffering(buffering);
                if (buffering) {
                  setDownloadConcurrencyOverride(1);
                  if (!bufferTimerRef.current) {
                    bufferTimerRef.current = setTimeout(() => {
                      bufferTimerRef.current = null;
                      setShowBufferIndicator(true);
                    }, 2500);
                  }
                } else {
                  if (bufferTimerRef.current) {
                    clearTimeout(bufferTimerRef.current);
                    bufferTimerRef.current = null;
                  }
                  setShowBufferIndicator(false);
                  setDownloadConcurrencyOverride(null);
                }
              }}
              onError={() => handleRenderError()}
            />
          </Animated.View>
          {showBufferIndicator && videoBuffering && !isMarkedCached ? (
            <View style={styles.bufferOverlay}>
              <View style={styles.bufferRing}>
                <ActivityIndicator size="small" color="#8fffe7" />
              </View>
              <Text style={styles.bufferHint}>{bufferingReason}</Text>
            </View>
          ) : null}
        </View>
      ) : isPdf ? (
        <View style={mediaRotateLayerStyle}>
          {pdfSlotUrls.a ? (
            <WebView
              key={`pdf-a-${pdfReloadToken}`}
              source={{ uri: pdfSlotUrls.a }}
              style={[
                styles.media,
                styles.pdfLayer,
                pdfVisibleSlot === "a" ? styles.pdfVisible : styles.pdfHidden,
              ]}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              setSupportMultipleWindows={false}
              mixedContentMode="always"
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={() => handlePdfLoadEnd("a")}
              onError={handlePdfError}
            />
          ) : null}
          {pdfSlotUrls.b ? (
            <WebView
              key={`pdf-b-${pdfReloadToken}`}
              source={{ uri: pdfSlotUrls.b }}
              style={[
                styles.media,
                styles.pdfLayer,
                pdfVisibleSlot === "b" ? styles.pdfVisible : styles.pdfHidden,
              ]}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              setSupportMultipleWindows={false}
              mixedContentMode="always"
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={() => handlePdfLoadEnd("b")}
              onError={handlePdfError}
            />
          ) : null}
        </View>
      ) : isText ? (
        <View style={[mediaRotateLayerStyle, styles.textWrap]}>
          <ScrollView
            style={styles.media}
            contentContainerStyle={styles.textContentWrap}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.textContent}>
              {textContent || "No text content"}
            </Text>
          </ScrollView>
        </View>
      ) : (
        <View style={mediaRotateLayerStyle}>
          {imageSlotUrls.a ? (
            <Image
              source={{ uri: imageSlotUrls.a }}
              style={[
                styles.media,
                styles.imageLayer,
                imageVisibleSlot === "a" ? styles.imageVisible : styles.imageHidden,
              ]}
              resizeMode="stretch"
              fadeDuration={0}
              onLoad={() => handleImageLoadEnd("a")}
              onError={handleRenderError}
            />
          ) : null}
          {imageSlotUrls.b ? (
            <Image
              source={{ uri: imageSlotUrls.b }}
              style={[
                styles.media,
                styles.imageLayer,
                imageVisibleSlot === "b" ? styles.imageVisible : styles.imageHidden,
              ]}
              resizeMode="stretch"
              fadeDuration={0}
              onLoad={() => handleImageLoadEnd("b")}
              onError={handleRenderError}
            />
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", overflow: "hidden" },
  media: { width: "100%", height: "100%", backgroundColor: "#ffffff" },
  absoluteLayer: { position: "absolute" },
  fillLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  textWrap: { backgroundColor: "#0b0f14" },
  textContentWrap: { padding: 20 },
  textContent: {
    color: "#e8f2ff",
    fontSize: 24,
    lineHeight: 34,
  },
  processingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#05080d",
  },
  downloadHoldWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#0b0f14",
  },
  downloadHoldTitle: {
    marginTop: 16,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  downloadHoldText: {
    marginTop: 8,
    color: "rgba(210, 222, 236, 0.85)",
    fontSize: 14,
    textAlign: "center",
  },
  processingTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  processingText: {
    color: "#b9d2ea",
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
  },
  processingCountText: {
    marginTop: 10,
    color: "rgba(185, 210, 234, 0.85)",
    fontSize: 16,
    textAlign: "center",
  },
  bufferOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  bufferRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(140, 255, 230, 0.45)",
    borderTopColor: "rgba(130, 220, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 16, 22, 0.2)",
  },
  bufferHint: {
    marginTop: 6,
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    textAlign: "center",
  },
  pdfLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  imageLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  pdfVisible: {
    opacity: 1,
  },
  pdfHidden: {
    opacity: 0,
  },
  imageVisible: {
    opacity: 1,
  },
  imageHidden: {
    opacity: 0,
  },
  cacheBadge: {
    position: "absolute",
    top: 6,
    right: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(10, 20, 30, 0.32)",
    borderWidth: 1,
    borderColor: "rgba(120, 200, 255, 0.18)",
    zIndex: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  cacheBadgeOffline: {
    backgroundColor: "rgba(140, 20, 30, 0.45)",
    borderColor: "rgba(255, 160, 160, 0.35)",
  },
  cacheBadgeProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 190, 255, 0.45)",
  },
  cacheBadgeContent: {
    position: "relative",
    zIndex: 2,
  },
  cacheBadgeText: {
    color: "rgba(233, 246, 255, 0.95)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  liveBadge: {
    position: "absolute",
    top: 6,
    left: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(10, 18, 24, 0.32)",
    borderWidth: 1,
    borderColor: "rgba(127, 255, 212, 0.18)",
    zIndex: 6,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  liveDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(91, 255, 212, 0.9)",
    marginRight: 3,
  },
  liveText: {
    color: "rgba(234, 255, 248, 0.95)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cacheProgressFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#7fffd4",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#05080d",
  },
  emptyCard: {
    width: "86%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(130, 190, 230, 0.28)",
    backgroundColor: "rgba(12, 18, 26, 0.92)",
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(62, 188, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(120, 220, 255, 0.5)",
    marginBottom: 14,
  },
  emptyBadgeText: {
    color: "#bfeaff",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "rgba(203, 220, 235, 0.9)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  emptyHintBox: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(6, 12, 18, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(120, 180, 220, 0.22)",
  },
  emptyHintText: {
    color: "rgba(164, 210, 245, 0.9)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
