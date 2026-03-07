import React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  StyleProp,
  ViewStyle,
} from "react-native";

type NativeVideoErrorEvent = NativeSyntheticEvent<{ message?: string }>;

type Props = {
  src: string;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: "stretch" | "cover" | "contain";
  onEnd?: () => void;
  onReady?: () => void;
  onError?: (event: NativeVideoErrorEvent) => void;
};

const NativeVideoPlayerView = requireNativeComponent<Props>("NativeVideoPlayerView");

export default function NativeVideoPlayer(props: Props) {
  return <NativeVideoPlayerView {...props} />;
}
