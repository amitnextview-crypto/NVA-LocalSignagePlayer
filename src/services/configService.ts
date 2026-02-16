import { writeConfig } from "../utils/fileSystem";
import { getServer } from "./serverService";

export async function loadConfig(setConfig: Function) {
  try {
    const SERVER =  getServer();

    const res = await fetch(`${SERVER}/config`);
    const config = await res.json();

    await writeConfig(config);
    setConfig(config);

  } catch (e) {
    console.log("Server config failed", e);
  }
}


