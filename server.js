const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const DATA_DIR = process.env.DATA_DIR || __dirname;
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SECRET_FILE = path.join(DATA_DIR, ".session-secret");

// ---------- session secret (saved, para hindi ma-logout kapag nag-restart) ----------
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    return fs.readFileSync(SECRET_FILE, "utf8");
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, s);
    return s;
  }
}

// ---------- tiny user storage (JSON file) ----------
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanEmail = (v) => String(v || "").trim().toLowerCase();
const displayName = (email) => email.split("@")[0];

// ---------- middleware ----------
if (IS_PROD) app.set("trust proxy", 1); // host (Render/Railway) is a proxy
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: getSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: IS_PROD, maxAge: 1000 * 60 * 60 * 8 },
  })
);

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

// simple brute-force guard: max 5 fails per email per 10 min
const attempts = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
  attempts.set(key, list);
  return list.length >= 5;
}
function recordFail(key) {
  attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
}

// ---------- pages ----------
app.use("/static", express.static(path.join(__dirname, "public/static")));
app.use(express.static(path.join(__dirname, "site"))); // NEXORA website

app.get("/dashboard", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public/dashboard.html"))
);

// ---------- API ----------
app.post("/api/register", async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!EMAIL_RE.test(email) || email.length > 120)
    return res.status(400).json({ error: "Ilagay ang tamang email." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password dapat at least 8 characters." });

  const users = loadUsers();
  if (users.find((u) => u.email === email))
    return res.status(409).json({ error: "May account na ang email na yan. Mag-login na lang." });

  const hash = await bcrypt.hash(password, 10);
  users.push({ email, hash, createdAt: new Date().toISOString() });
  saveUsers(users);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error." });
    req.session.user = { email };
    res.json({ ok: true });
  });
});

app.post("/api/login", async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");

  if (tooManyAttempts(email))
    return res.status(429).json({ error: "Sobrang daming maling try. Subukan ulit after 10 minutes." });

  const user = loadUsers().find((u) => u.email === email);
  const ok = user && (await bcrypt.compare(password, user.hash));
  if (!ok) {
    recordFail(email);
    return res.status(401).json({ error: "Mali ang email o password." });
  }

  attempts.delete(email);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error." });
    req.session.user = { email: user.email };
    res.json({ ok: true });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  const { email } = req.session.user;
  res.json({ email, username: displayName(email) });
});

const HOST = process.env.HOST || (IS_PROD ? "0.0.0.0" : "127.0.0.1");
app.listen(PORT, HOST, () => {
  console.log(`Login app running at http://localhost:${PORT}`);
});