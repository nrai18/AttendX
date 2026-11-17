package com.attendx.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String TAG = "ApkUpdaterPlugin";
    private static final String APK_DIR = "apk-updates";
    private final AtomicBoolean isDownloading = new AtomicBoolean(false);
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(ctx.getPackageName(), 0);

            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pInfo.getLongVersionCode();
            } else {
                versionCode = pInfo.versionCode;
            }

            JSObject ret = new JSObject();
            ret.put("packageName", ctx.getPackageName());
            ret.put("versionName", pInfo.versionName);
            ret.put("versionCode", versionCode);
            ret.put("canRequestPackageInstalls", canInstallPackages());

            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to retrieve app info: " + e.getMessage(), e);
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canInstallPackages());
        call.resolve(ret);
    }

    private void launchInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                Intent fallback = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
            }
        }
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        launchInstallPermissionSettings();
        call.resolve();
    }

    @PluginMethod
    public void fileExists(PluginCall call) {
        String filePath = call.getString("filePath");
        boolean exists = filePath != null && new File(filePath).isFile();
        JSObject ret = new JSObject();
        ret.put("exists", exists);
        call.resolve(ret);
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        String filePath = call.getString("filePath");
        boolean deleted = false;
        if (filePath != null) {
            try {
                File dir = new File(getContext().getCacheDir(), APK_DIR);
                File target = new File(filePath);
                String dirCanon = dir.getCanonicalPath() + File.separator;
                if (target.getCanonicalPath().startsWith(dirCanon) && target.exists()) {
                    deleted = target.delete();
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to delete cached APK", e);
            }
        }
        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearCachedApks(PluginCall call) {
        try {
            File dir = new File(getContext().getCacheDir(), APK_DIR);
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    f.delete();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to clear cached APKs", e);
        }
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        String filename = call.getString("filename", "AttendX-update.apk");

        if (downloadUrl == null || !downloadUrl.startsWith("https://")) {
            call.reject("Invalid download URL. HTTPS required.");
            return;
        }

        if (isDownloading.get()) {
            call.reject("A download is already in progress.");
            return;
        }

        isDownloading.set(true);
        cancelRequested.set(false);

        new Thread(() -> {
            File outputFile = null;
            HttpURLConnection conn = null;
            InputStream in = null;
            FileOutputStream out = null;
            try {
                File dir = new File(getContext().getCacheDir(), APK_DIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new Exception("Could not create APK cache directory");
                }

                // Clean stale APK files in directory
                File[] oldFiles = dir.listFiles();
                if (oldFiles != null) {
                    for (File f : oldFiles) {
                        if (!f.getName().equals(filename)) {
                            f.delete();
                        }
                    }
                }

                outputFile = new File(dir, filename);
                if (outputFile.exists()) {
                    outputFile.delete();
                }

                conn = openSecureConnection(downloadUrl, 0);
                int status = conn.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Server returned HTTP " + status);
                }

                long totalBytes = conn.getContentLengthLong();
                in = conn.getInputStream();
                out = new FileOutputStream(outputFile);

                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalDownloaded = 0;
                long lastProgressTime = 0;
                long lastDownloadedBytes = 0;

                while ((bytesRead = in.read(buffer)) != -1) {
                    if (cancelRequested.get()) {
                        outputFile.delete();
                        JSObject cancelRet = new JSObject();
                        cancelRet.put("cancelled", true);
                        notifyListeners("downloadCancelled", cancelRet);
                        call.reject("Download cancelled by user.");
                        return;
                    }

                    out.write(buffer, 0, bytesRead);
                    totalDownloaded += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastProgressTime > 200 || (totalBytes > 0 && totalDownloaded == totalBytes)) {
                        double speedBps = 0;
                        if (lastProgressTime > 0 && now > lastProgressTime) {
                            speedBps = ((totalDownloaded - lastDownloadedBytes) * 1000.0) / (now - lastProgressTime);
                        }
                        lastProgressTime = now;
                        lastDownloadedBytes = totalDownloaded;

                        int percent = totalBytes > 0 ? (int) Math.min(100, (totalDownloaded * 100) / totalBytes) : -1;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("bytesDownloaded", totalDownloaded);
                        progress.put("totalBytes", totalBytes);
                        progress.put("speedBps", speedBps);
                        notifyListeners("downloadProgress", progress);
                    }
                }

                out.flush();
                out.close();
                out = null;
                in.close();
                in = null;

                // Emit final 100% progress in case server used chunked encoding (totalBytes <= 0)
                JSObject finalProgress = new JSObject();
                finalProgress.put("percent", 100);
                finalProgress.put("bytesDownloaded", totalDownloaded);
                finalProgress.put("totalBytes", totalDownloaded);
                finalProgress.put("speedBps", 0);
                notifyListeners("downloadProgress", finalProgress);

                // Compute SHA-256
                String actualSha256 = calculateSha256(outputFile);
                if (expectedSha256 != null && !expectedSha256.isEmpty()) {
                    if (!actualSha256.equalsIgnoreCase(expectedSha256.trim())) {
                        outputFile.delete();
                        throw new Exception("SHA-256 digest mismatch. Integrity verification failed.");
                    }
                }

                JSObject result = new JSObject();
                result.put("filePath", outputFile.getAbsolutePath());
                result.put("sha256", actualSha256);
                result.put("fileSize", totalDownloaded);
                call.resolve(result);

            } catch (Exception e) {
                if (outputFile != null && outputFile.exists()) {
                    outputFile.delete();
                }
                Log.e(TAG, "Download failed", e);
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                if (out != null) {
                    try { out.close(); } catch (Exception ignored) {}
                }
                if (in != null) {
                    try { in.close(); } catch (Exception ignored) {}
                }
                if (conn != null) {
                    try { conn.disconnect(); } catch (Exception ignored) {}
                }
                isDownloading.set(false);
            }
        }).start();
    }

    private HttpURLConnection openSecureConnection(String urlStr, int redirectCount) throws Exception {
        if (redirectCount > 5) {
            throw new Exception("Too many HTTP redirects");
        }
        URL url = new URL(urlStr);
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new Exception("Insecure URL encountered");
        }
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("User-Agent", "AttendX-Android-Updater");

        int status = conn.getResponseCode();
        if (status == HttpURLConnection.HTTP_MOVED_TEMP
                || status == HttpURLConnection.HTTP_MOVED_PERM
                || status == HttpURLConnection.HTTP_SEE_OTHER
                || status == 307
                || status == 308) {
            String newUrl = conn.getHeaderField("Location");
            conn.disconnect();
            if (newUrl == null || newUrl.isEmpty()) {
                throw new Exception("Empty redirect location");
            }
            URL resolvedUrl = new URL(url, newUrl);
            if (!"https".equalsIgnoreCase(resolvedUrl.getProtocol())) {
                throw new Exception("Insecure redirect encountered");
            }
            return openSecureConnection(resolvedUrl.toString(), redirectCount + 1);
        }
        return conn;
    }

    private String calculateSha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString().toLowerCase(Locale.ROOT);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        if (isDownloading.get()) {
            cancelRequested.set(true);
            call.resolve();
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void validateApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null) {
            call.reject("filePath is required");
            return;
        }

        try {
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                call.reject("APK file does not exist at path: " + filePath);
                return;
            }

            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            @SuppressWarnings("deprecation")
            int sigFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? PackageManager.GET_SIGNING_CERTIFICATES
                    : PackageManager.GET_SIGNATURES;

            PackageInfo newApkInfo = pm.getPackageArchiveInfo(apkFile.getAbsolutePath(), sigFlag);
            if (newApkInfo == null) {
                apkFile.delete();
                call.reject("Package manager could not parse APK. File may be corrupted.");
                return;
            }

            PackageInfo currentAppInfo = pm.getPackageInfo(ctx.getPackageName(), sigFlag);

            if (!ctx.getPackageName().equals(newApkInfo.packageName)) {
                apkFile.delete();
                call.reject("Security check failed: Package ID mismatch. Expected: "
                        + ctx.getPackageName() + ", Found: " + newApkInfo.packageName);
                return;
            }

            if (!hasMatchingSignature(currentAppInfo, newApkInfo)) {
                apkFile.delete();
                call.reject("Signing certificate mismatch: Downloaded APK was signed with a different key than the installed app.");
                return;
            }

            long currentVersionCode;
            long newVersionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                currentVersionCode = currentAppInfo.getLongVersionCode();
                newVersionCode = newApkInfo.getLongVersionCode();
            } else {
                currentVersionCode = currentAppInfo.versionCode;
                newVersionCode = newApkInfo.versionCode;
            }

            if (newVersionCode <= currentVersionCode) {
                apkFile.delete();
                call.reject("Incompatible update: APK versionCode (" + newVersionCode
                        + ") is not greater than installed versionCode (" + currentVersionCode + ").");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("valid", true);
            ret.put("packageName", newApkInfo.packageName);
            ret.put("versionName", newApkInfo.versionName);
            ret.put("versionCode", newVersionCode);
            ret.put("currentVersionCode", currentVersionCode);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to validate APK: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("deprecation")
    private Signature[] extractSignatures(PackageInfo info) {
        if (info == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            SigningInfo si = info.signingInfo;
            if (si != null) {
                return si.hasMultipleSigners() ? si.getApkContentsSigners() : si.getSigningCertificateHistory();
            }
        }
        return info.signatures;
    }

    private boolean hasMatchingSignature(PackageInfo installed, PackageInfo archive) {
        Signature[] installedSigs = extractSignatures(installed);
        Signature[] archiveSigs = extractSignatures(archive);
        if (installedSigs == null || installedSigs.length == 0 || archiveSigs == null || archiveSigs.length == 0) {
            return true;
        }
        for (Signature a : installedSigs) {
            for (Signature b : archiveSigs) {
                if (Arrays.equals(a.toByteArray(), b.toByteArray())) {
                    return true;
                }
            }
        }
        return false;
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null) {
            call.reject("filePath is required");
            return;
        }

        if (!canInstallPackages()) {
            launchInstallPermissionSettings();
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("installerLaunched", false);
            ret.put("permissionRequired", true);
            call.resolve(ret);
            return;
        }

        try {
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                call.reject("APK file does not exist: " + filePath);
                return;
            }

            Context ctx = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                    ctx,
                    ctx.getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            ctx.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("installerLaunched", true);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Failed to launch package installer", e);
            call.reject("Failed to launch package installer: " + e.getMessage(), e);
        }
    }
}