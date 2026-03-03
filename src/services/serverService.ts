import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";
const FETCH_TIMEOUT = 400;

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    ),
  ]);
}

export async function findCMS(): Promise<string> {

  // 🔥 1. Try saved server first
  const saved = await AsyncStorage.getItem(SERVER_KEY);

  if (saved) {
    try {
      const res = await fetchWithTimeout(saved + "/config");
      if (res.ok) {
        SERVER = saved;
        return saved;
      }
    } catch {}
  }

  // 🔥 2. Auto scan local network
  try {
   const gateway = await NetworkInfo.getGatewayIPAddress();

if (!gateway) {
  console.log("Gateway not found");
  return "";
}

const lastDot = gateway.lastIndexOf(".");
if (lastDot === -1) {
  console.log("Invalid gateway format");
  return "";
}

const base = gateway.substring(0, lastDot);

    for (let i = 1; i < 255; i++) {
      const testUrl = `http://${base}.${i}:8080`;

      try {
        const res = await fetchWithTimeout(testUrl + "/config");
        if (res.ok) {
          SERVER = testUrl;
          await AsyncStorage.setItem(SERVER_KEY, testUrl);
          return testUrl;
        }
      } catch {}
    }
  } catch (e) {
    console.log("Network scan failed", e);
  }

  return "";
}

export function getServer(): string {
  return SERVER;
}

export async function setServer(url: string) {
  SERVER = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
}







