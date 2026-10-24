const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "users.json");

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

// ---------- middleware ----------
const cors = require("cors");

app.set("trust proxy", 1); // trust first proxy (if behind reverse proxy)

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: crypto.randomBytes(32).toString("hex"), // new secret every restart = logout on restart
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 },
  })
);

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// simple brute-force guard: max 5 fails per username per 10 min
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

// Serve your NEXORA website (put its files inside the "site" folder)
app.use(express.static(path.join(__dirname, "site")));

// ---------- pages ----------
app.use("/static", express.static(path.join(__dirname, "public/static")));

app.get("/", (req, res) => res.redirect(req.session.user ? "/dashboard" : "/login"));
app.get("/login", (req, res) =>
  req.session.user ? res.redirect("/dashboard") : res.sendFile(path.join(__dirname, "public/login.html"))
);
app.get("/register", (req, res) =>
  req.session.user ? res.redirect("/dashboard") : res.sendFile(path.join(__dirname, "public/register.html"))
);
app.get("/dashboard", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public/dashboard.html"))
);

// ---------- API ----------
app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Username: 3-20 chars, letters/numbers/underscore lang." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password dapat at least 8 characters." });

  const users = loadUsers();
  if (users.find((u) => u.username === username))
    return res.status(409).json({ error: "Kinuha na yung username na yan." });

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, hash, createdAt: new Date().toISOString() });
  saveUsers(users);

  req.session.user = { username };
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (tooManyAttempts(username))
    return res.status(429).json({ error: "Sobrang daming maling try. Subukan ulit after 10 minutes." });

  const user = loadUsers().find((u) => u.username === username);
  const ok = user && (await bcrypt.compare(password, user.hash));
  if (!ok) {
    recordFail(username);
    return res.status(401).json({ error: "Mali ang username o password." });
  }

  attempts.delete(username);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error." });
    req.session.user = { username: user.username };
    res.json({ ok: true });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Login app running at http://localhost:${PORT}`);
});
