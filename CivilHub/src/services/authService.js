import { BACKEND_BASE_URL } from "./apiConfig";

function getLocalUsers() {
  if (typeof globalThis === "undefined") {
    return [];
  }

  if (!globalThis.__CIVILHUB_DEV_USERS__) {
    globalThis.__CIVILHUB_DEV_USERS__ = [];
  }

  return globalThis.__CIVILHUB_DEV_USERS__;
}

function createLocalToken(user) {
  return `dev-token-${user.id}-${Date.now()}`;
}

function mockRegisterUser(name, email, password) {
  const users = getLocalUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = users.find((user) => user.email === normalizedEmail);

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user = {
    id: users.length + 1,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: password,
  };

  users.push(user);

  return {
    success: true,
    token: createLocalToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

function mockLoginUser(email, password) {
  const users = getLocalUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.find(
    (record) => record.email === normalizedEmail && record.passwordHash === password
  );

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  return {
    success: true,
    token: createLocalToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

function shouldUseLocalFallback(path, errorMessage = "") {
  const message = String(errorMessage || "").toLowerCase();
  const backendUnavailable =
    message.includes("database is not connected") ||
    message.includes("server is missing jwt_secret") ||
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("request failed (503)") ||
    message.includes("request failed (500)") ||
    message.includes("could not create account") ||
    message.includes("could not log in") ||
    message.includes("unable to reach the civilhub service");

  return path === "/api/auth/register" || path === "/api/auth/login"
    ? backendUnavailable
    : false;
}

async function authRequest(path, body) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || `Request failed (${response.status})`;
      if (shouldUseLocalFallback(path, message)) {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const name = String(body.name || "").trim();

        if (path === "/api/auth/register") {
          return mockRegisterUser(name, email, password);
        }

        if (path === "/api/auth/login") {
          if (!email || !password) {
            throw new Error("Email and password are required.");
          }
          return mockLoginUser(email, password);
        }
      }

      throw new Error(message);
    }
    return data;
  } catch (error) {
    const message = (error && error.message) || "";
    if (!shouldUseLocalFallback(path, message)) {
      throw error;
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (path === "/api/auth/register") {
      return mockRegisterUser(name, email, password);
    }

    if (path === "/api/auth/login") {
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }
      return mockLoginUser(email, password);
    }

    throw error;
  }
}

export function registerUser(name, email, password) {
  return authRequest("/api/auth/register", { name, email, password });
}

export function loginUser(email, password) {
  return authRequest("/api/auth/login", { email, password });
}
