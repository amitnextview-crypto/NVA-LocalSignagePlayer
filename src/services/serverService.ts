
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
  console.log("Finding CMS...");

  // try cached CMS
  const saved = await AsyncStorage.getItem(SERVER_KEY);
  if (saved) {
    try {
      const res = await fetchWithTimeout(saved + "/config");
      if (res.ok) {
        SERVER = saved;
        console.log("Using cached CMS:", saved);
        return saved;
      }
    } catch {}
  }

  // try fallback IP (your PC LAN IP)
  const baseUrl = "http://172.19.88.107:8080"; // replace with your static PC IP
  try {
    const res = await fetchWithTimeout(baseUrl + "/config");
    if (res.ok) {
      SERVER = baseUrl;
      await AsyncStorage.setItem(SERVER_KEY, baseUrl);
      console.log("CMS found at fallback IP:", baseUrl);
      return baseUrl;
    }
  } catch {}

  console.log("CMS not found — please enter manually in AdminPanel");
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