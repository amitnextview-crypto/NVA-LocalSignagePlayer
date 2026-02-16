import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Dimensions, Text } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function Ticker({ ticker }: any) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (!ticker?.text || !textWidth) return;

    // 🔥 Speed 0–12 (pixels per second multiplier)
    const speed = ticker.speed ?? 6;

    // Convert to pixels per second
    const pixelsPerSecond = 40 + (speed * 15);

    // Total distance to travel
    const distance = screenWidth + textWidth;

    // Duration based on distance / speed
    const duration = (distance / pixelsPerSecond) * 1000;

    translateX.setValue(screenWidth);

    const animate = () => {
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: duration,
        useNativeDriver: true,
      }).start(() => {
        // Instantly reset to right side
        translateX.setValue(screenWidth);
        animate(); // loop manually (no acceleration)
      });
    };

    animate();

  }, [ticker?.text, ticker?.speed, textWidth]);

  if (!ticker?.text) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [ticker.position === 'top' ? 'top' : 'bottom']: 0,
        backgroundColor: ticker.bgColor || '#000',
        overflow: 'hidden',
        paddingVertical: 6
      }}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          numberOfLines={1}
          onLayout={(e) => {
            setTextWidth(e.nativeEvent.layout.width);
          }}
          style={{
            color: ticker.color || '#fff',
            fontSize: ticker.fontSize || 24,
          }}
        >
          {ticker.text}
        </Text>
      </Animated.View>
    </View>
  );
}
