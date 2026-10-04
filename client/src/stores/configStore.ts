import { create } from 'zustand';
import { api } from '../lib/api';

interface ConfigState {
  wsUrl: string | null;
  mlApiUrl: string | null;
  googleClientId: string | null;
  appDownloadLink: string | null;
  fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  wsUrl: null,
  mlApiUrl: null,
  googleClientId: null,
  appDownloadLink: null,
  fetchConfig: async () => {
    try {
      const { data } = await api.get('/system/config', { timeout: 5000 });
      set({
        wsUrl: data.wsUrl,
        mlApiUrl: data.mlApiUrl,
        googleClientId: data.googleClientId,
        appDownloadLink: data.appDownloadLink
      });
    } catch (err) {
      console.error("Failed to fetch dynamic config", err);
    }
  }
}));
