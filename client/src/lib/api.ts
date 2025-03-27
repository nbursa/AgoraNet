import axios, { AxiosError } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

interface AuthResponse {
  token: string;
  message?: string;
}

interface ErrorResponse {
  error?: string;
}

export const login = async (
  username: string,
  password: string
): Promise<AuthResponse> => {
  try {
    const res = await api.post<AuthResponse>("/auth/login", {
      username,
      password,
    });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("auth-update", Date.now().toString());
    }
    return res.data;
  } catch (err) {
    const error = err as AxiosError<ErrorResponse>;
    if (error.response?.status === 401) {
      throw new Error("invalid-credentials");
    }
    throw new Error("login-failed");
  }
};

export const register = async (formData: FormData): Promise<AuthResponse> => {
  try {
    const res = await api.post<AuthResponse>("/auth/register", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
    }

    return res.data;
  } catch (err) {
    const error = err as AxiosError<ErrorResponse>;
    if (
      error.response?.data?.error === "User exists, but password is incorrect"
    ) {
      throw new Error("user-exists-invalid-password");
    } else if (error.response?.status === 401) {
      throw new Error("user-exists-login-required");
    }
    throw new Error(error.response?.data?.error || "register-failed");
  }
};

export function isAuthenticated(): boolean {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("token");
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.setItem("auth-update", Date.now().toString());
  window.location.href = "/login";
}
