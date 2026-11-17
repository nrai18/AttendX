import { Capacitor, registerPlugin } from "@capacitor/core";

export interface BiometricAvailability {
  available: boolean;
  biometryType: "fingerprint" | "none";
  reason?: string;
}

export interface BiometricAuthResult {
  verified: boolean;
  cancelled?: boolean;
  lockout?: boolean;
  errorCode?: number;
  errorMessage?: string;
}

interface BiometricPluginInterface {
  isAvailable(): Promise<BiometricAvailability>;
  authenticate(options?: {
    title?: string;
    subtitle?: string;
    negativeButtonText?: string;
  }): Promise<BiometricAuthResult>;
}

const NativeBiometric = registerPlugin<BiometricPluginInterface>("Biometric");

/**
 * Bridge to the native Android BiometricPrompt plugin with graceful fallback on web.
 */
export const biometricService = {
  isNativeSupported(): boolean {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "android" &&
      Capacitor.isPluginAvailable("Biometric")
    );
  },

  async isAvailable(): Promise<BiometricAvailability> {
    if (!this.isNativeSupported()) {
      return { available: false, biometryType: "none", reason: "web_unsupported" };
    }
    try {
      return await NativeBiometric.isAvailable();
    } catch {
      return { available: false, biometryType: "none", reason: "error" };
    }
  },

  async authenticate(options?: {
    title?: string;
    subtitle?: string;
    negativeButtonText?: string;
  }): Promise<BiometricAuthResult> {
    if (!this.isNativeSupported()) {
      return { verified: false, errorMessage: "Biometrics require the Android app" };
    }
    try {
      return await NativeBiometric.authenticate(options);
    } catch (err: any) {
      return {
        verified: false,
        errorMessage: err?.message || "Biometric authentication failed",
      };
    }
  },
};
