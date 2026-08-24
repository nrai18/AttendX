import { useEffect, useState } from 'react';

// In a real implementation, we'd use a Capacitor plugin like @capacitor-community/native-audio or similar volume control
// import { VolumeControl } from '@capacitor-community/volume-control';

export function useFocusMode(userId: string | null) {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const wsUrl = import.meta.env.VITE_WS_URL || `ws://localhost:3000/ws?userId=${userId}`;
    const ws = new WebSocket(wsUrl.includes('?') ? wsUrl : `${wsUrl}?userId=${userId}`);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'FOCUS_MODE_ON') {
        setIsMuted(true);
        // await VolumeControl.setVolume({ volume: 0 }); // Mute device
        console.log("Device muted for class start");
      } else if (data.type === 'FOCUS_MODE_OFF') {
        setIsMuted(false);
        // await VolumeControl.setVolume({ volume: 1 }); // Restore volume
        console.log("Device volume restored");
      }
    };

    return () => {
      ws.close();
    };
  }, [userId]);

  const overrideMute = () => {
    setIsMuted(false);
    // VolumeControl.setVolume({ volume: 1 });
    console.log("User overrode mute manually");
  };

  return { isMuted, overrideMute };
}
