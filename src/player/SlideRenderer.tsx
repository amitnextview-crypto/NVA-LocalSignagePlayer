import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { ViewType } from "react-native-video";
import { WebView } from "react-native-webview";
import RNFS from "react-native-fs";
import { getMediaFiles, getCacheProgress, subscribeCacheProgress } from "../services/mediaService";
import { getServer } from "../services/serverService";
import NativeVideoPlayer from "./NativeVideoPlayer";

const SOURCE_TYPES = {
  multimedia: "multimedia",
  web: "web",
  youtube: "youtube",
};
const VIDEO_FILE_RE = /\.(mp4|m4v|mov|mkv|webm)(\?.*)?$/i;

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

function areMediaListsEqual(a: any[], b: any[]) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (getMediaIdentity(a[i]) !== getMediaIdentity(b[i])) {
      return false;
    }
  }
  return true;
}

function findMatchingIndex(list: any[], current: any, fallbackIndex = 0) {
  if (!Array.isArray(list) || !list.length) return 0;
  if (!current) return Math.min(fallbackIndex, list.length - 1);
  const currentIdentity = getMediaIdentity(current);
  const matchedIndex = list.findIndex((item) => getMediaIdentity(item) === currentIdentity);
  if (matchedIndex >= 0) return matchedIndex;
  return Math.min(fallbackIndex, list.length - 1);
}

export default function SlideRenderer({
  config,
  sectionIndex,
  mediaVersion,
  processingMessage,
  onPlaybackChange,
  onPlaybackError,
}: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [uri, setUri] = useState("");
  const [videoReloadToken, setVideoReloadToken] = useState(0);
  const [videoViewType, setVideoViewType] = useState(
    config?.layout === "grid2" || config?.layout === "grid3"
      ? ViewType.TEXTURE
      : ViewType.SURFACE
  );
  const [textContent, setTextContent] = useState("");
  const [pdfSlotUrls, setPdfSlotUrls] = useState<{ a: string; b: string }>({ a: "", b: "" });
  const [pdfSlotLoaded, setPdfSlotLoaded] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [pdfVisibleSlot, setPdfVisibleSlot] = useState<"a" | "b">("a");
  const [pdfReloadToken, setPdfReloadToken] = useState(0);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [forceLocalRestart, setForceLocalRestart] = useState(false);
  const server = getServer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesRef = useRef<any[]>([]);
  const indexRef = useRef(0);
  const pinnedMediaUriRef = useRef<{ identity: string; uri: string } | null>(null);
  const pinnedContentIdentityRef = useRef<string>("");
  const pdfSlotUrlsRef = useRef({ a: "", b: "" });
  const isMountedRef = useRef(true);
  const emptyFetchCountRef = useRef(0);
  const videoRetryCountRef = useRef(0);
  const pdfPendingSlotRef = useRef<"a" | "b" | null>(null);
  const pdfPendingUrlRef = useRef("");
  const pdfRetryCountRef = useRef(0);
  const pendingLocalSwitchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EMPTY_FETCH_CLEAR_THRESHOLD = 3;
  const MAX_SINGLE_VIDEO_RETRY = 3;
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
  }, [files, index]);

  useEffect(() => {
    pdfSlotUrlsRef.current = pdfSlotUrls;
  }, [pdfSlotUrls]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (pendingLocalSwitchRef.current) clearTimeout(pendingLocalSwitchRef.current);
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

    console.log("Media render error", {
      sectionIndex,
      name: activeFile?.name || activeFile?.originalName || "",
      uri,
      videoViewType,
    });

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

    timer = setInterval(refresh, 5000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sectionIndex, sourceType]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;
    videoRetryCountRef.current = 0;
    setVideoReloadToken(0);
    setVideoViewType(isMultiPaneLayout ? ViewType.TEXTURE : ViewType.SURFACE);

    const file = files[index];
    const identity = getMediaIdentity(file);
    const contentIdentity = getMediaContentIdentity(file);
    const fileSize = Number(file?.size || 0);
    const streamThresholdBytes = 300 * 1024 * 1024; // Prefer HTTP streaming for videos > 300MB to avoid OOM
    const isVideo = isVideoFile(file);
    const isLargeVideo = isVideo && fileSize > streamThresholdBytes;
    const localPlayableUri = normalizeMediaUri(String(file?.remoteUrl || ""));
    const hasLocalPlayableUri = /^file:\/\//i.test(localPlayableUri);

    let nextUri = "";
    if (hasLocalPlayableUri) {
      nextUri = localPlayableUri;
    } else if (isLargeVideo && server && file?.url) {
      nextUri = buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion);
    } else if (server && file?.url) {
      nextUri = buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion);
    } else if (file.remoteUrl) {
      nextUri = localPlayableUri;
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
    setUri(nextUri || "");
  }, [files, index, server, sourceType, mediaVersion]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) {
      setCacheProgress(0);
      pdfRetryCountRef.current = 0;
      setPdfReloadToken(0);
      setForceLocalRestart(false);
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
    if (!files.length) return;

    const file = files[index];
    const isVideo = isVideoFile(file);
    if (!isVideo) return;

    const localPlayableUri = normalizeMediaUri(String(file?.remoteUrl || ""));
    const hasLocalPlayableUri = /^file:\/\//i.test(localPlayableUri);
    const usingRemote = /^https?:\/\//i.test(uri);

    if (!hasLocalPlayableUri || !usingRemote) return;

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
    setIndex((prev) => (prev + 1) % files.length);
  };

  const currentFile = files[index] || null;
  const currentFileType = String(currentFile?.type || "").toLowerCase();
  const isCurrentTextFile =
    sourceType === SOURCE_TYPES.multimedia &&
    !!currentFile &&
    (currentFileType === "text" ||
      /\.txt$/i.test(currentFile?.originalName || currentFile?.name || "")) &&
    !!uri;

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

      const shouldSwitchVisible = pdfVisibleSlot !== activeSlot;
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

  if (!uri) return <View style={styles.container} />;
  const file = currentFile;
  const fileType = String(file?.type || "").toLowerCase();
  const isVideo = isVideoFile(file);
  const isText = fileType === "text" || /\.txt$/i.test(file.originalName || file.name || "");
  const isPdf = fileType === "pdf" || /\.pdf$/i.test(file.originalName || file.name || "");
  const pdfPage = Number(file?.page || 1);
  const showProcessingOverlay = !!String(processingMessage || "").trim();
  const isCached = /^file:\/\//i.test(uri);
  const hasLocalFile = !!String(file?.localPath || "").trim();
  const isMarkedCached = isCached || hasLocalFile || /^file:\/\//i.test(String(file?.remoteUrl || ""));
  const cacheStatus = !uri
    ? ""
    : isMarkedCached
    ? "Cached"
    : server
    ? "Streaming"
    : "Offline";
  const showCacheBadge = sourceType === SOURCE_TYPES.multimedia && !!cacheStatus;
  const showCacheProgress =
    cacheStatus === "Streaming" && !isMarkedCached && cacheProgress > 0 && cacheProgress < 100;
  const showLiveBadge = !!uri;

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
          <Text style={styles.cacheBadgeText}>{cacheStatus}</Text>
          {showCacheProgress ? (
            <View style={styles.cacheProgressTrack}>
              <View
                style={[
                  styles.cacheProgressFill,
                  { width: `${cacheProgress}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {showProcessingOverlay ? (
        <View style={styles.processingWrap}>
          <Text style={styles.processingTitle}>Updating Section</Text>
          <Text style={styles.processingText}>
            {String(processingMessage || "Uploading... Please wait.")}
          </Text>
        </View>
      ) : isVideo ? (
        <View style={mediaRotateLayerStyle}>
         <NativeVideoPlayer
            key={`${file.name}-${index}-${videoReloadToken}-${String(videoViewType)}`}
            src={uri}
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
                goNext();
              }
            }}
            onReady={() => {
              videoRetryCountRef.current = 0;
            }}
            onError={() => handleRenderError()}
          />
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
          <Image
            source={{ uri }}
            style={styles.media}
            resizeMode="stretch"
            fadeDuration={0}
            onError={handleRenderError}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  media: { width: "100%", height: "100%" },
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
  pdfLayer: {
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
  cacheBadge: {
    position: "absolute",
    top: 6,
    right: 44,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(8,12,18,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 5,
  },
  cacheBadgeOffline: {
    backgroundColor: "rgba(120,16,26,0.8)",
    borderColor: "rgba(255,160,160,0.5)",
  },
  cacheBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  liveBadge: {
    position: "absolute",
    top: 6,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(10,14,18,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7fffd4",
    marginRight: 4,
  },
  liveText: {
    color: "#e9fff8",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  cacheProgressTrack: {
    marginTop: 4,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
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
