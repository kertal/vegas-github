/**
 * Storage utilities for managing localStorage data and handling quota exceeded errors
 */

export interface StorageInfo {
  key: string;
  size: number;
  lastModified?: number;
}

/**
 * Get the size of a localStorage item in bytes
 */
export const getStorageItemSize = (key: string): number => {
  try {
    const item = localStorage.getItem(key);
    return item ? new Blob([item]).size : 0;
  } catch {
    return 0;
  }
};

/**
 * Get total size of all localStorage data
 */
export const getTotalStorageSize = (): number => {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += getStorageItemSize(key);
      }
    }
    return total;
  } catch {
    return 0;
  }
};

/**
 * Get information about all localStorage items
 */
export const getStorageInfo = (): StorageInfo[] => {
  try {
    const info: StorageInfo[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        info.push({
          key,
          size: getStorageItemSize(key),
        });
      }
    }
    return info.sort((a, b) => b.size - a.size); // Sort by size, largest first
  } catch {
    return [];
  }
};

/**
 * Clear old data to make space for new data
 */
export const clearOldData = (targetKey: string, requiredSize: number): boolean => {
  try {
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB limit to be safe
    const currentSize = getTotalStorageSize();
    
    if (currentSize + requiredSize > maxSize) {
      // Priority order for cleanup: old raw data first, then non-essential data
      const cleanupOrder = [
        // Old raw data (highest priority for cleanup)
        'github-search-results',
        'github-events-results', 
        'github-raw-events-results',
        'github-raw-data-storage', // Legacy storage (now using IndexedDB for both events and search items)
        // Non-essential data (lower priority)
        'github-item-ui-state',
        'github-ui-settings'
      ];
      
      for (const key of cleanupOrder) {
        if (key !== targetKey && localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.warn(`Removed old data from localStorage: ${key}`);
          
          // Check if we have enough space now
          if (getTotalStorageSize() + requiredSize <= maxSize) {
            return true;
          }
        }
      }
    }
    
    return getTotalStorageSize() + requiredSize <= maxSize;
  } catch {
    return false;
  }
};

/**
 * Check if there's enough space for new data
 */
export const hasEnoughSpace = (requiredSize: number): boolean => {
  const maxSize = 4.5 * 1024 * 1024; // 4.5MB limit
  return getTotalStorageSize() + requiredSize <= maxSize;
};

/**
 * Get storage usage statistics
 */
export const getStorageStats = () => {
  const totalSize = getTotalStorageSize();
  const maxSize = 5 * 1024 * 1024; // 5MB theoretical limit
  const usagePercent = (totalSize / maxSize) * 100;
  
  return {
    totalSize,
    maxSize,
    usagePercent,
    availableSpace: maxSize - totalSize,
    isNearLimit: usagePercent > 80,
  };
};

/**
 * Clear all GitHub-related data from localStorage
 */
export const clearAllGitHubData = (): void => {
  const githubKeys = [
    'github-search-results',
    'github-events-results',
    'github-raw-events-results',
    'github-raw-data-storage', // Legacy storage (now using IndexedDB for both events and search items)
    'github-last-search-params', // Legacy cache validation
    'github-item-ui-state',
    'github-ui-settings',
    'github-form-settings',
    'github-username-cache'
  ];
  
  githubKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`Cleared localStorage key: ${key}`);
    }
  });
};

/**
 * Clear GitHub caches and data while preserving the GitHub token
 * Used when loading the app with URL parameters (shared links)
 * Returns the preserved GitHub token that should be used in the updated form settings
 */
export const clearCachesKeepToken = async (): Promise<string> => {
  try {
    // First, preserve the GitHub token from form settings
    let preservedToken = '';
    const formSettings = localStorage.getItem('github-form-settings');
    if (formSettings) {
      try {
        const parsed = JSON.parse(formSettings);
        preservedToken = parsed.githubToken || '';
      } catch {
        // If parsing fails, token will remain empty string
      }
    }

    // Clear localStorage keys (including form settings - we'll rebuild it with URL params)
    const keysToRemove = [
      'github-search-results',
      'github-events-results', 
      'github-raw-events-results',
      'github-raw-data-storage', // Legacy storage
      'github-last-search-params', // Legacy cache validation
      'github-item-ui-state',
      'github-ui-settings',
      'github-username-cache', // Clear username validation cache
      'github-form-settings' // Clear form settings - will be rebuilt with URL params
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`Cleared cache localStorage key: ${key}`);
      }
    });

    // Clear IndexedDB data (events and search items)
    const { eventsStorage } = await import('./indexedDB');
    await eventsStorage.clear();
    console.log('Cleared IndexedDB cache data');
    
    console.log('✅ Cache cleanup completed, preserved GitHub token for reuse');
    return preservedToken;
  } catch (error) {
    console.error('Failed to clear caches:', error);
    return '';
  }
};

/**
 * Safe localStorage setter that handles quota exceeded errors
 */
export const safeSetItem = (key: string, value: string): boolean => {
  try {
    const dataSize = new Blob([value]).size;
    
    // Check if we have enough space
    if (!hasEnoughSpace(dataSize)) {
      // Try to clean up old data
      if (!clearOldData(key, dataSize)) {
        console.warn('Not enough localStorage space. Data will not be saved.');
        return false;
      }
    }
    
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error(`localStorage quota exceeded for key "${key}". Attempting cleanup...`);
      
      const dataSize = new Blob([value]).size;
      if (clearOldData(key, dataSize)) {
        try {
          localStorage.setItem(key, value);
          console.log('Successfully saved data after cleanup');
          return true;
        } catch (retryError) {
          console.error('Failed to save data even after cleanup:', retryError);
          return false;
        }
      } else {
        console.error('Not enough space even after cleanup. Data will not be saved.');
        return false;
      }
    } else {
      console.error(`Error saving to localStorage key "${key}":`, error);
      return false;
    }
  }
}; 