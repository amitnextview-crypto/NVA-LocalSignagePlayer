import { NetworkInfo } from "react-native-network-info";

let SERVER = "";

/*
Find CMS automatically in same WiFi network
Example: 192.168.1.xxx:8080
*/
export async function findCMS(): Promise<string> {
  const ip = await NetworkInfo.getIPAddress();

  if (!ip) throw new Error("No IP found");

  const subnet = ip.split(".").slice(0, 3).join(".");

  for (let i = 2; i < 255; i++) {
    const url = `http://${subnet}.${i}:8080`;

    try {
      const res = await fetch(url + "/config");
      if (res.ok) {
        SERVER = url;
        return url;
      }
    } catch {}
  }

  throw new Error("CMS not found");
}

export function getServer() {
  return SERVER;
}
