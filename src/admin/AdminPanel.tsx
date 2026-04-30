import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  findCMS,
  getServer,
  refreshCMSDiscovery,
  setServer,
  subscribeToServerChanges,
  verifyCMS,
} from "../services/serverService";

const TV_INPUT_FOCUS_DELAY_MS = 400;

export default function AdminPanel({ visible, onClose }: any) {
  const slide = useRef(new Animated.Value(400)).current;
  const [server, updateServer] = useState("");
  const [manualInput, setManualInput] = useState("http://192.168.1.5:8080");
  const [busyAction, setBusyAction] = useState<"save" | "refresh" | "">("");
  const [focusTarget, setFocusTarget] = useState<"input" | "save" | "refresh" | "close">("input");
  const inputRef = useRef<TextInput | null>(null);
  const saveButtonRef = useRef<any>(null);
  const refreshButtonRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);

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

  useEffect(() => {
    if (!visible) return;
    setFocusTarget("input");
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, TV_INPUT_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const focusInput = () => {
    setFocusTarget("input");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const focusSave = () => {
    setFocusTarget("save");
    inputRef.current?.blur();
    setTimeout(() => {
      saveButtonRef.current?.focus?.();
    }, 0);
  };

  const focusRefresh = () => {
    setFocusTarget("refresh");
    inputRef.current?.blur();
    setTimeout(() => {
      refreshButtonRef.current?.focus?.();
    }, 0);
  };

  const focusClose = () => {
    setFocusTarget("close");
    inputRef.current?.blur();
    setTimeout(() => {
      closeButtonRef.current?.focus?.();
    }, 0);
  };

  const handleInputKeyPress = (event: any) => {
    const key = String(event?.nativeEvent?.key || "").toLowerCase();
    if (key === "arrowdown" || key === "arrowright") {
      focusSave();
    }
  };

  const inputNode = findNodeHandle(inputRef.current);
  const saveNode = findNodeHandle(saveButtonRef.current);
  const refreshNode = findNodeHandle(refreshButtonRef.current);
  const closeNode = findNodeHandle(closeButtonRef.current);
  const closeFocusProps: any = {
    nextFocusUp: inputNode ?? undefined,
    nextFocusLeft: refreshNode ?? undefined,
    nextFocusDown: saveNode ?? undefined,
  };
  const inputFocusProps: any = {
    nextFocusDown: saveNode ?? undefined,
    nextFocusRight: saveNode ?? undefined,
    nextFocusLeft: closeNode ?? undefined,
  };
  const saveFocusProps: any = {
    nextFocusUp: inputNode ?? undefined,
    nextFocusLeft: closeNode ?? undefined,
    nextFocusRight: refreshNode ?? undefined,
  };
  const refreshFocusProps: any = {
    nextFocusUp: inputNode ?? undefined,
    nextFocusLeft: saveNode ?? undefined,
    nextFocusRight: closeNode ?? undefined,
  };

  const saveManualServer = async () => {
    if (busyAction) return;
    setBusyAction("save");
    const { normalizedUrl, ok } = await verifyCMS(manualInput);
    if (!normalizedUrl) {
      setBusyAction("");
      return Alert.alert("Enter CMS URL", "Example: http://192.168.1.5:8080");
    }

    await setServer(normalizedUrl, { forceNotify: true });
    updateServer(normalizedUrl);
    setBusyAction("");
    Alert.alert(
      ok ? "CMS connected" : "CMS URL saved",
      ok
        ? normalizedUrl
        : `${normalizedUrl}\n\nCMS unreachable. Retrying in background; will auto-connect when available.`
    );
    onClose();
  };

  const refreshServer = async () => {
    if (busyAction) return;
    setBusyAction("refresh");
    try {
      const current = getServer();
      const currentProbe = current ? await verifyCMS(current, 3000) : { normalizedUrl: "", ok: false };
      if (currentProbe.ok && currentProbe.normalizedUrl) {
        await setServer(currentProbe.normalizedUrl, { forceNotify: true });
        updateServer(currentProbe.normalizedUrl);
        setManualInput(currentProbe.normalizedUrl);
        Alert.alert("CMS connected", currentProbe.normalizedUrl);
        return;
      }

      const discoveredUrl = (await refreshCMSDiscovery()) || (await findCMS());
      if (!discoveredUrl) {
        Alert.alert(
          "CMS not found",
          "Open the CMS exe on the PC, set it to the same network, and then refresh it again."
        );
        return;
      }

      await setServer(discoveredUrl, { forceNotify: true });
      updateServer(discoveredUrl);
      setManualInput(discoveredUrl);
      Alert.alert("CMS connected", discoveredUrl);
    } finally {
      setBusyAction("");
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <Pressable
          ref={closeButtonRef}
          onPress={onClose}
          onFocus={() => setFocusTarget("close")}
          focusable
          hasTVPreferredFocus={focusTarget === "close"}
          {...closeFocusProps}
          style={[
            styles.headerAction,
            focusTarget === "close" ? styles.focusedAction : null,
          ]}
        >
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>CMS URL (manual):</Text>
        <TextInput
          ref={inputRef}
          placeholder="http://PC_IP:8080"
          placeholderTextColor="#888"
          value={manualInput}
          onChangeText={setManualInput}
          onFocus={() => setFocusTarget("input")}
          onKeyPress={handleInputKeyPress}
          autoCapitalize="none"
          autoCorrect={false}
          hasTVPreferredFocus={focusTarget === "input"}
          {...inputFocusProps}
          style={[
            styles.input,
            focusTarget === "input" ? styles.focusedInput : null,
          ]}
        />

        <View style={styles.actionRow}>
          <Pressable
            ref={saveButtonRef}
            onPress={saveManualServer}
            onFocus={() => setFocusTarget("save")}
            focusable
            disabled={!!busyAction}
            hasTVPreferredFocus={focusTarget === "save"}
            {...saveFocusProps}
            style={[
              styles.actionBtn,
              styles.saveBtn,
              focusTarget === "save" ? styles.focusedAction : null,
              busyAction ? styles.disabledAction : null,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {busyAction === "save" ? "Saving..." : "Save CMS URL"}
            </Text>
          </Pressable>

          <Pressable
            ref={refreshButtonRef}
            onPress={refreshServer}
            onFocus={() => setFocusTarget("refresh")}
            focusable
            disabled={!!busyAction}
            hasTVPreferredFocus={focusTarget === "refresh"}
            {...refreshFocusProps}
            style={[
              styles.actionBtn,
              styles.refreshBtn,
              focusTarget === "refresh" ? styles.focusedAction : null,
              busyAction ? styles.disabledAction : null,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {busyAction === "refresh" ? "Refreshing..." : "Refresh CMS"}
            </Text>
          </Pressable>
        </View>

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
  headerAction: {
    minWidth: 52,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 10,
  },
  focusedInput: {
    borderColor: "#6fe6b4",
    backgroundColor: "#26303a",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    backgroundColor: "#4da3ff",
    borderColor: "rgba(255,255,255,0.14)",
  },
  refreshBtn: {
    backgroundColor: "#1d7f6f",
    borderColor: "rgba(255,255,255,0.14)",
  },
  saveBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },
  focusedAction: {
    borderColor: "#7fffd4",
    transform: [{ scale: 1.03 }],
  },
  disabledAction: {
    opacity: 0.6,
  },
  emptyText: {
    color: "#fff",
  },
});
