// Production-safe logging utility

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  // Performance logs - only in development
  perf: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`⚡ ${message}`, ...args);
    }
  },

  // Debug logs - only in development
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`🔍 ${message}`, ...args);
    }
  },

  // Info logs - always show but simplified in production
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`ℹ️ ${message}`, ...args);
    } else {
      console.log(message);
    }
  },

  // Success logs - always show but simplified in production
  success: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`✅ ${message}`, ...args);
    } else {
      console.log(`Success: ${message}`);
    }
  },

  // Error logs - always show
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  },

  // Warning logs - always show
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },

  // Cache logs - only in development
  cache: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`💾 ${message}`, ...args);
    }
  }
};
