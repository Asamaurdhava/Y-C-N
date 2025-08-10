class YCNBackground {
  constructor() {
    this.keepAliveInterval = null;
    this.lastActivity = Date.now();
    this.performanceManager = new PerformanceManager();
    this.smartBadge = new SmartBadgeManager(this);
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.updateActivity();
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message port open for async response
    });

    chrome.notifications.onClicked.addListener((notificationId) => {
      this.updateActivity();
      this.handleNotificationClick(notificationId);
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.updateActivity();
      if (namespace === 'local' && changes.channels) {
        this.checkForNewVideos();
      }
    });

    // Keep service worker alive
    this.startKeepAlive();

    // Handle service worker startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('YCN: Service worker started up');
      this.updateActivity();
    });

    // Handle extension install/enable
    chrome.runtime.onInstalled.addListener(() => {
      console.log('YCN: Extension installed/enabled');
      this.updateActivity();
    });

    console.log('YCN: Background service worker initialized');
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  startKeepAlive() {
    // Ping every 20 seconds to keep service worker active
    this.keepAliveInterval = setInterval(() => {
      try {
        // Simple operation to keep worker alive
        chrome.storage.local.get(['keepAlive'], () => {
          chrome.storage.local.set({ 
            keepAlive: Date.now(),
            lastServiceWorkerPing: Date.now()
          });
        });
        
        console.log('YCN: Service worker keep-alive ping');
      } catch (error) {
        console.warn('YCN: Keep-alive error:', error);
      }
    }, 20000);
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'PING':
          // Simple ping to wake up service worker
          console.log('YCN: Service worker pinged and active');
          sendResponse({ success: true, pong: Date.now() });
          break;
          
        case 'RECORD_VIDEO_WATCH':
          const result = await this.recordVideoWatch(message.channelId, message.videoId, message.channelInfo, message.videoTitle);
          sendResponse(result);
          break;
          
        case 'REQUEST_PERMISSION':
          await this.showPermissionRequest(message.channelId, message.channelName);
          sendResponse({ success: true });
          break;
        
        case 'APPROVE_CHANNEL':
          await this.approveChannel(message.channelId);
          sendResponse({ success: true });
          break;
        
        case 'DENY_CHANNEL':
          await this.denyChannel(message.channelId);
          sendResponse({ success: true });
          break;
        
        case 'UPDATE_CURRENT_VIDEO':
          await this.updateCurrentVideo(message.channelId, message.videoId, message.channelInfo, message.videoTitle);
          sendResponse({ success: true });
          break;
        
        case 'CLEAR_CURRENT_VIDEO':
          await this.clearCurrentVideo(message.channelId);
          sendResponse({ success: true });
          break;
        
        default:
          console.warn('YCN: Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.warn('YCN: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async updateCurrentVideo(channelId, videoId, channelInfo, videoTitle) {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      if (!channels[channelId]) {
        channels[channelId] = {
          name: channelInfo.name || 'Unknown Channel',
          count: 0,
          approved: false,
          lastVideo: null,
          currentVideo: null,
          firstSeen: Date.now(),
          watchedVideos: [], // Track unique video IDs
          watchedVideoData: {} // Store video titles keyed by ID
        };
      }
      
      // Initialize arrays/objects if they don't exist (for existing data)
      if (!channels[channelId].watchedVideos) {
        channels[channelId].watchedVideos = [];
      }
      if (!channels[channelId].watchedVideoData) {
        channels[channelId].watchedVideoData = {};
      }
      
      channels[channelId].currentVideo = {
        id: videoId,
        title: videoTitle,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ channels });

      console.log('YCN: Updated current video for channel:', 
                 channelInfo.name, '(' + channelId + ')', 
                 'Video:', videoTitle);

      return { success: true };
    } catch (error) {
      console.warn('YCN: Error updating current video:', error);
      return { success: false, error: error.message };
    }
  }

  async clearCurrentVideo(channelId) {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      if (channels[channelId]) {
        channels[channelId].currentVideo = null;
        await chrome.storage.local.set({ channels });
        console.log('YCN: Cleared current video for channel:', channelId);
      }

      return { success: true };
    } catch (error) {
      console.warn('YCN: Error clearing current video:', error);
      return { success: false, error: error.message };
    }
  }

  async recordVideoWatch(channelId, videoId, channelInfo, videoTitle) {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      if (!channels[channelId]) {
        channels[channelId] = {
          name: channelInfo.name || 'Unknown Channel',
          count: 0,
          approved: false,
          lastVideo: null,
          currentVideo: null,
          firstSeen: Date.now(),
          watchedVideos: [], // Track unique video IDs
          watchedVideoData: {}, // Store video titles keyed by ID
          
          // Enhanced data structure for 10/10
          relationship: {
            score: 0,
            trend: 'new',
            lastScoreUpdate: Date.now(),
            watchStreak: 0,
            longestBreak: 0
          },
          
          patterns: {
            averageWatchTime: 0,
            watchDays: [],
            watchHours: [],
            sessionCount: 0,
            totalWatchDuration: 0,
            averageWatchPercentage: 0
          },
          
          intelligence: {
            predictedNextWatch: null,
            similarChannels: [],
            lastPatternUpdate: Date.now()
          }
        };
      }
      
      // Initialize arrays/objects if they don't exist (for existing data)
      if (!channels[channelId].watchedVideos) {
        channels[channelId].watchedVideos = [];
      }
      if (!channels[channelId].watchedVideoData) {
        channels[channelId].watchedVideoData = {};
      }
      
      // Initialize enhanced structures for existing channels
      if (!channels[channelId].relationship) {
        channels[channelId].relationship = {
          score: Math.min(channels[channelId].count * 8, 100), // Estimate initial score
          trend: channels[channelId].count >= 10 ? 'stable' : 'growing',
          lastScoreUpdate: Date.now(),
          watchStreak: 0,
          longestBreak: 0
        };
      }
      
      if (!channels[channelId].patterns) {
        channels[channelId].patterns = {
          averageWatchTime: 0,
          watchDays: [],
          watchHours: [],
          sessionCount: 0,
          totalWatchDuration: 0,
          averageWatchPercentage: 50 // Default estimate
        };
      }
      
      if (!channels[channelId].intelligence) {
        channels[channelId].intelligence = {
          predictedNextWatch: null,
          similarChannels: [],
          lastPatternUpdate: Date.now()
        };
      }
      
      // Only count if this video hasn't been watched before
      if (!channels[channelId].watchedVideos.includes(videoId)) {
        channels[channelId].watchedVideos.push(videoId);
        channels[channelId].watchedVideoData[videoId] = {
          title: videoTitle,
          timestamp: Date.now()
        };
        channels[channelId].count++;
        
        // Only keep the last 10 videos to prevent storage bloat
        if (channels[channelId].watchedVideos.length > 10) {
          const removedId = channels[channelId].watchedVideos.shift();
          delete channels[channelId].watchedVideoData[removedId];
        }
      } else {
        console.log('YCN: Video already counted, skipping:', videoTitle);
      }
      
      channels[channelId].lastVideo = {
        id: videoId,
        title: videoTitle,
        timestamp: Date.now(),
        channelName: channelInfo.name
      };

      // Use performance manager for debounced save
      this.performanceManager.debouncedSave('channels', channels);

      // Update smart badge
      this.smartBadge.updateSmartBadge();

      console.log('YCN: Background recorded watch for channel:', 
                 channelInfo.name, '(' + channelId + ')', 
                 'Count:', channels[channelId].count,
                 'Video:', videoTitle);

      return {
        success: true,
        count: channels[channelId].count,
        approved: channels[channelId].approved,
        askedPermission: channels[channelId].askedPermission
      };

    } catch (error) {
      console.warn('YCN: Error in background recordVideoWatch:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async showPermissionRequest(channelId, channelName) {
    try {
      const notificationId = `permission_${channelId}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'YCN: New Channel Ready!',
        message: `You've watched 10+ videos from "${channelName}". Enable notifications?`,
        buttons: [
          { title: 'Yes, notify me' },
          { title: 'No thanks' }
        ],
        requireInteraction: true
      });

      chrome.notifications.onButtonClicked.addListener(async (clickedId, buttonIndex) => {
        if (clickedId === notificationId) {
          if (buttonIndex === 0) {
            await this.approveChannel(channelId);
          } else {
            await this.denyChannel(channelId);
          }
          chrome.notifications.clear(clickedId);
        }
      });

    } catch (error) {
      console.warn('YCN: Error showing permission request:', error);
    }
  }

  async approveChannel(channelId) {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      if (channels[channelId]) {
        channels[channelId].approved = true;
        channels[channelId].approvedAt = Date.now();
        await chrome.storage.local.set({ channels });
        
        // Update smart badge
        this.smartBadge.updateSmartBadge();
        
        console.log('YCN: Approved channel:', channelId);
        
        await chrome.notifications.create(`approved_${channelId}`, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'YCN: Notifications Enabled',
          message: `You'll now get notifications for new videos from "${channels[channelId].name}"`,
          silent: false
        });
      }
    } catch (error) {
      console.warn('YCN: Error approving channel:', error);
    }
  }

  async denyChannel(channelId) {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      if (channels[channelId]) {
        channels[channelId].denied = true;
        channels[channelId].deniedAt = Date.now();
        await chrome.storage.local.set({ channels });
        
        // Update smart badge
        this.smartBadge.updateSmartBadge();
        
        console.log('YCN: Denied channel:', channelId);
      }
    } catch (error) {
      console.warn('YCN: Error denying channel:', error);
    }
  }

  async handleNotificationClick(notificationId) {
    try {
      if (notificationId.startsWith('new_video_')) {
        const channelId = notificationId.replace('new_video_', '');
        const result = await chrome.storage.local.get(['channels']);
        const channels = result.channels || {};
        
        if (channels[channelId] && channels[channelId].lastVideo) {
          const videoUrl = `https://www.youtube.com/watch?v=${channels[channelId].lastVideo.id}`;
          await chrome.tabs.create({ url: videoUrl });
        }
      }
      
      chrome.notifications.clear(notificationId);
    } catch (error) {
      console.warn('YCN: Error handling notification click:', error);
    }
  }

  async checkForNewVideos() {
    try {
      const result = await chrome.storage.local.get(['channels', 'lastCheck']);
      const channels = result.channels || {};
      const lastCheck = result.lastCheck || 0;
      const now = Date.now();
      
      if (now - lastCheck < 300000) return;
      
      for (const [channelId, channel] of Object.entries(channels)) {
        if (channel.approved && channel.lastVideo && 
            channel.lastVideo.timestamp > lastCheck) {
          
          await this.sendNewVideoNotification(channelId, channel);
        }
      }
      
      await chrome.storage.local.set({ lastCheck: now });
    } catch (error) {
      console.warn('YCN: Error checking for new videos:', error);
    }
  }

  async sendNewVideoNotification(channelId, channel) {
    try {
      const notificationId = `new_video_${channelId}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `New video from ${channel.name}`,
        message: channel.lastVideo.title,
        silent: false
      });
      
      console.log('YCN: Sent notification for channel:', channelId);
    } catch (error) {
      console.warn('YCN: Error sending notification:', error);
    }
  }
}

class PerformanceManager {
  constructor() {
    this.debounceTimers = {};
    this.cache = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  debouncedSave(key, data, delay = 1000) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }
    
    this.debounceTimers[key] = setTimeout(() => {
      chrome.storage.local.set({ [key]: data });
      delete this.debounceTimers[key];
    }, delay);
  }

  getCachedChannel(channelId) {
    if (!this.cache.has(channelId)) {
      return null;
    }
    return this.cache.get(channelId);
  }

  setCachedChannel(channelId, data) {
    this.cache.set(channelId, {
      ...data,
      cachedAt: Date.now()
    });
  }

  shouldCleanup() {
    return Date.now() - this.lastCleanup > this.cleanupInterval;
  }

  async autoCleanup(channels) {
    if (!this.shouldCleanup()) return channels;

    console.log('YCN: Starting automatic cleanup...');
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
    
    const cleanedChannels = {};
    let removedCount = 0;

    for (const [channelId, channel] of Object.entries(channels)) {
      const lastActivity = channel.lastVideo?.timestamp || channel.firstSeen || 0;
      
      if (lastActivity < ninetyDaysAgo && !channel.approved) {
        // Remove inactive channels that aren't approved
        removedCount++;
        continue;
      }

      // Keep channel but clean up old video data
      const cleanedChannel = { ...channel };
      if (channel.watchedVideos && channel.watchedVideos.length > 20) {
        const recentVideos = channel.watchedVideos.slice(-20);
        cleanedChannel.watchedVideos = recentVideos;
        
        // Clean up corresponding video data
        if (channel.watchedVideoData) {
          const cleanedVideoData = {};
          recentVideos.forEach(videoId => {
            if (channel.watchedVideoData[videoId]) {
              cleanedVideoData[videoId] = channel.watchedVideoData[videoId];
            }
          });
          cleanedChannel.watchedVideoData = cleanedVideoData;
        }
      }
      
      cleanedChannels[channelId] = cleanedChannel;
    }

    if (removedCount > 0) {
      console.log(`YCN: Cleaned up ${removedCount} inactive channels`);
    }

    this.lastCleanup = now;
    return cleanedChannels;
  }
}

class SmartBadgeManager {
  constructor(backgroundInstance) {
    this.background = backgroundInstance;
    this.lastBadgeUpdate = 0;
    this.badgeUpdateThrottle = 1000; // Update badge at most once per second
  }

  async updateSmartBadge() {
    const now = Date.now();
    if (now - this.lastBadgeUpdate < this.badgeUpdateThrottle) {
      return;
    }
    this.lastBadgeUpdate = now;

    try {
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      const channelList = Object.values(channels);
      const readyCount = channelList.filter(c => c.count >= 10 && !c.approved && !c.denied).length;
      const trackingCount = channelList.filter(c => c.count > 0 && c.count < 10).length;
      const approvedCount = channelList.filter(c => c.approved).length;
      
      let badgeText = '';
      let badgeColor = '#6c757d'; // Default gray
      
      if (readyCount > 0) {
        // Red pulse - channels ready for approval (highest priority)
        badgeText = readyCount.toString();
        badgeColor = '#FF0000';
      } else if (approvedCount > 0) {
        // Green - notifications active
        badgeText = approvedCount.toString();
        badgeColor = '#28a745';
      } else if (trackingCount > 0) {
        // Blue - actively tracking
        badgeText = trackingCount.toString();
        badgeColor = '#0084FF';
      }
      
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      
      console.log(`YCN: Badge updated - ${badgeText} (${badgeColor})`);
    } catch (error) {
      console.warn('YCN: Error updating smart badge:', error);
    }
  }

  async clearBadge() {
    try {
      await chrome.action.setBadgeText({ text: '' });
    } catch (error) {
      console.warn('YCN: Error clearing badge:', error);
    }
  }
}

new YCNBackground();