const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.json");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "app_state";
const STATE_KEY = process.env.STATE_KEY || "dienstplan";

const defaultData = {
  settings: {
    adminPin: "1234",
    businessName: "Dienstplan",
    employees: [
      "Kevin",
      "Daniel",
      "Anita",
      "Dennis",
      "Marc",
      "Christian Gaas",
      "Marco",
      "Ali",
      "Bianca",
      "Kevin Leicht"
    ],
    positions: ["Counter", "Service 1", "Service 2", "Service 3", "Service 4", "Service 5", "Kueche 1", "Reinigung"]
  },
  availability: {},
  schedules: {}
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readLocalData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeLocalData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function usesSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Fehler: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function readSupabaseData() {
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?key=eq.${encodeURIComponent(STATE_KEY)}&select=value&limit=1`);
  if (rows.length) {
    return { ...defaultData, ...rows[0].value };
  }
  await writeSupabaseData(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

async function writeSupabaseData(data) {
  await supabaseRequest(SUPABASE_TABLE, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      key: STATE_KEY,
      value: data,
      updated_at: new Date().toISOString()
    })
  });
}

async function readData() {
  return usesSupabase() ? readSupabaseData() : readLocalData();
}

async function writeData(data) {
  if (usesSupabase()) {
    await writeSupabaseData(data);
  } else {
    writeLocalData(data);
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isAuthed(req, data) {
  return req.headers["x-admin-pin"] === data.settings.adminPin;
}

function safeMonth(month) {
  return typeof month === "string" && /^\d{4}-\d{2}$/.test(month);
}

async function handleApi(req, res) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url, `https://${host}`);
  const data = await readData();

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      storage: usesSupabase() ? "supabase" : "local",
      stateKey: STATE_KEY
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const month = url.searchParams.get("month");
    if (!safeMonth(month)) {
      sendJson(res, 400, { error: "Ungueltiger Monat." });
      return;
    }
    sendJson(res, 200, {
      settings: data.settings,
      availability: data.availability[month] || {},
      schedule: data.schedules[month] || { month, published: false, days: {} }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/availability") {
    const body = await parseBody(req);
    if (!safeMonth(body.month) || !body.employee || !body.days || typeof body.days !== "object") {
      sendJson(res, 400, { error: "Bitte Name, Monat und Tage senden." });
      return;
    }
    if (!data.settings.employees.includes(body.employee)) {
      data.settings.employees.push(body.employee);
    }
    data.availability[body.month] ||= {};
    data.availability[body.month][body.employee] = body.days;
    await writeData(data);
    sendJson(res, 200, { ok: true, employees: data.settings.employees });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/schedule") {
    const body = await parseBody(req);
    if (!isAuthed(req, data)) {
      sendJson(res, 401, { error: "Falsche Admin-PIN." });
      return;
    }
    if (!safeMonth(body.month) || !body.days || typeof body.days !== "object") {
      sendJson(res, 400, { error: "Bitte Monat und Dienstplan senden." });
      return;
    }
    data.schedules[body.month] = {
      month: body.month,
      published: Boolean(body.published),
      updatedAt: new Date().toISOString(),
      days: body.days
    };
    await writeData(data);
    sendJson(res, 200, { ok: true, schedule: data.schedules[body.month] });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await parseBody(req);
    if (!isAuthed(req, data)) {
      sendJson(res, 401, { error: "Falsche Admin-PIN." });
      return;
    }
    if (Array.isArray(body.employees)) {
      data.settings.employees = [...new Set(body.employees.map(String).map((name) => name.trim()).filter(Boolean))];
    }
    if (Array.isArray(body.positions)) {
      data.settings.positions = [...new Set(body.positions.map(String).map((name) => name.trim()).filter(Boolean))];
    }
    if (typeof body.businessName === "string" && body.businessName.trim()) {
      data.settings.businessName = body.businessName.trim();
    }
    if (typeof body.adminPin === "string" && body.adminPin.trim()) {
      data.settings.adminPin = body.adminPin.trim();
    }
    await writeData(data);
    sendJson(res, 200, { ok: true, settings: data.settings });
    return;
  }

  sendJson(res, 404, { error: "API nicht gefunden." });
}

module.exports = {
  handleApi,
  usesSupabase
};
