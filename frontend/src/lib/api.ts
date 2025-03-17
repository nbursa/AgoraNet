import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Login function
export const login = async (username: string, password: string) => {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
};
