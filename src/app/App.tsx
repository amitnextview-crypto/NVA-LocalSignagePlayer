import React, { useEffect, useState } from "react";
import { View, Dimensions, Text } from "react-native";
import Immersive from "react-native-immersive";
import PlayerScreen from "../player/PlayerScreen";
import AdminButton from "../admin/AdminButton";
import AdminPanel from "../admin/AdminPanel";
import { findCMS } from "../services/serverService";
import { loadConfig } from "../services/configService";
import { io } from "socket.io-client";
import { getServer } from "../services/serverService";
import { useWindowDimensions } from "react-native";
import Ticker from "../player/Ticker";
let socket: any = null;

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<any>(null);

useEffect(() => {
  async function init() {
    try {
      const url = await findCMS();
      if (!url) {
        console.log("No CMS found");
        setReady(true);
        return;
      }

      socket = io(url, { transports: ["websocket"] });

      socket.on("connect", async () => {
        console.log("Connected to CMS");
        await loadConfig(setConfig);
      });

      socket.on("media-updated", async () => {
        console.log("Media updated");
        await loadConfig(setConfig);
      });

      setReady(true);
    } catch (err) {
      console.log("CMS error", err);
      setReady(true);
    }
  }

  init();
  (Immersive as any).on();

  return () => socket?.disconnect();
}, []);
  // show loading while connecting
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 22 }}>
          Connecting to CMS...
        </Text>
      </View>
    );
  }

  // fallback config if CMS not available
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
      <PlayerScreen config={safeConfig} />
      <AdminButton onOpen={() => setShowAdmin(true)} />
      <AdminPanel
        visible={showAdmin}
        onClose={() => setShowAdmin(false)}
      />
    </View>
  </View>
);
}