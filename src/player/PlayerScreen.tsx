import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import Video from "react-native-video";
import SlideRenderer from "./SlideRenderer";
import Ticker from "./Ticker";

const GRID_GAP = 1;

function getOrientationRotation(orientation: string) {
  if (orientation === "vertical") return "90deg";
  if (orientation === "reverse-vertical") return "-90deg";
  if (orientation === "reverse-horizontal") return "180deg";
  return "0deg";
}

function parseRatio(value: any, count: number): number[] {
  const parts = String(value || "")
    .split(":")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== count) return count === 3 ? [1, 1, 1] : [1, 1];
  return parts;
}

function parseTimeToMinutes(value: string): number | null {
  const [hStr, mStr] = String(value || "").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isScheduleActive(schedule: any): boolean {
  if (!schedule?.enabled) return true;

  const now = new Date();
  const day = now.getDay();
  const days = Array.isArray(schedule.days) && schedule.days.length
    ? schedule.days.map((d: any) => Number(d)).filter((d: number) => Number.isFinite(d))
    : [0, 1, 2, 3, 4, 5, 6];

  if (!days.includes(day)) return false;

  const start = parseTimeToMinutes(schedule.start || "00:00");
  const end = parseTimeToMinutes(schedule.end || "23:59");
  if (start == null || end == null) return true;
  if (start === end) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return nowMinutes >= start || nowMinutes < end;
}

export default function PlayerScreen({ config, mediaVersion }: any) {
  const [scheduleOn, setScheduleOn] = useState(true);
  const tickerHeight = config?.ticker?.text
    ? (config.ticker.fontSize || 24) + 12
    : 0;
  const grid3Layout = config?.grid3Layout || "stack-v";
  const gridRatio = config?.gridRatio || "1:1:1";
  const mediaRotation = getOrientationRotation(config?.orientation || "horizontal");

  useEffect(() => {
    const evalSchedule = () => setScheduleOn(isScheduleActive(config?.schedule));
    evalSchedule();
    const timer = setInterval(evalSchedule, 30000);
    return () => clearInterval(timer);
  }, [config?.schedule]);

  const renderGrid3 = () => {
    if (grid3Layout === "stack-h") {
      const [a, b, c] = parseRatio(gridRatio, 3);
      return (
        <View style={{ flex: 1, flexDirection: "row", gap: GRID_GAP }}>
          <View style={{ flex: a, marginRight: GRID_GAP / 2 }}>
            <SlideRenderer key={mediaVersion + "-3"} sectionIndex={0} config={config} mediaVersion={mediaVersion} />
          </View>
          <View style={{ flex: b, marginHorizontal: GRID_GAP / 2 }}>
            <SlideRenderer key={mediaVersion + "-4"} sectionIndex={1} config={config} mediaVersion={mediaVersion} />
          </View>
          <View style={{ flex: c, marginLeft: GRID_GAP / 2 }}>
            <SlideRenderer key={mediaVersion + "-5"} sectionIndex={2} config={config} mediaVersion={mediaVersion} />
          </View>
        </View>
      );
    }

    if (grid3Layout === "top-two-bottom-one") {
      const [top, bottom] = parseRatio(gridRatio, 2);
      return (
        <View style={{ flex: 1, gap: GRID_GAP }}>
          <View style={{ flex: top, flexDirection: "row", gap: GRID_GAP }}>
            <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
              <SlideRenderer key={mediaVersion + "-3"} sectionIndex={0} config={config} mediaVersion={mediaVersion} />
            </View>
            <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
              <SlideRenderer key={mediaVersion + "-4"} sectionIndex={1} config={config} mediaVersion={mediaVersion} />
            </View>
          </View>
          <View style={{ flex: bottom }}>
            <SlideRenderer key={mediaVersion + "-5"} sectionIndex={2} config={config} mediaVersion={mediaVersion} />
          </View>
        </View>
      );
    }

    if (grid3Layout === "top-one-bottom-two") {
      const [top, bottom] = parseRatio(gridRatio, 2);
      return (
        <View style={{ flex: 1, gap: GRID_GAP }}>
          <View style={{ flex: top }}>
            <SlideRenderer key={mediaVersion + "-3"} sectionIndex={0} config={config} mediaVersion={mediaVersion} />
          </View>
          <View style={{ flex: bottom, flexDirection: "row", gap: GRID_GAP }}>
            <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
              <SlideRenderer key={mediaVersion + "-4"} sectionIndex={1} config={config} mediaVersion={mediaVersion} />
            </View>
            <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
              <SlideRenderer key={mediaVersion + "-5"} sectionIndex={2} config={config} mediaVersion={mediaVersion} />
            </View>
          </View>
        </View>
      );
    }

    const [a, b, c] = parseRatio(gridRatio, 3);
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: a, marginBottom: GRID_GAP / 2 }}>
          <SlideRenderer key={mediaVersion + "-3"} sectionIndex={0} config={config} mediaVersion={mediaVersion} />
        </View>
        <View style={{ flex: b, marginVertical: GRID_GAP / 2 }}>
          <SlideRenderer key={mediaVersion + "-4"} sectionIndex={1} config={config} mediaVersion={mediaVersion} />
        </View>
        <View style={{ flex: c, marginTop: GRID_GAP / 2 }}>
          <SlideRenderer key={mediaVersion + "-5"} sectionIndex={2} config={config} mediaVersion={mediaVersion} />
        </View>
      </View>
    );
  };

  const renderGrid2 = () => {
    const [left, right] = parseRatio(gridRatio, 2);
    return (
      <View style={{ flex: 1, flexDirection: "row", gap: GRID_GAP }}>
        <View style={{ flex: left, marginRight: GRID_GAP / 2 }}>
          <SlideRenderer key={mediaVersion + "-1"} config={config} sectionIndex={0} mediaVersion={mediaVersion} />
        </View>
        <View style={{ flex: right, marginLeft: GRID_GAP / 2 }}>
          <SlideRenderer key={mediaVersion + "-2"} config={config} sectionIndex={1} mediaVersion={mediaVersion} />
        </View>
      </View>
    );
  };

  if (!scheduleOn) {
    const fallbackMode = config?.schedule?.fallbackMode || "black";
    const fallbackBgColor = config?.schedule?.fallbackBgColor || "#000000";
    const fallbackMediaUrl = config?.schedule?.fallbackImageUrl || "";
    const isFallbackVideo = /\.(mp4|mkv|webm)(\?.*)?$/i.test(fallbackMediaUrl);

    if (fallbackMode === "image" && fallbackMediaUrl) {
      if (isFallbackVideo) {
        return (
          <View style={{ flex: 1, backgroundColor: fallbackBgColor }}>
            <Video
              source={{ uri: fallbackMediaUrl }}
              style={[
                { width: "100%", height: "100%" },
                mediaRotation !== "0deg" ? { transform: [{ rotate: mediaRotation }] } : null,
              ]}
              resizeMode="cover"
              repeat
              muted
              playInBackground={false}
              ignoreSilentSwitch="ignore"
            />
          </View>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: fallbackBgColor }}>
          <Image
            source={{ uri: fallbackMediaUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
      );
    }

    if (fallbackMode === "message") {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: fallbackBgColor,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 30,
          }}
        >
          <Text
            style={{
              color: config?.schedule?.fallbackTextColor || "#ffffff",
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {config?.schedule?.fallbackMessage || "Playback is currently scheduled off."}
          </Text>
        </View>
      );
    }

    return <View style={{ flex: 1, backgroundColor: fallbackBgColor }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: config.bgColor }}>
      <View
        style={{
          flex: 1,
          flexDirection: config.layout === "fullscreen" ? "column" : "row",
          marginTop: config.ticker?.position === "top" ? tickerHeight : 0,
          marginBottom: config.ticker?.position === "bottom" ? tickerHeight : 0,
        }}
      >
        {config.layout === "fullscreen" && (
          <SlideRenderer key={mediaVersion + "-0"} config={config} sectionIndex={0} mediaVersion={mediaVersion} />
        )}
        {config.layout === "grid2" && renderGrid2()}
        {config.layout === "grid3" && renderGrid3()}
      </View>
      {config.ticker?.text && <Ticker ticker={config.ticker} />}
    </View>
  );
}
