import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";

/*
Find CMS automatically in same WiFi network
BUT cache result so next launch is instant
*/
export async function findCMS(): Promise<string> {

  // ✅ try cached server first
  const saved = await AsyncStorage.getItem(SERVER_KEY);

  if (saved) {
    try {
      const res = await fetch(saved + "/config");
      if (res.ok) {
        SERVER = saved;
        return saved;
      }
    } catch {}
  }

  console.log("Scanning network for CMS...");

  const ip = await NetworkInfo.getIPAddress();
  if (!ip) throw new Error("No IP found");

  const subnet = ip.split(".").slice(0, 3).join(".");

  for (let i = 2; i < 255; i++) {
    const url = `http://${subnet}.${i}:8080`;

    try {
      const res = await fetch(url + "/config");
      if (res.ok) {
        SERVER = url;

        // ⭐ SAVE FOR NEXT TIME
        await AsyncStorage.setItem(SERVER_KEY, url);

        console.log("CMS found:", url);
        return url;
      }
    } catch {}
  }

  throw new Error("CMS not found");
}

export function getServer() {
  return SERVER;
}
