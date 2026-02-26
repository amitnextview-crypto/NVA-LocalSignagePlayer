import { writeConfig } from "../utils/fileSystem";
import { getServer } from "./serverService";
import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules;

export async function loadConfig(setConfig: Function) {
  try {
    const SERVER = getServer();
    if (!SERVER) return;

    const DEVICE_ID = await DeviceIdModule.getDeviceId();

    const res = await fetch(
      `${SERVER}/config?deviceId=${DEVICE_ID}`
    );

    const config = await res.json();

    await writeConfig(config);
    setConfig(config);

  } catch (e) {
    console.log("Server config failed", e);
  }
}