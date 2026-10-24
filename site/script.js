document.addEventListener("DOMContentLoaded", () => {
  // ---------- 1. Hero animation: preserve ----------
  const hero = document.querySelector(".hero");
  const hands = document.querySelector(".hands");
  const canHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  if (hero && hands && canHover) {
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;

      hands.style.setProperty("--px", (nx * 35).toFixed(1) + "px");
      hands.style.setProperty("--py", (ny * 20).toFixed(1) + "px");
    });

    hero.addEventListener("mouseleave", () => {
      hands.style.setProperty("--px", "0px");
      hands.style.setProperty("--py", "0px");
    });
  }

  // ---------- 2. Login modal + server authentication ----------
  const dialog = document.getElementById("loginDialog");
  const form = document.getElementById("loginForm");
  const loginLink = document.getElementById("loginLink");
  const userBox = document.getElementById("userBox");
  const userName = document.getElementById("userName");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!dialog || !form || !loginLink) {
    console.error("Login modal elements are missing.");
    return;
  }

  const API_BASE = "YOUR_RENDER_BACKEND_URL";
  const emailInput = form.querySelector('[name="email"]');
  const passwordInput = form.querySelector('[name="password"]');

  let errorBox = document.getElementById("loginError");

  if (!errorBox) {
    errorBox = document.createElement("p");
    errorBox.id = "loginError";
    errorBox.setAttribute("role", "alert");
    form.appendChild(errorBox);
  }

  function showError(message) {
    errorBox.textContent = message;
  }

  function renderUser(user) {
    const loggedIn = Boolean(user);

    loginLink.hidden = loggedIn;

    if (userBox) userBox.hidden = !loggedIn;

    if (loggedIn && userName) {
      userName.textContent = user.username || user.email || "User";
    }
  }

  loginLink.addEventListener("click", (e) => {
    e.preventDefault();

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }

    if (emailInput) emailInput.focus();
    showError("");
  });

  const closeButton = dialog.querySelector(".modal-close");

  if (closeButton) {
    closeButton.addEventListener("click", () => dialog.close());
  }

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    if (!emailInput || !passwordInput) {
      showError("Login form fields are missing.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }
       
      // Confirm the server session before showing logged-in state.
      const meResponse = await fetch(`${API_BASE}/api/me`, {
        credentials: "include"
      });

      if (!meResponse.ok) {
        throw new Error(
          "Login response received, but the session could not be verified."
        );
      }

      const user = await meResponse.json();

      renderUser(user);
      form.reset();
      dialog.close();
    } catch (error) {
      showError(
        error.message === "Failed to fetch"
          ? "Cannot connect to the server. Check your backend URL and CORS settings."
          : error.message
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const response = await fetch(`${API_BASE}/api/logout`, {
          method: "POST",
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Logout failed.");
        }

        renderUser(null);
        location.reload();
      } catch (error) {
        console.error("Logout error:", error);
        alert("Could not log out. Please check your connection.");
      }
    });
  }

  // Check whether a valid session already exists.
  async function checkSession() {
    try {
      const response = await fetch(`${API_BASE}/api/me`, {
        credentials: "include"
      });

      if (!response.ok) {
        renderUser(null);
        return;
      }

      const user = await response.json();
      renderUser(user);
    } catch (error) {
      console.error("Session check failed:", error);
      renderUser(null);
    }
  }

  checkSession();
});