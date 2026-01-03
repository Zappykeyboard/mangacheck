// Content script for MangaKatana manga pages
// Replaces bookmark button with watchlist functionality

(function() {
  'use strict';

  // Configuration
  const SELECTORS = {
    bookmarkButton: [
      'a.bookmark',
      '.bookmark-btn',
      'a[href*="bookmark"]',
      'button.bookmark'
    ],
    mangaTitle: '.heading',
    chapterTable: '.chapters'
  };

  let mangaData = null;
  let isInWatchlist = false;

  async function init() {
    console.log('MangaKatana Watchlist: Initializing...');

    // Extract manga data from page
    mangaData = extractMangaData();

    if (!mangaData) {
      console.warn('MangaKatana Watchlist: Could not extract manga data');
      return;
    }

    console.log('MangaKatana Watchlist: Extracted manga data:', mangaData.title);

    // Check if already in watchlist
    isInWatchlist = await checkWatchlistStatus(mangaData.id);

    // Find and replace bookmark button
    const bookmarkButton = findBookmarkButton();

    if (bookmarkButton) {
      console.log('MangaKatana Watchlist: Found bookmark button, replacing...');
      replaceBookmarkButton(bookmarkButton);
    } else {
      console.log('MangaKatana Watchlist: Bookmark button not found, injecting our button');
      injectWatchlistButton();
    }
  }

  function extractMangaData() {
    try {
      // Extract manga ID from URL
      // URL format: https://mangakatana.com/manga/manga-name.12345
      const urlParts = window.location.pathname.split('/');
      const mangaSlug = urlParts[urlParts.length - 1];

      if (!mangaSlug || mangaSlug.length === 0) {
        return null;
      }

      const mangaId = mangaSlug;

      // Extract title
      const titleEl = document.querySelector(SELECTORS.mangaTitle);
      const title = titleEl ? titleEl.textContent.trim() : 'Unknown Manga';

      // Extract latest chapter
      const latestChapter = extractLatestChapter();

      return {
        id: mangaId,
        title: title,
        url: window.location.href,
        latestChapter: latestChapter
      };
    } catch (error) {
      console.error('MangaKatana Watchlist: Error extracting manga data:', error);
      return null;
    }
  }

  function extractLatestChapter() {
    try {
      const chapterTable = document.querySelector(SELECTORS.chapterTable);
      if (!chapterTable) return null;

      const firstRow = chapterTable.querySelector('tr');
      if (!firstRow) return null;

      const link = firstRow.querySelector('a');
      if (!link) return null;

      const chapterText = link.textContent.trim();
      const chapterUrl = link.href;

      // Get date from last cell
      const cells = firstRow.querySelectorAll('td');
      const dateCell = cells[cells.length - 1];
      const date = dateCell ? dateCell.textContent.trim() : '';

      return {
        number: chapterText,
        title: chapterText,
        url: chapterUrl,
        date: date
      };
    } catch (error) {
      console.error('MangaKatana Watchlist: Error extracting latest chapter:', error);
      return null;
    }
  }

  function findBookmarkButton() {
    // Try each selector
    for (const selector of SELECTORS.bookmarkButton) {
      const button = document.querySelector(selector);
      if (button) return button;
    }

    // Fallback: search for any link/button containing "bookmark"
    const allLinks = document.querySelectorAll('a, button');
    for (const link of allLinks) {
      const text = link.textContent.toLowerCase();
      if (text.includes('bookmark')) {
        return link;
      }
    }

    return null;
  }

  function replaceBookmarkButton(bookmarkButton) {
    const watchlistButton = createWatchlistButton();

    // Replace in DOM
    bookmarkButton.parentNode.replaceChild(watchlistButton, bookmarkButton);
    console.log('MangaKatana Watchlist: Bookmark button replaced');
  }

  function injectWatchlistButton() {
    // If no bookmark button found, inject near title or info section
    const titleEl = document.querySelector(SELECTORS.mangaTitle);

    if (titleEl) {
      const watchlistButton = createWatchlistButton();

      // Try to find a good location - look for info section or buttons container
      const infoSection = document.querySelector('.info');
      if (infoSection) {
        infoSection.appendChild(watchlistButton);
      } else {
        titleEl.parentNode.insertBefore(watchlistButton, titleEl.nextSibling);
      }

      console.log('MangaKatana Watchlist: Button injected');
    }
  }

  function createWatchlistButton() {
    const button = document.createElement('button');
    button.id = 'manga-watchlist-button';
    button.className = 'watchlist-btn';
    button.textContent = isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist';
    button.dataset.inWatchlist = isInWatchlist;

    button.addEventListener('click', handleWatchlistClick);

    return button;
  }

  async function handleWatchlistClick(event) {
    event.preventDefault();

    const button = event.target;
    const currentlyInWatchlist = button.dataset.inWatchlist === 'true';

    // Disable button during operation
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = currentlyInWatchlist ? 'Removing...' : 'Adding...';

    try {
      if (currentlyInWatchlist) {
        // Remove from watchlist
        const response = await browser.runtime.sendMessage({
          type: 'REMOVE_FROM_WATCHLIST',
          data: { id: mangaData.id }
        });

        if (response.success) {
          button.textContent = '+ Add to Watchlist';
          button.dataset.inWatchlist = 'false';
          isInWatchlist = false;
          console.log('MangaKatana Watchlist: Removed from watchlist');
        } else {
          throw new Error(response.error || 'Failed to remove from watchlist');
        }

      } else {
        // Add to watchlist
        const response = await browser.runtime.sendMessage({
          type: 'ADD_TO_WATCHLIST',
          data: mangaData
        });

        if (response.success) {
          button.textContent = '✓ In Watchlist';
          button.dataset.inWatchlist = 'true';
          isInWatchlist = true;
          console.log('MangaKatana Watchlist: Added to watchlist');
        } else {
          throw new Error(response.error || 'Failed to add to watchlist');
        }
      }
    } catch (error) {
      console.error('MangaKatana Watchlist: Error updating watchlist:', error);
      alert('Failed to update watchlist. Please try again.');
      button.textContent = originalText;
    } finally {
      button.disabled = false;
    }
  }

  async function checkWatchlistStatus(mangaId) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'CHECK_WATCHLIST_STATUS',
        data: { id: mangaId }
      });
      return response.inWatchlist || false;
    } catch (error) {
      console.error('MangaKatana Watchlist: Error checking watchlist status:', error);
      return false;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
