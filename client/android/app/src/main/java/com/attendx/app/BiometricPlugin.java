package com.attendx.app;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    private static final String TAG = "BiometricPlugin";
    private static final int ALLOWED_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG |
        BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            Context ctx = getContext();
            BiometricManager manager = BiometricManager.from(ctx);
            int status = manager.canAuthenticate(ALLOWED_AUTHENTICATORS);

            JSObject ret = new JSObject();
            ret.put("statusCode", status);
            if (status == BiometricManager.BIOMETRIC_SUCCESS) {
                ret.put("available", true);
                ret.put("biometryType", "fingerprint");
                ret.put("reason", "ready");
            } else if (status == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                ret.put("available", false);
                ret.put("biometryType", "none");
                ret.put("reason", "none_enrolled");
            } else {
                ret.put("available", false);
                ret.put("biometryType", "none");
                ret.put("reason", "unavailable");
            }
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to check biometric availability", e);
            JSObject ret = new JSObject();
            ret.put("available", false);
            ret.put("biometryType", "none");
            ret.put("reason", "error");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            JSObject ret = new JSObject();
            ret.put("verified", false);
            ret.put("errorMessage", "Activity unavailable");
            call.resolve(ret);
            return;
        }

        String title = call.getString("title", "Unlock AttendX");
        String subtitle = call.getString("subtitle", "Use your fingerprint to unlock your vault");
        String negativeButtonText = call.getString("negativeButtonText", "Use Passcode");

        activity.runOnUiThread(() -> {
            try {
                BiometricManager manager = BiometricManager.from(activity);
                if (manager.canAuthenticate(ALLOWED_AUTHENTICATORS) != BiometricManager.BIOMETRIC_SUCCESS) {
                    JSObject ret = new JSObject();
                    ret.put("verified", false);
                    ret.put("errorMessage", "Biometric hardware not ready");
                    call.resolve(ret);
                    return;
                }

                Executor executor = ContextCompat.getMainExecutor(activity);
                BiometricPrompt prompt = new BiometricPrompt(
                    activity,
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            JSObject ret = new JSObject();
                            ret.put("verified", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            JSObject ret = new JSObject();
                            ret.put("verified", false);
                            ret.put("errorCode", errorCode);
                            ret.put("errorMessage", errString != null ? errString.toString() : "Cancelled");
                            ret.put("cancelled",
                                errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                                errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                                errorCode == BiometricPrompt.ERROR_CANCELED
                            );
                            ret.put("lockout",
                                errorCode == BiometricPrompt.ERROR_LOCKOUT ||
                                errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT
                            );
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            // OS prompt stays open and handles retry feedback visually
                        }
                    }
                );

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title != null ? title : "Unlock AttendX")
                    .setSubtitle(subtitle != null ? subtitle : "Confirm your fingerprint")
                    .setNegativeButtonText(negativeButtonText != null ? negativeButtonText : "Use Passcode")
                    .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                    .setConfirmationRequired(false)
                    .build();

                prompt.authenticate(promptInfo);
            } catch (Exception e) {
                Log.e(TAG, "BiometricPrompt failed", e);
                JSObject ret = new JSObject();
                ret.put("verified", false);
                ret.put("errorMessage", e.getMessage());
                call.resolve(ret);
            }
        });
    }
}
