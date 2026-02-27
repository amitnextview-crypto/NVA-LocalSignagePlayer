
import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER = "";
const SERVER_KEY = "CMS_SERVER";

const FETCH_TIMEOUT = 800;

// fetch with timeout
function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    ),
  ]);
}

// Discover CMS: try cached first, then fallback, then manual input
export async function findCMS(): Promise<string> {
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

  return "";
}

// Get current server
export function getServer(): string {
  return SERVER;
}

// Save server manually (via AdminPanel input)
export async function setServer(url: string) {
  SERVER = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
}



