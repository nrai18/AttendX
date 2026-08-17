import axios from "axios";
import { neon } from "./neon";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly refresh cookies automatically
});

// Request interceptor: Attach Neon Session Token
api.interceptors.request.use(
  async (config) => {
    try {
      const session = await neon.auth.getSession();
      if (session?.data?.session?.token) {
        config.headers.Authorization = `Bearer ${session.data.session.token}`;
      }
    } catch (e) {
      // Ignore auth fetch errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Global Error Interceptor for non-401s
    if (error.response?.status !== 401) {
      import("sonner").then(({ toast }) => {
        toast.error(`API Error: ${error.response?.data?.message || error.message}`, {
          duration: 10000,
          action: {
            label: "Email Developer",
            onClick: () => {
              const trace = JSON.stringify({
                 url: error.config?.url,
                 status: error.response?.status,
                 message: error.response?.data?.message || error.message
              }, null, 2);
              window.location.href = `mailto:dev@iiitu.ac.in?subject=AttendX API Error&body=Error Trace:%0D%0A${encodeURIComponent(trace)}`;
            }
          }
        });
      });
    }

    return Promise.reject(error);
  }
);
