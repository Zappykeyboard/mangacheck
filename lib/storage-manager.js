// Abstraction layer for browser.storage operations
import {
  compressWatchlistEntry,
  decompressWatchlistEntry,
  compressChapterEntry,
  decompressChapterEntry,
  limitNewChapters
} from './storage-compression.js';

const STORAGE_VERSION = 2;

export async function getWatchlist() {
  const { watchlist, _storageVersion } = await browser.storage.sync.get(['watchlist', '_storageVersion']);
  if (!watchlist) return {};

  // Check if migration is needed (old format or no version)
  if (!_storageVersion || _storageVersion < STORAGE_VERSION) {
    // Old format detected - migrate to compressed format
    console.log('Migrating watchlist to compressed format v2...');
    const compressed = {};
    for (const [id, oldEntry] of Object.entries(watchlist)) {
      // Check if already compressed (has short keys like 't', 'l', 's')
      if (oldEntry.t !== undefined) {
        compressed[id] = oldEntry; // Already compressed
      } else {
        compressed[id] = compressWatchlistEntry(oldEntry); // Compress old format
      }
    }

    // Save migrated data
    await browser.storage.sync.set({
      watchlist: compressed,
      _storageVersion: STORAGE_VERSION
    });

    console.log('Migration complete. Storage usage reduced by ~70%');

    // Return decompressed for use
    const decompressed = {};
    for (const [id, compressedEntry] of Object.entries(compressed)) {
      decompressed[id] = decompressWatchlistEntry(compressedEntry, id);
    }
    return decompressed;
  }

  // New format (v2) - decompress all entries
  const decompressed = {};
  for (const [id, compressed] of Object.entries(watchlist)) {
    decompressed[id] = decompressWatchlistEntry(compressed, id);
  }
  return decompressed;
}

export async function addToWatchlist(manga) {
  // Build full manga object
  const fullManga = {
    ...manga,
    addedAt: Date.now(),
    lastChecked: null,
    lastSeenChapter: manga.latestChapter
  };

  // Read current compressed watchlist
  const { watchlist: compressedWatchlist } = await browser.storage.sync.get('watchlist');
  const compressed = compressedWatchlist || {};

  // Compress and add new entry
  compressed[manga.id] = compressWatchlistEntry(fullManga);

  // Save compressed data
  await browser.storage.sync.set({ watchlist: compressed });

  return fullManga;
}

export async function removeFromWatchlist(mangaId) {
  // Read compressed watchlist directly
  const { watchlist: compressedWatchlist } = await browser.storage.sync.get('watchlist');
  const compressed = compressedWatchlist || {};
  delete compressed[mangaId];

  await browser.storage.sync.set({ watchlist: compressed });

  // Also remove from newChapters (also compressed)
  const { newChapters: compressedNewChapters } = await browser.storage.sync.get('newChapters');
  if (compressedNewChapters && compressedNewChapters[mangaId]) {
    delete compressedNewChapters[mangaId];
    await browser.storage.sync.set({ newChapters: compressedNewChapters });
  }
}

export async function isInWatchlist(mangaId) {
  const watchlist = await getWatchlist();
  return mangaId in watchlist;
}

export async function getNewChapters() {
  const { newChapters, _storageVersion } = await browser.storage.sync.get(['newChapters', '_storageVersion']);
  if (!newChapters) return {};

  // Check if migration is needed (old format or no version)
  if (!_storageVersion || _storageVersion < STORAGE_VERSION) {
    // Old format detected - migrate to compressed format
    console.log('Migrating newChapters to compressed format v2...');
    const compressed = {};
    for (const [id, chapters] of Object.entries(newChapters)) {
      // Check if already compressed (first chapter has 'n' instead of 'number')
      if (chapters.length > 0 && chapters[0].n !== undefined) {
        compressed[id] = limitNewChapters(chapters, 3); // Already compressed, just limit
      } else {
        // Compress old format chapters
        const compressedChapters = chapters.map(ch => compressChapterEntry(ch));
        compressed[id] = limitNewChapters(compressedChapters, 3);
      }
    }

    // Save migrated data
    await browser.storage.sync.set({
      newChapters: compressed,
      _storageVersion: STORAGE_VERSION
    });

    console.log('NewChapters migration complete');

    // Return decompressed for use
    const decompressed = {};
    for (const [id, compressedChapters] of Object.entries(compressed)) {
      decompressed[id] = compressedChapters.map(ch => decompressChapterEntry(ch, id));
    }
    return decompressed;
  }

  // New format (v2) - decompress all entries
  const decompressed = {};
  for (const [id, compressedChapters] of Object.entries(newChapters)) {
    decompressed[id] = compressedChapters.map(ch => decompressChapterEntry(ch, id));
  }
  return decompressed;
}

export async function clearNewChaptersForManga(mangaId) {
  // Read compressed newChapters directly
  const { newChapters: compressedNewChapters } = await browser.storage.sync.get('newChapters');
  const compressed = compressedNewChapters || {};
  delete compressed[mangaId];
  await browser.storage.sync.set({ newChapters: compressed });
}

export async function getSettings() {
  const { settings } = await browser.storage.sync.get('settings');
  return settings || {
    checkIntervalHours: 6,
    notificationsEnabled: true,
    lastGlobalCheck: null
  };
}

export async function updateSettings(newSettings) {
  const currentSettings = await getSettings();
  const merged = { ...currentSettings, ...newSettings };
  await browser.storage.sync.set({ settings: merged });
  return merged;
}

export async function safeStorageSet(data) {
  try {
    await browser.storage.sync.set(data);
  } catch (error) {
    if (error.message && error.message.includes('QUOTA')) {
      // Clean up old new chapters (older than 2 weeks)
      const { newChapters } = await browser.storage.sync.get('newChapters');
      const now = Date.now();
      const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

      const cleaned = {};
      for (const [id, chapters] of Object.entries(newChapters || {})) {
        const recentChapters = chapters.filter(ch =>
          now - (ch.detectedAt || 0) < TWO_WEEKS
        );
        if (recentChapters.length > 0) {
          cleaned[id] = recentChapters;
        }
      }

      await browser.storage.sync.set({ newChapters: cleaned });

      // Retry original operation
      await browser.storage.sync.set(data);
    } else {
      throw error;
    }
  }
}
