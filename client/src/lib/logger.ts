// A simple in-memory logger to capture the last 50 console outputs
// Useful for attaching to bug reports and feedback.

export const logHistory: { timestamp: string; level: string; message: string }[] = [];
const MAX_LOGS = 50;

function captureLog(level: string, ...args: any[]) {
  const message = args.map(arg => {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return '[Unserializable Object]';
    }
  }).join(' ');

  logHistory.push({
    timestamp: new Date().toISOString(),
    level,
    message
  });

  if (logHistory.length > MAX_LOGS) {
    logHistory.shift(); // Remove oldest
  }
}

// Store original methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

export function initLogger() {
  if ((window as any).__loggerInitialized) return;
  (window as any).__loggerInitialized = true;

  console.log = (...args) => {
    captureLog('LOG', ...args);
    originalConsole.log(...args);
  };
  
  console.warn = (...args) => {
    captureLog('WARN', ...args);
    originalConsole.warn(...args);
  };

  console.error = (...args) => {
    captureLog('ERROR', ...args);
    originalConsole.error(...args);
  };

  console.info = (...args) => {
    captureLog('INFO', ...args);
    originalConsole.info(...args);
  };

  console.debug = (...args) => {
    captureLog('DEBUG', ...args);
    originalConsole.debug(...args);
  };
  
  originalConsole.log("[Logger] Console interceptor initialized. Catching last 50 logs.");
}

export function getLogs() {
  return [...logHistory];
}
