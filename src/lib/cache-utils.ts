// Cache utilities for inventory system

// Simple in-memory cache with improved duration
const globalCache = new Map<string, { data: any; timestamp: number }>();

// Different cache durations for different data types
const CACHE_DURATIONS = {
  holdings: 2 * 60 * 1000,      // 2 minutes - user holdings change less frequently
  inventory: 1 * 60 * 1000,     // 1 minute - inventory changes moderately
  config: 5 * 60 * 1000,        // 5 minutes - config changes rarely
  dashboard: 5 * 60 * 1000,     // 5 minutes - dashboard stats change slowly
  default: 30 * 1000            // 30 seconds - fallback
};

// Function to clear cache for a specific user
export function clearUserCache(userId: string) {
  const cacheKey = `holdings_${userId}`;
  globalCache.delete(cacheKey);
}

// Function to clear all caches
export function clearAllCaches() {
  globalCache.clear();
}

// Function to get cached data with dynamic duration
export function getCachedData(key: string) {
  const cached = globalCache.get(key);
  if (cached) {
    // Determine cache duration based on key type
    let duration = CACHE_DURATIONS.default;
    if (key.startsWith('holdings_')) duration = CACHE_DURATIONS.holdings;
    else if (key.includes('inventory')) duration = CACHE_DURATIONS.inventory;
    else if (key.includes('config')) duration = CACHE_DURATIONS.config;
    else if (key.includes('dashboard')) duration = CACHE_DURATIONS.dashboard;
    
    if (Date.now() - cached.timestamp < duration) {
      return cached.data;
    }
  }
  return null;
}

// Function to set cached data
export function setCachedData(key: string, data: any) {
  globalCache.set(key, { data, timestamp: Date.now() });
}

// Function to check if data is cached with dynamic duration
export function isCached(key: string): boolean {
  const cached = globalCache.get(key);
  if (cached) {
    // Determine cache duration based on key type
    let duration = CACHE_DURATIONS.default;
    if (key.startsWith('holdings_')) duration = CACHE_DURATIONS.holdings;
    else if (key.includes('inventory')) duration = CACHE_DURATIONS.inventory;
    else if (key.includes('config')) duration = CACHE_DURATIONS.config;
    else if (key.includes('dashboard')) duration = CACHE_DURATIONS.dashboard;
    
    return Date.now() - cached.timestamp < duration;
  }
  return false;
}
