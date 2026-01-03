// Handles notification creation and click events

import { getSettings } from '../lib/storage-manager.js';

// Maps notification ID to manga data
const notificationMap = new Map();

export async function createChapterNotification(mangaId, mangaTitle, newChapters) {
  const settings = await getSettings();

  if (!settings.notificationsEnabled) {
    console.log('Notifications disabled, skipping');
    return;
  }

  const count = newChapters.length;
  const notificationId = `manga-${mangaId}-${Date.now()}`;

  // Store mapping for click handler
  notificationMap.set(notificationId, { mangaId, newChapters });

  const title = count === 1
    ? `New chapter for ${mangaTitle}`
    : `${count} new chapters for ${mangaTitle}`;

  const message = count === 1
    ? newChapters[0].title
    : newChapters.slice(0, 5).map(ch => ch.title).join('\n') +
      (count > 5 ? `\n... and ${count - 5} more` : '');

  try {
    await browser.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-128.svg'),
      title: title,
      message: message,
      priority: 2
    });

    console.log(`Notification created for ${mangaTitle}`);

    // Clean up old mappings after 10 minutes
    setTimeout(() => {
      notificationMap.delete(notificationId);
    }, 600000);

  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function handleNotificationClick(notificationId) {
  const data = notificationMap.get(notificationId);

  if (!data) {
    console.log('No data found for notification, opening popup');
    // Generic click - just show a message
    return;
  }

  try {
    // Get manga URL from storage
    const { watchlist } = await browser.storage.sync.get('watchlist');
    const manga = watchlist[data.mangaId];

    if (manga) {
      // Open manga page in new tab
      // Note: Firefox MV3 doesn't allow programmatic popup opening
      await browser.tabs.create({ url: manga.url });
      console.log(`Opened manga page for ${manga.title}`);
    }

    // Clear notification
    await browser.notifications.clear(notificationId);
    notificationMap.delete(notificationId);

  } catch (error) {
    console.error('Error handling notification click:', error);
  }
}
