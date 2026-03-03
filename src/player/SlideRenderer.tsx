import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Video, { BufferingStrategyType, ViewType } from "react-native-video";
import { WebView } from "react-native-webview";
import { getMediaFiles } from "../services/mediaService";
import { getServer } from "../services/serverService";

const SOURCE_TYPES = {
  multimedia: "multimedia",
  web: "web",
  youtube: "youtube",
};

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
  const match = String(fileUrl || "").match(/^(https?:\/\/[^/]+)/i);
  const origin = match?.[1] || "";
  if (origin) {
    return `${origin}/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
  }
  return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
}

export default function SlideRenderer({
  config,
  sectionIndex,
  mediaVersion,
}: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [uri, setUri] = useState("");
  const [textContent, setTextContent] = useState("");
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const server = getServer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionConfig = config?.sections?.[sectionIndex] || {};
  const sourceType = sectionConfig?.sourceType || SOURCE_TYPES.multimedia;
  const sourceUrl = sectionConfig?.sourceUrl || "";
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

    if (!server) return;
    const load = async () => {
      try {
        const list = await getMediaFiles(sectionIndex);
        setFiles(list || []);
        setIndex(0);
      } catch (error) {
        console.log("Media load error:", error);
      }
    };
    load();
  }, [sectionIndex, server, mediaVersion, sourceType, sourceUrl]);

  useEffect(() => {
    if (sourceType !== SOURCE_TYPES.multimedia) return;
    if (!files.length) return;

    const file = files[index];
    if (file.remoteUrl) {
      setUri(file.remoteUrl);
    } else if (server) {
      setUri(server + file.url);
    } else {
      setUri("");
    }
  }, [files, index, server, sourceType]);

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
    const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);
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
        const res = await fetch(uri);
        const txt = await res.text();
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
  const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);
  const isText = fileType === "text" || /\.txt$/i.test(file.originalName || file.name || "");
  const isPdf = fileType === "pdf" || /\.pdf$/i.test(file.originalName || file.name || "");
  const pdfPage = Number(file?.page || 1);

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
      {isVideo ? (
        <View style={mediaRotateLayerStyle}>
          <Video
            key={`${file.name}-${index}-${mediaRotation}`}
            source={{ uri }}
            style={styles.media}
            // Multiple simultaneous videos are generally more stable with SURFACE on Android TV.
            viewType={ViewType.SURFACE}
            muted
            resizeMode="stretch"
            repeat={files.length === 1}
            onEnd={() => files.length > 1 && goNext()}
            bufferingStrategy={BufferingStrategyType.DEFAULT}
            bufferConfig={{
              minBufferMs: 15000,
              maxBufferMs: 50000,
              bufferForPlaybackMs: 2500,
              bufferForPlaybackAfterRebufferMs: 5000,
            }}
            playInBackground={false}
            ignoreSilentSwitch="ignore"
          />
        </View>
      ) : isPdf ? (
        <View style={mediaRotateLayerStyle}>
          <WebView
            source={{ uri: buildPdfViewerUrl(uri, pdfPage) }}
            style={styles.media}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            mediaPlaybackRequiresUserAction={false}
          />
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
