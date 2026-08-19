import axios from "axios";
import { useAuthStore } from "../stores/authStore";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly refresh cookies automatically
});

// Request interceptor: Attach in-memory Access Token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Silent Refresh on 401 Unauthorized
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop on auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err: any) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;
        useAuthStore.getState().setAccessToken(accessToken);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

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
              const subject = encodeURIComponent("AttendX API Error");
              const body = encodeURIComponent(`Error Trace:\n${trace}`);
              window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=24247@iiitu.ac.in,rai18naman@gmail.com&su=${subject}&body=${body}`, '_blank');
            }
          }
        });
      });
    }

    return Promise.reject(error);
  }
);
