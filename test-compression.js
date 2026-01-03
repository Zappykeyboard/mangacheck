// Simple test to validate storage compression
import {
  compressTimestamp,
  decompressTimestamp,
  buildMangaUrl,
  buildChapterUrl,
  extractChapterNumberOnly,
  shortenDate,
  compressWatchlistEntry,
  decompressWatchlistEntry,
  compressChapterEntry,
  decompressChapterEntry,
  limitNewChapters
} from './lib/storage-compression.js';

console.log('=== Storage Compression Tests ===\n');

// Test 1: Timestamp compression
console.log('Test 1: Timestamp Compression');
const originalTimestamp = 1736899200000; // Jan 15, 2025
const compressed = compressTimestamp(originalTimestamp);
const decompressed = decompressTimestamp(compressed);
console.log(`Original: ${originalTimestamp} (${new Date(originalTimestamp).toISOString()})`);
console.log(`Compressed: ${compressed} hours`);
console.log(`Decompressed: ${decompressed} (${new Date(decompressed).toISOString()})`);
console.log(`Accuracy: ${Math.abs(originalTimestamp - decompressed) / 3600000} hours difference`);
console.log(`Storage saved: ${JSON.stringify(originalTimestamp).length} → ${JSON.stringify(compressed).length} bytes\n`);

// Test 2: URL Reconstruction
console.log('Test 2: URL Reconstruction');
const mangaId = 'one-piece.12345';
const chapterNum = '1095';
const mangaUrl = buildMangaUrl(mangaId);
const chapterUrl = buildChapterUrl(mangaId, chapterNum);
console.log(`Manga URL: ${mangaUrl}`);
console.log(`Chapter URL: ${chapterUrl}\n`);

// Test 3: Chapter number extraction
console.log('Test 3: Chapter Number Extraction');
const testTitles = ['Chapter 1095', 'Chapter 1095: The Title', '1095', 'Chapter 1095.5'];
testTitles.forEach(title => {
  console.log(`"${title}" → "${extractChapterNumberOnly(title)}"`);
});
console.log();

// Test 4: Date shortening
console.log('Test 4: Date Shortening');
const dates = ['Jan 15, 2025', 'Dec 25, 2024', 'Feb 29, 2024'];
dates.forEach(date => {
  console.log(`"${date}" → "${shortenDate(date)}" (saved ${date.length - shortenDate(date).length} chars)`);
});
console.log();

// Test 5: Full watchlist entry compression
console.log('Test 5: Watchlist Entry Compression');
const sampleManga = {
  id: 'one-piece.12345',
  title: 'One Piece',
  url: 'https://mangakatana.com/manga/one-piece.12345',
  latestChapter: {
    number: 'Chapter 1095',
    title: 'Chapter 1095',
    url: 'https://mangakatana.com/manga/one-piece.12345/c1095',
    date: 'Jan 15, 2025'
  },
  lastSeenChapter: {
    number: 'Chapter 1094',
    title: 'Chapter 1094',
    url: 'https://mangakatana.com/manga/one-piece.12345/c1094',
    date: 'Jan 08, 2025'
  },
  addedAt: 1704067200000,
  lastChecked: 1736899200000
};

const compressedEntry = compressWatchlistEntry(sampleManga);
const decompressedEntry = decompressWatchlistEntry(compressedEntry, sampleManga.id);

console.log('Original entry:');
console.log(JSON.stringify(sampleManga, null, 2));
console.log(`\nOriginal size: ${JSON.stringify(sampleManga).length} bytes`);

console.log('\nCompressed entry:');
console.log(JSON.stringify(compressedEntry, null, 2));
console.log(`\nCompressed size: ${JSON.stringify(compressedEntry).length} bytes`);

console.log('\nDecompressed entry:');
console.log(JSON.stringify(decompressedEntry, null, 2));

const reduction = ((1 - JSON.stringify(compressedEntry).length / JSON.stringify(sampleManga).length) * 100).toFixed(1);
console.log(`\nStorage reduction: ${reduction}%`);
console.log(`Saved: ${JSON.stringify(sampleManga).length - JSON.stringify(compressedEntry).length} bytes per manga\n`);

// Test 6: Chapter entry compression
console.log('Test 6: Chapter Entry Compression');
const sampleChapter = {
  number: 'Chapter 1095',
  title: 'Chapter 1095',
  url: 'https://mangakatana.com/manga/one-piece.12345/c1095',
  date: 'Jan 15, 2025',
  detectedAt: 1736899200000
};

const compressedChapter = compressChapterEntry(sampleChapter);
const decompressedChapter = decompressChapterEntry(compressedChapter, mangaId);

console.log('Original chapter:');
console.log(JSON.stringify(sampleChapter, null, 2));
console.log(`Original size: ${JSON.stringify(sampleChapter).length} bytes`);

console.log('\nCompressed chapter:');
console.log(JSON.stringify(compressedChapter, null, 2));
console.log(`Compressed size: ${JSON.stringify(compressedChapter).length} bytes`);

const chapterReduction = ((1 - JSON.stringify(compressedChapter).length / JSON.stringify(sampleChapter).length) * 100).toFixed(1);
console.log(`\nChapter storage reduction: ${chapterReduction}%\n`);

// Test 7: Chapter limiting
console.log('Test 7: Chapter Limiting');
const manyChapters = [
  { number: '1095', detectedAt: Date.now() },
  { number: '1094', detectedAt: Date.now() - 86400000 },
  { number: '1093', detectedAt: Date.now() - 172800000 },
  { number: '1092', detectedAt: Date.now() - 259200000 },
  { number: '1091', detectedAt: Date.now() - 345600000 }
];

const limited = limitNewChapters(manyChapters, 3);
console.log(`Original: ${manyChapters.length} chapters`);
console.log(`After limiting: ${limited.length} chapters`);
console.log(`Limited chapters: ${limited.map(ch => ch.number).join(', ')}\n`);

// Test 8: Overall storage calculation
console.log('=== Overall Storage Impact ===');
const mangaCount = 150;
const avgChaptersPerManga = 2;

const oldSize = mangaCount * JSON.stringify(sampleManga).length +
                mangaCount * avgChaptersPerManga * JSON.stringify(sampleChapter).length;
const newSize = mangaCount * JSON.stringify(compressedEntry).length +
                mangaCount * avgChaptersPerManga * JSON.stringify(compressedChapter).length;

console.log(`\nFor ${mangaCount} manga with avg ${avgChaptersPerManga} new chapters each:`);
console.log(`Old format: ${(oldSize / 1024).toFixed(1)} KB`);
console.log(`New format: ${(newSize / 1024).toFixed(1)} KB`);
console.log(`Reduction: ${((1 - newSize / oldSize) * 100).toFixed(1)}%`);
console.log(`\nStorage.sync quota: 100 KB`);
console.log(`Old format usage: ${(oldSize / 1024 / 100 * 100).toFixed(1)}% ${oldSize > 102400 ? '❌ QUOTA EXCEEDED' : '✓'}`);
console.log(`New format usage: ${(newSize / 1024 / 100 * 100).toFixed(1)}% ${newSize > 102400 ? '❌' : '✓ OK'}`);

console.log('\n=== All Tests Complete ===');
