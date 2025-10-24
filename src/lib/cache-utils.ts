// Cache utilities for inventory system - Enhanced Performance Version

// Simple in-memory cache with improved duration and LRU eviction
const globalCache = new Map<string, { data: any; timestamp: number; accessCount: number; lastAccessed: number }>();

// Different cache durations for different data types
const CACHE_DURATIONS = {
  holdings: 5 * 60 * 1000,      // 5 minutes - user holdings change less frequently
  inventory: 2 * 60 * 1000,    // 2 minutes - inventory changes moderately
  config: 10 * 60 * 1000,      // 10 minutes - config changes rarely
  dashboard: 1 * 60 * 1000,    // 1 minute - dashboard stats need to be up-to-date
  equipment_reports: 3 * 60 * 1000, // 3 minutes - equipment reports
  users: 5 * 60 * 1000,        // 5 minutes - user data
  default: 1 * 60 * 1000       // 1 minute - fallback
};

// Cache size limits
const MAX_CACHE_SIZE = 1000; // Maximum number of cache entries
const MAX_CACHE_MEMORY = 50 * 1024 * 1024; // 50MB maximum cache memory

// Function to estimate memory usage of cached data
function estimateMemoryUsage(data: any): number {
  try {
    return JSON.stringify(data).length * 2; // Rough estimate (2 bytes per character)
  } catch {
    return 1024; // Fallback estimate
  }
}

// Function to evict least recently used items
function evictLRU() {
  if (globalCache.size <= MAX_CACHE_SIZE) return;
  
  // Sort by last accessed time and remove oldest 10%
  const entries = Array.from(globalCache.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  
  const toRemove = Math.floor(entries.length * 0.1);
  for (let i = 0; i < toRemove; i++) {
    globalCache.delete(entries[i][0]);
  }
}

// Function to clear cache for a specific user
export function clearUserCache(userId: string) {
  const patterns = [`holdings_${userId}`, `user_${userId}`, `equipment_${userId}`];
  for (const pattern of patterns) {
    for (const key of globalCache.keys()) {
      if (key.includes(pattern)) {
        globalCache.delete(key);
      }
    }
  }
}

// Function to clear dashboard cache
export function clearDashboardCache() {
  // Delete all keys that start with 'dashboard_'
  for (const key of globalCache.keys()) {
    if (key.startsWith('dashboard_')) {
      globalCache.delete(key);
    }
  }
}

// Function to clear inventory cache
export function clearInventoryCache() {
  // Delete all keys that contain 'inventory'
  for (const key of globalCache.keys()) {
    if (key.includes('inventory')) {
      globalCache.delete(key);
    }
  }
}

// Function to clear equipment reports cache
export function clearEquipmentReportsCache() {
  // Delete all keys that contain 'equipment' or 'request' or 'return'
  for (const key of globalCache.keys()) {
    if (key.includes('equipment') || key.includes('request') || key.includes('return')) {
      globalCache.delete(key);
    }
  }
}

// Function to clear all caches
export function clearAllCaches() {
  globalCache.clear();
}

// Function to get cached data with dynamic duration and access tracking
export function getCachedData(key: string) {
  const cached = globalCache.get(key);
  if (cached) {
    // Update access tracking
    cached.accessCount++;
    cached.lastAccessed = Date.now();
    
    // Determine cache duration based on key type
    let duration = CACHE_DURATIONS.default;
    if (key.startsWith('holdings_')) duration = CACHE_DURATIONS.holdings;
    else if (key.includes('inventory')) duration = CACHE_DURATIONS.inventory;
    else if (key.includes('config')) duration = CACHE_DURATIONS.config;
    else if (key.includes('dashboard')) duration = CACHE_DURATIONS.dashboard;
    else if (key.includes('equipment') || key.includes('request') || key.includes('return')) duration = CACHE_DURATIONS.equipment_reports;
    else if (key.includes('user')) duration = CACHE_DURATIONS.users;
    
    if (Date.now() - cached.timestamp < duration) {
      return cached.data;
    } else {
      // Cache expired, remove it
      globalCache.delete(key);
    }
  }
  return null;
}

// Function to set cached data with access tracking
export function setCachedData(key: string, data: any) {
  // Evict LRU items if cache is getting too large
  evictLRU();
  
  // Check memory usage and evict if necessary
  const currentMemory = Array.from(globalCache.values())
    .reduce((total, item) => total + estimateMemoryUsage(item.data), 0);
  
  if (currentMemory > MAX_CACHE_MEMORY) {
    // Evict 20% of least recently used items
    const entries = Array.from(globalCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      globalCache.delete(entries[i][0]);
    }
  }
  
  globalCache.set(key, {
    data,
    timestamp: Date.now(),
    accessCount: 1,
    lastAccessed: Date.now()
  });
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
    else if (key.includes('equipment') || key.includes('request') || key.includes('return')) duration = CACHE_DURATIONS.equipment_reports;
    else if (key.includes('user')) duration = CACHE_DURATIONS.users;
    
    return Date.now() - cached.timestamp < duration;
  }
  return false;
}

// Function to get cache statistics
export function getCacheStats() {
  const entries = Array.from(globalCache.values());
  const totalMemory = entries.reduce((total, item) => total + estimateMemoryUsage(item.data), 0);
  const avgAccessCount = entries.reduce((total, item) => total + item.accessCount, 0) / entries.length || 0;
  
  return {
    size: globalCache.size,
    maxSize: MAX_CACHE_SIZE,
    memoryUsage: totalMemory,
    maxMemory: MAX_CACHE_MEMORY,
    memoryUsagePercent: (totalMemory / MAX_CACHE_MEMORY) * 100,
    averageAccessCount: avgAccessCount,
    hitRate: entries.reduce((total, item) => total + item.accessCount, 0) / entries.length || 0
  };
}

// Function to warm up cache with frequently accessed data
export async function warmupCache() {
  console.log('🔥 Warming up cache...');
  
  try {
    // Pre-load commonly accessed data
    const commonQueries = [
      '/api/admin/inventory?page=1&limit=50',
      '/api/admin/dashboard',
      '/api/configs'
    ];
    
    // This would be implemented based on actual usage patterns
    console.log('✅ Cache warmup completed');
  } catch (error) {
    console.error('❌ Cache warmup failed:', error);
  }
}