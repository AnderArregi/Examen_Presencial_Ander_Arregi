import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// Helpers para rutas en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "db.json");

// Middlewares
app.use(cors());
app.use(express.json());

// ---------- Utilidades DB ----------
async function readDB() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeDB(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function validateServerPayload(payload, { partial = false } = {}) {
  // Campos esperados
  const errors = [];

  // En POST (partial=false), exigimos ciertos campos
  const requiredFields = ["name", "cpu", "ram", "storage", "os", "budget"];
  if (!partial) {
    for (const f of requiredFields) {
      if (payload?.[f] === undefined || payload?.[f] === null || payload?.[f] === "") {
        errors.push(`El campo '${f}' es obligatorio.`);
      }
    }
  }

  // Validación budget si viene
  if (payload?.budget !== undefined) {
    const budget = toNumber(payload.budget);
    if (Number.isNaN(budget)) errors.push("El presupuesto (budget) debe ser numérico.");
    if (!Number.isNaN(budget) && budget > 700) errors.push("El presupuesto no puede superar 700€.");
    if (!Number.isNaN(budget) && budget < 0) errors.push("El presupuesto no puede ser negativo.");
  }

  // Longitudes básicas
  if (payload?.name !== undefined && String(payload.name).trim().length < 3) {
    errors.push("El nombre debe tener al menos 3 caracteres.");
  }

  return errors;
}

// ---------- Rutas ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "catalogo-servidores-backend", time: new Date().toISOString() });
});

// GET all
app.get("/api/servers", async (_req, res) => {
  try {
    const db = await readDB();
    res.json(db.servers ?? []);
  } catch (err) {
    res.status(500).json({ message: "Error leyendo la base de datos." });
  }
});

// GET by id
app.get("/api/servers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await readDB();
    const item = (db.servers ?? []).find((s) => s.id === id);
    if (!item) return res.status(404).json({ message: "Servidor no encontrado." });
    res.json(item);
  } catch {
    res.status(500).json({ message: "Error leyendo la base de datos." });
  }
});

// POST create (valida budget <= 700)
app.post("/api/servers", async (req, res) => {
  try {
    const payload = req.body;

    const errors = validateServerPayload(payload, { partial: false });
    if (errors.length) return res.status(400).json({ message: "Validación fallida.", errors });

    const db = await readDB();
    db.servers = db.servers ?? [];

    const maxId = db.servers.reduce((acc, s) => Math.max(acc, s.id ?? 0), 0);
    const newServer = {
      id: maxId + 1,
      name: String(payload.name).trim(),
      cpu: String(payload.cpu).trim(),
      ram: String(payload.ram).trim(),
      storage: String(payload.storage).trim(),
      os: String(payload.os).trim(),
      budget: Number(payload.budget),
      status: payload.status ? String(payload.status).trim() : "activo",
      createdAt: new Date().toISOString()
    };

    db.servers.push(newServer);
    await writeDB(db);

    // 201 Created
    res.status(201).json(newServer);
  } catch (err) {
    res.status(500).json({ message: "Error guardando el servidor." });
  }
});

// PUT update completo
app.put("/api/servers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body;

    const errors = validateServerPayload(payload, { partial: false });
    if (errors.length) return res.status(400).json({ message: "Validación fallida.", errors });

    const db = await readDB();
    db.servers = db.servers ?? [];
    const index = db.servers.findIndex((s) => s.id === id);
    if (index === -1) return res.status(404).json({ message: "Servidor no encontrado." });

    const updated = {
      ...db.servers[index],
      name: String(payload.name).trim(),
      cpu: String(payload.cpu).trim(),
      ram: String(payload.ram).trim(),
      storage: String(payload.storage).trim(),
      os: String(payload.os).trim(),
      budget: Number(payload.budget),
      status: payload.status ? String(payload.status).trim() : db.servers[index].status
    };

    db.servers[index] = updated;
    await writeDB(db);

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Error actualizando el servidor." });
  }
});

// PATCH update parcial
app.patch("/api/servers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body;

    const errors = validateServerPayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: "Validación fallida.", errors });

    const db = await readDB();
    db.servers = db.servers ?? [];
    const index = db.servers.findIndex((s) => s.id === id);
    if (index === -1) return res.status(404).json({ message: "Servidor no encontrado." });

    const prev = db.servers[index];
    const updated = {
      ...prev,
      ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}),
      ...(payload.cpu !== undefined ? { cpu: String(payload.cpu).trim() } : {}),
      ...(payload.ram !== undefined ? { ram: String(payload.ram).trim() } : {}),
      ...(payload.storage !== undefined ? { storage: String(payload.storage).trim() } : {}),
      ...(payload.os !== undefined ? { os: String(payload.os).trim() } : {}),
      ...(payload.budget !== undefined ? { budget: Number(payload.budget) } : {}),
      ...(payload.status !== undefined ? { status: String(payload.status).trim() } : {})
    };

    db.servers[index] = updated;
    await writeDB(db);

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Error actualizando parcialmente." });
  }
});

// DELETE
app.delete("/api/servers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const db = await readDB();
    db.servers = db.servers ?? [];
    const index = db.servers.findIndex((s) => s.id === id);
    if (index === -1) return res.status(404).json({ message: "Servidor no encontrado." });

    const deleted = db.servers.splice(index, 1)[0];
    await writeDB(db);

    res.json({ message: "Servidor eliminado.", deleted });
  } catch {
    res.status(500).json({ message: "Error eliminando el servidor." });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ message: "Ruta no encontrada." });
});

// Start
app.listen(PORT, () => {
  console.log(`✅ API corriendo en http://localhost:${PORT}`);
  console.log(`➡️  GET http://localhost:${PORT}/api/servers`);
});
