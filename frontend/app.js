const API_URL = "http://localhost:3000/api/servers";

const els = {
  form: document.getElementById("serverForm"),
  msg: document.getElementById("formMsg"),
  cards: document.getElementById("cards"),
  reloadBtn: document.getElementById("reloadBtn"),
  resetBtn: document.getElementById("resetBtn"),

  name: document.getElementById("name"),
  cpuCores: document.getElementById("cpuCores"),
  ramGb: document.getElementById("ramGb"),
  storageType: document.getElementById("storageType"),
  storageGb: document.getElementById("storageGb"),
  os: document.getElementById("os"),
  budget: document.getElementById("budget"),
  status: document.getElementById("status")
};

function setMsg(text, type = "info") {
  els.msg.textContent = text || "";
  els.msg.style.color =
    type === "error" ? "rgba(239, 68, 68, 0.95)" :
    type === "ok" ? "rgba(34, 197, 94, 0.95)" :
    "rgba(167, 180, 199, 0.95)";
}

function parseIntSafe(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : NaN;
}

function validateForm() {
  const name = els.name.value.trim();
  const cpu = parseIntSafe(els.cpuCores.value);
  const ram = parseIntSafe(els.ramGb.value);
  const storageType = els.storageType.value;
  const storageGb = parseIntSafe(els.storageGb.value);
  const os = els.os.value;
  const budget = parseIntSafe(els.budget.value);

  const errors = [];

  if (name.length < 3) errors.push("El nombre debe tener al menos 3 caracteres.");
  if (!Number.isFinite(cpu) || cpu < 2) errors.push("CPU debe ser mínimo 2 núcleos.");
  if (!Number.isFinite(ram) || ram < 4) errors.push("RAM debe ser mínimo 4 GB.");
  if (!storageType) errors.push("Selecciona SSD o HDD.");
  if (!Number.isFinite(storageGb) || storageGb < 64) errors.push("Capacidad mínima recomendada: 64 GB.");
  if (!os) errors.push("Selecciona el sistema operativo.");
  if (!Number.isFinite(budget)) errors.push("El presupuesto debe ser un número.");
  if (Number.isFinite(budget) && budget > 700) errors.push("El presupuesto no puede superar 700€.");

  return { ok: errors.length === 0, errors, data: { name, cpu, ram, storageType, storageGb, os, budget } };
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "activo") return "card--activo";
  if (s === "mantenimiento") return "card--mantenimiento";
  if (s === "inactivo") return "card--inactivo";
  return "";
}

function makeCard(server) {
  const div = document.createElement("article");
  div.className = `card ${statusClass(server.status)}`;

  div.innerHTML = `
    <div class="card__top">
      <h3 class="card__title">${escapeHtml(server.name)}</h3>
      <span class="badge">${escapeHtml(server.status || "activo")}</span>
    </div>

    <ul class="specs">
      <li><b>CPU</b><span>${escapeHtml(server.cpu)}</span></li>
      <li><b>RAM</b><span>${escapeHtml(server.ram)}</span></li>
      <li><b>Storage</b><span>${escapeHtml(server.storage)}</span></li>
      <li><b>OS</b><span>${escapeHtml(server.os)}</span></li>
      <li><b>Presupuesto</b><span>${Number(server.budget)} €</span></li>
      <li><b>ID</b><span>#${Number(server.id)}</span></li>
    </ul>
  `;

  return div;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchServers() {
  els.cards.innerHTML = `<p class="muted">Cargando servidores...</p>`;
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    renderServers(Array.isArray(data) ? data : []);
  } catch (e) {
    els.cards.innerHTML = `<p class="muted">No se pudo conectar con la API. ¿Está el backend encendido?</p>`;
  }
}

function renderServers(list) {
  els.cards.innerHTML = "";
  if (!list.length) {
    els.cards.innerHTML = `<p class="muted">No hay servidores aún. Crea el primero desde el formulario.</p>`;
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach((s) => frag.appendChild(makeCard(s)));
  els.cards.appendChild(frag);
}

async function createServer() {
  const { ok, errors, data } = validateForm();
  if (!ok) {
    setMsg(errors[0], "error");
    return;
  }

  // ✅ Ajuste al formato que espera el backend
  const payload = {
    name: data.name,
    cpu: `${data.cpu} vCPU`,
    ram: `${data.ram} GB`,
    storage: `${data.storageGb} GB ${data.storageType}`,
    os: data.os,
    budget: data.budget,
    status: els.status.value || "activo"
  };

  setMsg("Guardando...", "info");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      // backend devuelve { message, errors }
      const msg = result?.errors?.[0] || result?.message || "Error al guardar.";
      setMsg(msg, "error");
      return;
    }

    // SPA: agregar card sin recargar
    const current = els.cards.querySelector(".muted") ? [] : null;
    // Re-render simple: pedimos lista otra vez (más consistente)
    await fetchServers();

    setMsg("Servidor guardado ✅", "ok");
    els.form.reset();
    els.status.value = "activo";
  } catch (e) {
    setMsg("No se pudo guardar. Revisa que el backend esté corriendo.", "error");
  }
}

// Events
els.form.addEventListener("submit", (e) => {
  e.preventDefault(); // ✅ SPA sin recargar
  createServer();
});

els.reloadBtn.addEventListener("click", fetchServers);

els.resetBtn.addEventListener("click", () => {
  els.form.reset();
  els.status.value = "activo";
  setMsg("");
});

// Init
fetchServers();
