import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

export const downloadBlob = async (blob: Blob, filename: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const result = await Filesystem.writeFile({
            path: filename,
            data: base64data,
            directory: Directory.Cache
          });
          
          await Share.share({
            title: filename,
            url: result.uri,
            dialogTitle: 'Save or Share File'
          });
        } catch (innerErr) {
          console.error("Inner share err:", innerErr);
          toast.error("Failed to share file.");
        }
      };
    } catch (e) {
      console.error(e);
      toast.error('Failed to save file to device');
    }
  } else {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error(e);
      toast.error('Failed to download file');
    }
  }
};
