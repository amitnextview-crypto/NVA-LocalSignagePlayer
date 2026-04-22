import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY_STORAGE_KEY = "license_key_v1";
const LICENSE_DEVICE_STORAGE_KEY = "license_device_id_v1";
const LICENSE_GENERATOR_BASE_URLS = [
  "https://nva-signageplayertv-licences-fmza.vercel.app",
  "https://local-signage-player-tv-admin-user.vercel.app",
];
const LICENSE_TIMEOUT_MS = 12000;
const LICENSE_RETRY_COUNT = 3;
const LICENSE_RETRY_BACKOFF_MS = 900;

function normalizeKey(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function hasConfiguredGeneratorUrl() {
  return LICENSE_GENERATOR_BASE_URLS.some((url) => /^https?:\/\//i.test(String(url || "")));
}

function fetchWithTimeout(url: string, timeoutMs = LICENSE_TIMEOUT_MS): Promise<Response> {
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller?.abort();
      reject(new Error("license-timeout"));
    }, timeoutMs);

    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller?.signal,
    })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

function getLicenseGeneratorUrls(deviceId: string): string[] {
  const safeDeviceId = encodeURIComponent(String(deviceId || "").trim());
  return Array.from(
    new Set(
      LICENSE_GENERATOR_BASE_URLS
        .map((baseUrl) => String(baseUrl || "").trim().replace(/\/+$/, ""))
        .filter((baseUrl) => /^https?:\/\//i.test(baseUrl))
        .map((baseUrl) => `${baseUrl}/api/generate?deviceId=${safeDeviceId}`)
    )
  );
}

async function readLicenseKeyFromUrl(url: string): Promise<string | null> {
  const res = await fetchWithTimeout(url, LICENSE_TIMEOUT_MS);
  if (!res.ok) return null;
  const data = await res.json();
  const normalized = normalizeKey(String(data?.licenseKey || ""));
  return normalized || null;
}

async function getExpectedLicenseFromServer(deviceId: string): Promise<string | null> {
  if (!hasConfiguredGeneratorUrl()) return null;
  const urls = getLicenseGeneratorUrls(deviceId);
  let lastTimeoutError: Error | null = null;

  for (let attempt = 0; attempt < LICENSE_RETRY_COUNT; attempt += 1) {
    for (const url of urls) {
      try {
        const licenseKey = await readLicenseKeyFromUrl(url);
        if (licenseKey) return licenseKey;
      } catch (error: any) {
        if (String(error?.message || "").includes("license-timeout")) {
          lastTimeoutError = error;
        }
      }
    }

    if (attempt < LICENSE_RETRY_COUNT - 1) {
      await wait(LICENSE_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }

  if (lastTimeoutError) {
    throw lastTimeoutError;
  }
  return null;
}

export async function readStoredLicense() {
  const [deviceId, licenseKey] = await Promise.all([
    AsyncStorage.getItem(LICENSE_DEVICE_STORAGE_KEY),
    AsyncStorage.getItem(LICENSE_KEY_STORAGE_KEY),
  ]);
  return {
    deviceId: String(deviceId || ""),
    licenseKey: normalizeKey(String(licenseKey || "")),
  };
}

export async function saveLicense(deviceId: string, licenseKey: string) {
  await Promise.all([
    AsyncStorage.setItem(LICENSE_DEVICE_STORAGE_KEY, String(deviceId)),
    AsyncStorage.setItem(LICENSE_KEY_STORAGE_KEY, normalizeKey(licenseKey)),
  ]);
}

export async function hasLocalActivationForDevice(deviceId: string) {
  const stored = await readStoredLicense();
  return (
    stored.deviceId === String(deviceId || "") &&
    !!stored.licenseKey &&
    stored.licenseKey.length >= 8
  );
}

export async function activateDeviceWithKey(deviceId: string, enteredKey: string) {
  const normalizedDeviceId = String(deviceId || "").trim();
  const normalizedKey = normalizeKey(enteredKey);

  if (!normalizedDeviceId) {
    return { success: false, message: "Device ID not found." };
  }
  if (!normalizedKey) {
    return { success: false, message: "Please enter license key." };
  }
  if (!hasConfiguredGeneratorUrl()) {
    return {
      success: false,
      message:
        "License server URL not configured. Set LICENSE_GENERATOR_BASE_URLS in app.",
    };
  }

  try {
    const expectedKey = await getExpectedLicenseFromServer(normalizedDeviceId);
    if (!expectedKey) {
      return {
        success: false,
        message: "Unable to verify key. Check internet/license server.",
      };
    }
    if (expectedKey !== normalizedKey) {
      return { success: false, message: "Invalid license key." };
    }

    await saveLicense(normalizedDeviceId, normalizedKey);
    return { success: true, message: "Activation successful." };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Activation failed. Try again.",
    };
  }
}

