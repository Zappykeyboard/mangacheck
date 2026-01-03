# MangaKatana Chapter Watchlist

A Firefox extension (Manifest V3) that monitors your favorite manga on MangaKatana for new chapters and sends notifications when they're available.

## Features

- **Smart Watchlist**: Replace MangaKatana's bookmark button with a custom "Add to Watchlist" button
- **Automatic Checking**: Checks for new chapters every 6 hours using Firefox alarms
- **Browser Notifications**: Get notified when new chapters are detected
- **Cross-Device Sync**: Watchlist syncs across Firefox browsers using `browser.storage.sync`
- **Clean UI**: Beautiful popup interface to manage your watchlist and view new chapters
- **Batch Processing**: Checks multiple manga efficiently without overwhelming the server

## Installation

### For Development

1. Clone this repository or download the files
2. Add proper PNG icons to the `icons` folder (16x16, 48x48, 128x128)
3. Open Firefox and navigate to `about:debugging`
4. Click "This Firefox" in the left sidebar
5. Click "Load Temporary Add-on"
6. Navigate to the extension directory and select `manifest.json`

### For Production

1. Ensure all icons are proper PNG files (not SVG)
2. Zip all files in the extension directory
3. Submit to [Firefox Add-ons](https://addons.mozilla.org/)

## Usage

### Adding Manga to Watchlist

1. Visit any manga page on MangaKatana (e.g., `https://mangakatana.com/manga/your-manga-name.12345`)
2. Look for the "Add to Watchlist" button (it replaces the bookmark button)
3. Click to add the manga to your watchlist
4. The button will change to "✓ In Watchlist"

### Viewing New Chapters

1. Click the extension icon in your Firefox toolbar
2. The popup will show two tabs:
   - **New Chapters**: Lists all manga with new chapters detected
   - **Watchlist**: Shows all manga you're tracking

### Managing Your Watchlist

- **Mark as Read**: Click "Mark as Read" on any manga in the New Chapters tab to clear its new chapter notifications
- **Remove**: Click "Remove" in the Watchlist tab to stop tracking a manga
- **Manual Check**: Click the 🔄 button in the popup header to trigger an immediate check for updates

### Notifications

When new chapters are detected:
- A browser notification will appear
- Clicking the notification opens the manga page in a new tab
- New chapters remain in the popup until you mark them as read

## Project Structure

```
mangacheckv2/
├── manifest.json                 # Extension configuration
├── background/
│   ├── service-worker.js        # Main orchestrator
│   ├── alarm-handler.js         # Periodic check handler
│   ├── chapter-checker.js       # Chapter detection logic
│   └── notification-manager.js  # Notification system
├── content/
│   ├── content-script.js        # Page manipulation
│   └── content-styles.css       # Button styling
├── popup/
│   ├── popup.html               # Extension UI
│   ├── popup.js                 # UI logic
│   └── popup.css                # UI styling
├── lib/
│   ├── storage-manager.js       # Storage abstraction
│   ├── parser.js                # HTML parsing utilities
│   └── utils.js                 # Shared utilities
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Technical Details

### Storage Schema

The extension uses `browser.storage.sync` with the following structure:

```javascript
{
  watchlist: {
    [mangaId]: {
      id, title, url, addedAt, lastChecked,
      latestChapter: { number, title, url, date },
      lastSeenChapter: { number, title }
    }
  },
  newChapters: {
    [mangaId]: [
      { number, title, url, date, detectedAt }
    ]
  },
  settings: {
    checkIntervalHours: 6,
    notificationsEnabled: true,
    lastGlobalCheck: timestamp
  }
}
```

### How Chapter Detection Works

1. Every 6 hours, the alarm triggers a check
2. For each manga in the watchlist:
   - Fetches the manga page HTML
   - Parses the chapter list
   - Compares the latest chapter with `lastSeenChapter`
   - Detects new chapters by comparing chapter numbers
3. Sends notifications for new chapters
4. Updates storage with the latest information

### Performance Optimizations

- **Batch Processing**: Checks 3 manga at a time with 2-second delays
- **Retry Logic**: Network requests retry with exponential backoff (3 attempts)
- **Error Handling**: Failed checks don't break the entire process
- **Storage Quota Management**: Automatically cleans old chapters (>2 weeks) if quota exceeded

## Permissions

The extension requires the following permissions:

- `storage`: To save watchlist and settings
- `alarms`: For periodic chapter checks (every 6 hours)
- `notifications`: To notify you of new chapters
- `https://mangakatana.com/*`: To access and parse manga pages

## Troubleshooting

### Extension doesn't load
- Ensure all files are present in the correct directories
- Check browser console for errors (`Ctrl+Shift+J`)

### Button not appearing on manga pages
- Verify you're on a manga detail page (not chapter or search page)
- Check content script console logs
- Try refreshing the page

### Checks not working
- Open `about:debugging` and check service worker logs
- Verify alarm is created (check browser console)
- Manually trigger a check using the refresh button

### No notifications
- Check Firefox notification permissions for the extension
- Ensure notifications are enabled in extension settings

## Development

### Debug Logging

All components include console.log statements for debugging:
- Service worker logs: `about:debugging` → This Firefox → Inspect service worker
- Content script logs: Open DevTools on MangaKatana page
- Popup logs: Right-click extension popup → Inspect

### Testing

1. Add a manga to watchlist
2. Trigger manual check (🔄 button)
3. Monitor console for logs
4. Verify storage updates in browser DevTools

## Future Enhancements

- Settings page for customizing check interval
- Support for additional manga sites
- Reading progress tracking
- Import/export watchlist
- Statistics and analytics
- Dark mode

## License

This project is open source and available for personal use.

## Credits

Created for tracking manga updates on MangaKatana.com
