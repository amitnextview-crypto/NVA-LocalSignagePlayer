import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text } from "react-native";

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window"); // ✅ inside component

  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (!ticker?.text || !textWidth) return;

    const speed = ticker.speed ?? 6;

    // pixels per second
    const pixelsPerSecond = 40 + speed * 15;

    // total distance to travel
    const distance = width + textWidth;

    const duration = (distance / pixelsPerSecond) * 1000;

    // start from right edge
    translateX.setValue(width);

    const animate = () => {
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: duration,
        useNativeDriver: true,
      }).start(() => {
        translateX.setValue(width);
        animate();
      });
    };

    animate();
  }, [ticker?.text, ticker?.speed, textWidth, width]);

  if (!ticker?.text) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [ticker.position === "top" ? "top" : "bottom"]: 0,
        backgroundColor: ticker.bgColor || "#000",
        overflow: "hidden",
        paddingVertical: 6,
      }}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          numberOfLines={1}
          onLayout={(e) => {
            setTextWidth(e.nativeEvent.layout.width);
          }}
          style={{
            color: ticker.color || "#fff",
            fontSize: ticker.fontSize || 24,
          }}
        >
          {ticker.text}
        </Text>
      </Animated.View>
    </View>
  );
}

