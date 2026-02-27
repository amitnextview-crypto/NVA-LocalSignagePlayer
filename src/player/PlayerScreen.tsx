import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import SlideRenderer from './SlideRenderer';
import Ticker from './Ticker';
import { Dimensions } from 'react-native';




export default function PlayerScreen({ config, mediaVersion }: any) {
  const [refreshKey, setRefreshKey] = useState(0);
// 🔥 Define a gap size
const GRID_GAP = 1; // pixels between sections

 
  const [server, setServer] = useState("");

  const tickerHeight = config?.ticker?.text
    ? (config.ticker.fontSize || 24) + 12
    : 0;


  const { width, height } = Dimensions.get("window");



return (
   <View  key={refreshKey} style={{ flex: 1, backgroundColor: config.bgColor }}>

   

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
     key={mediaVersion + "-0"}
  config={config}
  sectionIndex={0}
  mediaVersion={mediaVersion}
/>
  )}


{config.layout === 'grid2' && (
  <View style={{ flex: 1, flexDirection: 'row', gap: GRID_GAP }}>
    <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
      <SlideRenderer
       key={mediaVersion + "-1"}
        config={config}
        sectionIndex={0}
        mediaVersion={mediaVersion}
      />
    </View>

    <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
      <SlideRenderer
        key={mediaVersion + "-2"}
        config={config}
        sectionIndex={1}
        mediaVersion={mediaVersion}
      />
    </View>
  </View>
)}

{config.layout === 'grid3' && (
  <View style={{ flex: 1, flexDirection: 'row', gap: GRID_GAP }}>
    <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
      <SlideRenderer   key={mediaVersion + "-3"} sectionIndex={0} config={config} mediaVersion={mediaVersion} />
    </View>
    <View style={{ flex: 1, marginHorizontal: GRID_GAP / 2 }}>
      <SlideRenderer key={mediaVersion + "-4"} sectionIndex={1} config={config} mediaVersion={mediaVersion} />
    </View>
    <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
      <SlideRenderer key={mediaVersion + "-5"} sectionIndex={2} config={config} mediaVersion={mediaVersion} />
    </View>
  </View>
)}

</View>


      {/* 🔥 TICKER */}
      {config.ticker?.text && <Ticker ticker={config.ticker} />}

   
        </View>

  );
}