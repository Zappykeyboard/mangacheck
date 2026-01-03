// Main background service worker - orchestrates all background operations

import { initializeAlarm, handleAlarm, triggerManualCheck } from './alarm-handler.js';
import { handleNotificationClick } from './notification-manager.js';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../lib/storage-manager.js';

// Installation - set up recurring alarm and default storage
browser.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('First install - initializing...');

    // Initialize alarm
    await initializeAlarm();

    // Set default settings
    await browser.storage.sync.set({
      watchlist: {},
      newChapters: {},
      settings: {
        checkIntervalHours: 6,
        notificationsEnabled: true,
        lastGlobalCheck: null
      }
    });

    console.log('Extension initialized successfully');
  } else if (details.reason === 'update') {
    console.log('Extension updated - re-initializing alarm');
    // Re-initialize alarm to ensure it's running
    await initializeAlarm();
  }
});

// Alarm listener for periodic checks
browser.alarms.onAlarm.addListener(handleAlarm);

// Notification click handler
browser.notifications.onClicked.addListener(handleNotificationClick);

// Message handler from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);

  if (message.type === 'ADD_TO_WATCHLIST') {
    handleAddToWatchlist(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Async response
  }

  if (message.type === 'REMOVE_FROM_WATCHLIST') {
    handleRemoveFromWatchlist(message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_WATCHLIST_STATUS') {
    checkWatchlistStatus(message.data)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ inWatchlist: false, error: err.message }));
    return true;
  }

  if (message.type === 'MANUAL_CHECK') {
    triggerManualCheck()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Unknown message type
  console.warn('Unknown message type:', message.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// Handler functions
async function handleAddToWatchlist(data) {
  try {
    console.log('Adding to watchlist:', data.id);
    const manga = await addToWatchlist(data);
    console.log('Successfully added to watchlist');
    return manga;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
}

async function handleRemoveFromWatchlist(data) {
  try {
    console.log('Removing from watchlist:', data.id);
    await removeFromWatchlist(data.id);
    console.log('Successfully removed from watchlist');
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
}

async function checkWatchlistStatus(data) {
  try {
    const inWatchlist = await isInWatchlist(data.id);
    return { inWatchlist };
  } catch (error) {
    console.error('Error checking watchlist status:', error);
    return { inWatchlist: false, error: error.message };
  }
}

console.log('Service worker loaded');
