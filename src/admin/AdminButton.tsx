import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AdminButton({ onOpen }: any) {
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        padding: 10, // easier to click
        backgroundColor: "rgba(0,0,0,0.5)", // transparent background
        borderRadius: 20,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          color: "rgba(255,255,255,0.7)", // white + transparent
          fontWeight: "bold",
        }}
      >
        ⚙
      </Text>
    </TouchableOpacity>
  );
}
