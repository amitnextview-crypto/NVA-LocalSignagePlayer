import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text } from "react-native";

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window");

  const translateX = useRef(new Animated.Value(width)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (!ticker?.text) return;

    if (!textWidth) return; // wait until width calculated

    const speed = ticker.speed ?? 6;

    const pixelsPerSecond = 40 + speed * 15;
    const distance = width + textWidth;
    const duration = (distance / pixelsPerSecond) * 1000;

    translateX.setValue(width);

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: duration,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();

  }, [ticker?.text, ticker?.speed, textWidth]);

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
        justifyContent: "center"
      }}
    >
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => {
          setTextWidth(e.nativeEvent.layout.width);
        }}
        style={{
          transform: [{ translateX }],
          color: ticker.color || "#fff",
          fontSize: ticker.fontSize || 24,
        }}
      >
        {ticker.text}
      </Animated.Text>
    </View>
  );
}