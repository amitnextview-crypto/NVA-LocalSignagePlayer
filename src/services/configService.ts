import { writeConfig } from "../utils/fileSystem";
import { getServer } from "./serverService";
import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules;

export async function loadConfig(setConfig: Function) {
  try {
    const server = getServer();
    if (!server) return;

    const deviceId = await DeviceIdModule.getDeviceId();

    const res = await fetch(
      `${server}/config?deviceId=${deviceId}&ts=${Date.now()}`,
      {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    const config = await res.json();

    await writeConfig(config);
    setConfig(config);

  } catch (e) {
    console.log("Server config failed", e);
  }
}
