# YouTube Channel Notifier - Project Structure

## Professional Folder Organization

The extension code is now professionally organized into a clean, maintainable structure:

```
youtube-channel-notifier/
│
├── manifest.json                 # Extension manifest (entry point)
├── README.md                     # Project documentation
├── PERFORMANCE_IMPROVEMENTS.md   # Performance optimization notes
├── PROJECT_STRUCTURE.md         # This file
│
└── src/                         # Source code directory
    │
    ├── background/              # Background service worker
    │   └── background.js        # Main background script
    │
    ├── content/                 # Content scripts
    │   └── content.js           # YouTube page tracker
    │
    ├── popup/                   # Extension popup
    │   ├── popup.html          # Popup UI
    │   └── popup.js            # Popup logic
    │
    ├── pages/                   # Extension pages
    │   ├── dashboard.html      # Main dashboard page
    │   ├── dashboard.js        # Dashboard functionality
    │   ├── ghost-dashboard.html # Email notification settings
    │   ├── ghost-dashboard.js  # Ghost protocol logic
    │   ├── guide.html          # Getting started guide
    │   ├── guide.js            # Guide interactions
    │   ├── documentation.html  # Technical documentation
    │   └── documentation.js    # Documentation logic
    │
    ├── lib/                     # External libraries
    │   └── auth.js             # Authentication module
    │
    ├── utils/                   # Utility modules
    │   └── intelligence.js     # Data analysis utilities
    │
    ├── styles/                  # Stylesheets
    │   └── styles.css          # Main stylesheet
    │
    └── assets/                  # Static assets
        └── icons/              # Extension icons
            ├── icon16.png
            ├── icon32.png
            ├── icon48.png
            └── icon128.png
```

## Architecture Overview

### Core Components

1. **Background Service Worker** (`src/background/`)
   - Handles all background operations
   - Manages notifications and alarms
   - Coordinates data storage
   - RSS feed checking for new videos

2. **Content Script** (`src/content/`)
   - Tracks YouTube video watching
   - Detects channel interactions
   - Implements skip detection
   - Manages session intelligence

3. **Popup Interface** (`src/popup/`)
   - Quick access to extension stats
   - Shows currently playing video
   - Links to dashboard and settings

4. **Dashboard Pages** (`src/pages/`)
   - Full channel management interface
   - Ghost Protocol email settings
   - User guides and documentation

### Supporting Modules

- **Authentication** (`src/lib/auth.js`) - OAuth and email service authentication
- **Intelligence** (`src/utils/intelligence.js`) - Data analysis and pattern recognition
- **Styles** (`src/styles/`) - Consistent UI styling across all pages

## Benefits of This Structure

1. **Separation of Concerns** - Each component has its own directory
2. **Easy Navigation** - Logical grouping makes finding files intuitive
3. **Scalability** - Easy to add new features without cluttering
4. **Maintainability** - Clear organization reduces debugging time
5. **Professional Standards** - Follows industry best practices

## Development Guidelines

- Keep background logic in `src/background/`
- Place new UI pages in `src/pages/`
- Add utility functions to `src/utils/`
- Store third-party code in `src/lib/`
- Maintain consistent naming conventions
- Document new modules as they're added

## Testing

To test the extension with the new structure:

1. Open Chrome Extensions page (`chrome://extensions/`)
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `youtube-channel-notifier` directory
5. The extension should load without errors

All paths in `manifest.json` and internal references have been updated to reflect the new structure.