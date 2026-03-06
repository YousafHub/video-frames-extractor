const uploadSection = document.getElementById("uploadSection");
const uploadZone = document.getElementById("uploadZone");
const browseBtn = document.getElementById("browseBtn");
const videoInput = document.getElementById("videoInput");
const videoSection = document.getElementById("videoSection");
const videoPlayer = document.getElementById("videoPlayer");
const videoFilename = document.getElementById("videoFilename");
const videoDuration = document.getElementById("videoDuration");
const videoResolution = document.getElementById("videoResolution");
const changeVideoBtn = document.getElementById("changeVideoBtn");
const timestampInput = document.getElementById("timestampInput");
const captureBtn = document.getElementById("captureBtn");
const intervalInput = document.getElementById("intervalInput");
const extractAllBtn = document.getElementById("extractAllBtn");
const progressWrap = document.getElementById("progressWrap");
const progressLabel = document.getElementById("progressLabel");
const progressCount = document.getElementById("progressCount");
const progressFill = document.getElementById("progressFill");
const cancelBtn = document.getElementById("cancelBtn");
const gallerySection = document.getElementById("gallerySection");
const framesGrid = document.getElementById("framesGrid");
const frameCount = document.getElementById("frameCount");
const clearAllBtn = document.getElementById("clearAllBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const canvas = document.getElementById("extractCanvas");
const ctx = canvas.getContext("2d");


const state = {
  frames: [],      // { dataUrl, timestamp, filename }[]
  extracting: false,   // true while bulk extraction runs
  cancelFlag: false,   // flip to true to abort bulk loop
};



// toast


function baseToast(message, extraStyle = {}) {
  return Toastify({
    text: message,
    duration: 3000,
    close: false,
    gravity: "bottom",   // "top" or "bottom"
    position: "center",   // "left", "center", "right"
    stopOnFocus: true,
    style: {
      /* Dark pill that matches the app's colour palette */
      background: "#1a1d27",
      border: "1px solid #2a2d3e",
      borderRadius: "9999px",
      color: "#f0f0f5",
      fontSize: "0.85rem",
      fontWeight: "500",
      padding: "0.55rem 1.25rem",
      boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      fontFamily: "inherit",
      ...extraStyle,
    },
  });
}

/** Green success toast */
function toastSuccess(message) {
  baseToast(message, {
    borderColor: "rgba(34,197,94,0.4)",
    color: "#4ade80",
  }).showToast();
}

/** Red error toast */
function toastError(message) {
  baseToast(message, {
    borderColor: "rgba(239,68,68,0.4)",
    color: "#f87171",
  }).showToast();
}

/** Neutral info toast */
function toastInfo(message) {
  baseToast(message).showToast();
}


// helper functions

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const d = Math.round((sec % 1) * 10); // one decimal
  return `${m}:${String(s).padStart(2, "0")}.${d}`;
}


function buildFilename(rawName, seconds) {
  const base = rawName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");
  return `${base}_t${Math.round(seconds * 1000)}ms.png`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));




function seekTo(video, time) {
  return new Promise((resolve) => {
    const clamped = Math.max(0, Math.min(time, video.duration));

    if (Math.abs(video.currentTime - clamped) < 0.01) {
      resolve();
      return;
    }

    const tid = setTimeout(() => {
      video.removeEventListener("seeked", done);
      resolve();
    }, 5000);

    function done() {
      clearTimeout(tid);
      video.removeEventListener("seeked", done);
      resolve();
    }

    video.addEventListener("seeked", done);
    video.currentTime = clamped;
  });
}




function snapFrame() {
  canvas.width = videoPlayer.videoWidth || 1280;
  canvas.height = videoPlayer.videoHeight || 720;
  ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");





browseBtn.addEventListener("click", () => videoInput.click());

uploadZone.addEventListener("click", (e) => {
  if (e.target !== browseBtn) videoInput.click();
});

videoInput.addEventListener("change", () => {
  if (videoInput.files.length) loadVideo(videoInput.files[0]);
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");

  const file = e.dataTransfer.files[0];
  if (!file) return;

  if (!file.type.startsWith("video/")) {
    toastError("Please drop a video file.");
    return;
  }

  loadVideo(file);
});

changeVideoBtn.addEventListener("click", resetApp);



function loadVideo(file) {
  if (videoPlayer.src) URL.revokeObjectURL(videoPlayer.src);

  videoPlayer.src = URL.createObjectURL(file);

  videoFilename.textContent = file.name;

  videoPlayer.addEventListener("loadedmetadata", onMeta, { once: true });

  hide(uploadSection);
  show(videoSection);
}

function onMeta() {
  videoDuration.textContent = formatTime(videoPlayer.duration);
  videoResolution.textContent = `${videoPlayer.videoWidth}×${videoPlayer.videoHeight}`;
  toastSuccess("Video loaded — ready to extract frames!");
}


function resetApp() {
  state.cancelFlag = true;
  state.extracting = false;

  if (videoPlayer.src) {
    URL.revokeObjectURL(videoPlayer.src);
    videoPlayer.src = "";
  }

  state.frames = [];
  framesGrid.innerHTML = "";
  updateFrameCount();

  videoInput.value = "";
  timestampInput.value = "";
  intervalInput.value = "2";

  hide(videoSection);
  hide(gallerySection);
  hide(progressWrap);
  show(uploadSection);

  setCaptureLoading(false);
  setExtractLoading(false);
}

captureBtn.addEventListener("click", captureFrame);

async function captureFrame() {
  if (!videoPlayer.src) {
    toastError("No video loaded.");
    return;
  }

  const rawVal = timestampInput.value.trim();

  if (rawVal !== "") {
    // User gave a timestamp — validate then seek
    const t = parseFloat(rawVal);

    if (isNaN(t) || t < 0) {
      toastError("Enter a valid time in seconds.");
      return;
    }

    if (t > videoPlayer.duration) {
      toastError(`Time exceeds video duration (${formatTime(videoPlayer.duration)}).`);
      return;
    }

    setCaptureLoading(true);
    await seekTo(videoPlayer, t);
    await sleep(80);
  } else {
    setCaptureLoading(true);
  }

  const dataUrl = snapFrame();
  const timestamp = videoPlayer.currentTime;
  const filename = buildFilename(videoFilename.textContent, timestamp);

  addFrame(dataUrl, timestamp, filename);
  setCaptureLoading(false);
  toastSuccess(`Frame captured at ${formatTime(timestamp)}`);
}

function setCaptureLoading(on) {
  captureBtn.disabled = on;
  captureBtn.innerHTML = on
    ? `<span class="inline-block w-3.5 h-3.5 border-2 border-white/30
                    border-t-white rounded-full animate-spin"></span>
       Capturing…`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
         <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8
                  a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
         <circle cx="12" cy="13" r="4"/>
       </svg>
       Capture`;
}


extractAllBtn.addEventListener("click", startBulkExtraction);
cancelBtn.addEventListener("click", () => { state.cancelFlag = true; toastInfo("Cancelling…"); });

async function startBulkExtraction() {
  if (!videoPlayer.src) {
    toastError("No video loaded.");
    return;
  }
  if (state.extracting) return;

  const interval = parseFloat(intervalInput.value);
  if (isNaN(interval) || interval <= 0) {
    toastError("Enter a valid interval greater than 0.");
    return;
  }

  const duration = videoPlayer.duration;
  if (!duration || !isFinite(duration)) {
    toastError("Video duration is unknown. Please wait for the video to fully load.");
    return;
  }

  const timestamps = [];
  for (let t = 0; t <= duration + 0.001; t += interval) {
    timestamps.push(parseFloat(t.toFixed(3)));
  }

  if (timestamps.length > 300) {
    toastError(
      `Would extract ${timestamps.length} frames. Use a larger interval to stay under 300.`
    );
    return;
  }

  state.extracting = true;
  state.cancelFlag = false;

  show(progressWrap);
  setExtractLoading(true);
  captureBtn.disabled = true;

  let done = 0;

  for (const t of timestamps) {
    if (state.cancelFlag) break;

    // Update progress UI
    progressLabel.textContent = `Extracting frame ${done + 1} of ${timestamps.length}…`;
    progressCount.textContent = `${done} / ${timestamps.length}`;
    progressFill.style.width = `${(done / timestamps.length) * 100}%`;

    await seekTo(videoPlayer, t);
    await sleep(60);

    if (state.cancelFlag) break;

    const dataUrl = snapFrame();
    const filename = buildFilename(videoFilename.textContent, t);
    addFrame(dataUrl, t, filename);

    done++;
  }

  // final progress 
  progressCount.textContent = `${done} / ${timestamps.length}`;
  progressFill.style.width = "100%";
  await sleep(500);

  // remove progress UI
  hide(progressWrap);
  progressFill.style.width = "0%";
  state.extracting = false;
  setExtractLoading(false);
  captureBtn.disabled = false;

  if (state.cancelFlag) {
    toastInfo(`Cancelled — ${done} frame${done !== 1 ? "s" : ""} extracted.`);
  } else {
    toastSuccess(`Done! ${done} frame${done !== 1 ? "s" : ""} extracted.`);
  }
  state.cancelFlag = false;
}


function setExtractLoading(on) {
  extractAllBtn.disabled = on;
  extractAllBtn.innerHTML = on
    ? `<span class="inline-block w-3.5 h-3.5 border-2 border-brand/30
                    border-t-brand rounded-full animate-spin"></span>
       Extracting…`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
         <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
       </svg>
       Extract All`;
}


function addFrame(dataUrl, timestamp, filename) {
  const index = state.frames.length;
  state.frames.push({ dataUrl, timestamp, filename });

  if (index === 0) show(gallerySection);

  framesGrid.appendChild(buildFrameCard(dataUrl, timestamp, filename, index));
  updateFrameCount();
}

function buildFrameCard(dataUrl, timestamp, filename, index) {
  const card = document.createElement("div");
  card.className = [
    "rounded-xl border border-bdr bg-surface-alt overflow-hidden",
    "flex flex-col",
    "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/60",
    "animate-frame-in",
    "group",
  ].join(" ");

  card.innerHTML = `
    <!-- Image wrapper -->
    <div class="relative overflow-hidden bg-black aspect-video cursor-zoom-in"
         data-action="lightbox">
      <img
        src="${dataUrl}"
        alt="Frame at ${formatTime(timestamp)}"
        loading="lazy"
        class="w-full h-full object-cover block
               transition-transform duration-300 group-hover:scale-[1.04]"
      />
      <!-- Index badge overlay -->
      <span class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded
                   bg-black/70 text-white text-[0.6rem] font-bold
                   backdrop-blur-sm pointer-events-none select-none">
        #${index + 1}
      </span>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-2.5 py-2 gap-2">
      <!-- Timestamp -->
      <span class="flex items-center gap-1 text-[0.7rem] font-semibold text-brand
                   font-variant-numeric tabular-nums">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        ${formatTime(timestamp)}
      </span>

      <!-- Download button -->
      <button
        data-action="download"
        title="Download this frame"
        class="w-7 h-7 rounded-md flex items-center justify-center
               border border-bdr text-slate-500
               hover:text-brand hover:border-brand/40 hover:bg-brand-dim
               transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    </div>
  `;

  card.querySelector("[data-action='lightbox']").addEventListener("click", () => {
    openLightbox(dataUrl, timestamp, filename);
  });

  card.querySelector("[data-action='download']").addEventListener("click", (e) => {
    e.stopPropagation();
    downloadFrame(dataUrl, filename);
    toastSuccess("Frame downloaded!");
  });

  return card;
}

function updateFrameCount() {
  frameCount.textContent = state.frames.length;
}


function downloadFrame(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

downloadAllBtn.addEventListener("click", async () => {
  if (!state.frames.length) {
    toastError("No frames to download.");
    return;
  }

  downloadAllBtn.disabled = true;
  downloadAllBtn.innerHTML = `
    <span class="inline-block w-3 h-3 border-2 border-white/30
                 border-t-white rounded-full animate-spin"></span>
    Downloading…
  `;

  for (const { dataUrl, filename } of state.frames) {
    downloadFrame(dataUrl, filename);
    await sleep(200);
  }

  downloadAllBtn.disabled = false;
  downloadAllBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download All
  `;

  toastSuccess(`${state.frames.length} frames downloaded!`);
});

clearAllBtn.addEventListener("click", () => {
  if (!state.frames.length) return;

  state.frames = [];
  framesGrid.innerHTML = "";
  hide(gallerySection);
  updateFrameCount();
  toastInfo("All frames cleared.");
});


function openLightbox(dataUrl, timestamp, filename) {
  closeLightbox(); // remove any existing one first

  const lb = document.createElement("div");
  lb.id = "lightbox";
  lb.className = [
    "fixed inset-0 z-[999]",
    "flex items-center justify-center p-4",
    "bg-black/85 backdrop-blur-md",
  ].join(" ");

  lb.innerHTML = `
    <!-- Close button -->
    <button
      id="lbClose"
      class="fixed top-4 right-4 w-9 h-9 rounded-full
             bg-white/10 border border-white/15 text-white text-lg
             flex items-center justify-center
             hover:bg-white/20 transition-colors z-10"
      title="Close (Esc)"
    >✕</button>

    <!-- Inner container -->
    <div class="flex flex-col items-center gap-4 max-w-[90vw] max-h-[90vh]">
      <img
        src="${dataUrl}"
        alt="Frame at ${formatTime(timestamp)}"
        class="max-w-full max-h-[78vh] object-contain rounded-xl
               border border-bdr shadow-[0_8px_48px_rgba(0,0,0,0.6)]"
      />
      <div class="flex items-center gap-3">
        <!-- Timestamp badge -->
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                     bg-brand-dim text-brand border border-brand/25
                     text-xs font-bold">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          ${formatTime(timestamp)}
        </span>
        <!-- Download button -->
        <button
          id="lbDownload"
          class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full
                 bg-brand text-white text-xs font-semibold
                 hover:bg-brand-hover transition-colors
                 shadow-[0_2px_10px_rgba(108,99,255,0.35)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>
    </div>
  `;

  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });

  lb.querySelector("#lbClose").addEventListener("click", closeLightbox);

  lb.querySelector("#lbDownload").addEventListener("click", () => {
    downloadFrame(dataUrl, filename);
    toastSuccess("Frame downloaded!");
  });

  document.body.appendChild(lb);
}

function closeLightbox() {
  const el = document.getElementById("lightbox");
  if (el) el.remove();
}



document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

console.log("FrameSnap ready.");