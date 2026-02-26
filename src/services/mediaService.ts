import RNFS from "react-native-fs";
import { getServer } from "./serverService";
import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules;

const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/media`;

export async function syncMedia() {
  try {
    const SERVER = getServer();
    if (!SERVER) return false;

    const DEVICE_ID = await DeviceIdModule.getDeviceId();

const res = await fetch(
  `${SERVER}/media-list?deviceId=${DEVICE_ID}`
);
    const serverFiles = await res.json();

    const exists = await RNFS.exists(MEDIA_DIR);
    if (!exists) await RNFS.mkdir(MEDIA_DIR);

    const localFiles = await RNFS.readDir(MEDIA_DIR);

    // remove deleted files
    for (const local of localFiles) {
      const stillExists = serverFiles.find((s: any) => s.name === local.name);
      if (!stillExists) await RNFS.unlink(local.path);
    }

    // download new files
    for (const file of serverFiles) {
     const sectionDir = `${MEDIA_DIR}/section${file.section}`;
const existsDir = await RNFS.exists(sectionDir);
if (!existsDir) await RNFS.mkdir(sectionDir);

const localPath = `${sectionDir}/${file.name}`;
      const exists = await RNFS.exists(localPath);

      if (!exists) {
        await RNFS.downloadFile({
          fromUrl: SERVER + file.url,
          toFile: localPath,
        }).promise;
      }
    }

    return true;
  } catch (e) {
    console.log("Media sync failed", e);
    return false;
  }
}

export async function getMediaFiles(sectionIndex = 0) {
  const SERVER = getServer();
  if (!SERVER) return [];

  const DEVICE_ID = await DeviceIdModule.getDeviceId();

const res = await fetch(
  `${SERVER}/media-list?deviceId=${DEVICE_ID}`
);

const list = await res.json();

const filtered = list.filter(
  (file: any) => file.section === sectionIndex + 1
);
  return filtered.map((file: any) => ({
    ...file,
   localPath: `${MEDIA_DIR}/section${file.section}/${file.name}`,
  }));
}