document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 1. Hands follow the mouse (desktop only) ---------- */
  const hero  = document.querySelector(".hero");
  const hands = document.querySelector(".hands");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (hero && hands && canHover) {
    hero.addEventListener("mousemove", (e) => {
      const r  = hero.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      const ny = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      hands.style.setProperty("--px", (nx * 35).toFixed(1) + "px");
      hands.style.setProperty("--py", (ny * 20).toFixed(1) + "px");
    });
    hero.addEventListener("mouseleave", () => {
      hands.style.setProperty("--px", "0px");
      hands.style.setProperty("--py", "0px");
    });
  }

  /* ---------- 2. Login popup (REAL login via the Node server) ---------- */
  const dialog    = document.getElementById("loginDialog");
  const form      = document.getElementById("loginForm");
  const loginLink = document.getElementById("loginLink");
  const userBox   = document.getElementById("userBox");
  const userName  = document.getElementById("userName");
  const logoutBtn = document.getElementById("logoutBtn");
  if (!dialog || !form || !loginLink) return;

  const title     = dialog.querySelector("h1, h2, h3");
  const subtitle  = title ? title.nextElementSibling : null;
  const submitBtn = [...form.querySelectorAll("button")].find((b) => b.type === "submit");

  // palitan ang "Demo login..." na note
  const note = [...dialog.querySelectorAll("p, small, span, div")].find(
    (el) => el.children.length === 0 && /demo login/i.test(el.textContent)
  );
  if (note) note.textContent = "Ang account mo ay nase-save sa server. Naka-hash ang password.";

  // error message box
  const errBox = document.createElement("div");
  errBox.setAttribute("role", "alert");
  errBox.style.cssText = "color:#c0392b;font-size:.9rem;min-height:1.2em;margin:10px 0 0;";
  if (submitBtn) submitBtn.parentNode.insertBefore(errBox, submitBtn);
  else form.appendChild(errBox);

  // toggle Login <-> Register
  const switchWrap = document.createElement("p");
  switchWrap.style.cssText = "text-align:center;margin:14px 0 0;font-size:.9rem;";
  const switchText = document.createElement("span");
  const switchBtn = document.createElement("button");
  switchBtn.type = "button";
  switchBtn.style.cssText =
    "background:none;border:0;padding:0;margin-left:6px;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer;color:inherit;width:auto;";
  switchWrap.append(switchText, switchBtn);
  form.parentNode.insertBefore(switchWrap, form.nextSibling);

  let mode = "login"; // "login" | "register"

  function setMode(m) {
    mode = m;
    errBox.textContent = "";
    const isLogin = m === "login";
    if (title) title.textContent = isLogin ? "Welcome back" : "Create account";
    if (subtitle) subtitle.textContent = isLogin ? "Log in to your account." : "Gumawa ng bagong account.";
    if (submitBtn) submitBtn.textContent = isLogin ? "Log in" : "Sign up";
    switchText.textContent = isLogin ? "Wala pang account?" : "May account na?";
    switchBtn.textContent = isLogin ? "Sign up" : "Log in";
    if (form.password) form.password.autocomplete = isLogin ? "current-password" : "new-password";
  }
  switchBtn.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));
  setMode("login");

  async function refreshUser() {
    try {
      const r = await fetch("/api/me");
      const u = r.ok ? await r.json() : null;
      loginLink.hidden = !!u;
      if (userBox) userBox.hidden = !u;
      if (u && userName) {
        userName.textContent = "";
        const a = document.createElement("a");
        a.href = "/dashboard";
        a.textContent = u.username;
        a.style.cssText = "color:inherit;text-decoration:underline;";
        userName.appendChild(a);
      }
    } catch {
      loginLink.hidden = false;
      if (userBox) userBox.hidden = true;
    }
  }

  loginLink.addEventListener("click", (e) => {
    e.preventDefault();
    setMode("login");
    dialog.showModal();
    form.email.focus();
  });

  dialog.querySelector(".modal-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.textContent = "";
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch(mode === "login" ? "/api/login" : "/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.value, password: form.password.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        form.reset();
        dialog.close();
        location.href = "/dashboard";   // pumunta sa member page
        return;
      } else {
        errBox.textContent = data.error || "May error. Subukan ulit.";
      }
    } catch {
      errBox.textContent = "Hindi maabot ang server. Naka-run ba ang npm start? Buksan ang http://localhost:3000";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    await refreshUser();
  });

  refreshUser();
});