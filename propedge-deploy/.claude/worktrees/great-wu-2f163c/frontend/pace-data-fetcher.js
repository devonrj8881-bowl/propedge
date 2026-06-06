/**
 * Pace Data Fetcher
 * Fetches pace data from Netlify Function endpoint
 * Caches results in local memory and IndexedDB
 */

class PaceDataFetcher {
  constructor() {
    this.cache = {};
    this.cacheExpiry = {};
    this.CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    this.apiEndpoint = '/.netlify/functions/espn-pace';
    this.refreshInterval = 15 * 60 * 1000; // Auto-refresh every 15 min
    this.refreshTimers = {};
  }

  /**
   * Fetch pace data for a league
   * @param {string} league - NBA, NHL, MLB, NFL
   * @returns {Promise<object>} Pace data
   */
  async fetchLeaguePace(league) {
    try {
      console.log(`[${league}] Fetching pace data...`);

      // Check local cache first
      if (this.isCacheValid(league)) {
        console.log(`[${league}] Returning cached data`);
        return {
          ...this.cache[league],
          fromCache: true
        };
      }

      // Fetch from Netlify Function
      const response = await fetch(`${this.apiEndpoint}?league=${league}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // Store in cache
      this.cache[league] = data;
      this.cacheExpiry[league] = Date.now() + this.CACHE_TTL;

      console.log(`[${league}] ✅ Fetched ${data.playerCount || 0} players from ${data.source}`);

      // Store in IndexedDB for persistence
      await this.storeInIndexedDB(league, data);

      // Set up auto-refresh
      this.startAutoRefresh(league);

      return {
        ...data,
        fromCache: false
      };

    } catch (error) {
      console.error(`[${league}] ❌ Error fetching pace data:`, error);

      // Try to return cached data even if expired
      if (this.cache[league]) {
        console.log(`[${league}] Returning stale cache due to error`);
        return {
          ...this.cache[league],
          fromCache: true,
          isStale: true,
          error: error.message
        };
      }

      // Try to load from IndexedDB
      const indexedData = await this.loadFromIndexedDB(league);
      if (indexedData) {
        console.log(`[${league}] Returning data from IndexedDB`);
        this.cache[league] = indexedData;
        return {
          ...indexedData,
          fromCache: true,
          fromIndexedDB: true
        };
      }

      throw error;
    }
  }

  /**
   * Fetch all leagues in parallel
   */
  async fetchAllLeagues() {
    const leagues = ['NBA', 'NFL', 'NHL', 'MLB'];
    const results = await Promise.allSettled(
      leagues.map(league => this.fetchLeaguePace(league))
    );

    return {
      NBA: results[0].status === 'fulfilled' ? results[0].value : null,
      NFL: results[1].status === 'fulfilled' ? results[1].value : null,
      NHL: results[2].status === 'fulfilled' ? results[2].value : null,
      MLB: results[3].status === 'fulfilled' ? results[3].value : null,
      errors: results
        .map((r, i) => r.status === 'rejected' ? { league: leagues[i], error: r.reason } : null)
        .filter(e => e !== null)
    };
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(league) {
    if (!this.cache[league]) return false;
    if (!this.cacheExpiry[league]) return false;
    return Date.now() < this.cacheExpiry[league];
  }

  /**
   * Clear cache for a league
   */
  clearCache(league = null) {
    if (league) {
      delete this.cache[league];
      delete this.cacheExpiry[league];
      this.stopAutoRefresh(league);
      console.log(`[${league}] Cache cleared`);
    } else {
      this.cache = {};
      this.cacheExpiry = {};
      Object.keys(this.refreshTimers).forEach(l => this.stopAutoRefresh(l));
      console.log('All cache cleared');
    }
  }

  /**
   * Start auto-refresh for a league
   */
  startAutoRefresh(league) {
    // Clear existing timer
    if (this.refreshTimers[league]) {
      clearTimeout(this.refreshTimers[league]);
    }

    // Set new timer
    this.refreshTimers[league] = setInterval(() => {
      console.log(`[${league}] Auto-refresh triggered`);
      this.fetchLeaguePace(league).catch(error => {
        console.error(`[${league}] Auto-refresh failed:`, error);
      });
    }, this.refreshInterval);

    console.log(`[${league}] Auto-refresh enabled (every ${this.refreshInterval / 60000} minutes)`);
  }

  /**
   * Stop auto-refresh for a league
   */
  stopAutoRefresh(league) {
    if (this.refreshTimers[league]) {
      clearTimeout(this.refreshTimers[league]);
      delete this.refreshTimers[league];
      console.log(`[${league}] Auto-refresh disabled`);
    }
  }

  /**
   * IndexedDB methods for persistence
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PropEdge', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pace_cache')) {
          db.createObjectStore('pace_cache', { keyPath: 'league' });
        }
      };
    });
  }

  async storeInIndexedDB(league, data) {
    try {
      const db = await this.initIndexedDB();
      const transaction = db.transaction('pace_cache', 'readwrite');
      const store = transaction.objectStore('pace_cache');

      store.put({
        league: league,
        data: data,
        timestamp: Date.now()
      });

      console.log(`[${league}] Stored in IndexedDB`);
    } catch (error) {
      console.warn(`[${league}] IndexedDB storage failed:`, error);
    }
  }

  async loadFromIndexedDB(league) {
    try {
      const db = await this.initIndexedDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pace_cache', 'readonly');
        const store = transaction.objectStore('pace_cache');
        const request = store.get(league);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn(`[${league}] IndexedDB load failed:`, error);
      return null;
    }
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    const status = {};
    ['NBA', 'NFL', 'NHL', 'MLB'].forEach(league => {
      const isValid = this.isCacheValid(league);
      const age = this.cacheExpiry[league] ? Date.now() - (this.cacheExpiry[league] - this.CACHE_TTL) : null;
      status[league] = {
        isCached: !!this.cache[league],
        isValid: isValid,
        age: age ? Math.floor(age / 1000) : null,
        playerCount: this.cache[league]?.playerCount || 0,
        isAutoRefreshing: !!this.refreshTimers[league]
      };
    });
    return status;
  }
}

// Create global instance
window.paceDataFetcher = new PaceDataFetcher();

// Export for module imports
export default window.paceDataFetcher;
