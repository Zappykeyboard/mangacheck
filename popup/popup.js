// Popup UI logic for MangaKatana Watchlist extension

import { formatRelativeTime } from '../lib/utils.js';

// Tab management
function initializeTabs() {
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
}

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

  // Create header
  const header = document.createElement('div');
  header.className = 'manga-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'manga-title';
  titleEl.textContent = title;

  const badge = document.createElement('span');
  badge.className = 'new-badge';
  badge.textContent = `${chapters.length} new`;

  header.appendChild(titleEl);
  header.appendChild(badge);

  // Create chapter list
  const chapterList = document.createElement('div');
  chapterList.className = 'chapter-list';

  chapters.forEach(ch => {
    const chapterLink = document.createElement('a');
    chapterLink.href = ch.url;
    chapterLink.className = 'chapter-item';
    chapterLink.target = '_blank';

    const chapterTitle = document.createElement('span');
    chapterTitle.className = 'chapter-title';
    chapterTitle.textContent = ch.title;

    const chapterDate = document.createElement('span');
    chapterDate.className = 'chapter-date';
    chapterDate.textContent = ch.date;

    chapterLink.appendChild(chapterTitle);
    chapterLink.appendChild(chapterDate);
    chapterList.appendChild(chapterLink);
  });

  // Create actions
  const actions = document.createElement('div');
  actions.className = 'manga-actions';

  const markReadBtn = document.createElement('button');
  markReadBtn.className = 'btn-mark-read';
  markReadBtn.dataset.mangaId = mangaId;
  markReadBtn.textContent = 'Mark as Read';
  markReadBtn.addEventListener('click', () => markAsRead(mangaId));

  const viewLink = document.createElement('a');
  viewLink.href = mangaUrl;
  viewLink.className = 'btn-view';
  viewLink.target = '_blank';
  viewLink.textContent = 'View Manga';

  actions.appendChild(markReadBtn);
  actions.appendChild(viewLink);

  // Assemble card
  card.appendChild(header);
  card.appendChild(chapterList);
  card.appendChild(actions);

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

  // Create header
  const header = document.createElement('div');
  header.className = 'manga-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'manga-title';
  titleEl.textContent = manga.title;

  header.appendChild(titleEl);

  // Create info section
  const info = document.createElement('div');
  info.className = 'manga-info';

  // Latest chapter row
  const latestRow = document.createElement('div');
  latestRow.className = 'info-row';

  const latestLabel = document.createElement('span');
  latestLabel.className = 'label';
  latestLabel.textContent = 'Latest:';

  const latestValue = document.createElement('span');
  latestValue.className = 'value';
  latestValue.textContent = manga.latestChapter?.title || 'Unknown';

  latestRow.appendChild(latestLabel);
  latestRow.appendChild(latestValue);

  // Last checked row
  const checkedRow = document.createElement('div');
  checkedRow.className = 'info-row';

  const checkedLabel = document.createElement('span');
  checkedLabel.className = 'label';
  checkedLabel.textContent = 'Last checked:';

  const checkedValue = document.createElement('span');
  checkedValue.className = 'value';
  checkedValue.textContent = lastChecked;

  checkedRow.appendChild(checkedLabel);
  checkedRow.appendChild(checkedValue);

  info.appendChild(latestRow);
  info.appendChild(checkedRow);

  // Create actions
  const actions = document.createElement('div');
  actions.className = 'manga-actions';

  const viewLink = document.createElement('a');
  viewLink.href = manga.url;
  viewLink.className = 'btn-view';
  viewLink.target = '_blank';
  viewLink.textContent = 'View Manga';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove';
  removeBtn.dataset.mangaId = manga.id;
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => removeFromWatchlist(manga.id));

  actions.appendChild(viewLink);
  actions.appendChild(removeBtn);

  // Assemble card
  card.appendChild(header);
  card.appendChild(info);
  card.appendChild(actions);

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
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  loadData();
});

// Listen for storage changes
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    loadData();
  }
});
