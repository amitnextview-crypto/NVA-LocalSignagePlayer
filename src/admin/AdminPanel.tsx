import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  findCMS,
  getServer,
  setServer,
  subscribeToServerChanges,
  verifyCMS,
} from "../services/serverService";

export default function AdminPanel({ visible, onClose }: any) {
  const slide = useRef(new Animated.Value(400)).current;
  const [server, updateServer] = useState("");
  const [manualInput, setManualInput] = useState("http://172.19.88.107:8080");

  useEffect(() => {
    async function init() {
      const current = getServer();
      if (current) {
        updateServer(current);
        setManualInput(current);
      }
      const url = await findCMS();
      if (url) {
        updateServer(url);
        setManualInput(url);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToServerChanges((url) => {
      if (!url) return;
      updateServer(url);
      setManualInput(url);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 400,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  const saveManualServer = async () => {
    const { normalizedUrl, ok } = await verifyCMS(manualInput);
    if (!normalizedUrl) {
      return Alert.alert("Enter CMS URL", "Example: http://192.168.1.5:8080");
    }

    await setServer(normalizedUrl, { forceNotify: true });
    updateServer(normalizedUrl);
    Alert.alert(
      ok ? "CMS connected" : "CMS URL saved",
      ok
        ? normalizedUrl
        : `${normalizedUrl}\n\nCMS abhi reachable nahi hai, lekin device is URL ko background me lagatar retry karegi. Jaise hi PC par CMS open hoga, TV auto-connect karne ki koshish karega.`
    );
    onClose();
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>X</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>CMS URL (manual):</Text>
        <TextInput
          placeholder="http://PC_IP:8080"
          placeholderTextColor="#888"
          value={manualInput}
          onChangeText={setManualInput}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <TouchableOpacity onPress={saveManualServer} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save CMS URL</Text>
        </TouchableOpacity>

        {server ? (
          <WebView
            source={{ uri: server }}
            style={{ flex: 1 }}
            onMessage={(event) => {
              if (event.nativeEvent.data === "CONFIG_SAVED") onClose();
            }}
          />
        ) : (
          <Text style={styles.emptyText}>CMS not detected. Enter URL above.</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "90%",
    backgroundColor: "#111",
  },
  header: {
    height: 60,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  close: {
    color: "#fff",
    fontSize: 24,
  },
  body: {
    flex: 1,
    padding: 10,
  },
  label: {
    color: "#fff",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: "#4da3ff",
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
  },
  saveBtnText: {
    color: "#fff",
    textAlign: "center",
  },
  emptyText: {
    color: "#fff",
  },
});
