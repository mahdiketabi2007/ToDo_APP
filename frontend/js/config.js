/*
 * Taskly frontend configuration.
 * Start in demo mode to explore the UI without a running backend.
 * When your FastAPI routes are ready, set DEMO_MODE to false and update the
 * endpoint paths below to match your actual router definitions.
 */
window.TASKLY_CONFIG = {
  API_BASE_URL: window.location.origin,
  DEMO_MODE: false,
  ENDPOINTS: {
    login: "/users/login",
    signup: "/users/register",
    tasks: "/tasks",
    refreshToken: "/users/refresh-token"
  }
};
