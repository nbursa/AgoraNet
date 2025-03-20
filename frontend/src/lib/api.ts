import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const login = async (username: string, password: string) => {
  try {
    const res = await api.post("/auth/login", { username, password });
    return res.data;
  } catch {
    throw new Error("Invalid credentials");
  }
};

export const register = async (formData: FormData) => {
  try {
    const res = await api.post("/auth/register", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch {
    throw new Error("Registration failed");
  }
};

export function isAuthenticated(): boolean {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("token");
  }
  return false;
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}
