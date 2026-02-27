import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View, Text } from "react-native";
import Video from "react-native-video";
import { getMediaFiles } from "../services/mediaService";
import { getServer } from "../services/serverService";
import RNFS from "react-native-fs";

export default function SlideRenderer({ config, sectionIndex, mediaVersion }: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [uri, setUri] = useState("");

  const server = getServer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const timerRef = useRef<any>(null);

  // load media list
  useEffect(() => {
    if (!server) return;

    const load = async () => {
      const list = await getMediaFiles(sectionIndex);
      setFiles(list || []);
      setIndex(0);
    };

    load();
  }, [sectionIndex, server, mediaVersion]);

  // resolve file uri
  useEffect(() => {
    if (!files.length) return;

    const file = files[index];

    async function resolvePath() {
      const exists = await RNFS.exists(file.localPath);

      if (exists) setUri("file://" + file.localPath);
      else if (server) setUri(server + file.url);
    }

    resolvePath();
  }, [files, index, server]);

  // animation
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [index]);

  // slide timer
  useEffect(() => {
    if (!files.length) return;

    clearTimeout(timerRef.current);

    const file = files[index];
    const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);

    if (!isVideo) {
      timerRef.current = setTimeout(goNext, (
  config?.sections?.[sectionIndex]?.slideDuration ||
  config?.slideDuration ||
  5
) * 1000);
    }

    return () => clearTimeout(timerRef.current);
  }, [index, files, config]);

  const goNext = () => {
    if (!files.length) return;

    const direction =
      config?.sections?.[sectionIndex]?.slideDirection || "left";

    const distance = 300;

    translateX.setValue(0);
    translateY.setValue(0);

    if (direction === "left") translateX.setValue(distance);
    if (direction === "right") translateX.setValue(-distance);
    if (direction === "top") translateY.setValue(distance);
    if (direction === "bottom") translateY.setValue(-distance);

    Animated.timing(
      direction === "left" || direction === "right"
        ? translateX
        : translateY,
      { toValue: 0, duration: 400, useNativeDriver: true }
    ).start();

    setIndex((prev) => (files.length === 1 ? prev : (prev + 1) % files.length));
  };

  if (!files.length)
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>No Media Found</Text>
      </View>
    );

  if (!uri) return <View />;

  const file = files[index];
  const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }, { translateY }, { scale }] }]}
    >
      {isVideo ? (
        <Video
          key={file.name + index}
          source={{ uri }}
          style={styles.media}
          muted
          resizeMode="stretch"
          repeat={files.length === 1}
          onEnd={() => files.length > 1 && goNext()}
        />
      ) : (
        <Image source={{ uri }} style={styles.media} resizeMode="stretch" />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});




