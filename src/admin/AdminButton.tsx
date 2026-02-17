import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AdminButton({ onOpen, onClose }: any) {
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        opacity: 0.3,
         cursor: "pointer" 
      }}
    >
      <Text>⚙</Text>
    </TouchableOpacity>
  );
}
