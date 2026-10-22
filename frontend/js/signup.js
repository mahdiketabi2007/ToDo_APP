(() => {
  "use strict";
  const config = window.TASKLY_CONFIG || { DEMO_MODE: true, API_BASE_URL: "http://127.0.0.1:8000", ENDPOINTS: {} };
  const form = document.getElementById("signup-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm-password");
  const message = document.getElementById("signup-message");
  const submitButton = document.getElementById("signup-submit");
  const demoHint = document.getElementById("demo-hint");
  const strengthMeter = document.getElementById("password-strength");
  const passwordHint = document.getElementById("password-hint");

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

  usernameInput.addEventListener("input", () => clearFieldError("username-error"));
  passwordInput.addEventListener("input", () => {
    clearFieldError("password-error");
    updateStrength(passwordInput.value);
    if (confirmInput.value) validateConfirmation(false);
  });
  confirmInput.addEventListener("input", () => clearFieldError("confirm-password-error"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirmation = confirmInput.value;
    let valid = true;

    if (username.length < 3) {
      setFieldError("username-error", "Username must contain at least 3 characters."); valid = false;
    }
    if (password.length < 8) {
      setFieldError("password-error", "Use at least 8 characters for your password."); valid = false;
    }
    if (password !== confirmation) {
      setFieldError("confirm-password-error", "Your passwords don't match yet."); valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      if (config.DEMO_MODE) {
        // Demo mode does not create a server account and never persists the password.
        localStorage.setItem("taskly_session", JSON.stringify({ username, demo: true }));
        setMessage("Your demo workspace is ready. Opening it now…", "success");
        window.location.href = "index.html";
        return;
      }

      const response = await fetch(`${config.API_BASE_URL}${config.ENDPOINTS.signup}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ username, password, password_confirm: confirmation })
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(extractError(data, "Unable to create your account. Please try again."));

      const token = data.access_token || data.token || data.data?.access_token || null;
      if (token) {
        localStorage.setItem("taskly_session", JSON.stringify({ username: data.username || data.user?.username || username, token, demo: false }));
        window.location.href = "index.html";
      } else {
        setMessage("Account created successfully. Redirecting you to sign in…", "success");
        window.setTimeout(() => { window.location.href = "login.html"; }, 1100);
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  });

  function updateStrength(value) {
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    strengthMeter.dataset.strength = value.length ? String(Math.max(1, score)) : "0";
    if (!value) passwordHint.textContent = "Use at least 8 characters.";
    else if (value.length < 8) passwordHint.textContent = "A little longer — use at least 8 characters.";
    else if (score <= 1) passwordHint.textContent = "Good start. Add a number or symbol to make it stronger.";
    else if (score <= 2) passwordHint.textContent = "Getting stronger. Consider mixing letter cases and symbols.";
    else passwordHint.textContent = "Nice. Your password has a good mix of characters.";
  }
  function validateConfirmation(showError = true) {
    const matches = passwordInput.value === confirmInput.value;
    if (showError && !matches) setFieldError("confirm-password-error", "Your passwords don't match yet.");
    else if (matches) clearFieldError("confirm-password-error");
    return matches;
  }
  function setLoading(loading) {
    submitButton.classList.toggle("is-loading", loading);
    submitButton.disabled = loading;
    submitButton.querySelector("span").textContent = loading ? "Creating account…" : "Create account";
  }
  function setFieldError(id, text) { document.getElementById(id).textContent = text; }
  function clearFieldError(id) { document.getElementById(id).textContent = ""; }
  function clearMessages() {
    ["username-error", "password-error", "confirm-password-error"].forEach(clearFieldError);
    message.textContent = ""; message.className = "form-message";
  }
  function setMessage(text, type) { message.textContent = text; message.className = `form-message is-visible is-${type}`; }
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
