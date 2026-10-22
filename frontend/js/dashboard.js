(() => {
  "use strict";
  const config = window.TASKLY_CONFIG || { DEMO_MODE: false, API_BASE_URL: "http://127.0.0.1:8000", ENDPOINTS: { tasks: "/tasks/" } };
  let session = readSession();
  if (!session) {
    window.location.replace("login.html");
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const taskList = $("#task-list");
  const emptyState = $("#empty-state");
  const modal = $("#task-modal");
  const taskForm = $("#task-form");
  const titleInput = $("#task-title");
  const descriptionInput = $("#task-description");
  const searchInput = $("#task-search");
  const toast = $("#toast");
  const confirmModal = $("#confirm-modal");
  const confirmTitle = $("#confirm-title");
  const confirmMessage = $("#confirm-message");
  const confirmAccept = $("#confirm-accept");
  const confirmCancel = $("#confirm-cancel");
  const confirmIcon = $("#confirm-icon");

  let confirmCallback = null;
  const userName = session.username || "Mahdi";
  const taskStorageKey = `taskly_tasks_${userName.toLowerCase()}`;

  let tasks = [];
  let currentFilter = "all";
  let searchTerm = "";
  let sortNewestFirst = true;
  let editingId = null;
  let toastTimer = null;
  let lastFocusedElement = null;

  initializePage();

  async function initializePage() {
    const displayName = userName.trim() || "there";
    const safeName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    $("#sidebar-username").textContent = safeName;
    $("#sidebar-avatar").textContent = safeName.charAt(0).toUpperCase();
    $("#topbar-avatar").textContent = safeName.charAt(0).toUpperCase();
    $("#welcome-heading").innerHTML = `Good to see you, ${escapeHTML(safeName)}<span class="heading-sparkle"> ✦</span>`;
    const now = new Date();
    $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
    $("#welcome-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now).toUpperCase();
    if (config.DEMO_MODE) {
      const stored = readStoredTasks();
      tasks = Array.isArray(stored) ? stored : seedTasks();
      if (!Array.isArray(stored)) persistDemoTasks();
      render();
    } else {
      try {
        await loadRemoteTasks();
        render();
      } catch (error) {
        render();
        showToast(error.message || "Couldn't load tasks from the API.");
      }
    }
  }

  // ----- Task data -----
  function seedTasks() {
    const now = Date.now();
    return [
      { id: "demo-1", title: "Map out the next API endpoints", description: "Review the task routes and write down what the frontend needs from the backend.", is_completed: false, created_date: new Date(now - 1000 * 60 * 35).toISOString() },
      { id: "demo-2", title: "Polish the project README", description: "Add setup steps, a short feature list, and a clear project structure for GitHub.", is_completed: false, created_date: new Date(now - 1000 * 60 * 60 * 3).toISOString() },
      { id: "demo-3", title: "Review SQLAlchemy relationships", description: "Double-check the UserModel and TaskModel relationship before adding authentication.", is_completed: true, created_date: new Date(now - 1000 * 60 * 60 * 26).toISOString() }
    ];
  }
  function readStoredTasks() {
    try {
      const raw = localStorage.getItem(taskStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function persistDemoTasks() {
    if (config.DEMO_MODE) localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
  }
  function readSession() {
    try {
      const raw = localStorage.getItem("taskly_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  let refreshPromise = null;

  async function refreshAccessToken() {
    if (!session?.refreshToken) {
      return false;
    }

    // Prevent multiple simultaneous refresh requests.
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const endpoint =
          config.ENDPOINTS.refreshToken || "/users/refresh-token";

        const response = await fetch(
          `${config.API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              token: session.refreshToken
            })
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.access_token) {
          return false;
        }

        session = {
          ...session,
          token: data.access_token
        };

        localStorage.setItem(
          "taskly_session",
          JSON.stringify(session)
        );

        return true;
      })().finally(() => {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  async function apiRequest(path, options = {}, retry = true) {
    const headers = {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {})
    };

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(
      `${config.API_BASE_URL}${path}`,
      {
        ...options,
        headers
      }
    );

    if (
      response.status === 401 &&
      retry &&
      !config.DEMO_MODE
    ) {
      let refreshed = false;

      try {
        refreshed = await refreshAccessToken();
      } catch {
        throw new Error(
          "Could not refresh your session. Check your connection and try again."
        );
      }

      if (refreshed) {
        return apiRequest(path, options, false);
      }

      localStorage.removeItem("taskly_session");
      window.location.replace("login.html");

      throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 204) {
      return null;
    }

    const raw = await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { detail: raw };
      }
    }

    if (!response.ok) {
      const detail =
        data?.detail ||
        data?.message ||
        `Request failed (${response.status})`;

      throw new Error(
        Array.isArray(detail)
          ? detail.map((item) => item.msg || String(item)).join(" ")
          : String(detail)
      );
    }

    return data;
  }
  function tasksEndpoint() { return config.ENDPOINTS.tasks || "/tasks/"; }
  function taskEndpoint(id) { return `${tasksEndpoint().replace(/\/$/, "")}/${encodeURIComponent(id)}`; }
  async function loadRemoteTasks() {
    const data = await apiRequest(tasksEndpoint());
    const collection = Array.isArray(data) ? data : (data?.items || data?.tasks || data?.data || []);
    tasks = Array.isArray(collection) ? collection.map(normalizeTask) : [];
  }
  function normalizeTask(task) {
    return { id: task.id, title: task.title || "Untitled task", description: task.description || "", is_completed: Boolean(task.is_completed ?? task.is_done ?? false), created_date: task.created_date || task.created_at || null, updated_date: task.updated_date || null };
  }

  // ----- Rendering -----
  function render() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.is_completed).length;
    const active = total - completed;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    $("#stat-total").textContent = total;
    $("#stat-active").textContent = active;
    $("#stat-completed").textContent = completed;
    $("#nav-all-count").textContent = total;
    $("#nav-active-count").textContent = active;
    $("#nav-completed-count").textContent = completed;
    $("#progress-percent").textContent = `${percentage}%`;
    $("#progress-ring").style.setProperty("--progress", `${percentage * 3.6}deg`);
    $("#progress-caption").textContent = total === 0 ? "A fresh start" : percentage === 100 ? "Everything is complete!" : `${completed} of ${total} tasks done`;
    $("#progress-subcaption").textContent = total === 0 ? "Add a task to get your momentum going." : percentage === 100 ? "You made it happen. Take a little victory lap." : `${active} ${active === 1 ? "task" : "tasks"} left to keep moving.`;

    const filtered = getVisibleTasks();
    $("#visible-task-count").textContent = filtered.length;
    taskList.innerHTML = filtered.map(taskTemplate).join("");
    taskList.hidden = filtered.length === 0;
    emptyState.hidden = filtered.length !== 0;
    $("#list-footer").hidden = filtered.length === 0;
    updateEmptyCopy(total);
  }
  function getVisibleTasks() {
    let visible = tasks.filter((task) => currentFilter === "all" || (currentFilter === "active" ? !task.is_completed : task.is_completed));
    if (searchTerm) {
      const query = searchTerm.toLocaleLowerCase();
      visible = visible.filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase().includes(query));
    }
    visible.sort((a, b) => {
      const aDate = safeDate(a.created_date)?.getTime() || 0;
      const bDate = safeDate(b.created_date)?.getTime() || 0;
      return sortNewestFirst ? bDate - aDate : aDate - bDate;
    });
    return visible;
  }
  function taskTemplate(task) {
    const done = Boolean(task.is_completed);
    const dateText = formatDate(task.created_date);
    return `<article class="task-row${done ? " is-completed" : ""}" data-task-id="${escapeHTML(String(task.id))}">
      <button class="task-check${done ? " is-checked" : ""}" type="button" data-action="toggle" aria-label="${done ? "Mark as not completed" : "Mark as completed"}" aria-pressed="${done}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
      <div class="task-main"><h3 class="task-title">${escapeHTML(task.title)}</h3>${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ""}<div class="task-meta"><span class="task-status${done ? " status-completed" : ""}">${done ? "Completed" : "In progress"}</span><span>${dateText ? `Created ${escapeHTML(dateText)}` : "No date"}</span></div></div>
      <div class="task-actions"><button class="task-action" type="button" data-action="edit" aria-label="Edit task"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/></svg></button><button class="task-action delete-action" type="button" data-action="delete" aria-label="Delete task"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button></div>
    </article>`;
  }
  function updateEmptyCopy(total) {
    if (searchTerm) {
      $("#empty-title").textContent = "No matching tasks.";
      $("#empty-copy").textContent = "Try another search term or clear the search field.";
      $("#empty-add-button").hidden = true;
    } else if (currentFilter === "completed") {
      $("#empty-title").textContent = "Your wins are waiting.";
      $("#empty-copy").textContent = "Complete a task and it will appear here.";
      $("#empty-add-button").hidden = true;
    } else if (currentFilter === "active" && total > 0) {
      $("#empty-title").textContent = "Nothing left in progress.";
      $("#empty-copy").textContent = "All tasks are complete. Enjoy the breathing room.";
      $("#empty-add-button").hidden = false;
    } else {
      $("#empty-title").textContent = "A clear path ahead.";
      $("#empty-copy").textContent = "Add your first task and turn your plans into progress.";
      $("#empty-add-button").hidden = false;
    }
  }

  function safeDate(value) {
    if (!value) return null;

    let normalized = value;

    if (typeof value === "string") {
      normalized = value.trim();

      if (
        normalized.includes(" ") &&
        !normalized.includes("T")
      ) {
        normalized = normalized.replace(" ", "T");
      }
    }

    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = safeDate(value);
    if (!date) return "";
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay) return `today, ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
    if (date.toDateString() === yesterday.toDateString()) return `yesterday, ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  // ----- Confirm modal -----
  function openConfirm({ title, message, acceptText = "Confirm", type = "delete", onAccept }) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmAccept.textContent = acceptText;
    confirmIcon.textContent = type === "logout" ? "↪" : "!";
    confirmModal.classList.toggle("is-logout", type === "logout");

    confirmCallback = onAccept;
    confirmModal.hidden = false;
    document.body.classList.add("modal-open");

    confirmCancel.focus();
  }

  function closeConfirm() {
    confirmModal.hidden = true;
    confirmCallback = null;

    if (modal.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  confirmCancel.addEventListener("click", closeConfirm);

  confirmModal.querySelectorAll("[data-confirm-cancel]").forEach((element) => {
    element.addEventListener("click", closeConfirm);
  });

  confirmAccept.addEventListener("click", async () => {
    const callback = confirmCallback;
    if (!callback) return;

    confirmAccept.disabled = true;

    try {
      await callback();
      closeConfirm();
    } catch (error) {
      showToast(error.message || "Something went wrong.", "error");
    } finally {
      confirmAccept.disabled = false;
    }
  });

  // ----- Create / edit / delete -----
  function openModal(task = null) {
    lastFocusedElement = document.activeElement;
    editingId = task ? task.id : null;
    $("#modal-heading").textContent = task ? "Edit task" : "Create a task";
    $("#task-submit").querySelector("span").textContent = task ? "Save changes" : "Save task";
    titleInput.value = task?.title || "";
    descriptionInput.value = task?.description || "";
    $("#task-form-error").textContent = "";
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => titleInput.focus(), 30);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    editingId = null;
    taskForm.reset();
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }
  function showToast(text, type = "success") {
    $("#toast-message").textContent = text;
    const icon = toast.querySelector(".toast-check");
    icon.textContent = type === "error" ? "!" : "✓";
    icon.style.background = type === "error" ? "#df6c79" : "#4ab58b";
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3100);
  }
  function setSubmitting(loading) {
    const button = $("#task-submit");
    button.disabled = loading;
    button.style.opacity = loading ? ".7" : "";
  }

  $("#new-task-button").addEventListener("click", () => openModal());
  $("#empty-add-button").addEventListener("click", () => openModal());
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!confirmModal.hidden) {
        closeConfirm();
      } else if (!modal.hidden) {
        closeModal();
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
    }
  });

  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const errorNode = $("#task-form-error");
    errorNode.textContent = "";
    if (!title) { errorNode.textContent = "A task name is required."; titleInput.focus(); return; }
    setSubmitting(true);
    try {
      if (config.DEMO_MODE) {
        if (editingId !== null) {
          tasks = tasks.map((task) => String(task.id) === String(editingId) ? { ...task, title, description, updated_date: new Date().toISOString() } : task);
          showToast("Your task has been updated.");
        } else {
          tasks.unshift({ id: `local-${Date.now()}`, title, description, is_completed: false, created_date: new Date().toISOString() });
          showToast("New task added. Nice work!");
        }
        persistDemoTasks();
      } else {
        if (editingId !== null) {
          await apiRequest(taskEndpoint(editingId), {
            method: "PUT",
            body: JSON.stringify({ title, description, is_completed: tasks.find((task) => String(task.id) === String(editingId)).is_completed })
          });
          showToast("Your task has been updated.");
        } else {
          await apiRequest(tasksEndpoint(), { method: "POST", body: JSON.stringify({ title, description, is_completed: false }) });
          showToast("New task added. Nice work!");
        }
        await loadRemoteTasks();
      }
      closeModal();
      render();
    } catch (error) {
      errorNode.textContent = error.message || "Couldn't save the task. Please try again.";
    } finally { setSubmitting(false); }
  });

  taskList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-task-id]");
    if (!row) return;
    const task = tasks.find((item) => String(item.id) === row.dataset.taskId);
    if (!task) return;
    const action = actionButton.dataset.action;
    if (action === "edit") { openModal(task); return; }
    if (action === "toggle") {
      const nextValue = !task.is_completed;
      try {
        if (config.DEMO_MODE) {
          tasks = tasks.map((item) => String(item.id) === String(task.id) ? { ...item, is_completed: nextValue, updated_date: new Date().toISOString() } : item);
          persistDemoTasks();
        } else {
          await apiRequest(taskEndpoint(task.id), { method: "PUT", body: JSON.stringify({ title: task.title, description: task.description || "", is_completed: nextValue }) });
          await loadRemoteTasks();
        }
        showToast(nextValue ? "Task completed. That's a win!" : "Task moved back to in progress.");
        render();
      } catch (error) { showToast(error.message || "Couldn't update the task.", "error"); }
    }

    if (action === "delete") {
      openConfirm({
        title: "Delete this task?",
        message: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
        acceptText: "Delete task",
        onAccept: async () => {
          if (config.DEMO_MODE) {
            tasks = tasks.filter((item) => String(item.id) !== String(task.id));
            persistDemoTasks();
          } else {
            await apiRequest(taskEndpoint(task.id), { method: "DELETE" });
            await loadRemoteTasks();
          }

          showToast("Task deleted.");
          render();
        }
      });
    }
  });

  function setFilter(filter) {
    currentFilter = filter;
    $$("[data-filter]").forEach((button) => {
      button.classList.toggle("is-selected", button.classList.contains("filter-tab") && button.dataset.filter === filter);
      if (button.classList.contains("nav-item")) button.classList.toggle("is-active", button.dataset.filter === filter);
    });
    const labels = { all: "Overview", active: "In progress", completed: "Completed" };
    $("#breadcrumb-current").textContent = labels[filter] || "Overview";
    $("#tasks-heading").childNodes[0].textContent = filter === "all" ? "Your tasks " : filter === "active" ? "In progress " : "Completed tasks ";
    render();
    $("#sidebar").classList.remove("is-open");
    $("#mobile-menu").setAttribute("aria-expanded", "false");
  }
  $$("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));
  searchInput.addEventListener("input", () => { searchTerm = searchInput.value.trim(); render(); });
  $("#sort-button").addEventListener("click", () => {
    sortNewestFirst = !sortNewestFirst;
    $("#sort-button").setAttribute("aria-pressed", String(!sortNewestFirst));
    $("#sort-button").innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>${sortNewestFirst ? "Newest first" : "Oldest first"}`;
    render();
  });
  $("#mobile-menu").addEventListener("click", () => {
    const opened = $("#sidebar").classList.toggle("is-open");
    $("#mobile-menu").setAttribute("aria-expanded", String(opened));
  });
  $("#profile-button").addEventListener("click", () => {
    openConfirm({
      title: "Sign out?",
      message: "Are you sure you want to sign out of your Taskly account?",
      acceptText: "Sign out",
      type: "logout",
      onAccept: () => {
        localStorage.removeItem("taskly_session");
        window.location.href = "login.html";
      }
    });
  });
})();