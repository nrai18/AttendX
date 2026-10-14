import { create } from 'zustand';
import { api } from '../lib/api';

interface ConfigState {
  wsUrl: string | null;
  mlApiUrl: string | null;
  googleClientId: string | null;
  appDownloadLink: string | null;
  fetchConfig: () => Promise<void>;
}

let fetchPromise: Promise<void> | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  wsUrl: null,
  mlApiUrl: null,
  googleClientId: null,
  appDownloadLink: null,
  fetchConfig: async () => {
    if (get().appDownloadLink) return;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
      try {
        const { data } = await api.get('/system/config', { timeout: 6000 });
        set({
          wsUrl: data.wsUrl,
          mlApiUrl: data.mlApiUrl,
          googleClientId: data.googleClientId,
          appDownloadLink: data.appDownloadLink
        });
      } catch (err) {
        console.warn("[ConfigStore] Using fallback config due to network timeout/unreachable backend");
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }
}));
