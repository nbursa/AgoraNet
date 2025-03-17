import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Login function
export const login = async (username: string, password: string) => {
  try {
    const res = await api.post("/auth/login", { username, password });
    return res.data;
  } catch {
    throw new Error("Invalid credentials");
  }
};

// Check if the user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("token");
  }
  return false;
}

// Logout function
export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}
