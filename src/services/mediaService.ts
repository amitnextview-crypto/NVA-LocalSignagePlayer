import RNFS from "react-native-fs";
import { NativeModules } from "react-native";
import { getServer } from "./serverService";

const { DeviceIdModule } = NativeModules;

const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/media`;

async function cleanupLegacyLocalMedia() {
  try {
    if (await RNFS.exists(MEDIA_DIR)) {
      await RNFS.unlink(MEDIA_DIR);
    }
  } catch (e) {
    console.log("Legacy media cleanup failed", e);
  }
}

export async function syncMedia() {
  try {
    const server = getServer();
    if (!server) return false;

    // Keep app in stream mode: no local media persistence.
    await cleanupLegacyLocalMedia();

    const deviceId = await DeviceIdModule.getDeviceId();
    await fetch(
      `${server}/media-list?deviceId=${deviceId}&ts=${Date.now()}`
    );

    return true;
  } catch (e) {
    console.log("Media sync failed", e);
    return false;
  }
}

export async function getMediaFiles(sectionIndex = 0) {
  const server = getServer();
  if (!server) return [];

  const deviceId = await DeviceIdModule.getDeviceId();
  const res = await fetch(
    `${server}/media-list?deviceId=${deviceId}&ts=${Date.now()}`
  );
  const list = await res.json();

  const filtered = list.filter(
    (file: any) => file.section === sectionIndex + 1
  );

  return filtered.map((file: any) => ({
    ...file,
    remoteUrl: server + file.url,
  }));
}
