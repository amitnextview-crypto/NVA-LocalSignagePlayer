import React, { useEffect, useState } from "react";
import { View, Dimensions, Text } from "react-native";
import Immersive from "react-native-immersive";

import PlayerScreen from "../player/PlayerScreen";
import AdminButton from "../admin/AdminButton";
import AdminPanel from "../admin/AdminPanel";

import { findCMS } from "../services/serverService";
import { loadConfig } from "../services/configService";

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    async function init() {
      try {
        // try connect CMS (max 10 sec)
        await findCMS();

        // try load config (may fail if CMS offline)
        try {
          await loadConfig(setConfig);
        } catch {
          console.log("Starting without CMS");
        }

        setReady(true);
      } catch {
        console.log("CMS not found — starting offline");
        setReady(true);
      }
    }

    init();
    (Immersive as any).on();
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

  const isVertical = safeConfig.orientation === "vertical";
  const rotatedWidth = isVertical ? height : width;
  const rotatedHeight = isVertical ? width : height;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={{
          position: "absolute",
          width: rotatedWidth,
          height: rotatedHeight,
          top: isVertical ? (height - rotatedHeight) / 2 : 0,
          left: isVertical ? (width - rotatedWidth) / 2 : 0,
          transform: isVertical ? [{ rotate: "90deg" }] : [],
        }}
      >
        <PlayerScreen />
        <AdminButton onOpen={() => setShowAdmin(true)} />
        <AdminPanel
          visible={showAdmin}
          onClose={() => setShowAdmin(false)}
        />
      </View>
    </View>
  );
}
