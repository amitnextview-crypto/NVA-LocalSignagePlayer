let selectedDevice = "all";

async function loadDevices() {
  const res = await fetch('/devices');
  const devices = await res.json();

  const select = document.getElementById('deviceSelect');

  const currentSelected = select.value;

  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Devices";
  select.appendChild(allOption);

  devices.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });

  select.value =
    devices.includes(currentSelected)
      ? currentSelected
      : "all";
}

// loadDevices();
// setInterval(loadDevices, 100000);



async function uploadMedia(section) {

  const input = document.getElementById(`media${section}`);
  const files = input.files;

  if (!files.length) {
    alert("Select file first");
    return;
  }

  const deviceId = document.getElementById("deviceSelect").value;

  const formData = new FormData();
  for (let file of files) {
    formData.append("files", file);
  }

  console.log("Uploading to:", `/upload/${deviceId}/section/${section}`);

  await fetch(`/upload/${deviceId}/section/${section}`, {
    method: "POST",
    body: formData
  });

  alert("Upload Success");
}

function updateSectionVisibility() {
  const layout = document.getElementById('layout').value;

  const s1 = document.getElementById('section1Wrapper');
  const s2 = document.getElementById('section2Wrapper');
  const s3 = document.getElementById('section3Wrapper');

  // Always show section 1
  s1.style.display = 'block';

  if (layout === 'fullscreen') {
    s2.style.display = 'none';
    s3.style.display = 'none';
  }

  if (layout === 'grid2') {
    s2.style.display = 'block';
    s3.style.display = 'none';
  }

  if (layout === 'grid3') {
    s2.style.display = 'block';
    s3.style.display = 'block';
  }
}

async function loadConfig() {

  const targetDevice = document.getElementById("deviceSelect")?.value || "all";

  const res = await fetch(`/config?deviceId=${targetDevice}`);
  const config = await res.json();

  renderUploadSections();

  document.getElementById('orientation').value =
  config.orientation || 'horizontal';

  document.getElementById('dir1').value =
  config.sections?.[0]?.slideDirection || 'left';

document.getElementById('dir2').value =
  config.sections?.[1]?.slideDirection || 'left';

document.getElementById('dir3').value =
  config.sections?.[2]?.slideDirection || 'left';

  document.getElementById('layout').value = config.layout;
  updateSectionVisibility();
  document.getElementById('duration').value = config.slideDuration;
  document.getElementById('animation').value = config.animation;
  document.getElementById('tickerText').value = config.ticker.text;
  document.getElementById('tickerFontSize').value = config.ticker.fontSize || 24;
document.getElementById('tickerPosition').value = config.ticker.position || 'bottom';
document.getElementById('tickerColor').value = config.ticker.color || '#ffffff';
document.getElementById('tickerBgColor').value = config.ticker.bgColor || '#000000';
  document.getElementById('tickerSpeed').value = config.ticker.speed;

  document.getElementById('duration1').value =
  config.sections?.[0]?.slideDuration || 5;

document.getElementById('duration2').value =
  config.sections?.[1]?.slideDuration || 5;

document.getElementById('duration3').value =
  config.sections?.[2]?.slideDuration || 5;
}

// loadConfig();


async function saveConfig() {
  const config = {
    orientation: document.getElementById('orientation').value,
  layout: document.getElementById('layout').value,
  slideDuration: Number(document.getElementById('duration').value),
  animation: "slide",
  bgColor: "#000000",

  sections: [
  {
    slideDirection: document.getElementById('dir1').value,
    slideDuration: Number(document.getElementById('duration1').value)
  },
  {
    slideDirection: document.getElementById('dir2').value,
    slideDuration: Number(document.getElementById('duration2').value)
  },
  {
    slideDirection: document.getElementById('dir3').value,
    slideDuration: Number(document.getElementById('duration3').value)
  }
],
  ticker: {
    text: document.getElementById('tickerText').value,
    color: document.getElementById('tickerColor').value,
    bgColor: document.getElementById('tickerBgColor').value,
    speed: Number(document.getElementById('tickerSpeed').value),
    fontSize: Number(document.getElementById('tickerFontSize').value),
    position: document.getElementById('tickerPosition').value
  }
};

//   await fetch('/config', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(config)
//   });

//  alert('Saved');

const targetDevice = document.getElementById('deviceSelect').value;

await fetch('/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetDevice,
    config
  })
});
alert("Saved Successfully");

// send message to React Native WebView (TV app)
if (window.ReactNativeWebView) {
  window.ReactNativeWebView.postMessage("CONFIG_SAVED");
}

}

function renderUploadSections() {
  const layout = document.getElementById('layout').value;
  const container = document.getElementById('uploadSections');

  container.innerHTML = "";

  let count = 1;
  if (layout === "grid2") count = 2;
  if (layout === "grid3") count = 3;

  for (let i = 1; i <= count; i++) {
    container.innerHTML += `
      <div style="margin-bottom:20px;">
        <h3>Section ${i}</h3>
        <input type="file" id="media${i}" multiple />
        <button onclick="uploadMedia(${i})">Upload Section ${i}</button>
      </div>
    `;
  }
}



document.addEventListener("DOMContentLoaded", () => {

  loadDevices();
  loadConfig();

  document.getElementById("layout")
    .addEventListener("change", () => {
      renderUploadSections();
      updateSectionVisibility();
    });

  document
    .getElementById("deviceSelect")
    .addEventListener("change", loadConfig);
});