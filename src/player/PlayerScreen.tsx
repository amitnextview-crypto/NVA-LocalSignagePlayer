import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import SlideRenderer from './SlideRenderer';
import Ticker from './Ticker';
import { loadConfig } from '../services/configService';
import { syncMedia } from '../services/mediaService';
import { io, Socket } from 'socket.io-client';
import { Dimensions } from 'react-native';
import { getServer } from "../services/serverService";

let socket: Socket | null = null;

export default function PlayerScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
// 🔥 Define a gap size
const GRID_GAP = 1; // pixels between sections

 const [config, setConfig] = useState<any>(null);
  const [server, setServer] = useState("");

  useEffect(():any => {
  async function init() {
  try {
    const url = getServer();

    if (!url) {
      console.log("Server not ready");
      return;
    }

    setServer(url);

    // ⭐ LOAD CONFIG FIRST
    await loadConfig(setConfig);
    await syncMedia();

    socket = io(url);

    socket.on("connect", () => {
      console.log("✅ Connected to CMS");
    });

    socket.on("media-updated", async () => {
      await syncMedia();
      await loadConfig(setConfig);
      setRefreshKey(prev => prev + 1);
    });

  } catch (e) {
    console.log("Init error", e);
  }
}

    init();

    return () => socket?.disconnect();
  }, []);

  if (!config) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // 🔥 Calculate ticker height
  const tickerHeight = config?.ticker?.text
    ? (config.ticker.fontSize || 24) + 12
    : 0;


  const { width, height } = Dimensions.get("window");



return (
   <View style={{ flex: 1, backgroundColor: config.bgColor }}>

   

      {/* 🔥 MEDIA AREA (space reserved for ticker) */}
       <View
        style={{
          flex: 1,
          flexDirection: config.layout === 'fullscreen' ? 'column' : 'row',
          marginTop: config.ticker?.position === 'top' ? tickerHeight : 0,
          marginBottom: config.ticker?.position === 'bottom' ? tickerHeight : 0,
        }}
      >
  {config.layout === 'fullscreen' && (
    <SlideRenderer
  key={refreshKey}
  config={config}
  sectionIndex={0}
/>
  )}


{config.layout === 'grid2' && (
  <View style={{ flex: 1, flexDirection: 'row', gap: GRID_GAP }}>
    <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
      <SlideRenderer
        key={refreshKey + '-1'}
        config={config}
        sectionIndex={0}
      />
    </View>

    <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
      <SlideRenderer
        key={refreshKey + '-2'}
        config={config}
        sectionIndex={1}
      />
    </View>
  </View>
)}

{config.layout === 'grid3' && (
  <View style={{ flex: 1, flexDirection: 'row', gap: GRID_GAP }}>
    <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
      <SlideRenderer sectionIndex={0} config={config} />
    </View>
    <View style={{ flex: 1, marginHorizontal: GRID_GAP / 2 }}>
      <SlideRenderer sectionIndex={1} config={config} />
    </View>
    <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
      <SlideRenderer sectionIndex={2} config={config} />
    </View>
  </View>
)}

</View>


      {/* 🔥 TICKER */}
      {config.ticker?.text && <Ticker ticker={config.ticker} />}

    
        </View>

  );
}

