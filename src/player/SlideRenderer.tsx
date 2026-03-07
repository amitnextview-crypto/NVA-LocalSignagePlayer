import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { ViewType } from "react-native-video";
import { WebView } from "react-native-webview";
import RNFS from "react-native-fs";
import { getMediaFiles } from "../services/mediaService";
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

function buildPdfViewerUrl(fileUrl: string, page: number) {
  const safePage = Math.max(1, Number(page || 1));
  if (/^file:\/\//i.test(String(fileUrl || ""))) {
    return String(fileUrl || "");
  }
  const match = String(fileUrl || "").match(/^(https?:\/\/[^/]+)/i);
  const origin = match?.[1] || "";
  if (origin) {
    return `${origin}/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
  }
  return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
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
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const [pdfSlotUrls, setPdfSlotUrls] = useState<{ a: string; b: string }>({ a: "", b: "" });
  const [pdfSlotLoaded, setPdfSlotLoaded] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [pdfVisibleSlot, setPdfVisibleSlot] = useState<"a" | "b">("a");
  const server = getServer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesRef = useRef<any[]>([]);
  const indexRef = useRef(0);
  const pdfSlotUrlsRef = useRef({ a: "", b: "" });
  const isMountedRef = useRef(true);
  const emptyFetchCountRef = useRef(0);
  const videoRetryCountRef = useRef(0);
  const pdfPendingSlotRef = useRef<"a" | "b" | null>(null);
  const pdfPendingUrlRef = useRef("");
  const EMPTY_FETCH_CLEAR_THRESHOLD = 3;
  const MAX_SINGLE_VIDEO_RETRY = 3;

  const sectionConfig = config?.sections?.[sectionIndex] || {};
  const sourceType = sectionConfig?.sourceType || SOURCE_TYPES.multimedia;
  const sourceUrl = sectionConfig?.sourceUrl || "";
  const isMultiPaneLayout = config?.layout === "grid2" || config?.layout === "grid3";
  const manualRotation = 0;
  const mediaRotation = ((manualRotation % 360) + 360) % 360;
  const isQuarterTurn = mediaRotation === 90 || mediaRotation === 270;
  const mediaRotateLayerStyle = (() => {
    if (!mediaRotation) return styles.fillLayer;
    if (!isQuarterTurn || !boxSize.width || !boxSize.height) {
      return [styles.fillLayer, { transform: [{ rotate: `${mediaRotation}deg` }] }];
    }
    const rotatedWidth = boxSize.height;
    const rotatedHeight = boxSize.width;
    return [
      styles.absoluteLayer,
      {
        width: rotatedWidth,
        height: rotatedHeight,
        left: (boxSize.width - rotatedWidth) / 2,
        top: (boxSize.height - rotatedHeight) / 2,
        transform: [{ rotate: `${mediaRotation}deg` }],
      },
    ];
  })();

  useEffect(() => {
    filesRef.current = files;
    indexRef.current = index;
  }, [files, index]);

  useEffect(() => {
    pdfSlotUrlsRef.current = pdfSlotUrls;
  }, [pdfSlotUrls]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

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
    if (files.length > 1) {
      goNext();
      return;
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
    if (!files.length) return;
    videoRetryCountRef.current = 0;
    setVideoReloadToken(0);
    setVideoViewType(isMultiPaneLayout ? ViewType.TEXTURE : ViewType.SURFACE);

    const file = files[index];
    const fileSize = Number(file?.size || 0);
    const streamThresholdBytes = 300 * 1024 * 1024; // Prefer HTTP streaming for videos > 300MB to avoid OOM
    const isVideo = isVideoFile(file);
    const isLargeVideo = isVideo && fileSize > streamThresholdBytes;
    if (isVideo && server && file?.url) {
      // Prefer direct HTTP for video playback on Android TV. Cached file playback has
      // been less reliable than streamed playback on some devices.
      setUri(buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion));
    } else if (isLargeVideo && server && file?.url) {
      setUri(buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion));
    } else if (file.remoteUrl) {
      setUri(normalizeMediaUri(file.remoteUrl));
    } else if (server && file?.url) {
      setUri(buildRemoteMediaUri(server, file.url, file?.mtimeMs || mediaVersion));
    } else {
      setUri("");
    }
  }, [files, index, server, sourceType, mediaVersion]);

  useEffect(() => {
    const animationType = config?.animation || "slide";
    const direction =
      config?.sections?.[sectionIndex]?.slideDirection || "left";

    if (animationType === "fade") {
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
      });
      return;
    }

    const active = files[index];
    if (!active) return;
    onPlaybackChange({
      section: sectionIndex + 1,
      sourceType: "multimedia",
      title: active.originalName || active.name || "Unknown media",
      mediaType: active.type || "",
      uri,
      page: active.page || 0,
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

    const currentPdfUrl = buildPdfViewerUrl(uri, Number(current?.page || 1));
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
            Number(nextFile?.page || 1)
          )
        : nextIsPdf && server && nextFile?.url
        ? buildPdfViewerUrl(
            buildRemoteMediaUri(server, nextFile.url, nextFile?.mtimeMs || mediaVersion),
            Number(nextFile?.page || 1)
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
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout || {};
          if (!width || !height) return;
          setBoxSize((prev) =>
            prev.width === width && prev.height === height
              ? prev
              : { width, height }
          );
        }}
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
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>No Media Found</Text>
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
            key={`${file.name}-${index}-${mediaRotation}-${videoReloadToken}-${String(videoViewType)}`}
            src={uri}
            style={styles.media}
            muted
            resizeMode="stretch"
            repeat={files.length === 1}
            onEnd={() => files.length > 1 && goNext()}
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
              onError={handleRenderError}
            />
          ) : null}
          {pdfSlotUrls.b ? (
            <WebView
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
              onError={handleRenderError}
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
