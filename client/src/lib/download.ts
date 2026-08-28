import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';

export const downloadBlob = async (blob: Blob, filename: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        await Filesystem.writeFile({
          path: filename,
          data: base64data,
          directory: Directory.Documents
        });
        toast.success('File saved to Documents folder');
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
