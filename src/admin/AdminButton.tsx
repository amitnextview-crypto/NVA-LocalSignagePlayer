import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AdminButton({ onOpen }: any) {
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        position: "absolute",
        top: 4,
        right: 12,
        padding: 4,
        backgroundColor: "rgba(8,12,18,0.55)",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.72)",
          fontWeight: "700",
        }}
      >
        {"\u2699"}
      </Text>
    </TouchableOpacity>
  );
}
