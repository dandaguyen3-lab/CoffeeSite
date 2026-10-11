const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const { createBackend, emptyStore } = require("./db");
const backend = createBackend({
  dataDir: DATA_DIR,
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
});
const ADMIN_USER = process.env.ADMIN_USER || "admin";

// On a hosted server (PORT is set by the host) never fall back to a guessable password.
const HOSTED = Boolean(process.env.PORT) || process.env.NODE_ENV === "production";
let ADMIN_PASS = process.env.ADMIN_PASS;
let adminPassGenerated = false;
if (!ADMIN_PASS) {
  if (HOSTED) {
    ADMIN_PASS = crypto.randomBytes(9).toString("base64url");
    adminPassGenerated = true;
  } else {
    ADMIN_PASS = "kopiadmin";
  }
}

const SESSION_DAYS = 14;
const ADMIN_SESSION_HOURS = 12;

// Prices and limits live in public/pricing.js, shared with the browser.
const PRICING = require("./public/pricing.js");
const SIZES = PRICING.sizes;

const ORDER_STATUSES = ["incoming", "preparing", "ready", "completed", "cancelled"];

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
// Only the public/ folder is served. server.js, data/, README and package files are not reachable.
app.use(
  express.static(PUBLIC_DIR, {
    index: "landpage.html",
    setHeaders(res, filePath) {
      // Images rarely change, so browsers may keep them for a day. Pages, scripts and styles
      // are re-checked every time (a quick "not modified" reply when nothing changed).
      if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);
app.get("/healthz", (req, res) => res.json({ ok: true }));

let store = emptyStore(); // filled from the database before the server starts listening
const adminSse = new Set();
let orderSeq = 1000;

function saveStore() {
  backend.save(store);
}

function nextOrderSeq(orders) {
  let max = 1000;
  for (const order of orders || []) {
    const n = Number(String(order.number || "").replace(/\D/g, ""));
    if (n > max) max = n;
  }
  return max;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = value;
  });
  return out;
}

function setCookie(req, res, name, value, hours = 24 * SESSION_DAYS) {
  const maxAge = hours * 60 * 60;
  const secure = req.secure ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function pruneSessions() {
  const now = Date.now();
  const before = store.sessions.length + store.adminSessions.length;
  store.sessions = store.sessions.filter((s) => now - new Date(s.createdAt) < SESSION_DAYS * 864e5);
  store.adminSessions = store.adminSessions.filter(
    (s) => now - new Date(s.createdAt) < ADMIN_SESSION_HOURS * 36e5
  );
  if (before !== store.sessions.length + store.adminSessions.length) saveStore();
}

// Small in-memory limiter so the login/signup forms can't be hammered.
const hits = new Map();
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const entry = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (entry.length >= max) {
      return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
    }
    entry.push(now);
    hits.set(key, entry);
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) {
    if (!list.some((t) => now - t < 15 * 60 * 1000)) hits.delete(key);
  }
}, 10 * 60 * 1000).unref();

function clearCookie(res, name) {
  res.append("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Philippine mobile numbers only: 09 followed by 9 digits (11 digits total).
// Spaces, dashes and brackets typed by the customer are ignored.
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/[\s\-().]/g, "");
  return /^09\d{9}$/.test(digits) ? digits : null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone || "",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function getUserFromRequest(req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const session = store.sessions.find((s) => s.token === token);
  if (!session || Date.now() - new Date(session.createdAt) > SESSION_DAYS * 864e5) return null;
  return store.users.find((u) => u.id === session.userId) || null;
}

function getAdminFromRequest(req) {
  const token = parseCookies(req).adminSession;
  if (!token) return false;
  return store.adminSessions.some(
    (s) => s.token === token && Date.now() - new Date(s.createdAt) < ADMIN_SESSION_HOURS * 36e5
  );
}

function requireUser(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!getAdminFromRequest(req)) {
    return res.status(401).json({ error: "Staff login required." });
  }
  next();
}

function sanitizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Cart is empty.");
  }
  if (rawItems.length > 30) throw new Error("Too many items in one order.");
  const maxDrinks = PRICING.maxDrinksPerOrder;
  let drinks = 0;

  const items = rawItems.map((item) => {
    const size = item.size;
    if (!SIZES[size]) throw new Error("Choose a valid size.");

    const quantity = Math.max(1, Math.floor(Number(item.quantity)) || 1);
    drinks += quantity;
    if (drinks > maxDrinks) {
      throw new Error(`You can order up to ${maxDrinks} drinks at a time.`);
    }

    // Only the known extras are kept, and each is capped. Anything else is dropped.
    const customizations = {};
    if (item.customizations && typeof item.customizations === "object") {
      for (const [key, value] of Object.entries(item.customizations)) {
        if (!PRICING.extras[key]) continue;
        const qty = Math.floor(Number(value));
        if (!(qty > 0)) continue;
        if (qty > PRICING.maxPerExtra) {
          throw new Error(`You can add at most ${PRICING.maxPerExtra} of each extra.`);
        }
        customizations[key] = qty;
      }
    }

    // The price is always worked out here, never taken from the browser.
    const unitPrice = PRICING.unitPrice(size, customizations);
    return {
      name: String(item.name || "Coffee").slice(0, 80),
      size,
      quantity,
      unitPrice,
      price: unitPrice,
      extrasCharge: PRICING.extrasCost(customizations),
      image: String(item.image || "").slice(0, 240),
      customizations,
    };
  });
  return items;
}

function adminUsers() {
  return store.users
    .map((user) => ({
      ...publicUser(user),
      orderCount: store.orders.filter((o) => o.customer.id === user.id).length,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function adminSnapshot() {
  return { type: "snapshot", orders: store.orders, users: adminUsers() };
}

// Pushes new orders, status changes and new sign-ups to every open staff desk.
function broadcastAdmin() {
  if (!adminSse.size) return;
  const payload = `data: ${JSON.stringify(adminSnapshot())}\n\n`;
  for (const client of adminSse) {
    client.write(payload);
  }
}

app.get("/api/me", (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not logged in." });
  res.json(publicUser(user));
});

function startSession(req, res, user) {
  user.lastLoginAt = new Date().toISOString();
  const token = crypto.randomBytes(24).toString("hex");
  store.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  pruneSessions();
  saveStore();
  setCookie(req, res, "session", token);
}

app.post("/api/register", rateLimit("register", 10, 15 * 60 * 1000), (req, res) => {
  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "").trim();
  const password = String(req.body.password || "");
  const phone = normalizePhone(req.body.phone);

  if (!/^[A-Za-z0-9_.-]{2,30}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 2–30 characters: letters, numbers, dot, dash or underscore." });
  }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }
  if (!phone) {
    return res.status(400).json({ error: "Enter a valid mobile number that starts with 09 (11 digits), for example 09171234567." });
  }
  if (password.length < 6 || password.length > 200) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "That username is taken." });
  }
  if (store.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username,
    email,
    phone,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  store.users.push(user);
  startSession(req, res, user); // signed in straight away, no second login screen
  broadcastAdmin();
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/login", rateLimit("login", 20, 15 * 60 * 1000), (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = store.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: "Username or password is incorrect." });
  }
  startSession(req, res, user);
  broadcastAdmin();
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  const token = parseCookies(req).session;
  store.sessions = store.sessions.filter((s) => s.token !== token);
  saveStore();
  clearCookie(res, "session");
  res.json({ ok: true });
});

app.post("/api/orders", requireUser, (req, res) => {
  let items;
  try {
    items = sanitizeItems(req.body.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const total = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0) / 100;
  orderSeq += 1;
  const order = {
    id: crypto.randomUUID(),
    number: `KK-${orderSeq}`,
    status: "incoming",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      phone: req.user.phone || "",
    },
    items,
    total: Number(total.toFixed(2)),
  };
  store.orders.unshift(order);
  saveStore();
  broadcastAdmin();
  res.json({ ok: true, order });
});

app.get("/api/my-orders", requireUser, (req, res) => {
  const orders = store.orders.filter((o) => o.customer.id === req.user.id);
  res.set("Cache-Control", "no-store");
  res.json({ orders });
});

// One order, for the e-receipt. Customers can only open their own orders.
app.get("/api/orders/:id", requireUser, (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id && o.customer.id === req.user.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.set("Cache-Control", "no-store");
  res.json({ order });
});

app.post("/api/admin/login", rateLimit("admin", 8, 15 * 60 * 1000), (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const userOk = safeEqual(username.toLowerCase(), ADMIN_USER.toLowerCase());
  const passOk = safeEqual(password, ADMIN_PASS);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: "Staff username or password is incorrect." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  store.adminSessions.push({ token, createdAt: new Date().toISOString() });
  pruneSessions();
  saveStore();
  setCookie(req, res, "adminSession", token, ADMIN_SESSION_HOURS);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = parseCookies(req).adminSession;
  store.adminSessions = store.adminSessions.filter((s) => s.token !== token);
  saveStore();
  clearCookie(res, "adminSession");
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, username: ADMIN_USER });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  res.json({ users: adminUsers() });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  res.json({ orders: store.orders });
});

app.get("/api/admin/orders/stream", requireAdmin, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // stop nginx-style proxies from holding the stream back
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(adminSnapshot())}\n\n`);
  adminSse.add(res);
  const ping = setInterval(() => res.write("event: ping\ndata: {}\n\n"), 15000);
  req.on("close", () => {
    clearInterval(ping);
    adminSse.delete(res);
  });
});

app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  const status = String(req.body.status || "");
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveStore();
  broadcastAdmin();
  res.json({ ok: true, order });
});

async function start() {
  store = await backend.load();
  pruneSessions();
  orderSeq = nextOrderSeq(store.orders);

  app.listen(PORT, () => {
    console.log(`Kopi Ko running on port ${PORT}`);
    console.log(`Staff desk: /admin.html  (user: ${ADMIN_USER})`);
    if (adminPassGenerated) {
      console.log(`ADMIN_PASS is not set, so a temporary staff password was generated: ${ADMIN_PASS}`);
      console.log("Set ADMIN_PASS in your host's environment settings to choose your own.");
    } else if (!process.env.ADMIN_PASS) {
      console.log("Local mode: staff login is admin / kopiadmin. Set ADMIN_PASS before deploying.");
    }
    console.log(`Storage: ${backend.name}`);
    console.log(`Loaded ${store.users.length} customers and ${store.orders.length} orders.`);
  });
}

// Finish pending database writes before the host restarts or redeploys us.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    await backend.flush();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error("Could not start:", err);
  process.exit(1);
});
