import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  NativeModules,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Immersive from "react-native-immersive";
import { io, Socket } from "socket.io-client";
import AdminButton from "../admin/AdminButton";
import AdminPanel from "../admin/AdminPanel";
import PlayerScreen from "../player/PlayerScreen";
import { loadConfig } from "../services/configService";
import { syncMedia } from "../services/mediaService";
import { findCMS } from "../services/serverService";

let socket: Socket | null = null;
const SOCKET_RECOVERY_TIMEOUT_MS = 65000;
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_STALL_MS = 20000;

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [connectSubtitleText, setConnectSubtitleText] = useState(
    "Preparing network scan..."
  );
  const [connectStatusText, setConnectStatusText] = useState(
    "Auto reconnect active"
  );
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [pulseValue, spinValue]);

  useEffect(() => {
    let isMounted = true;
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let lastWatchdogTick = Date.now();
    const setConnectTexts = (subtitle: string, status: string) => {
      if (!isMounted) return;
      setConnectSubtitleText(subtitle);
      setConnectStatusText(status);
    };

    const safeRestartApp = (reason: string) => {
      console.log("Restarting app:", reason);
      try {
        const rn = require("react-native");
        if (rn?.NativeModules?.RNRestart?.Restart) {
          rn.NativeModules.RNRestart.Restart();
          return;
        }
        if (rn?.DevSettings?.reload) {
          rn.DevSettings.reload();
          return;
        }
      } catch (e) {
        console.log("Restart failed", e);
      }
    };

    const startDisconnectRecovery = (reason: string) => {
      if (disconnectTimer) return;
      console.log("Socket disconnected, recovery timer started:", reason);
      disconnectTimer = setTimeout(() => {
        disconnectTimer = null;
        safeRestartApp(`socket timeout: ${reason}`);
      }, SOCKET_RECOVERY_TIMEOUT_MS);
    };

    const clearDisconnectRecovery = () => {
      if (!disconnectTimer) return;
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    };

    const startWatchdog = () => {
      if (watchdogTimer) return;
      lastWatchdogTick = Date.now();
      watchdogTimer = setInterval(() => {
        const now = Date.now();
        const delta = now - lastWatchdogTick;
        lastWatchdogTick = now;
        if (delta > WATCHDOG_INTERVAL_MS + WATCHDOG_STALL_MS) {
          safeRestartApp(`js-stall ${delta}ms`);
        }
      }, WATCHDOG_INTERVAL_MS);
    };

    const stopWatchdog = () => {
      if (!watchdogTimer) return;
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    };

    const onClearData = async () => {
      console.log("Clear data command received");
      const RNFS = require("react-native-fs");

      try {
        const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
        if (await RNFS.exists(mediaPath)) {
          await RNFS.unlink(mediaPath);
        }

        const configPath = `${RNFS.DocumentDirectoryPath}/config.json`;
        if (await RNFS.exists(configPath)) {
          await RNFS.unlink(configPath);
        }

        console.log("Data cleared");
        const { DevSettings } = require("react-native");
        DevSettings.reload();
      } catch (e) {
        console.log("Clear failed", e);
      }
    };

    const init = async () => {
      try {
        setConnectTexts("Scanning local network for CMS server", "Network scan running");
        const url = await findCMS();
        if (!url) {
          console.log("No CMS found");
          setConnectTexts(
            "CMS not found. Retrying discovery automatically",
            "Retrying in 5 seconds"
          );
          setTimeout(() => {
            if (isMounted) init();
          }, 5000);
          if (isMounted) setReady(false);
          return;
        }

        const { DeviceIdModule } = NativeModules;
        const deviceId = await DeviceIdModule.getDeviceId();
        setConnectTexts(
          `CMS found at ${url}. Opening secure socket`,
          "Connecting to server"
        );

        socket = io(url, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 3000,
        });

        socket.on("connect", async () => {
          console.log("Connected:", deviceId);
          clearDisconnectRecovery();
          socket?.emit("register-device", deviceId);
          setConnectTexts("Connected. Downloading device configuration", "Syncing config");

          await loadConfig(setConfig);
          setConnectTexts("Configuration received. Syncing media catalog", "Syncing media");
          await syncMedia();
          setConnectTexts("Setup complete. Starting player", "Ready");

          if (isMounted) setReady(true);
        });

        // Only media change should restart slideshow/media index.
        socket.on("media-updated", async () => {
          await syncMedia();
          await loadConfig(setConfig);
          if (isMounted) {
            setMediaVersion((prev) => prev + 1);
          }
        });

        // Config-only update should apply settings without restarting media playback.
        socket.on("config-updated", async () => {
          await loadConfig(setConfig);
        });

        socket.on("clear-data", onClearData);
        socket.on("restart-app", () => safeRestartApp("manual restart command"));
        socket.on("disconnect", (reason) => {
          setConnectTexts(
            `Connection lost (${String(reason)}). Trying to recover`,
            "Reconnecting..."
          );
          startDisconnectRecovery(`disconnect:${String(reason)}`);
        });
        socket.on("connect_error", (err) => {
          setConnectTexts(
            "Socket handshake failed. Retrying automatically",
            "Connect error"
          );
          startDisconnectRecovery(`connect_error:${err?.message || "unknown"}`);
        });
      } catch (err) {
        console.log("Init error", err);
        setConnectTexts("Startup failed unexpectedly", "Recovery mode");
        if (isMounted) setReady(false);
      }
    };

    init();
    (Immersive as any).on();
    startWatchdog();

    return () => {
      isMounted = false;
      clearDisconnectRecovery();
      stopWatchdog();
      if (socket) {
        socket.off("connect");
        socket.off("media-updated");
        socket.off("config-updated");
        socket.off("clear-data", onClearData);
        socket.off("restart-app");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.disconnect();
      }
    };
  }, []);

  if (!ready) {
    const ringSpin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    const pulseScale = pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1.12],
    });
    const pulseOpacity = pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    });

    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <AdminButton onOpen={() => setShowAdmin(true)} />

        <View style={styles.connectCard}>
          <Animated.View style={[styles.loaderRing, { transform: [{ rotate: ringSpin }] }]}>
            <View style={styles.loaderInner} />
          </Animated.View>

          <Animated.View
            style={[
              styles.pulseDot,
              { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
            ]}
          />

          <Text style={styles.connectTitle}>Connecting To CMS</Text>
          <Text style={styles.connectSubtitle}>
            {connectSubtitleText}
          </Text>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{connectStatusText}</Text>
          </View>
        </View>
      </View>
    );
  }

  const safeConfig = config || {
    orientation: "horizontal",
    bgColor: "#000",
  };

  const { width, height } = Dimensions.get("window");
  const orientation = safeConfig.orientation;

  let rotation = "0deg";
  let containerWidth = width;
  let containerHeight = height;

  if (orientation === "vertical") {
    rotation = "90deg";
    containerWidth = height;
    containerHeight = width;
  }

  if (orientation === "reverse-vertical") {
    rotation = "-90deg";
    containerWidth = height;
    containerHeight = width;
  }

  if (orientation === "reverse-horizontal") {
    rotation = "180deg";
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={{
          width: containerWidth,
          height: containerHeight,
          position: "absolute",
          top: (height - containerHeight) / 2,
          left: (width - containerWidth) / 2,
          transform: [{ rotate: rotation }],
        }}
      >
        <PlayerScreen config={safeConfig} mediaVersion={mediaVersion} />
        <AdminButton onOpen={() => setShowAdmin(true)} />
        <AdminPanel visible={showAdmin} onClose={() => setShowAdmin(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  connectRoot: {
    flex: 1,
    backgroundColor: "#05080d",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bgGlowTop: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(22, 168, 255, 0.18)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -170,
    left: -140,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(0, 210, 180, 0.14)",
  },
  connectCard: {
    width: "82%",
    maxWidth: 520,
    minHeight: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(16, 20, 27, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 34,
  },
  loaderRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 5,
    borderColor: "rgba(84, 190, 255, 0.2)",
    borderTopColor: "#5ec4ff",
    borderRightColor: "#39d8bc",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
    backgroundColor: "#69f1d0",
  },
  connectTitle: {
    marginTop: 22,
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  connectSubtitle: {
    marginTop: 10,
    color: "rgba(216, 225, 236, 0.82)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 360,
  },
  statusPill: {
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(132, 228, 205, 0.35)",
    backgroundColor: "rgba(39, 149, 122, 0.18)",
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7fffd4",
    marginRight: 8,
  },
  statusText: {
    color: "#c8fff1",
    fontSize: 13,
    fontWeight: "600",
  },
});
