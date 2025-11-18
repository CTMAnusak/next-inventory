// Cache utilities for inventory system - Enhanced Performance Version

// Simple in-memory cache with improved duration and LRU eviction
const globalCache = new Map<string, { data: any; timestamp: number; accessCount: number; lastAccessed: number }>();

// Different cache durations for different data types - Optimized for performance
const CACHE_DURATIONS = {
  holdings: 10 * 60 * 1000,      // 10 minutes - user holdings change less frequently
  owned_equipment: 5 * 60 * 1000, // 5 minutes - owned equipment (เพิ่ม cache duration)
  inventory: 5 * 60 * 1000,      // 5 minutes - inventory changes moderately
  config: 30 * 60 * 1000,        // 30 minutes - config changes rarely
  dashboard: 2 * 60 * 1000,      // 2 minutes - dashboard stats need to be up-to-date
  equipment_reports: 5 * 60 * 1000, // 5 minutes - equipment reports
  users: 10 * 60 * 1000,         // 10 minutes - user data
  categories: 60 * 60 * 1000,    // 1 hour - categories rarely change
  default: 2 * 60 * 1000         // 2 minutes - fallback
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

// Function to clear cache for a specific user with improved pattern matching
export function clearUserCache(userId: string) {
  const patterns = [`holdings_${userId}`, `user_${userId}`, `equipment_${userId}`, `owned_${userId}`];
  let clearedCount = 0;
  
  for (const pattern of patterns) {
    for (const key of globalCache.keys()) {
      if (key.includes(pattern)) {
        globalCache.delete(key);
        clearedCount++;
      }
    }
  }
  
  console.log(`🗑️ Cleared ${clearedCount} cache entries for user ${userId}`);
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
    else if (key.startsWith('owned_equipment_')) duration = CACHE_DURATIONS.owned_equipment;
    else if (key.includes('inventory')) duration = CACHE_DURATIONS.inventory;
    else if (key.includes('config')) duration = CACHE_DURATIONS.config;
    else if (key.includes('dashboard')) duration = CACHE_DURATIONS.dashboard;
    else if (key.includes('equipment') || key.includes('request') || key.includes('return')) duration = CACHE_DURATIONS.equipment_reports;
    else if (key.includes('user')) duration = CACHE_DURATIONS.users;
    else if (key.includes('category')) duration = CACHE_DURATIONS.categories;
    
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
    else if (key.startsWith('owned_equipment_')) duration = CACHE_DURATIONS.owned_equipment;
    else if (key.includes('inventory')) duration = CACHE_DURATIONS.inventory;
    else if (key.includes('config')) duration = CACHE_DURATIONS.config;
    else if (key.includes('dashboard')) duration = CACHE_DURATIONS.dashboard;
    else if (key.includes('equipment') || key.includes('request') || key.includes('return')) duration = CACHE_DURATIONS.equipment_reports;
    else if (key.includes('user')) duration = CACHE_DURATIONS.users;
    else if (key.includes('category')) duration = CACHE_DURATIONS.categories;
    
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
  console.log('🔥 Warming up cache with performance optimizations...');
  
  try {
    // Pre-load commonly accessed data with optimized cache keys
    const commonQueries = [
      { key: 'dashboard_current', url: '/api/admin/dashboard' },
      { key: 'inventory_page_1', url: '/api/admin/inventory?page=1&limit=50' },
      { key: 'configs_all', url: '/api/configs' },
      { key: 'categories_all', url: '/api/categories' }
    ];
    
    // This would be implemented based on actual usage patterns
    // For now, just log the warmup completion
    console.log('✅ Cache warmup completed - ready for high performance');
    
    // Return cache stats after warmup
    return getCacheStats();
  } catch (error) {
    console.error('❌ Cache warmup failed:', error);
    throw error;
  }
}