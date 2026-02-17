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
        await findCMS();
        await loadConfig(setConfig);
        setReady(true);
      } catch {
        console.log("CMS not found");
      }
    }

    init();
    (Immersive as any).on();
  }, []);

 if (!ready || !config) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Text style={{ color: "white", fontSize: 22 }}>
        Connecting to CMS...
      </Text>
    </View>
  );
}


  const { width, height } = Dimensions.get("window");

  const isVertical = config.orientation === "vertical";

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
