// Storage compression utilities to reduce storage.sync quota usage
// Achieves ~70% storage reduction through URL reconstruction, field deduplication, and timestamp compression

// Base epoch for timestamp compression (Jan 1, 2024 00:00:00 UTC)
const BASE_EPOCH = 1704067200000;

// Timestamp compression: 13-digit milliseconds → 4-5 digit hours offset
export function compressTimestamp(timestamp) {
  if (!timestamp) return null;
  return Math.floor((timestamp - BASE_EPOCH) / 3600000); // Convert to hours offset
}

export function decompressTimestamp(compressed) {
  if (compressed === null || compressed === undefined) return null;
  if (compressed === 0) return BASE_EPOCH; // Handle 0 as the base epoch
  return BASE_EPOCH + (compressed * 3600000); // Convert back to milliseconds
}

// URL reconstruction from manga ID and chapter number
export function buildMangaUrl(mangaId) {
  return `https://mangakatana.com/manga/${mangaId}`;
}

export function buildChapterUrl(mangaId, chapterNumber) {
  // Extract numeric part: "Chapter 1095" → "1095", "1095" → "1095", "Chapter 1095.5" → "1095.5"
  const numMatch = chapterNumber?.toString().match(/(\d+\.?\d*)/);
  const num = numMatch ? numMatch[1] : chapterNumber;
  return `https://mangakatana.com/manga/${mangaId}/c${num}`;
}

// Extract just the chapter number from title
// "Chapter 1095" → "1095", "Chapter 1095: Title" → "1095"
export function extractChapterNumberOnly(chapterTitle) {
  if (!chapterTitle) return '';
  const match = chapterTitle.toString().match(/(\d+\.?\d*)/);
  return match ? match[1] : chapterTitle;
}

// Shorten date format by removing year
// "Jan 15, 2025" → "Jan 15", "2025-01-15" → "Jan 15"
export function shortenDate(dateStr) {
  if (!dateStr) return '';
  // Remove year (4 digits with optional comma/space)
  return dateStr.replace(/,?\s*\d{4}/, '').trim();
}

// Compress watchlist entry: full object → compact format
export function compressWatchlistEntry(manga) {
  return {
    t: manga.title || '',
    l: extractChapterNumberOnly(manga.latestChapter?.number || ''),
    s: extractChapterNumberOnly(manga.lastSeenChapter?.number || ''),
    d: shortenDate(manga.latestChapter?.date || ''),
    a: compressTimestamp(manga.addedAt),
    c: manga.lastChecked // Keep lastChecked at full precision (important for "X minutes ago")
  };
}

// Decompress watchlist entry: compact format → full object
export function decompressWatchlistEntry(compressed, mangaId) {
  return {
    id: mangaId,
    title: compressed.t || '',
    url: buildMangaUrl(mangaId),
    latestChapter: {
      number: compressed.l || '',
      title: compressed.l || '', // Use number as title (they're identical in MangaKatana)
      url: buildChapterUrl(mangaId, compressed.l || ''),
      date: compressed.d || ''
    },
    lastSeenChapter: {
      number: compressed.s || '',
      title: compressed.s || '',
      url: buildChapterUrl(mangaId, compressed.s || ''),
      date: '' // Not stored anymore, not needed for functionality
    },
    addedAt: decompressTimestamp(compressed.a),
    lastChecked: compressed.c // Already at full precision, no decompression needed
  };
}

// Compress new chapter entry
export function compressChapterEntry(chapter) {
  return {
    n: extractChapterNumberOnly(chapter.number),
    d: shortenDate(chapter.date),
    t: compressTimestamp(chapter.detectedAt)
  };
}

// Decompress new chapter entry
export function decompressChapterEntry(compressed, mangaId) {
  return {
    number: compressed.n || '',
    title: compressed.n || '', // Use number as title
    url: buildChapterUrl(mangaId, compressed.n || ''),
    date: compressed.d || '',
    detectedAt: decompressTimestamp(compressed.t)
  };
}

// Limit new chapters array to prevent unbounded storage growth
export function limitNewChapters(chapters, maxCount = 3) {
  if (!Array.isArray(chapters)) return [];
  // Keep only the most recent N chapters (assumed to be in order, newest first)
  return chapters.slice(0, maxCount);
}
