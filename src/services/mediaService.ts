import RNFS from "react-native-fs";
import { getServer } from "./serverService";

const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/media`;

export async function syncMedia() {
  try {
    const SERVER =  getServer();

    const res = await fetch(`${SERVER}/media-list`);
    const serverFiles = await res.json();

    const exists = await RNFS.exists(MEDIA_DIR);
    if (!exists) await RNFS.mkdir(MEDIA_DIR);

    const localFiles = await RNFS.readDir(MEDIA_DIR);

    for (const local of localFiles) {
      const stillExists = serverFiles.find((s: any) => s.name === local.name);
      if (!stillExists) await RNFS.unlink(local.path);
    }

    for (const file of serverFiles) {
      const localPath = `${MEDIA_DIR}/${file.name}`;
      const exists = await RNFS.exists(localPath);

      if (!exists) {
        await RNFS.downloadFile({
          fromUrl: SERVER + file.url,
          toFile: localPath
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
  const SERVER =  getServer();
  const res = await fetch(`${SERVER}/media-list/section${sectionIndex + 1}`);
  return await res.json();
}
