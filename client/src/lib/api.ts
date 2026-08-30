import axios from "axios";
import { useAuthStore } from "../stores/authStore";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly refresh cookies automatically
});

// Helper to check token expiration
const isTokenExpired = (token: string) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // 10 second buffer
    return payload.exp * 1000 < Date.now() + 10000;
  } catch (e) {
    return true;
  }
};

import { Capacitor } from "@capacitor/core";

// Request interceptor: Attach in-memory Access Token and proactively refresh if expired
api.interceptors.request.use(
  async (config) => {
    config.headers['X-Attendx-Platform'] = Capacitor.isNativePlatform() ? 'Mobile App' : 'Web/Laptop';
    config.headers['X-Attendx-OS'] = Capacitor.getPlatform();
    config.headers['X-Attendx-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (config.url?.includes("/auth/login") || config.url?.includes("/auth/register")) {
      try {
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          const hasPerms = await Geolocation.checkPermissions();
          if (hasPerms.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
          const pos = await Geolocation.getCurrentPosition({ timeout: 5000, maximumAge: 300000 });
          config.headers['X-Attendx-Lat'] = pos.coords.latitude;
          config.headers['X-Attendx-Lon'] = pos.coords.longitude;
        }
      } catch (e) {
        console.warn("Location error:", e);
      }
    }

    if (
      config.url?.includes("/auth/login") ||
      config.url?.includes("/auth/register") ||
      config.url?.includes("/auth/refresh")
    ) {
      return config;
    }

    let token = useAuthStore.getState().accessToken;

    if (token && isTokenExpired(token)) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          token = response.data.accessToken;
          useAuthStore.getState().setAccessToken(token);
          processQueue(null, token);
        } catch (error) {
          processQueue(error, null);
          useAuthStore.getState().logout();
          token = null;
        } finally {
          isRefreshing = false;
        }
      } else {
        try {
          token = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
        } catch (error) {
          token = null;
        }
      }
    }

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
      !originalRequest.url?.includes("/auth/register") && !originalRequest.url?.includes("/auth/refresh")
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

    // Global Error Interceptor for non-401s and non-429s (Peer Sync recovery)
    if (error.response?.status !== 401 && error.response?.status !== 429) {
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
