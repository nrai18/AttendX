import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

export const downloadBlob = async (blob: Blob, filename: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
          reject(reader.error || new Error("Failed to read blob data"));
        };
        reader.onloadend = async () => {
          try {
            const resultStr = reader.result as string;
            if (!resultStr) {
              throw new Error("Empty file data");
            }
            const base64data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            const result = await Filesystem.writeFile({
              path: filename,
              data: base64data,
              directory: Directory.Cache
            });
            
            try {
              await Share.share({
                title: filename,
                url: result.uri,
                dialogTitle: 'Save or Share File'
              });
            } catch (shareErr: any) {
              const msg = (shareErr?.message || '').toLowerCase();
              // Ignore standard user cancellations/dismissals
              if (
                msg.includes('cancel') ||
                msg.includes('dismiss') ||
                msg.includes('abort') ||
                msg.includes('closed')
              ) {
                console.log("Share sheet dismissed by user.");
              } else {
                console.error("Inner share err:", shareErr);
                toast.error("Failed to share file.");
              }
            }
            resolve();
          } catch (innerErr) {
            reject(innerErr);
          }
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Native download error:", e);
      toast.error('Failed to save file to device');
    }
  } else {
    let url = '';
    try {
      url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error("Browser download error:", e);
      toast.error('Failed to download file');
    } finally {
      if (url) {
        setTimeout(() => {
          try {
            window.URL.revokeObjectURL(url);
          } catch (_) {}
        }, 1000);
      }
    }
  }
};

export const downloadFile = downloadBlob;
