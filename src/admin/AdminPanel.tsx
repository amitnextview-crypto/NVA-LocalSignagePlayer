import React, { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Animated } from "react-native";
import { WebView } from "react-native-webview";
import { findCMS, getServer } from "../services/serverService";

export default function AdminPanel({ visible, onClose }: any) {
  const slide = useRef(new Animated.Value(400)).current;

  const [server, setServer] = useState("");
useEffect(() => {
  async function init() {
    try {
      await findCMS();
      const url = getServer();
if (url) setServer(url);
    } catch {}
  }

  init();
}, []);


  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 400,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { transform: [{ translateX: slide }] }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <WebView source={{ uri: server }}  style={{ flex: 1 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "70%",
    backgroundColor: "#111"
  },
  header: {
    height: 60,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  close: { color: "#fff", fontSize: 24 }
});
