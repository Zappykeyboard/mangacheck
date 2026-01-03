// MangaKatana-specific HTML parsing utilities

import { extractChapterNumber } from './utils.js';

export function parseChapterList(html) {
  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find chapter table - MangaKatana uses a table with class "chapters"
    const chapterTable = doc.querySelector('.chapters');
    if (!chapterTable) {
      console.warn('Chapter table not found');
      return [];
    }

    // Extract chapter rows
    const rows = Array.from(chapterTable.querySelectorAll('tr'));
    const chapters = [];

    for (const row of rows) {
      const link = row.querySelector('a');
      if (!link) continue;

      const chapterText = link.textContent.trim();
      const chapterUrl = link.href;

      // Make sure URL is absolute
      const absoluteUrl = chapterUrl.startsWith('http')
        ? chapterUrl
        : `https://mangakatana.com${chapterUrl}`;

      // Extract date (usually in the last cell)
      const cells = row.querySelectorAll('td');
      const dateCell = cells[cells.length - 1];
      const date = dateCell ? dateCell.textContent.trim() : '';

      // Skip empty or invalid entries
      if (!chapterText || chapterText.length === 0) continue;

      chapters.push({
        number: chapterText,
        title: chapterText,
        url: absoluteUrl,
        date: date
      });
    }

    return chapters;
  } catch (error) {
    console.error('Error parsing chapter list:', error);
    return parseChapterListFallback(html);
  }
}

function parseChapterListFallback(html) {
  try {
    // Fallback: try alternative selectors
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try finding chapter links directly
    const chapterLinks = doc.querySelectorAll('a[href*="/chapter"]');
    const chapters = [];

    for (const link of chapterLinks) {
      const chapterText = link.textContent.trim();
      const chapterUrl = link.href;

      if (!chapterText || chapterText.length === 0) continue;

      const absoluteUrl = chapterUrl.startsWith('http')
        ? chapterUrl
        : `https://mangakatana.com${chapterUrl}`;

      chapters.push({
        number: chapterText,
        title: chapterText,
        url: absoluteUrl,
        date: ''
      });
    }

    return chapters;
  } catch (error) {
    console.error('Fallback parsing also failed:', error);
    return [];
  }
}

export function extractLatestChapter(html) {
  const chapters = parseChapterList(html);
  return chapters.length > 0 ? chapters[0] : null;
}

export function extractMangaTitle(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try multiple selectors
    const selectors = [
      '.heading',
      'h1.heading',
      '.info h1',
      'h1'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return 'Unknown Manga';
  } catch (error) {
    console.error('Error extracting manga title:', error);
    return 'Unknown Manga';
  }
}

export function comparechapters(lastSeenChapter, latestChapter) {
  if (!lastSeenChapter) return true; // First time seeing this manga

  const lastSeenNum = extractChapterNumber(lastSeenChapter.number);
  const latestNum = extractChapterNumber(latestChapter.number);

  return latestNum > lastSeenNum;
}

export function getNewChaptersFromList(chapters, lastSeenChapter) {
  if (!lastSeenChapter) return [];

  const lastSeenNum = extractChapterNumber(lastSeenChapter.number);
  const newChapters = [];

  for (const chapter of chapters) {
    const chapterNum = extractChapterNumber(chapter.number);

    if (chapterNum > lastSeenNum) {
      newChapters.push(chapter);
    } else {
      // Chapters are sorted newest first, so we can break here
      break;
    }
  }

  return newChapters;
}
