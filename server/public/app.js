const SUPPORTED_FILE_EXT = /\.(mp4|mkv|webm|jpg|jpeg|png|txt|pdf)$/i;
const MAX_FILES_PER_UPLOAD = 120;
const HARD_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const WARN_FILE_SIZE_BYTES = 700 * 1024 * 1024;

const GRID3_LAYOUTS = [
  { id: "stack-v", label: "Stack Vertical" },
  { id: "stack-h", label: "Stack Horizontal" },
  { id: "top-two-bottom-one", label: "Top 2 / Bottom 1" },
  { id: "top-one-bottom-two", label: "Top 1 / Bottom 2" },
];

const SECTION_SOURCE_TYPES = {
  multimedia: "multimedia",
  web: "web",
  youtube: "youtube",
};

let selectedGrid3Layout = "stack-v";
let currentConfig = null;
let previewMediaBySection = { 1: [], 2: [], 3: [] };
let previewSectionState = {
  1: { index: 0, timer: null },
  2: { index: 0, timer: null },
  3: { index: 0, timer: null },
};
let previewPollTimer = null;
let selectedGridRatio = "1:1:1";

const RATIO_PRESETS = {
  fullscreen: [{ value: "1:1", label: "Default" }],
  grid2: [
    { value: "1:1", label: "Equal" },
    { value: "2:1", label: "Section 1 Large" },
    { value: "1:2", label: "Section 2 Large" },
  ],
  grid3StackV: [
    { value: "1:1:1", label: "Equal" },
    { value: "2:1:1", label: "Section 1 Large" },
    { value: "1:2:1", label: "Section 2 Large" },
    { value: "1:1:2", label: "Section 3 Large" },
  ],
  grid3StackH: [
    { value: "1:1:1", label: "Equal" },
    { value: "2:1:1", label: "Section 1 Wide" },
    { value: "1:2:1", label: "Section 2 Wide" },
    { value: "1:1:2", label: "Section 3 Wide" },
  ],
  grid3TopBottom: [
    { value: "1:1", label: "Equal Top/Bottom" },
    { value: "2:1", label: "Top Large" },
    { value: "1:2", label: "Bottom Large" },
  ],
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function updateUploadProgress(percent, statusText) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = document.getElementById("uploadProgressFill");
  const progressText = document.getElementById("uploadProgressText");
  const status = document.getElementById("uploadStatus");

  if (fill) fill.style.width = `${clamped}%`;
  if (progressText) progressText.textContent = `${clamped}%`;
  if (status && statusText) status.textContent = statusText;
}

function validateUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  const errors = [];
  const warnings = [];
  const validFiles = [];
  let totalSize = 0;

  if (!files.length) {
    errors.push("Select at least one file.");
    return { errors, warnings, validFiles, totalSize };
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    errors.push(`Max ${MAX_FILES_PER_UPLOAD} files per upload allowed.`);
  }

  for (const file of files) {
    totalSize += file.size || 0;

    if (!SUPPORTED_FILE_EXT.test(file.name || "")) {
      errors.push(`Unsupported file type: ${file.name}`);
      continue;
    }

    if ((file.size || 0) > HARD_FILE_SIZE_BYTES) {
      errors.push(
        `File too large (> ${formatBytes(HARD_FILE_SIZE_BYTES)}): ${file.name}`
      );
      continue;
    }

    if ((file.size || 0) > WARN_FILE_SIZE_BYTES) {
      warnings.push(`Large file: ${file.name} (${formatBytes(file.size)})`);
    }

    validFiles.push(file);
  }

  return { errors, warnings, validFiles, totalSize };
}

function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = (event.loaded / event.total) * 100;
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        let message = `Upload failed with status ${xhr.status}`;
        try {
          const parsed = JSON.parse(xhr.responseText || "{}");
          if (parsed?.error) message = parsed.error;
        } catch (_e) {
          if (xhr.responseText) message = xhr.responseText;
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

function fileNameBase(name) {
  const safe = String(name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  const dot = safe.lastIndexOf(".");
  return dot > 0 ? safe.slice(0, dot) : safe;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas conversion failed"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

let pdfJsLoadingPromise = null;
function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsLoadingPromise) return pdfJsLoadingPromise;

  pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error("PDF engine not available"));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF engine"));
    document.head.appendChild(script);
  });

  return pdfJsLoadingPromise;
}

async function convertPdfFileToImages(file) {
  const pdfjsLib = await ensurePdfJsLoaded();
  const data = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const base = fileNameBase(file.name || "document");
  const converted = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvasToBlob(canvas, "image/png");
    converted.push(
      new File([blob], `${base}__page-${pad3(pageNo)}.png`, {
        type: "image/png",
      })
    );
  }

  return converted;
}

function sectionCount(layout) {
  if (layout === "grid2") return 2;
  if (layout === "grid3") return 3;
  return 1;
}

function normalizeWebUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function extractYoutubeId(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function normalizeYoutubeEmbedUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/youtube\.com\/embed\//i.test(value)) return value;
  const id = extractYoutubeId(value);
  if (!id) return "";
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
}

function normalizeSectionSourceUrl(sourceType, value) {
  if (sourceType === SECTION_SOURCE_TYPES.web) return normalizeWebUrl(value);
  if (sourceType === SECTION_SOURCE_TYPES.youtube) return normalizeYoutubeEmbedUrl(value);
  return "";
}

function buildPdfViewerUrl(fileUrl, page) {
  const safePage = Math.max(1, Number(page || 1));
  return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
}

function normalizeRatio(value, count) {
  const parts = String(value || "")
    .split(":")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== count) return count === 3 ? [1, 1, 1] : [1, 1];
  return parts;
}

function ratioOptionsFor(layout, grid3Layout) {
  if (layout === "grid2") return RATIO_PRESETS.grid2;
  if (layout === "grid3" && grid3Layout === "stack-v") return RATIO_PRESETS.grid3StackV;
  if (layout === "grid3" && grid3Layout === "stack-h") return RATIO_PRESETS.grid3StackH;
  if (layout === "grid3") return RATIO_PRESETS.grid3TopBottom;
  return RATIO_PRESETS.fullscreen;
}

function updateGridRatioOptions() {
  const layout = document.getElementById("layout").value;
  const ratioSelect = document.getElementById("gridRatio");
  if (!ratioSelect) return;

  const options = ratioOptionsFor(layout, selectedGrid3Layout);
  ratioSelect.innerHTML = options
    .map((opt) => `<option value="${opt.value}">${opt.label} (${opt.value})</option>`)
    .join("");

  const exists = options.some((opt) => opt.value === selectedGridRatio);
  selectedGridRatio = exists ? selectedGridRatio : options[0].value;
  ratioSelect.value = selectedGridRatio;
}

function getScheduleFromForm() {
  const enabled = !!document.getElementById("scheduleEnabled")?.checked;
  const start = document.getElementById("scheduleStart")?.value || "09:00";
  const end = document.getElementById("scheduleEnd")?.value || "18:00";
  const fallbackMode = document.getElementById("scheduleFallbackMode")?.value || "black";
  const fallbackMessage = document.getElementById("scheduleFallbackMessage")?.value || "";
  const fallbackImageUrl = document.getElementById("scheduleFallbackImageUrl")?.value?.trim() || "";
  const fallbackTextColor = document.getElementById("scheduleFallbackTextColor")?.value || "#ffffff";
  const fallbackBgColor = document.getElementById("scheduleFallbackBgColor")?.value || "#000000";
  const dayInputs = Array.from(document.querySelectorAll(".schedule-day"));
  const days = dayInputs
    .filter((el) => el.checked)
    .map((el) => Number(el.value))
    .filter((n) => Number.isFinite(n));

  return {
    enabled,
    start,
    end,
    days,
    fallbackMode,
    fallbackMessage,
    fallbackImageUrl,
    fallbackTextColor,
    fallbackBgColor,
  };
}

function setScheduleToForm(schedule) {
  const safeSchedule = schedule || {};
  const enabled = !!safeSchedule.enabled;
  const start = safeSchedule.start || "09:00";
  const end = safeSchedule.end || "18:00";
  const days = Array.isArray(safeSchedule.days) && safeSchedule.days.length
    ? safeSchedule.days.map(Number)
    : [1, 2, 3, 4, 5, 6, 0];
  const fallbackMode = safeSchedule.fallbackMode || "black";

  const enabledEl = document.getElementById("scheduleEnabled");
  const startEl = document.getElementById("scheduleStart");
  const endEl = document.getElementById("scheduleEnd");
  const modeEl = document.getElementById("scheduleFallbackMode");
  const msgEl = document.getElementById("scheduleFallbackMessage");
  const imageUrlEl = document.getElementById("scheduleFallbackImageUrl");
  const textColorEl = document.getElementById("scheduleFallbackTextColor");
  const bgColorEl = document.getElementById("scheduleFallbackBgColor");
  const fields = document.getElementById("scheduleFields");

  if (enabledEl) enabledEl.checked = enabled;
  if (startEl) startEl.value = start;
  if (endEl) endEl.value = end;
  if (modeEl) modeEl.value = fallbackMode;
  if (msgEl) msgEl.value = safeSchedule.fallbackMessage || "";
  if (imageUrlEl) imageUrlEl.value = safeSchedule.fallbackImageUrl || "";
  if (textColorEl) textColorEl.value = safeSchedule.fallbackTextColor || "#ffffff";
  if (bgColorEl) bgColorEl.value = safeSchedule.fallbackBgColor || "#000000";
  if (fields) fields.style.opacity = enabled ? "1" : "0.55";

  const dayInputs = Array.from(document.querySelectorAll(".schedule-day"));
  dayInputs.forEach((el) => {
    el.checked = days.includes(Number(el.value));
  });

  updateScheduleFallbackVisibility();
}

function updateScheduleFallbackVisibility() {
  const mode = document.getElementById("scheduleFallbackMode")?.value || "black";
  const msgWrap = document.getElementById("scheduleFallbackMessageWrap");
  const imageWrap = document.getElementById("scheduleFallbackImageWrap");
  if (msgWrap) msgWrap.classList.toggle("hidden", mode !== "message");
  if (imageWrap) imageWrap.classList.toggle("hidden", mode !== "image");
}

function miniLayoutMarkup(layout, grid3Layout) {
  if (layout === "fullscreen") {
    return `<div style="height:100%;display:grid;grid-template-columns:1fr"><div class="cell">1</div></div>`;
  }

  if (layout === "grid2") {
    const [a, b] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div style="height:100%;display:grid;grid-template-columns:${a}fr ${b}fr">
        <div class="cell">1</div><div class="cell">2</div>
      </div>
    `;
  }

  if (grid3Layout === "stack-h") {
    const [a, b, c] = normalizeRatio(selectedGridRatio, 3);
    return `
      <div style="height:100%;display:grid;grid-template-columns:${a}fr ${b}fr ${c}fr">
        <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div>
      </div>
    `;
  }

  if (grid3Layout === "top-two-bottom-one") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div style="height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one two' 'three three';">
        <div class="cell" style="grid-area:one;">1</div>
        <div class="cell" style="grid-area:two;">2</div>
        <div class="cell" style="grid-area:three;">3</div>
      </div>
    `;
  }

  if (grid3Layout === "top-one-bottom-two") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div style="height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one one' 'two three';">
        <div class="cell" style="grid-area:one;">1</div>
        <div class="cell" style="grid-area:two;">2</div>
        <div class="cell" style="grid-area:three;">3</div>
      </div>
    `;
  }

  const [r1, r2, r3] = normalizeRatio(selectedGridRatio, 3);
  return `
    <div style="height:100%;display:grid;grid-template-rows:${r1}fr ${r2}fr ${r3}fr">
      <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div>
    </div>
  `;
}

function liveLayoutMarkup(layout, grid3Layout) {
  if (layout === "fullscreen") {
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr;">
        <div class="preview-slot" data-section="1"></div>
      </div>
    `;
  }

  if (layout === "grid2") {
    const [left, right] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:${left}fr ${right}fr;">
        <div class="preview-slot" data-section="1"></div>
        <div class="preview-slot" data-section="2"></div>
      </div>
    `;
  }

  if (grid3Layout === "stack-h") {
    const [a, b, c] = normalizeRatio(selectedGridRatio, 3);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:${a}fr ${b}fr ${c}fr;">
        <div class="preview-slot" data-section="1"></div>
        <div class="preview-slot" data-section="2"></div>
        <div class="preview-slot" data-section="3"></div>
      </div>
    `;
  }

  if (grid3Layout === "top-two-bottom-one") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one two' 'three three';">
        <div class="preview-slot" data-section="1" style="grid-area:one;"></div>
        <div class="preview-slot" data-section="2" style="grid-area:two;"></div>
        <div class="preview-slot" data-section="3" style="grid-area:three;"></div>
      </div>
    `;
  }

  if (grid3Layout === "top-one-bottom-two") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one one' 'two three';">
        <div class="preview-slot" data-section="1" style="grid-area:one;"></div>
        <div class="preview-slot" data-section="2" style="grid-area:two;"></div>
        <div class="preview-slot" data-section="3" style="grid-area:three;"></div>
      </div>
    `;
  }

  const [r1, r2, r3] = normalizeRatio(selectedGridRatio, 3);
  return `
    <div class="preview-layout" style="display:grid;grid-template-rows:${r1}fr ${r2}fr ${r3}fr;">
      <div class="preview-slot" data-section="1"></div>
      <div class="preview-slot" data-section="2"></div>
      <div class="preview-slot" data-section="3"></div>
    </div>
  `;
}

function getSectionDurationMs(config, sectionNumber) {
  const sectionDuration = config?.sections?.[sectionNumber - 1]?.slideDuration;
  const fallbackDuration = config?.slideDuration || 5;
  return Math.max(1, Number(sectionDuration || fallbackDuration)) * 1000;
}

function clearPreviewTimers() {
  for (const key of Object.keys(previewSectionState)) {
    const state = previewSectionState[key];
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }
}

function resetPreviewState() {
  clearPreviewTimers();
  previewSectionState = {
    1: { index: 0, timer: null },
    2: { index: 0, timer: null },
    3: { index: 0, timer: null },
  };
}

function renderSectionSlot(slot, sectionNumber, config) {
  const sectionConfig = config?.sections?.[sectionNumber - 1] || {};
  const sourceType = sectionConfig.sourceType || SECTION_SOURCE_TYPES.multimedia;
  const sourceUrl = normalizeSectionSourceUrl(sourceType, sectionConfig.sourceUrl);

  const files = previewMediaBySection[sectionNumber] || [];
  const state = previewSectionState[sectionNumber];

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  slot.innerHTML = "";
  const tag = document.createElement("div");
  tag.className = "slot-tag";
  tag.textContent = `Section ${sectionNumber}`;
  slot.appendChild(tag);

  if (sourceType === SECTION_SOURCE_TYPES.web || sourceType === SECTION_SOURCE_TYPES.youtube) {
    if (!sourceUrl) {
      slot.innerHTML += `<div class="cell">No URL</div>`;
      return;
    }

    const frame = document.createElement("iframe");
    frame.className = "preview-media";
    frame.src = sourceUrl;
    frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.style.border = "0";
    slot.appendChild(frame);
    return;
  }

  if (!files.length) {
    slot.innerHTML += `<div class="cell">No Media</div>`;
    return;
  }

  const file = files[state.index % files.length];
  const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name || "");
  const isText = (file.type || "").toLowerCase() === "text" || /\.txt$/i.test(file.originalName || file.name || "");
  const isPdf = (file.type || "").toLowerCase() === "pdf" || /\.pdf$/i.test(file.originalName || file.name || "");

  if (isPdf) {
    const frame = document.createElement("iframe");
    frame.className = "preview-media";
    frame.src = buildPdfViewerUrl(file.remoteUrl || file.url || "", file.page || 1);
    frame.setAttribute("allowfullscreen", "true");
    frame.style.border = "0";
    slot.appendChild(frame);

    const durationMs = getSectionDurationMs(config, sectionNumber);
    state.timer = setTimeout(() => {
      state.index = (state.index + 1) % files.length;
      renderSectionSlot(slot, sectionNumber, config);
    }, durationMs);
    return;
  }

  if (isText) {
    const panel = document.createElement("div");
    panel.className = "cell";
    panel.style.padding = "10px";
    panel.style.overflow = "auto";
    panel.style.fontSize = "12px";
    panel.style.textAlign = "left";
    panel.textContent = "Loading text...";
    slot.appendChild(panel);

    fetch(file.remoteUrl || file.url || "", { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        panel.textContent = text || "No text content";
      })
      .catch(() => {
        panel.textContent = "Unable to load text file";
      });

    const durationMs = getSectionDurationMs(config, sectionNumber);
    state.timer = setTimeout(() => {
      state.index = (state.index + 1) % files.length;
      renderSectionSlot(slot, sectionNumber, config);
    }, durationMs);
    return;
  }

  const mediaEl = document.createElement(isVideo ? "video" : "img");

  mediaEl.className = "preview-media";
  mediaEl.src = file.remoteUrl || file.url || "";

  if (isVideo) {
    mediaEl.muted = true;
    mediaEl.autoplay = true;
    mediaEl.playsInline = true;
    mediaEl.preload = "metadata";

    mediaEl.onended = () => {
      state.index = (state.index + 1) % files.length;
      renderSectionSlot(slot, sectionNumber, config);
    };

    mediaEl.onerror = () => {
      state.timer = setTimeout(() => {
        state.index = (state.index + 1) % files.length;
        renderSectionSlot(slot, sectionNumber, config);
      }, 1500);
    };
  } else {
    const durationMs = getSectionDurationMs(config, sectionNumber);
    state.timer = setTimeout(() => {
      state.index = (state.index + 1) % files.length;
      renderSectionSlot(slot, sectionNumber, config);
    }, durationMs);
  }

  slot.appendChild(mediaEl);
}

function startLivePreviewPlayback(config) {
  const preview = document.getElementById("screenPreview");
  if (!preview) return;

  clearPreviewTimers();
  const slots = preview.querySelectorAll(".preview-slot");
  slots.forEach((slot) => {
    const sectionNumber = Number(slot.getAttribute("data-section") || "1");
    renderSectionSlot(slot, sectionNumber, config);
  });
}

function renderGrid3LayoutOptions() {
  const box = document.getElementById("grid3LayoutOptions");
  if (!box) return;

  box.innerHTML = GRID3_LAYOUTS.map((item) => {
    const active = item.id === selectedGrid3Layout ? "active" : "";
    const mini = miniLayoutMarkup("grid3", item.id);
    return `
      <button class="layout-option ${active}" onclick="selectGrid3Layout('${item.id}')" type="button">
        <strong>${item.label}</strong>
        <div class="mini-layout">${mini}</div>
      </button>
    `;
  }).join("");
}

function renderScreenPreview() {
  const config = currentConfig || buildConfigFromForm();
  const layout = config.layout || "fullscreen";
  const preview = document.getElementById("screenPreview");
  if (!preview) return;
  preview.innerHTML = liveLayoutMarkup(layout, selectedGrid3Layout);
  startLivePreviewPlayback(config);
}

function buildConfigFromForm() {
  const section1Duration = Number(document.getElementById("duration1").value || 5);
  return {
    orientation: document.getElementById("orientation").value,
    layout: document.getElementById("layout").value,
    grid3Layout: selectedGrid3Layout,
    gridRatio: selectedGridRatio,
    // Keep backward compatibility for player fallback.
    slideDuration: section1Duration,
    animation: document.getElementById("animation")?.value || "slide",
    bgColor: "#000000",
    sections: [
      {
        slideDirection: document.getElementById("dir1").value,
        slideDuration: Number(document.getElementById("duration1").value || 5),
        sourceType: document.getElementById("sourceType1")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl1")?.value || "",
      },
      {
        slideDirection: document.getElementById("dir2").value,
        slideDuration: Number(document.getElementById("duration2").value || 5),
        sourceType: document.getElementById("sourceType2")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl2")?.value || "",
      },
      {
        slideDirection: document.getElementById("dir3").value,
        slideDuration: Number(document.getElementById("duration3").value || 5),
        sourceType: document.getElementById("sourceType3")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl3")?.value || "",
      },
    ],
    ticker: {
      text: document.getElementById("tickerText").value,
      color: document.getElementById("tickerColor").value,
      bgColor: document.getElementById("tickerBgColor").value,
      speed: Number(document.getElementById("tickerSpeed").value || 6),
      fontSize: Number(document.getElementById("tickerFontSize").value || 24),
      position: document.getElementById("tickerPosition").value,
    },
    schedule: getScheduleFromForm(),
  };
}

async function loadPreviewMedia(deviceId) {
  try {
    const res = await fetch(`/media-list?deviceId=${deviceId}&ts=${Date.now()}`);
    const files = await res.json();
    const grouped = { 1: [], 2: [], 3: [] };
    for (const file of files) {
      const sec = Number(file.section || 1);
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push({
        ...file,
        remoteUrl: file.url,
      });
    }
    previewMediaBySection = grouped;
    resetPreviewState();
  } catch (e) {
    console.log("Preview media load failed", e);
    previewMediaBySection = { 1: [], 2: [], 3: [] };
    resetPreviewState();
  }
}

function startPreviewPolling() {
  if (previewPollTimer) {
    clearInterval(previewPollTimer);
  }

  previewPollTimer = setInterval(async () => {
    const deviceId = document.getElementById("deviceSelect")?.value || "all";
    await loadPreviewMedia(deviceId);
    renderScreenPreview();
  }, 15000);
}

function updateSectionVisibility() {
  const layout = document.getElementById("layout").value;

  const s1 = document.getElementById("section1Wrapper");
  const s2 = document.getElementById("section2Wrapper");
  const s3 = document.getElementById("section3Wrapper");
  const grid3LayoutSection = document.getElementById("grid3LayoutSection");

  s1.style.display = "block";
  s2.style.display = layout === "fullscreen" ? "none" : "block";
  s3.style.display = layout === "grid3" ? "block" : "none";
  grid3LayoutSection.classList.toggle("hidden", layout !== "grid3");

  renderScreenPreview();
}

function onSectionSourceChange(section) {
  updateSectionUploadMode(section);
  currentConfig = buildConfigFromForm();
  renderScreenPreview();
}

function onSectionSourceUrlInput() {
  currentConfig = buildConfigFromForm();
  renderScreenPreview();
}

function updateSectionUploadMode(section) {
  const typeEl = document.getElementById(`sourceType${section}`);
  const uploadWrap = document.getElementById(`uploadWrap${section}`);
  const sourceWrap = document.getElementById(`sourceUrlWrap${section}`);
  const sourceInput = document.getElementById(`sourceUrl${section}`);
  if (!typeEl) return;

  const sourceType = typeEl.value || SECTION_SOURCE_TYPES.multimedia;
  if (uploadWrap) uploadWrap.classList.toggle("hidden", sourceType !== SECTION_SOURCE_TYPES.multimedia);
  if (sourceWrap) sourceWrap.classList.toggle("hidden", sourceType === SECTION_SOURCE_TYPES.multimedia);

  if (sourceInput) {
    if (sourceType === SECTION_SOURCE_TYPES.youtube) {
      sourceInput.placeholder = "https://youtube.com/watch?v=...";
    } else if (sourceType === SECTION_SOURCE_TYPES.web) {
      sourceInput.placeholder = "https://example.com";
    } else {
      sourceInput.placeholder = "";
    }
  }
}

function renderUploadSections() {
  const layout = document.getElementById("layout").value;
  const container = document.getElementById("uploadSections");
  container.innerHTML = "";

  const count = sectionCount(layout);

  for (let i = 1; i <= count; i++) {
    container.innerHTML += `
      <div>
        <h3>Section ${i}</h3>
        <div class="source-controls">
          <label>Source Type</label>
          <select id="sourceType${i}" onchange="onSectionSourceChange(${i})">
            <option value="multimedia">Multimedia (Image/Video)</option>
            <option value="web">Website URL</option>
            <option value="youtube">YouTube URL</option>
          </select>
        </div>
        <div id="sourceUrlWrap${i}" class="hidden">
          <input
            type="text"
            id="sourceUrl${i}"
            class="source-url-input"
            placeholder=""
            oninput="onSectionSourceUrlInput()"
          />
        </div>
        <div id="uploadWrap${i}" class="upload-row">
          <input
            type="file"
            id="media${i}"
            multiple
            accept=".mp4,.mkv,.webm,.jpg,.jpeg,.png,.txt,.pdf,video/mp4,video/webm,image/jpeg,image/png,text/plain,application/pdf"
          />
          <button class="btn primary" onclick="uploadMedia(${i})">Upload Section ${i}</button>
        </div>
      </div>
    `;
    updateSectionUploadMode(i);
  }
}

function selectGrid3Layout(layoutId) {
  selectedGrid3Layout = layoutId;
  if (currentConfig) currentConfig.grid3Layout = layoutId;
  updateGridRatioOptions();
  if (currentConfig) currentConfig.gridRatio = selectedGridRatio;
  renderGrid3LayoutOptions();
  renderScreenPreview();
}

async function loadDevices() {
  const res = await fetch("/devices");
  const devices = await res.json();

  const select = document.getElementById("deviceSelect");
  const currentSelected = select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Devices";
  select.appendChild(allOption);

  devices.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });

  select.value = devices.includes(currentSelected) ? currentSelected : "all";
}

async function uploadMedia(section) {
  const sourceType = document.getElementById(`sourceType${section}`)?.value || SECTION_SOURCE_TYPES.multimedia;
  if (sourceType !== SECTION_SOURCE_TYPES.multimedia) {
    alert("For Website/YouTube source, upload is not required. Save settings only.");
    return;
  }

  const loader = document.getElementById("uploadLoader");
  const input = document.getElementById(`media${section}`);
  const files = input?.files;

  const { errors, warnings, validFiles, totalSize } = validateUploadFiles(files);

  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }

  if (warnings.length) {
    const proceed = confirm(
      `${warnings.join("\n")}\n\nTotal upload size: ${formatBytes(
        totalSize
      )}\n\nContinue upload?`
    );
    if (!proceed) return;
  }

  try {
    loader.classList.remove("hidden");
    updateUploadProgress(0, "Preparing upload...");

    const deviceId = document.getElementById("deviceSelect").value;
    let uploadFiles = [...validFiles];

    const pdfFiles = uploadFiles.filter((f) => /\.pdf$/i.test(f.name || ""));
    if (pdfFiles.length) {
      updateUploadProgress(0, "Converting PDF pages to images...");
      const nonPdf = uploadFiles.filter((f) => !/\.pdf$/i.test(f.name || ""));
      const convertedPdfImages = [];
      for (const pdfFile of pdfFiles) {
        const pages = await convertPdfFileToImages(pdfFile);
        convertedPdfImages.push(...pages);
      }
      uploadFiles = [...nonPdf, ...convertedPdfImages];
      if (!uploadFiles.length) {
        throw new Error("No uploadable files generated from PDF");
      }
    }

    const formData = new FormData();
    for (const file of uploadFiles) {
      formData.append("files", file);
    }

    updateUploadProgress(
      0,
      `Uploading ${uploadFiles.length} file(s), ${formatBytes(totalSize)}`
    );

    await uploadWithProgress(`/upload/${deviceId}/section/${section}`, formData, (percent) => {
      updateUploadProgress(percent, "Uploading media...");
    });

    updateUploadProgress(100, "Upload complete");
    alert("Upload Success");
  } catch (err) {
    alert(`Upload Failed: ${err.message || "Unknown error"}`);
  } finally {
    loader.classList.add("hidden");
    updateUploadProgress(0, "Preparing upload...");
  }
}

async function loadConfig() {
  const targetDevice = document.getElementById("deviceSelect")?.value || "all";
  const res = await fetch(`/config?deviceId=${targetDevice}&ts=${Date.now()}`);
  const config = await res.json();

  document.getElementById("orientation").value = config.orientation || "horizontal";
  document.getElementById("layout").value = config.layout || "fullscreen";
  document.getElementById("animation").value = config.animation || "slide";

  document.getElementById("dir1").value = config.sections?.[0]?.slideDirection || "left";
  document.getElementById("dir2").value = config.sections?.[1]?.slideDirection || "left";
  document.getElementById("dir3").value = config.sections?.[2]?.slideDirection || "left";

  document.getElementById("duration1").value = config.sections?.[0]?.slideDuration || 5;
  document.getElementById("duration2").value = config.sections?.[1]?.slideDuration || 5;
  document.getElementById("duration3").value = config.sections?.[2]?.slideDuration || 5;

  document.getElementById("tickerText").value = config.ticker?.text || "";
  document.getElementById("tickerFontSize").value = config.ticker?.fontSize || 24;
  document.getElementById("tickerPosition").value = config.ticker?.position || "bottom";
  document.getElementById("tickerColor").value = config.ticker?.color || "#ffffff";
  document.getElementById("tickerBgColor").value = config.ticker?.bgColor || "#000000";
  document.getElementById("tickerSpeed").value = config.ticker?.speed ?? 6;
  setScheduleToForm(config.schedule);

  selectedGrid3Layout = config.grid3Layout || "stack-v";
  selectedGridRatio = config.gridRatio || "1:1:1";
  currentConfig = {
    ...config,
    grid3Layout: selectedGrid3Layout,
    gridRatio: selectedGridRatio,
  };
  await loadPreviewMedia(targetDevice);
  updateGridRatioOptions();
  renderGrid3LayoutOptions();
  renderUploadSections();
  for (let i = 1; i <= 3; i++) {
    const sectionConfig = config.sections?.[i - 1] || {};
    const typeEl = document.getElementById(`sourceType${i}`);
    const urlEl = document.getElementById(`sourceUrl${i}`);
    if (typeEl) typeEl.value = sectionConfig.sourceType || SECTION_SOURCE_TYPES.multimedia;
    if (urlEl) urlEl.value = sectionConfig.sourceUrl || "";
    updateSectionUploadMode(i);
  }
  updateSectionVisibility();
}

async function saveConfig() {
  const config = buildConfigFromForm();
  const targetDevice = document.getElementById("deviceSelect").value;

  currentConfig = config;
  await fetch("/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDevice, config }),
  });

  alert("Saved Successfully");

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage("CONFIG_SAVED");
  }

  renderScreenPreview();
}

async function clearDeviceData() {
  const deviceId = document.getElementById("deviceSelect").value;
  const confirmMsg =
    deviceId === "all"
      ? "Are you sure? This will clear app data on ALL connected devices."
      : "Are you sure? This will clear app data.";

  if (!confirm(confirmMsg)) return;

  await fetch("/config/clear-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDevice: deviceId }),
  });

  alert("Clear command sent");
}

async function restartDeviceApp() {
  const deviceId = document.getElementById("deviceSelect").value;
  const confirmMsg =
    deviceId === "all"
      ? "Restart app on ALL connected devices?"
      : `Restart app on device ${deviceId}?`;

  if (!confirm(confirmMsg)) return;

  const res = await fetch("/config/restart-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDevice: deviceId }),
  });

  const data = await res.json();
  if (data?.success) {
    alert("Restart command sent");
  } else {
    alert("Restart failed: device not connected");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderGrid3LayoutOptions();
  updateScheduleFallbackVisibility();
  updateUploadProgress(0, "Preparing upload...");
  loadDevices();
  loadConfig();
  startPreviewPolling();

  document.getElementById("layout").addEventListener("change", () => {
    updateGridRatioOptions();
    currentConfig = buildConfigFromForm();
    currentConfig.gridRatio = selectedGridRatio;
    renderUploadSections();
    updateSectionVisibility();
  });

  document.getElementById("deviceSelect").addEventListener("change", loadConfig);
  document.getElementById("gridRatio").addEventListener("change", (e) => {
    selectedGridRatio = e.target.value;
    if (currentConfig) currentConfig.gridRatio = selectedGridRatio;
    renderGrid3LayoutOptions();
    renderScreenPreview();
  });
  document.getElementById("scheduleEnabled").addEventListener("change", () => {
    const fields = document.getElementById("scheduleFields");
    if (fields) fields.style.opacity = document.getElementById("scheduleEnabled").checked ? "1" : "0.55";
    currentConfig = buildConfigFromForm();
  });
  document.getElementById("scheduleFallbackMode").addEventListener("change", () => {
    updateScheduleFallbackVisibility();
    currentConfig = buildConfigFromForm();
  });

  const previewLinkedFields = [
    "duration1",
    "duration2",
    "duration3",
    "dir1",
    "dir2",
    "dir3",
    "orientation",
    "animation",
    "tickerText",
    "tickerFontSize",
    "tickerPosition",
    "tickerColor",
    "tickerBgColor",
    "tickerSpeed",
    "scheduleStart",
    "scheduleEnd",
    "scheduleFallbackMessage",
    "scheduleFallbackTextColor",
    "scheduleFallbackBgColor",
  ];

  previewLinkedFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      currentConfig = buildConfigFromForm();
      renderScreenPreview();
    });
  });

  Array.from(document.querySelectorAll(".schedule-day")).forEach((el) => {
    el.addEventListener("change", () => {
      currentConfig = buildConfigFromForm();
    });
  });
});
