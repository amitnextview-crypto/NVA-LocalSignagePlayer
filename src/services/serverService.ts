import { NetworkInfo } from "react-native-network-info";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SERVER: string = "";
const SERVER_KEY = "CMS_SERVER";

const FETCH_TIMEOUT = 800; // timeout per request
const MAX_SCAN_TIME = 10000; // max 10 sec total

// fetch with timeout
function fetchWithTimeout(
  url: string,
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    ),
  ]);
}

export async function findCMS(): Promise<string> {
  console.log("Finding CMS...");

  // 1️⃣ try cached server first (fast)
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

  // 2️⃣ get device IP
  const ip = await NetworkInfo.getIPAddress();
  if (!ip) throw new Error("No IP found");

  const subnet = ip.split(".").slice(0, 3).join(".");
  console.log("Fast scanning network...");

  const requests: Promise<string | null>[] = [];

  // 3️⃣ scan whole subnet in parallel
  for (let i = 2; i < 255; i++) {
    const url = `http://${subnet}.${i}:8080/config`;

    requests.push(
      fetchWithTimeout(url)
        .then((res: Response) => {
          if (res.ok) {
            const serverUrl = `http://${subnet}.${i}:8080`;
            SERVER = serverUrl;
            AsyncStorage.setItem(SERVER_KEY, serverUrl);
            return serverUrl;
          }
          return null;
        })
        .catch(() => null)
    );
  }

  // 4️⃣ wait max 10 sec
  const timeoutPromise = new Promise<string | null>((resolve) =>
    setTimeout(() => resolve(null), MAX_SCAN_TIME)
  );

  const result = await Promise.race([
    Promise.any(requests),
    timeoutPromise,
  ]);

  if (result) {
    console.log("CMS found:", result);
    return result;
  }

  console.log("CMS not found in 10 sec — continuing offline");
  return "";
}

export function getServer(): string {
  return SERVER;
}
