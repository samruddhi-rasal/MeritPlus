// Simple JWT storage for local/dev use. NOTE: localStorage is vulnerable to
// token theft if this app ever has an XSS vulnerability. For production,
// prefer having the backend set the JWT in an HttpOnly, Secure cookie instead.
const TOKEN_KEY = "resumeapp_token";
const USER_KEY = "resumeapp_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Redirect to login if there's no token. Call at the top of protected pages.
function requireAuth() {
  if (!getToken()) {
    window.location.href = "/login.html";
  }
}

// fetch() wrapper that attaches the Authorization header and redirects to
// login on a 401 (expired/invalid session) instead of retrying with a refresh token.
async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${getToken()}`);

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}

async function logout() {
  try {
    await authFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    // Ignore — we're clearing local state regardless.
  }
  clearSession();
  window.location.href = "/login.html";
}
