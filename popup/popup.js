// Popup UI logic for MangaKatana Watchlist extension

import { formatRelativeTime } from '../lib/utils.js';

// Tab management
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active states
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Load data on popup open
async function loadData() {
  try {
    const { watchlist, newChapters, settings } = await browser.storage.sync.get([
      'watchlist',
      'newChapters',
      'settings'
    ]);

    renderNewChapters(newChapters || {}, watchlist || {});
    renderWatchlist(watchlist || {});
    updateLastCheckTime(settings?.lastGlobalCheck);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function renderNewChapters(newChapters, watchlist) {
  const container = document.getElementById('new-chapters-list');
  const emptyState = document.getElementById('no-new-chapters');
  const badge = document.getElementById('new-count');

  const mangaIds = Object.keys(newChapters);
  let totalCount = 0;

  if (mangaIds.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    badge.textContent = '0';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';
  container.innerHTML = '';

  for (const mangaId of mangaIds) {
    const chapters = newChapters[mangaId];
    if (!chapters || chapters.length === 0) continue;

    totalCount += chapters.length;

    const manga = watchlist[mangaId];
    const mangaCard = createNewChaptersCard(mangaId, chapters, manga);
    container.appendChild(mangaCard);
  }

  badge.textContent = totalCount;
}

function createNewChaptersCard(mangaId, chapters, manga) {
  const card = document.createElement('div');
  card.className = 'manga-card new';

  const title = manga ? manga.title : 'Unknown Manga';
  const mangaUrl = manga ? manga.url : '#';

  card.innerHTML = `
    <div class="manga-header">
      <h3 class="manga-title">${escapeHtml(title)}</h3>
      <span class="new-badge">${chapters.length} new</span>
    </div>
    <div class="chapter-list">
      ${chapters.map(ch => `
        <a href="${escapeHtml(ch.url)}" class="chapter-item" target="_blank">
          <span class="chapter-title">${escapeHtml(ch.title)}</span>
          <span class="chapter-date">${escapeHtml(ch.date)}</span>
        </a>
      `).join('')}
    </div>
    <div class="manga-actions">
      <button class="btn-mark-read" data-manga-id="${mangaId}">Mark as Read</button>
      <a href="${escapeHtml(mangaUrl)}" class="btn-view" target="_blank">View Manga</a>
    </div>
  `;

  // Add mark as read handler
  const markReadBtn = card.querySelector('.btn-mark-read');
  markReadBtn.addEventListener('click', () => markAsRead(mangaId));

  return card;
}

function renderWatchlist(watchlist) {
  const container = document.getElementById('watchlist-list');
  const emptyState = document.getElementById('no-watchlist');
  const badge = document.getElementById('watchlist-count');

  const mangaList = Object.values(watchlist);

  if (mangaList.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    badge.textContent = '0';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';
  container.innerHTML = '';
  badge.textContent = mangaList.length;

  // Sort by most recently added
  mangaList.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  for (const manga of mangaList) {
    const mangaCard = createWatchlistCard(manga);
    container.appendChild(mangaCard);
  }
}

function createWatchlistCard(manga) {
  const card = document.createElement('div');
  card.className = 'manga-card';

  const lastChecked = manga.lastChecked
    ? formatRelativeTime(manga.lastChecked)
    : 'Never';

  card.innerHTML = `
    <div class="manga-header">
      <h3 class="manga-title">${escapeHtml(manga.title)}</h3>
    </div>
    <div class="manga-info">
      <div class="info-row">
        <span class="label">Latest:</span>
        <span class="value">${escapeHtml(manga.latestChapter?.title || 'Unknown')}</span>
      </div>
      <div class="info-row">
        <span class="label">Last checked:</span>
        <span class="value">${lastChecked}</span>
      </div>
    </div>
    <div class="manga-actions">
      <a href="${escapeHtml(manga.url)}" class="btn-view" target="_blank">View Manga</a>
      <button class="btn-remove" data-manga-id="${manga.id}">Remove</button>
    </div>
  `;

  // Add remove handler
  const removeBtn = card.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => removeFromWatchlist(manga.id));

  return card;
}

async function markAsRead(mangaId) {
  try {
    const { newChapters } = await browser.storage.sync.get('newChapters');

    delete newChapters[mangaId];

    await browser.storage.sync.set({ newChapters });

    loadData(); // Refresh UI
  } catch (error) {
    console.error('Error marking as read:', error);
    alert('Failed to mark as read. Please try again.');
  }
}

async function removeFromWatchlist(mangaId) {
  if (!confirm('Remove this manga from your watchlist?')) return;

  try {
    const response = await browser.runtime.sendMessage({
      type: 'REMOVE_FROM_WATCHLIST',
      data: { id: mangaId }
    });

    if (response.success) {
      loadData(); // Refresh UI
    } else {
      throw new Error(response.error || 'Failed to remove from watchlist');
    }
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    alert('Failed to remove from watchlist. Please try again.');
  }
}

function updateLastCheckTime(timestamp) {
  const element = document.getElementById('last-check');

  if (!timestamp) {
    element.textContent = 'Last checked: Never';
    return;
  }

  const timeStr = formatRelativeTime(timestamp);
  element.textContent = `Last checked: ${timeStr}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Test notification button
document.getElementById('test-notif-btn').addEventListener('click', async () => {
  const btn = document.getElementById('test-notif-btn');
  btn.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({ type: 'TEST_NOTIFICATION' });

    if (response.success) {
      console.log('Test notification sent!');
      // Visual feedback
      btn.textContent = '✅';
      setTimeout(() => {
        btn.textContent = '🔔';
        btn.disabled = false;
      }, 1000);
    } else {
      throw new Error(response.error || 'Failed to send test notification');
    }
  } catch (error) {
    console.error('Test notification failed:', error);
    alert('Failed to send test notification: ' + error.message);
    btn.disabled = false;
  }
});

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    // Trigger manual check
    const response = await browser.runtime.sendMessage({ type: 'MANUAL_CHECK' });

    if (response.success) {
      console.log('Manual check completed:', response.message);
    } else {
      console.error('Manual check failed:', response.message);
    }

    // Wait a bit then reload
    setTimeout(() => {
      loadData();
      btn.disabled = false;
      btn.textContent = '🔄';
    }, 2000);
  } catch (error) {
    console.error('Refresh failed:', error);
    btn.disabled = false;
    btn.textContent = '🔄';
    alert('Failed to refresh. Please try again.');
  }
});

// Initialize
loadData();

// Listen for storage changes
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    loadData();
  }
});
