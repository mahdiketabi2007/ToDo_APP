(() => {
  "use strict";
  const config = window.TASKLY_CONFIG || { DEMO_MODE: true, API_BASE_URL: "http://127.0.0.1:8000", ENDPOINTS: {} };
  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const message = document.getElementById("login-message");
  const submitButton = document.getElementById("login-submit");
  const demoHint = document.getElementById("demo-hint");
  const toast = document.getElementById("auth-toast");

  if (!config.DEMO_MODE) demoHint.hidden = true;

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  });

  document.getElementById("forgot-password")?.addEventListener("click", (event) => {
    event.preventDefault();
    showToast(config.DEMO_MODE
      ? "This is a demo screen. Password recovery can be connected to your backend later."
      : "Password recovery is not configured yet. Please contact the application administrator.");
  });

  usernameInput.addEventListener("input", () => clearFieldError("username-error"));
  passwordInput.addEventListener("input", () => clearFieldError("password-error"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    let valid = true;

    if (username.length < 3) {
      setFieldError("username-error", "Enter a username with at least 3 characters.");
      valid = false;
    }
    if (!password) {
      setFieldError("password-error", "Please enter your password.");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      if (config.DEMO_MODE) {
        // Demo mode intentionally stores only a display name, never a password.
        const user = { username, demo: true };
        localStorage.setItem("taskly_session", JSON.stringify(user));
        setMessage("Welcome back! Opening your workspace…", "success");
        window.location.href = "index.html";
        return;
      }

      const response = await fetch(`${config.API_BASE_URL}${config.ENDPOINTS.login}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(extractError(data, "Unable to sign in. Check your credentials."));

      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new Error("The server did not return both authentication tokens.");
      }

      localStorage.setItem("taskly_session", JSON.stringify({
        username,
        token: accessToken,
        refreshToken,
        demo: false
      }));
      window.location.href = "index.html";
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitButton.classList.toggle("is-loading", loading);
    submitButton.disabled = loading;
    submitButton.querySelector("span").textContent = loading ? "Signing in…" : "Sign in";
  }
  function setFieldError(id, text) { document.getElementById(id).textContent = text; }
  function clearFieldError(id) { document.getElementById(id).textContent = ""; }
  function clearMessages() {
    clearFieldError("username-error"); clearFieldError("password-error");
    message.textContent = ""; message.className = "form-message";
  }
  function setMessage(text, type) { message.textContent = text; message.className = `form-message is-visible is-${type}`; }
  function showToast(text) {
    toast.textContent = text; toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }
  async function readResponse(response) {
    const raw = await response.text();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return { detail: raw }; }
  }
  function extractError(data, fallback) {
    const detail = data?.detail || data?.message || data?.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join(" ");
    return fallback;
  }
})();
