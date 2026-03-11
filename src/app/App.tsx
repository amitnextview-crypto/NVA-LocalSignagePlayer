import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Immersive from "react-native-immersive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { io, Socket } from "socket.io-client";
import AdminButton from "../admin/AdminButton";
import AdminPanel from "../admin/AdminPanel";
import PlayerScreen from "../player/PlayerScreen";
import { loadConfig } from "../services/configService";
import {
  activateDeviceWithKey,
  hasLocalActivationForDevice,
  readStoredLicense,
} from "../services/licenseService";
import { syncMedia } from "../services/mediaService";
import { findCMS, getServer, restoreServerFromStorage } from "../services/serverService";

let socket: Socket | null = null;
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_STALL_MS = 180000;
const NETWORK_RECOVERY_INTERVAL_MS = 10000;
const SELF_HEAL_SYNC_INTERVAL_MS = 120000;
const RECONNECT_RETRY_INTERVAL_MS = 10000;
const AUTO_CLEAR_BOOT_MARKER_KEY = "auto_clear_boot_marker_v1";
const AUTO_CLEAR_BOOT_LOOP_GUARD_MS = 20000;
const ENABLE_AUTO_CLEAR_ON_BOOT = false;
const INIT_RETRY_DELAY_MS = 5000;
const MEDIA_UPDATE_DEBOUNCE_MS = 800;
const LICENSE_INIT_RETRY_COUNT = 5;
const LICENSE_INIT_RETRY_DELAY_MS = 1200;
const APK_UPDATE_PENDING_KEY = "apk_update_pending_v1";
const APK_UPDATE_PENDING_MAX_AGE_MS = 1000 * 60 * 60;

type RuntimeErrorInfo = {
  message: string;
  detail?: string;
  source?: string;
  time: string;
};

class PlayerErrorBoundary extends React.Component<
  { onError?: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: String(error?.message || error) };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundaryWrap}>
          <Text style={styles.errorBoundaryTitle}>Playback Error</Text>
          <Text style={styles.errorBoundaryText}>
            {this.state.errorMessage || "Unexpected error. Please check logs."}
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPathSizeSafe(targetPath: string) {
  try {
    const exists = await RNFS.exists(targetPath);
    if (!exists) return 0;
    const stat = await RNFS.stat(targetPath);
    if (!stat.isDirectory()) {
      return Number(stat.size || 0);
    }
    const entries = await RNFS.readDir(targetPath);
    const sizes = await Promise.all(
      entries.map((entry) => getPathSizeSafe(entry.path))
    );
    return sizes.reduce((sum, size) => sum + Number(size || 0), 0);
  } catch {
    return 0;
  }
}

export default function App() {
  const [bootReady, setBootReady] = useState(false);
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
  const deviceIdRef = useRef("unknown");
  const [licenseReady, setLicenseReady] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [licenseDeviceId, setLicenseDeviceId] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("Checking activation...");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [lastError, setLastError] = useState<RuntimeErrorInfo | null>(null);
  const [uploadProcessingBySection, setUploadProcessingBySection] = useState<
    Record<number, string>
  >({});
  const playbackBySectionRef = useRef<Record<number, any>>({});
  const lastMetaRef = useRef<any | null>(null);
  const lastConfigSyncAtRef = useRef("");
  const lastMediaSyncAtRef = useRef("");
  const pendingApkUpdateSuccessRef = useRef<any | null>(null);
  const errorClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportRuntimeError = (message: string, detail = "", source = "runtime") => {
    if (errorClearTimerRef.current) {
      clearTimeout(errorClearTimerRef.current);
      errorClearTimerRef.current = null;
    }
    const friendlyMessage =
      source === "player"
        ? String(message || "Playback error")
        : "Something went wrong. Player will try to recover.";
    const friendlyDetail = detail ? String(detail) : "";

    setLastError({
      message: friendlyMessage,
      detail: friendlyDetail,
      source,
      time: new Date().toISOString(),
    });
    if (socket?.connected) {
      socket.emit("device-error", {
        deviceId: deviceIdRef.current,
        type: source,
        message: detail ? `${message} | ${detail}` : message,
      });
    }
    // Auto-clear after a while to avoid blocking playback forever.
    errorClearTimerRef.current = setTimeout(() => {
      setLastError(null);
      errorClearTimerRef.current = null;
    }, 20000);
  };

  async function clearRuntimePlaybackData() {
    // Intentionally do not clear AsyncStorage license keys.
    const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
    const configPath = `${RNFS.DocumentDirectoryPath}/config.json`;
    if (await RNFS.exists(mediaPath)) {
      await RNFS.unlink(mediaPath);
    }
    if (await RNFS.exists(configPath)) {
      await RNFS.unlink(configPath);
    }
  }

  async function clearRuntimeCacheOnly() {
    const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
    const cachePath = RNFS.CachesDirectoryPath;
    if (await RNFS.exists(mediaPath)) {
      await RNFS.unlink(mediaPath);
    }
    if (cachePath && (await RNFS.exists(cachePath))) {
      const entries = await RNFS.readDir(cachePath);
      await Promise.allSettled(entries.map((entry) => RNFS.unlink(entry.path)));
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!ENABLE_AUTO_CLEAR_ON_BOOT) {
      setBootReady(true);
      return () => {
        mounted = false;
      };
    }

    const triggerAppReload = () => {
      try {
        const rn = require("react-native");
        if (rn?.NativeModules?.DeviceIdModule?.restartApp) {
          rn.NativeModules.DeviceIdModule.restartApp();
          return true;
        }
        if (rn?.NativeModules?.RNRestart?.Restart) {
          rn.NativeModules.RNRestart.Restart();
          return true;
        }
        if (rn?.DevSettings?.reload) {
          rn.DevSettings.reload();
          return true;
        }
      } catch (_e) {
      }
      return false;
    };

    const autoClearOnBoot = async () => {
      try {
        const markerRaw = await AsyncStorage.getItem(AUTO_CLEAR_BOOT_MARKER_KEY);
        const markerTs = Number(markerRaw || 0);
        const recentMarker =
          Number.isFinite(markerTs) &&
          markerTs > 0 &&
          Date.now() - markerTs < AUTO_CLEAR_BOOT_LOOP_GUARD_MS;

        if (recentMarker) {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
          if (mounted) setBootReady(true);
          return;
        }

        await AsyncStorage.setItem(
          AUTO_CLEAR_BOOT_MARKER_KEY,
          String(Date.now())
        );

        await clearRuntimePlaybackData();

        const reloaded = triggerAppReload();
        if (!reloaded) {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
          if (mounted) setBootReady(true);
        }
      } catch (_e) {
        try {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
        } catch {
        }
        if (mounted) setBootReady(true);
      }
    };

    autoClearOnBoot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const ErrorUtils = (global as any)?.ErrorUtils;
    if (!ErrorUtils?.setGlobalHandler) return;

    const prevHandler = ErrorUtils.getGlobalHandler ? ErrorUtils.getGlobalHandler() : null;
    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      const message = String(error?.message || error || "Unknown JS error");
      reportRuntimeError(message, isFatal ? "fatal" : "non-fatal", "js");
      if (__DEV__ && typeof prevHandler === "function") {
        prevHandler(error, isFatal);
      }
    });

    return () => {
      if (typeof prevHandler === "function") {
        ErrorUtils.setGlobalHandler(prevHandler);
      }
    };
  }, []);

  useEffect(() => {
    if (!bootReady) return;
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
  }, [bootReady, pulseValue, spinValue]);

  useEffect(() => {
    if (!bootReady) return;
    let mounted = true;
    const initLicense = async () => {
      try {
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        const deviceId = String(nativeDeviceModule?.getDeviceId?.() || "").trim();
        deviceIdRef.current = deviceId || "unknown";
        if (!mounted) return;
        setLicenseDeviceId(deviceId || "unknown");
        let storedLicense = { deviceId: "", licenseKey: "" };
        let active = false;

        for (let attempt = 0; attempt < LICENSE_INIT_RETRY_COUNT; attempt += 1) {
          storedLicense = await readStoredLicense();
          if (!mounted) return;

          if (storedLicense.licenseKey) {
            setLicenseInput(storedLicense.licenseKey);
          }

          active = deviceId ? await hasLocalActivationForDevice(deviceId) : false;
          if (active) break;

          const hasStoredKeyForDevice =
            storedLicense.deviceId === deviceId && !!storedLicense.licenseKey;
          if (hasStoredKeyForDevice) {
            active = true;
            break;
          }

          if (attempt < LICENSE_INIT_RETRY_COUNT - 1) {
            await wait(LICENSE_INIT_RETRY_DELAY_MS);
          }
        }

        if (!mounted) return;
        setLicensed(!!active);
        setLicenseStatus(
          active
            ? "Device activated. Starting player..."
            : "License required. Enter key to activate."
        );
      } catch (_e) {
        if (!mounted) return;
        setLicensed(false);
        setLicenseStatus("Unable to read device id.");
      } finally {
        if (mounted) setLicenseReady(true);
      }
    };
    initLicense();
    return () => {
      mounted = false;
    };
  }, [bootReady]);

  useEffect(() => {
    if (!bootReady) return;
    let mounted = true;

    const inspectPendingApkUpdate = async () => {
      try {
        const raw = await AsyncStorage.getItem(APK_UPDATE_PENDING_KEY);
        if (!raw || !mounted) return;
        const pending = JSON.parse(String(raw || "{}"));
        const requestedAt = Number(pending?.requestedAt || 0);
        const previousVersion = String(pending?.previousVersion || "").trim();
        const apkUrl = String(pending?.apkUrl || "").trim();

        if (
          !requestedAt ||
          Date.now() - requestedAt > APK_UPDATE_PENDING_MAX_AGE_MS
        ) {
          await AsyncStorage.removeItem(APK_UPDATE_PENDING_KEY);
          return;
        }

        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        const currentVersion = String(nativeDeviceModule?.getAppVersion?.() || "").trim();
        if (!currentVersion || !previousVersion || currentVersion === previousVersion) {
          return;
        }

        pendingApkUpdateSuccessRef.current = {
          apkUrl,
          previousVersion,
          currentVersion,
          requestedAt,
          reportedAt: new Date().toISOString(),
        };
        await AsyncStorage.removeItem(APK_UPDATE_PENDING_KEY);
      } catch (_e) {
      }
    };

    inspectPendingApkUpdate();
    return () => {
      mounted = false;
    };
  }, [bootReady]);

  const onActivateLicense = async () => {
    if (licenseBusy) return;
    setLicenseBusy(true);
    const result = await activateDeviceWithKey(licenseDeviceId, licenseInput);
    setLicenseBusy(false);
    setLicenseStatus(result.message);
    if (result.success) {
      setLicenseInput(String(licenseInput || "").trim().toUpperCase());
      setLicensed(true);
      setReady(false);
    }
  };

  useEffect(() => {
    if (!bootReady || !licenseReady || !licensed) return;
    let isMounted = true;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let healthTimer: ReturnType<typeof setInterval> | null = null;
    let networkRecoveryTimer: ReturnType<typeof setInterval> | null = null;
    let selfHealTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setInterval> | null = null;
    let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let mediaUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    let initInProgress = false;
    let lastWatchdogTick = Date.now();
    const setConnectTexts = (subtitle: string, status: string) => {
      if (!isMounted) return;
      setConnectSubtitleText(subtitle);
      setConnectStatusText(status);
    };

    const safeRestartApp = (reason: string) => {
      if (socket?.connected) {
        socket.emit("device-error", {
          deviceId: deviceIdRef.current,
          type: "restart",
          message: `App restart triggered: ${reason}`,
        });
      }
      console.log("Restarting app:", reason);
      try {
        const rn = require("react-native");
        if (rn?.NativeModules?.DeviceIdModule?.restartApp) {
          rn.NativeModules.DeviceIdModule.restartApp();
          return;
        }
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

    const startDisconnectRecovery = (_reason: string) => {
      // Offline-first mode: do not auto-restart app on CMS disconnect.
      // Player should continue using cached config/media.
    };

    const clearDisconnectRecovery = () => {
      // no-op in offline-first mode
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

    const checkAndRecoverNetwork = () => {
      try {
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        if (!nativeDeviceModule?.getNetworkState) return;

        const networkState = nativeDeviceModule.getNetworkState() || {};
        const hasInternet = !!networkState?.internet;
        if (hasInternet) return;

        setConnectTexts(
          "Internet OFF detected. Trying auto WiFi recovery",
          "Recovering network..."
        );

        if (nativeDeviceModule?.tryRecoverInternet) {
          const recovery = nativeDeviceModule.tryRecoverInternet();
          emitDeviceHealth("network-recovery", { networkState, recovery });
        } else {
          emitDeviceHealth("network-recovery", { networkState, recovery: null });
        }
      } catch (e) {
        console.log("Network recovery check failed", e);
      }
    };

    const startNetworkRecoveryLoop = () => {
      if (networkRecoveryTimer) return;
      checkAndRecoverNetwork();
      networkRecoveryTimer = setInterval(() => {
        checkAndRecoverNetwork();
      }, NETWORK_RECOVERY_INTERVAL_MS);
    };

    const stopNetworkRecoveryLoop = () => {
      if (!networkRecoveryTimer) return;
      clearInterval(networkRecoveryTimer);
      networkRecoveryTimer = null;
    };

    const startSelfHealSyncLoop = () => {
      if (selfHealTimer) return;
      selfHealTimer = setInterval(async () => {
        if (!socket?.connected) return;
        try {
          const configLoaded = await loadConfig(setConfig);
          if (!configLoaded) {
            emitDeviceError("self-heal-config", "Config refresh failed");
            return;
          }
          await syncMedia();
          emitDeviceHealth("self-heal-sync");
        } catch (e) {
          emitDeviceError("self-heal-sync", String((e as any)?.message || e));
        }
      }, SELF_HEAL_SYNC_INTERVAL_MS);
    };

    const stopSelfHealSyncLoop = () => {
      if (!selfHealTimer) return;
      clearInterval(selfHealTimer);
      selfHealTimer = null;
    };

    const startReconnectLoop = () => {
      if (reconnectTimer) return;
      reconnectTimer = setInterval(async () => {
        if (!isMounted || initInProgress) return;
        if (socket?.connected) return;
        try {
          if (socket && !socket.connected) {
            socket.connect();
            return;
          }
        } catch {
        }
        await init();
      }, RECONNECT_RETRY_INTERVAL_MS);
    };

    const stopReconnectLoop = () => {
      if (!reconnectTimer) return;
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleInitRetry = () => {
      if (initRetryTimer) return;
      initRetryTimer = setTimeout(() => {
        initRetryTimer = null;
        if (isMounted) init();
      }, INIT_RETRY_DELAY_MS);
    };

    const emitDeviceHealth = (appState: string, meta: any = null) => {
      if (!socket?.connected) return;
      socket.emit("device-health", {
        deviceId: deviceIdRef.current,
        appState,
        meta,
      });
    };

    const emitDeviceError = (type: string, message: string) => {
      if (!socket?.connected) return;
      socket.emit("device-error", {
        deviceId: deviceIdRef.current,
        type,
        message,
      });
    };

    const collectDeviceMeta = async (extra: Record<string, any> = {}) => {
      const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
      let storageStats = { freeBytes: 0, totalBytes: 0 };
      let appVersion = "";

      try {
        if (nativeDeviceModule?.getStorageStats) {
          storageStats = nativeDeviceModule.getStorageStats() || storageStats;
        }
      } catch {
      }

      try {
        if (nativeDeviceModule?.getAppVersion) {
          appVersion = String(nativeDeviceModule.getAppVersion() || "");
        }
      } catch {
      }

      const mediaBytes = await getPathSizeSafe(`${RNFS.DocumentDirectoryPath}/media`);
      const configBytes = await getPathSizeSafe(`${RNFS.DocumentDirectoryPath}/config.json`);
      const cacheBytes = await getPathSizeSafe(RNFS.CachesDirectoryPath);

      return {
        appVersion,
        licensed,
        server: getServer(),
        currentPlaybackBySection: playbackBySectionRef.current,
        lastConfigSyncAt: lastConfigSyncAtRef.current,
        lastMediaSyncAt: lastMediaSyncAtRef.current,
        mediaBytes,
        configBytes,
        cacheBytes,
        freeBytes: Number(storageStats?.freeBytes || 0),
        totalBytes: Number(storageStats?.totalBytes || 0),
        ...extra,
      };
    };

    const emitDeviceHealthSnapshot = async (appState: string, extra: Record<string, any> = {}) => {
      const meta = await collectDeviceMeta(extra);
      lastMetaRef.current = meta;
      emitDeviceHealth(appState, meta);
    };

    const onClearData = async () => {
      console.log("Clear data command received");

      try {
        await clearRuntimePlaybackData();

        console.log("Data cleared");
        await emitDeviceHealthSnapshot("clear-data");
        const { DevSettings } = require("react-native");
        DevSettings.reload();
      } catch (e) {
        console.log("Clear failed", e);
        emitDeviceError("clear-data", `Clear failed: ${String((e as any)?.message || e)}`);
      }
    };

    const onClearCache = async () => {
      try {
        await clearRuntimeCacheOnly();
        await emitDeviceHealthSnapshot("clear-cache");
        await syncMedia({ force: true });
        if (isMounted) {
          setMediaVersion((prev) => prev + 1);
        }
      } catch (e) {
        emitDeviceError("clear-cache", `Clear cache failed: ${String((e as any)?.message || e)}`);
      }
    };

    const init = async () => {
      if (initInProgress) return;
      initInProgress = true;
      try {
        await restoreServerFromStorage();
        checkAndRecoverNetwork();
        setConnectTexts("Scanning local network for CMS server", "Network scan running");
        const url = await findCMS();
        if (!url) {
          console.log("No CMS found – using cached content if available");
          checkAndRecoverNetwork();
          await restoreServerFromStorage();
          const cachedConfig = await loadConfig(setConfig);
          await syncMedia();
          if (isMounted) {
            setConnectTexts(
              cachedConfig
                ? "CMS offline. Playing cached content"
                : "CMS not found. Playing cached content",
              "Offline playback"
            );
            setReady(true);
          }
          scheduleInitRetry();
          return;
        }

        const { DeviceIdModule } = NativeModules;
        const deviceId = await DeviceIdModule.getDeviceId();
        deviceIdRef.current = deviceId;
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
          stopReconnectLoop();
          clearDisconnectRecovery();
          socket?.emit("register-device", deviceId);
          await emitDeviceHealthSnapshot("connected", { phase: "socket-connected" });
          setConnectTexts("Connected. Downloading device configuration", "Syncing config");

          const loadedConfig = await loadConfig(setConfig);
          if (!loadedConfig) {
            emitDeviceError("config", "Config unavailable from server and local cache");
            setConnectTexts("Config unavailable. Retrying automatically", "Config retry");
            if (socket) {
              socket.disconnect();
              socket = null;
            }
            if (isMounted) setReady(false);
            scheduleInitRetry();
            return;
          }
          lastConfigSyncAtRef.current = new Date().toISOString();
          emitDeviceHealth("syncing-config");
          setConnectTexts("Configuration received. Syncing media catalog", "Syncing media");
          await syncMedia({ force: true });
          lastMediaSyncAtRef.current = new Date().toISOString();
          await emitDeviceHealthSnapshot("syncing-media");
          setConnectTexts("Setup complete. Starting player", "Ready");

          if (healthTimer) clearInterval(healthTimer);
          healthTimer = setInterval(async () => {
            await emitDeviceHealthSnapshot("ready", { ready: true });
          }, 15000);

          if (pendingApkUpdateSuccessRef.current) {
            await emitDeviceHealthSnapshot("apk-update-success", {
              apkUpdate: {
                status: "success",
                ...pendingApkUpdateSuccessRef.current,
              },
            });
            pendingApkUpdateSuccessRef.current = null;
          }

          if (isMounted) setReady(true);
        });

        // Media update: refresh slideshow immediately, then sync/cache in background.
        socket.on("media-updated", () => {
          emitDeviceHealth("media-updated-received");
          if (mediaUpdateTimer) clearTimeout(mediaUpdateTimer);
          mediaUpdateTimer = setTimeout(async () => {
            mediaUpdateTimer = null;
            try {
              await syncMedia({ force: true });
              lastMediaSyncAtRef.current = new Date().toISOString();
            } finally {
              if (isMounted) {
                setMediaVersion((prev) => prev + 1);
              }
              emitDeviceHealth("media-updated-synced");
            }
          }, MEDIA_UPDATE_DEBOUNCE_MS);
        });

        // Config-only update should apply settings without restarting media playback.
        socket.on("config-updated", async () => {
          const loadedConfig = await loadConfig(setConfig);
          if (loadedConfig) {
            lastConfigSyncAtRef.current = new Date().toISOString();
            emitDeviceHealth("config-updated");
          } else {
            emitDeviceError("config-updated", "Config refresh failed");
          }
        });

        socket.on("section-upload-status", (payload) => {
          const section = Number(payload?.section || 0);
          if (!section || section < 1 || section > 3) return;

          const status = String(payload?.status || "").toLowerCase();
          const message = String(payload?.message || "").trim();

          if (status === "processing") {
            setUploadProcessingBySection((prev) => ({
              ...prev,
              [section]: message || "Uploading... Please wait.",
            }));
            return;
          }

          if (status === "ready") {
            setUploadProcessingBySection((prev) => {
              const next = { ...prev };
              delete next[section];
              return next;
            });
            return;
          }

          if (status === "error") {
            setUploadProcessingBySection((prev) => ({
              ...prev,
              [section]: message || "Upload failed. Please try again.",
            }));
            return;
          }
        });

        socket.on("clear-data", onClearData);
        socket.on("clear-cache", onClearCache);
        socket.on("restart-app", () => safeRestartApp("manual restart command"));
        socket.on("install-app-update", async (payload) => {
          try {
            const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
            const apkUrl = String(payload?.apkUrl || "").trim();
            if (!apkUrl || !nativeDeviceModule?.installApkUpdate) {
              throw new Error("APK update not available");
            }
            const previousVersion = String(nativeDeviceModule?.getAppVersion?.() || "").trim();
            await AsyncStorage.setItem(
              APK_UPDATE_PENDING_KEY,
              JSON.stringify({
                apkUrl,
                previousVersion,
                requestedAt: Date.now(),
              })
            );
            await emitDeviceHealthSnapshot("install-app-update", {
              apkUrl,
              apkUpdate: {
                status: "installing",
                previousVersion,
                requestedAt: new Date().toISOString(),
              },
            });
            nativeDeviceModule.installApkUpdate(apkUrl);
          } catch (e) {
            emitDeviceError("install-app-update", String((e as any)?.message || e));
          }
        });
        socket.on("set-auto-reopen", (payload) => {
          try {
            const enabled = !!payload?.enabled;
            const { DeviceIdModule: NativeDeviceModule } = NativeModules;
            if (NativeDeviceModule?.setAutoReopenEnabled) {
              NativeDeviceModule.setAutoReopenEnabled(enabled);
              emitDeviceHealth("auto-reopen-updated", { enabled });
            }
          } catch (e) {
            emitDeviceError("auto-reopen", `Failed to update auto reopen: ${String((e as any)?.message || e)}`);
          }
        });
        socket.on("disconnect", (reason) => {
          setConnectTexts(
            `Connection lost (${String(reason)}). Continuing cached playback`,
            "Offline mode"
          );
          startReconnectLoop();
          startDisconnectRecovery(`disconnect:${String(reason)}`);
        });
        socket.on("connect_error", (err) => {
          checkAndRecoverNetwork();
          setConnectTexts(
            "Socket unavailable. Continuing cached playback",
            "Offline mode"
          );
          startReconnectLoop();
          emitDeviceError("connect-error", err?.message || "unknown");
          startDisconnectRecovery(`connect_error:${err?.message || "unknown"}`);
        });
      } catch (err) {
        console.log("Init error", err);
        if (socket?.connected) {
          socket.emit("device-error", {
            deviceId: deviceIdRef.current,
            type: "init",
            message: String((err as any)?.message || err),
          });
        }
        setConnectTexts("Startup failed unexpectedly", "Recovery mode");
        if (isMounted) setReady(false);
      } finally {
        initInProgress = false;
      }
    };

    init();
    (Immersive as any).on();
    startWatchdog();
    startNetworkRecoveryLoop();
    startSelfHealSyncLoop();
    startReconnectLoop();

    return () => {
      isMounted = false;
      clearDisconnectRecovery();
      stopWatchdog();
      stopNetworkRecoveryLoop();
      stopSelfHealSyncLoop();
      stopReconnectLoop();
      if (initRetryTimer) {
        clearTimeout(initRetryTimer);
        initRetryTimer = null;
      }
      if (mediaUpdateTimer) {
        clearTimeout(mediaUpdateTimer);
        mediaUpdateTimer = null;
      }
      if (healthTimer) {
        clearInterval(healthTimer);
        healthTimer = null;
      }
      if (socket) {
        socket.off("connect");
        socket.off("media-updated");
        socket.off("config-updated");
        socket.off("clear-data", onClearData);
        socket.off("clear-cache", onClearCache);
        socket.off("restart-app");
        socket.off("install-app-update");
        socket.off("set-auto-reopen");
        socket.off("section-upload-status");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.disconnect();
      }
    };
  }, [bootReady, licenseReady, licensed]);

  if (!bootReady) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.connectCard}>
          <Text style={styles.connectTitle}>Preparing Device</Text>
          <Text style={styles.connectSubtitle}>Clearing local data and restarting player...</Text>
        </View>
      </View>
    );
  }

  if (!licenseReady) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.connectCard}>
          <Text style={styles.connectTitle}>Checking License</Text>
          <Text style={styles.connectSubtitle}>Preparing device activation state...</Text>
        </View>
      </View>
    );
  }

  if (!licensed) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.licenseCard}>
          <Text style={styles.connectTitle}>Activate Device</Text>
          <Text style={styles.licenseHint}>Share Device ID and enter license key provided by admin.</Text>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>Device ID</Text>
            <Text selectable style={styles.licenseValue}>{licenseDeviceId || "unknown"}</Text>
          </View>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>License Key</Text>
            <TextInput
              value={licenseInput}
              onChangeText={setLicenseInput}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Enter key"
              placeholderTextColor="rgba(210,220,232,0.45)"
              style={styles.licenseInput}
            />
          </View>

          <Pressable
            onPress={onActivateLicense}
            disabled={licenseBusy}
            style={({ pressed }) => [
              styles.licenseBtn,
              pressed && !licenseBusy ? { opacity: 0.85 } : null,
              licenseBusy ? { opacity: 0.55 } : null,
            ]}
          >
            <Text style={styles.licenseBtnText}>
              {licenseBusy ? "Verifying..." : "Save And Activate"}
            </Text>
          </Pressable>

          <Text style={styles.licenseStatus}>{licenseStatus}</Text>
        </View>
      </View>
    );
  }

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

  const handlePlaybackChange = (payload: any) => {
    const section = Number(payload?.section || 0);
    if (!section) return;
    playbackBySectionRef.current = {
      ...playbackBySectionRef.current,
      [section]: {
        title: String(payload?.title || ""),
        sourceType: String(payload?.sourceType || ""),
        mediaType: String(payload?.mediaType || ""),
        page: Number(payload?.page || 0),
        cacheStatus: String(payload?.cacheStatus || ""),
        updatedAt: new Date().toISOString(),
      },
    };
    if (socket?.connected && lastMetaRef.current) {
      socket.emit("device-health", {
        deviceId: deviceIdRef.current,
        appState: "playback-change",
        meta: {
          ...lastMetaRef.current,
          currentPlaybackBySection: playbackBySectionRef.current,
        },
      });
    }
  };

  const handlePlaybackError = (payload: any) => {
    const message = String(payload?.message || "Playback error");
    const detailParts = [
      payload?.name ? `File: ${payload.name}` : "",
      payload?.mediaType ? `Type: ${payload.mediaType}` : "",
    ].filter(Boolean);
    const detail = detailParts.join(" · ");
    reportRuntimeError(message, detail, "player");
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
        <PlayerErrorBoundary onError={(error) => reportRuntimeError(String(error?.message || error), "", "boundary")}>
          <PlayerScreen
            config={safeConfig}
            mediaVersion={mediaVersion}
            uploadProcessingBySection={uploadProcessingBySection}
            onPlaybackChange={handlePlaybackChange}
            onPlaybackError={handlePlaybackError}
          />
        </PlayerErrorBoundary>
        <AdminButton onOpen={() => setShowAdmin(true)} />
        <AdminPanel visible={showAdmin} onClose={() => setShowAdmin(false)} />
      </View>
      {lastError ? (
        <View style={styles.errorToast}>
          <Text style={styles.errorToastTitle}>Error</Text>
          <Text style={styles.errorToastMsg}>{lastError.message}</Text>
          {lastError.detail ? (
            <Text style={styles.errorToastDetail}>{lastError.detail}</Text>
          ) : null}
        </View>
      ) : null}
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
  licenseCard: {
    width: "86%",
    maxWidth: 620,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(16, 20, 27, 0.93)",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  licenseHint: {
    marginTop: 8,
    marginBottom: 14,
    color: "rgba(216, 225, 236, 0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
  licenseRow: {
    marginTop: 10,
  },
  licenseLabel: {
    color: "#dff2ff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  licenseValue: {
    color: "#9de6d5",
    fontSize: 14,
    backgroundColor: "rgba(22,30,40,0.75)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  licenseInput: {
    color: "#f2fbff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(124, 190, 231, 0.45)",
    borderRadius: 10,
    backgroundColor: "rgba(14, 19, 27, 0.86)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    letterSpacing: 0.4,
  },
  licenseBtn: {
    marginTop: 18,
    backgroundColor: "#1d8fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  licenseBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  licenseStatus: {
    marginTop: 12,
    color: "rgba(206, 229, 245, 0.86)",
    fontSize: 13,
    lineHeight: 18,
  },
  errorToast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(120, 16, 26, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 140, 140, 0.45)",
  },
  errorToastTitle: {
    color: "#ffd9d9",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorToastMsg: {
    color: "#ffecec",
    fontSize: 13,
  },
  errorToastDetail: {
    color: "#f8caca",
    fontSize: 12,
    marginTop: 4,
  },
  errorBoundaryWrap: {
    flex: 1,
    backgroundColor: "#0b0f14",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorBoundaryTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBoundaryText: {
    color: "rgba(220, 230, 240, 0.9)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
});
