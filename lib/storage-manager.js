// Abstraction layer for browser.storage operations

export async function getWatchlist() {
  const { watchlist } = await browser.storage.sync.get('watchlist');
  return watchlist || {};
}

export async function addToWatchlist(manga) {
  const watchlist = await getWatchlist();

  watchlist[manga.id] = {
    ...manga,
    addedAt: Date.now(),
    lastChecked: null,
    lastSeenChapter: manga.latestChapter
  };

  await browser.storage.sync.set({ watchlist });
  return watchlist[manga.id];
}

export async function removeFromWatchlist(mangaId) {
  const watchlist = await getWatchlist();
  delete watchlist[mangaId];

  await browser.storage.sync.set({ watchlist });

  // Also remove from newChapters
  const { newChapters } = await browser.storage.sync.get('newChapters');
  if (newChapters && newChapters[mangaId]) {
    delete newChapters[mangaId];
    await browser.storage.sync.set({ newChapters });
  }
}

export async function isInWatchlist(mangaId) {
  const watchlist = await getWatchlist();
  return mangaId in watchlist;
}

export async function getNewChapters() {
  const { newChapters } = await browser.storage.sync.get('newChapters');
  return newChapters || {};
}

export async function clearNewChaptersForManga(mangaId) {
  const newChapters = await getNewChapters();
  delete newChapters[mangaId];
  await browser.storage.sync.set({ newChapters });
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
