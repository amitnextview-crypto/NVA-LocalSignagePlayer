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

    if (!(await RNFS.exists(MEDIA_DIR))) {
      await RNFS.mkdir(MEDIA_DIR);
    }

    // 🔥 LOOP EACH SECTION
    for (let i = 1; i <= 3; i++) {
      const sectionDir = `${MEDIA_DIR}/section${i}`;

      if (!(await RNFS.exists(sectionDir))) {
        await RNFS.mkdir(sectionDir);
      }

      const localFiles = await RNFS.readDir(sectionDir);

      const serverSectionFiles = serverFiles.filter(
        (f: any) => f.section === i
      );

      // 🔥 DELETE removed files
      for (const local of localFiles) {
        const stillExists = serverSectionFiles.find(
          (s: any) => s.name === local.name
        );

        if (!stillExists) {
          await RNFS.unlink(local.path);
        }
      }

      // 🔥 DOWNLOAD new files
      for (const file of serverSectionFiles) {
        const localPath = `${sectionDir}/${file.name}`;

        if (!(await RNFS.exists(localPath))) {
          await RNFS.downloadFile({
            fromUrl: SERVER + file.url,
            toFile: localPath,
          }).promise;
        }
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



