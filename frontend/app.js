const API_URL = "http://localhost:3000/api/servers";

const els = {
  form: document.getElementById("serverForm"),
  msg: document.getElementById("formMsg"),
  cards: document.getElementById("cards"),
  reloadBtn: document.getElementById("reloadBtn"),
  resetBtn: document.getElementById("resetBtn"),

  name: document.getElementById("name"),
  cpuPlan: document.getElementById("cpuPlan"),
  ramPlan: document.getElementById("ramPlan"),
  storagePlan: document.getElementById("storagePlan"),
  osPlan: document.getElementById("osPlan"),
  status: document.getElementById("status"),

  totalPrice: document.getElementById("totalPrice"),
  priceHint: document.getElementById("priceHint")
};

function setMsg(text, type = "info") {
  els.msg.textContent = text || "";
  els.msg.style.color =
    type === "error"
      ? "rgba(239, 68, 68, 0.95)"
      : type === "ok"
      ? "rgba(34, 197, 94, 0.95)"
      : "rgba(167, 180, 199, 0.95)";
}

function getOptionPrice(selectEl) {
  const opt = selectEl?.selectedOptions?.[0];
  if (!opt) return NaN;
  const p = Number(opt.dataset.price);
  return Number.isFinite(p) ? p : NaN;
}

function computeTotal() {
  const prices = [
    getOptionPrice(els.cpuPlan),
    getOptionPrice(els.ramPlan),
    getOptionPrice(els.storagePlan),
    getOptionPrice(els.osPlan)
  ];

  if (prices.some((p) => !Number.isFinite(p))) return { ready: false, total: 0 };

  const total = prices.reduce((a, b) => a + b, 0);
  return { ready: true, total };
}

function updateTotalUI() {
  const { ready, total } = computeTotal();

  if (!ready) {
    els.totalPrice.value = "0 €";
    els.priceHint.textContent = "Selecciona CPU, RAM, almacenamiento y SO.";
    els.priceHint.style.color = "rgba(167, 180, 199, 0.95)";
    return;
  }

  els.totalPrice.value = `${total} €`;

  if (total > 700) {
    els.priceHint.textContent = `⚠️ El total supera 700€ (${total}€). Cambia alguna opción.`;
    els.priceHint.style.color = "rgba(239, 68, 68, 0.95)";
  } else {
    els.priceHint.textContent = "Total calculado automáticamente.";
    els.priceHint.style.color = "rgba(34, 197, 94, 0.95)";
  }
}

function validateForm() {
  const name = els.name.value.trim();
  const cpu = els.cpuPlan.value;
  const ram = els.ramPlan.value;
  const storage = els.storagePlan.value;
  const os = els.osPlan.value;

  const errors = [];
  if (name.length < 3) errors.push("El nombre debe tener al menos 3 caracteres.");
  if (!cpu) errors.push("Selecciona una opción de CPU.");
  if (!ram) errors.push("Selecciona una opción de RAM.");
  if (!storage) errors.push("Selecciona una opción de almacenamiento.");
  if (!os) errors.push("Selecciona un sistema operativo.");

  const { ready, total } = computeTotal();
  if (!ready) errors.push("Faltan opciones para calcular el total.");
  if (ready && total > 700) errors.push(`El total (${total}€) no puede superar 700€.`);

  return { ok: errors.length === 0, errors, data: { name, cpu, ram, storage, os, total } };
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "activo") return "card--activo";
  if (s === "mantenimiento") return "card--mantenimiento";
  if (s === "inactivo") return "card--inactivo";
  return "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    <div class="card__actions">
      <button class="btn btn--danger js-delete" data-id="${Number(server.id)}">🗑️ Borrar</button>
    </div>
  `;

  return div;
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

async function fetchServers() {
  els.cards.innerHTML = `<p class="muted">Cargando servidores...</p>`;
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    renderServers(Array.isArray(data) ? data : []);
  } catch {
    els.cards.innerHTML = `<p class="muted">No se pudo conectar con la API. ¿Está el backend encendido?</p>`;
  }
}

async function createServer() {
  const { ok, errors, data } = validateForm();
  if (!ok) {
    setMsg(errors[0], "error");
    return;
  }

  const payload = {
    name: data.name,
    cpu: data.cpu,
    ram: data.ram,
    storage: data.storage,
    os: data.os,
    budget: data.total,
    status: els.status.value || "activo"
  };

  setMsg("Guardando...", "info");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = result?.errors?.[0] || result?.message || "Error al guardar.";
      setMsg(msg, "error");
      return;
    }

    await fetchServers();
    setMsg("Servidor guardado ✅", "ok");
    els.form.reset();
    updateTotalUI();
  } catch {
    setMsg("No se pudo guardar. Revisa que el backend esté corriendo.", "error");
  }
}

async function deleteServer(id) {
  const ok = confirm("¿Seguro que quieres borrar este servidor?");
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "No se pudo borrar el servidor.");
      return;
    }

    setMsg("Servidor borrado ✅", "ok");
    await fetchServers();
  } catch {
    alert("No se pudo conectar con la API para borrar.");
  }
}

[els.cpuPlan, els.ramPlan, els.storagePlan, els.osPlan].forEach((el) => {
  el.addEventListener("change", updateTotalUI);
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  createServer();
});

els.reloadBtn.addEventListener("click", fetchServers);

els.resetBtn.addEventListener("click", () => {
  els.form.reset();
  setMsg("");
  updateTotalUI();
});

els.cards.addEventListener("click", (e) => {
  const btn = e.target.closest(".js-delete");
  if (!btn) return;
  deleteServer(btn.dataset.id);
});

updateTotalUI();
fetchServers();
