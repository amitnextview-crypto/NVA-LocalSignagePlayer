import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AdminButton({ onOpen }: any) {
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        padding: 2,
        backgroundColor: "rgba(10, 18, 26, 0.28)",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(120, 200, 255, 0.15)",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 7,
          color: "rgba(233, 246, 255, 0.85)",
          fontWeight: "800",
        }}
      >
        {"\u2699"}
      </Text>
    </TouchableOpacity>
  );
}
