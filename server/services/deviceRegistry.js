"use strict";

const fs = require("fs");
const path = require("path");

const SAFE_DEVICE_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_GROUP_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function getBasePath() {
  return process.pkg
    ? global.runtimeBasePath || path.dirname(process.execPath)
    : path.join(__dirname, "..");
}

function getDataDir() {
  const dir = path.join(getBasePath(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getProfilesPath() {
  return path.join(getDataDir(), "device-profiles.json");
}

function getGroupsPath() {
  return path.join(getDataDir(), "device-groups.json");
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = String(fs.readFileSync(filePath, "utf8") || "").trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeDeviceId(value) {
  const id = String(value || "").trim();
  if (!SAFE_DEVICE_RE.test(id)) return "";
  return id;
}

function sanitizeGroupId(value) {
  const id = String(value || "").trim();
  if (!SAFE_GROUP_RE.test(id)) return "";
  return id;
}

function normalizeName(value, fallback = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60) || fallback;
}

function decodeTargetValue(value) {
  let current = String(value || "").trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function slugifyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function readProfiles() {
  return readJson(getProfilesPath(), {});
}

function writeProfiles(profiles) {
  writeJson(getProfilesPath(), profiles);
}

function readGroups() {
  return readJson(getGroupsPath(), {});
}

function writeGroups(groups) {
  writeJson(getGroupsPath(), groups);
}

function ensureProfile(deviceId) {
  const safeDeviceId = sanitizeDeviceId(deviceId);
  if (!safeDeviceId) return null;
  const profiles = readProfiles();
  const current = profiles[safeDeviceId] || {
    deviceId: safeDeviceId,
    customName: "",
    updatedAt: nowIso(),
  };
  profiles[safeDeviceId] = {
    deviceId: safeDeviceId,
    customName: normalizeName(current.customName, ""),
    updatedAt: current.updatedAt || nowIso(),
  };
  writeProfiles(profiles);
  return profiles[safeDeviceId];
}

function renameDevice(deviceId, customName) {
  const safeDeviceId = sanitizeDeviceId(deviceId);
  if (!safeDeviceId) return null;
  const profiles = readProfiles();
  profiles[safeDeviceId] = {
    ...(profiles[safeDeviceId] || { deviceId: safeDeviceId }),
    deviceId: safeDeviceId,
    customName: normalizeName(customName, ""),
    updatedAt: nowIso(),
  };
  writeProfiles(profiles);
  return profiles[safeDeviceId];
}

function buildUniqueGroupId(baseId, groups) {
  const seen = new Set(Object.keys(groups || {}));
  let candidate = sanitizeGroupId(baseId) || `group-${Date.now()}`;
  if (!seen.has(candidate)) return candidate;
  let index = 2;
  while (seen.has(`${candidate}-${index}`)) {
    index += 1;
  }
  return `${candidate}-${index}`;
}

function createGroup(name) {
  const groups = readGroups();
  const safeName = normalizeName(name, "New Group");
  const baseId = slugifyName(safeName) || `group-${Date.now()}`;
  const id = buildUniqueGroupId(baseId, groups);
  groups[id] = {
    id,
    name: safeName,
    deviceIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeGroups(groups);
  return groups[id];
}

function updateGroup(groupId, patch = {}) {
  const safeGroupId = sanitizeGroupId(groupId);
  if (!safeGroupId) return null;
  const groups = readGroups();
  const current = groups[safeGroupId];
  if (!current) return null;
  const nextDeviceIds = Array.isArray(patch.deviceIds)
    ? Array.from(
        new Set(
          patch.deviceIds
            .map((item) => sanitizeDeviceId(item))
            .filter(Boolean)
        )
      )
    : current.deviceIds || [];
  groups[safeGroupId] = {
    ...current,
    name: normalizeName(patch.name, current.name || safeGroupId),
    deviceIds: nextDeviceIds,
    updatedAt: nowIso(),
  };
  writeGroups(groups);
  return groups[safeGroupId];
}

function deleteGroup(groupId) {
  const safeGroupId = sanitizeGroupId(groupId);
  if (!safeGroupId) return false;
  const groups = readGroups();
  if (!groups[safeGroupId]) return false;
  delete groups[safeGroupId];
  writeGroups(groups);
  return true;
}

function listGroups() {
  return Object.values(readGroups())
    .map((item) => ({
      id: sanitizeGroupId(item.id),
      name: normalizeName(item.name, item.id),
      deviceIds: Array.from(
        new Set((Array.isArray(item.deviceIds) ? item.deviceIds : []).map((id) => sanitizeDeviceId(id)).filter(Boolean))
      ),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    }))
    .filter((item) => item.id)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getGroup(groupId) {
  const safeGroupId = sanitizeGroupId(groupId);
  if (!safeGroupId) return null;
  return listGroups().find((item) => item.id === safeGroupId) || null;
}

function getGroupsForDevice(deviceId) {
  const safeDeviceId = sanitizeDeviceId(deviceId);
  if (!safeDeviceId) return [];
  return listGroups().filter((group) => group.deviceIds.includes(safeDeviceId));
}

function listDevicesWithProfiles(deviceStatus = {}, connectedDevices = {}) {
  const profiles = readProfiles();
  const groups = listGroups();
  const knownIds = new Set([
    ...Object.keys(deviceStatus || {}),
    ...Object.keys(connectedDevices || {}),
    ...Object.keys(profiles || {}),
    ...groups.flatMap((group) => group.deviceIds || []),
  ]);

  return Array.from(knownIds)
    .map((deviceId) => {
      const safeDeviceId = sanitizeDeviceId(deviceId);
      if (!safeDeviceId) return null;
      const profile = profiles[safeDeviceId] || { deviceId: safeDeviceId, customName: "" };
      const membership = groups.filter((group) => group.deviceIds.includes(safeDeviceId));
      return {
        deviceId: safeDeviceId,
        customName: normalizeName(profile.customName, ""),
        displayName: normalizeName(profile.customName, safeDeviceId),
        online: !!connectedDevices[safeDeviceId],
        groupIds: membership.map((group) => group.id),
        groupNames: membership.map((group) => group.name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
}

function parseTargetValue(value) {
  const raw = decodeTargetValue(value);
  if (raw === "all") return { type: "all", value: "all" };
  if (raw.startsWith("group:")) {
    const groupId = sanitizeGroupId(raw.slice(6));
    return groupId ? { type: "group", value: groupId } : { type: "invalid", value: "" };
  }
  const deviceId = sanitizeDeviceId(raw);
  return deviceId ? { type: "device", value: deviceId } : { type: "invalid", value: "" };
}

function resolveTargetDeviceIds(targetValue, deviceStatus = {}, connectedDevices = {}) {
  const target = parseTargetValue(targetValue);
  if (target.type === "invalid") return [];
  if (target.type === "device") return [target.value];
  if (target.type === "group") {
    const group = getGroup(target.value);
    return Array.isArray(group?.deviceIds) ? group.deviceIds.slice() : [];
  }
  return listDevicesWithProfiles(deviceStatus, connectedDevices).map((item) => item.deviceId);
}

module.exports = {
  sanitizeDeviceId,
  sanitizeGroupId,
  ensureProfile,
  renameDevice,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  getGroup,
  getGroupsForDevice,
  listDevicesWithProfiles,
  parseTargetValue,
  resolveTargetDeviceIds,
};
