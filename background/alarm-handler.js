// Manages periodic chapter checking via Firefox alarms API

import { getSettings, updateSettings } from '../lib/storage-manager.js';
import { checkAllManga, processCheckResults } from './chapter-checker.js';

export async function initializeAlarm() {
  try {
    // Clear any existing alarms
    await browser.alarms.clear('checkChapters');

    // Get check interval from settings
    const settings = await getSettings();
    const intervalMinutes = settings.checkIntervalHours * 60;

    // Create recurring alarm
    await browser.alarms.create('checkChapters', {
      periodInMinutes: intervalMinutes  // Default: 360 minutes (6 hours)
    });

    console.log(`Alarm initialized: checking every ${settings.checkIntervalHours} hours (${intervalMinutes} minutes)`);
  } catch (error) {
    console.error('Error initializing alarm:', error);
  }
}

export async function handleAlarm(alarm) {
  if (alarm.name !== 'checkChapters') {
    console.log(`Ignoring alarm: ${alarm.name}`);
    return;
  }

  console.log('Alarm triggered: checking for new chapters...');

  try {
    const { watchlist } = await browser.storage.sync.get('watchlist');

    if (!watchlist || Object.keys(watchlist).length === 0) {
      console.log('No manga in watchlist, skipping check');
      return;
    }

    // Update last check time
    await updateSettings({ lastGlobalCheck: Date.now() });

    // Check each manga in watchlist
    const results = await checkAllManga(watchlist);

    // Process results and send notifications
    await processCheckResults(results);

    console.log('Alarm check completed successfully');

  } catch (error) {
    console.error('Error during alarm check:', error);
  }
}

export async function triggerManualCheck() {
  console.log('Manual check triggered');

  try {
    const { watchlist } = await browser.storage.sync.get('watchlist');

    if (!watchlist || Object.keys(watchlist).length === 0) {
      console.log('No manga in watchlist');
      return { success: false, message: 'Watchlist is empty' };
    }

    // Update last check time
    await updateSettings({ lastGlobalCheck: Date.now() });

    // Check all manga
    const results = await checkAllManga(watchlist);

    // Process results
    await processCheckResults(results);

    return {
      success: true,
      message: `Checked ${results.length} manga`,
      results
    };

  } catch (error) {
    console.error('Error during manual check:', error);
    return {
      success: false,
      message: error.message
    };
  }
}
