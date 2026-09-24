// Global Mock Environment for Native Android Capacitor Plugins
export const callSequence = [];
export const activeListeners = new Map();
export const mockCounters = {
  removeAllListeners: 0,
  ttsSpeak: 0,
  ttsStop: 0,
  lastSpokenText: '',
  lastSpeakOptions: null,
};

export function resetMockState() {
  callSequence.length = 0;
  activeListeners.clear();
  mockCounters.removeAllListeners = 0;
  mockCounters.ttsSpeak = 0;
  mockCounters.ttsStop = 0;
  mockCounters.lastSpokenText = '';
  mockCounters.lastSpeakOptions = null;
}

globalThis.window = globalThis;
globalThis.androidBridge = true; // Enables getPlatform() === 'android' and isNativePlatform() === true

globalThis.Capacitor = {
  PluginHeaders: [
    {
      name: 'TextToSpeech',
      methods: [
        { name: 'speak', rtype: 'promise' },
        { name: 'stop', rtype: 'promise' },
      ]
    },
    {
      name: 'SpeechRecognition',
      methods: [
        { name: 'available', rtype: 'promise' },
        { name: 'checkPermissions', rtype: 'promise' },
        { name: 'requestPermissions', rtype: 'promise' },
        { name: 'start', rtype: 'promise' },
        { name: 'stop', rtype: 'promise' },
        { name: 'removeAllListeners', rtype: 'promise' },
        { name: 'addListener', rtype: 'callback' },
        { name: 'removeListener', rtype: 'callback' },
      ]
    }
  ],
  nativePromise: async (plugin, method, options) => {
    callSequence.push({ type: 'promise', plugin, method, options });
    if (plugin === 'TextToSpeech') {
      if (method === 'speak') {
        mockCounters.ttsSpeak++;
        mockCounters.lastSpokenText = options?.text || '';
        mockCounters.lastSpeakOptions = options;
        return true;
      }
      if (method === 'stop') {
        mockCounters.ttsStop++;
        return true;
      }
    }
    if (plugin === 'SpeechRecognition') {
      if (method === 'available') return { available: true };
      if (method === 'checkPermissions' || method === 'requestPermissions') {
        return { speechRecognition: 'granted' };
      }
      if (method === 'start') {
        return { matches: ['test voice transcript'] };
      }
      if (method === 'stop') {
        return true;
      }
      if (method === 'removeAllListeners') {
        mockCounters.removeAllListeners++;
        activeListeners.clear();
        return true;
      }
    }
    return true;
  },
  nativeCallback: (plugin, method, options, callback) => {
    callSequence.push({ type: 'callback', plugin, method, options });
    if (plugin === 'SpeechRecognition' && method === 'addListener') {
      const eventName = options.eventName;
      if (!activeListeners.has(eventName)) {
        activeListeners.set(eventName, new Set());
      }
      activeListeners.get(eventName).add(callback);
      return 'callback-id-1';
    }
    return 'callback-id-default';
  }
};
