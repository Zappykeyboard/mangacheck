// Core logic for fetching and comparing chapters

import { fetchWithRetry } from '../lib/utils.js';
import { parseChapterList, getNewChaptersFromList } from '../lib/parser.js';
import { createChapterNotification } from './notification-manager.js';
import { safeStorageSet, getWatchlist, getNewChapters } from '../lib/storage-manager.js';
import {
  compressWatchlistEntry,
  compressChapterEntry,
  limitNewChapters
} from '../lib/storage-compression.js';

export async function checkMangaForNewChapters(manga) {
  const { id, url, lastSeenChapter } = manga;

  try {
    console.log(`Checking manga: ${id}`);

    // Fetch manga page with retry logic
    const response = await fetchWithRetry(url);
    const html = await response.text();

    // Parse chapter list
    const chapters = parseChapterList(html);

    if (chapters.length === 0) {
      console.warn(`No chapters found for ${id}`);
      return { id, newChapters: [], error: null };
    }

    // Get latest chapter (first in list, assuming sorted newest first)
    const latestChapter = chapters[0];

    // If this is first check, just store the latest chapter
    if (!lastSeenChapter) {
      console.log(`First check for ${id}, storing latest chapter`);
      return { id, latestChapter, newChapters: [], firstCheck: true };
    }

    // Find new chapters by comparing with last seen
    const newChapters = getNewChaptersFromList(chapters, lastSeenChapter);

    if (newChapters.length > 0) {
      console.log(`Found ${newChapters.length} new chapter(s) for ${id}`);
    }

    return { id, latestChapter, newChapters, error: null };

  } catch (error) {
    console.error(`Error checking ${id}:`, error);
    return { id, newChapters: [], error: error.message };
  }
}

export async function checkAllManga(watchlist) {
  const mangaList = Object.values(watchlist);

  if (mangaList.length === 0) {
    console.log('Watchlist is empty, nothing to check');
    return [];
  }

  console.log(`Checking ${mangaList.length} manga for updates...`);

  // Check in batches to avoid overwhelming the server
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 2000; // 2 seconds between batches
  const results = [];

  for (let i = 0; i < mangaList.length; i += BATCH_SIZE) {
    const batch = mangaList.slice(i, i + BATCH_SIZE);

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(mangaList.length / BATCH_SIZE)}`);

    const batchResults = await Promise.allSettled(
      batch.map(manga => checkMangaForNewChapters(manga))
    );

    // Extract successful results
    const successful = batchResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    results.push(...successful);

    // Log failed checks
    const failed = batchResults
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    if (failed.length > 0) {
      console.error('Some manga checks failed:', failed);
    }

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < mangaList.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`Check complete. Processed ${results.length}/${mangaList.length} manga`);
  return results;
}

export async function processCheckResults(results) {
  // Use storage-manager functions to get decompressed data
  const watchlist = await getWatchlist();
  const newChapters = await getNewChapters();

  const updatedWatchlist = { ...watchlist };
  const updatedNewChapters = { ...newChapters };

  for (const result of results) {
    const { id, latestChapter, newChapters: foundNewChapters, firstCheck, error } = result;

    if (error) {
      console.error(`Error checking ${id}: ${error}`);
      continue;
    }

    // Update manga with latest chapter and last checked time
    if (latestChapter) {
      updatedWatchlist[id] = {
        ...updatedWatchlist[id],
        latestChapter: latestChapter,
        lastChecked: Date.now()
      };

      // Update lastSeenChapter if first check
      if (firstCheck) {
        updatedWatchlist[id].lastSeenChapter = latestChapter;
      }
    }

    // Store and notify about new chapters
    if (foundNewChapters && foundNewChapters.length > 0) {
      // Add detected timestamp to each chapter and limit to 3
      const chaptersWithTimestamp = foundNewChapters.map(ch => ({
        ...ch,
        detectedAt: Date.now()
      }));

      // Limit to 3 most recent chapters to prevent unbounded storage growth
      const limitedChapters = limitNewChapters(chaptersWithTimestamp, 3);
      updatedNewChapters[id] = limitedChapters;

      // Send notification
      await createChapterNotification(
        id,
        updatedWatchlist[id].title,
        foundNewChapters
      );

      // Update lastSeenChapter to latest after notification
      updatedWatchlist[id].lastSeenChapter = latestChapter;
    }
  }

  // Compress data before storing
  const compressedWatchlist = {};
  for (const [id, manga] of Object.entries(updatedWatchlist)) {
    compressedWatchlist[id] = compressWatchlistEntry(manga);
  }

  const compressedNewChapters = {};
  for (const [id, chapters] of Object.entries(updatedNewChapters)) {
    compressedNewChapters[id] = chapters.map(ch => compressChapterEntry(ch));
  }

  // Save compressed updates using safe storage method
  await safeStorageSet({
    watchlist: compressedWatchlist,
    newChapters: compressedNewChapters
  });

  console.log('Check results processed and saved (compressed format)');
}
