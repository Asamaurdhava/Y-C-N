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
      this.setupVideoChecking();
    });

    // Handle extension install/enable
    chrome.runtime.onInstalled.addListener(() => {
      console.log('YCN: Extension installed/enabled');
      this.updateActivity();
      this.setupVideoChecking();
    });

    // Handle alarms for periodic video checking
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'checkYouTubeVideos') {
        console.log('YCN: Alarm triggered - checking for new videos');
        this.checkAllChannelsForNewVideos();
      }
    });

    // Initial setup
    this.setupVideoChecking();

    console.log('YCN: Background service worker initialized');
  }

  async setupVideoChecking() {
    // Create alarm to check every 30 minutes
    chrome.alarms.create('checkYouTubeVideos', {
      periodInMinutes: 30,
      delayInMinutes: 1 // Start checking 1 minute after setup
    });
    console.log('YCN: Video checking alarm set up');
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
        
        case 'CHECK_NOW':
          console.log('YCN: Manual check triggered from popup');
          await this.checkAllChannelsForNewVideos();
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
        // Try to get stored notification info first
        const notificationInfo = await chrome.storage.local.get([`notification_${notificationId}`]);
        
        if (notificationInfo[`notification_${notificationId}`]) {
          const { videoId } = notificationInfo[`notification_${notificationId}`];
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          await chrome.tabs.create({ url: videoUrl });
          
          // Clean up stored notification info
          await chrome.storage.local.remove([`notification_${notificationId}`]);
        } else {
          // Fallback to old method for backward compatibility
          const channelId = notificationId.replace('new_video_', '').split('_')[0];
          const result = await chrome.storage.local.get(['channels']);
          const channels = result.channels || {};
          
          if (channels[channelId]) {
            if (channels[channelId].latestVideoId) {
              const videoUrl = `https://www.youtube.com/watch?v=${channels[channelId].latestVideoId}`;
              await chrome.tabs.create({ url: videoUrl });
            } else if (channels[channelId].lastVideo) {
              const videoUrl = `https://www.youtube.com/watch?v=${channels[channelId].lastVideo.id}`;
              await chrome.tabs.create({ url: videoUrl });
            }
          }
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

  async sendNewVideoNotification(channelId, channel, videoTitle, videoId) {
    try {
      const notificationId = `new_video_${channelId}_${videoId}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `New video from ${channel.name}`,
        message: videoTitle || channel.lastVideo?.title || 'New video available',
        silent: false,
        requireInteraction: false
      });
      
      console.log('YCN: Sent notification for channel:', channelId, 'Video:', videoTitle);
      
      // Store notification info for click handling
      await chrome.storage.local.set({
        [`notification_${notificationId}`]: {
          channelId,
          videoId,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn('YCN: Error sending notification:', error);
    }
  }

  decodeXmlEntities(str) {
    // Decode common XML/HTML entities
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  async getChannelIdFromHandle(handle) {
    try {
      // First check if we already resolved this handle
      const result = await chrome.storage.local.get(['handleCache']);
      const handleCache = result.handleCache || {};
      
      if (handleCache[handle]) {
        console.log(`YCN: Using cached channel ID for @${handle}: ${handleCache[handle]}`);
        return handleCache[handle];
      }
      
      // Fetch the channel page to extract the real channel ID
      const channelUrl = `https://www.youtube.com/@${handle}`;
      const response = await fetch(channelUrl);
      
      if (!response.ok) {
        console.warn(`YCN: Failed to fetch channel page for @${handle}:`, response.status);
        return null;
      }
      
      const html = await response.text();
      
      // Look for channel ID in various places
      // Method 1: Look in meta tags
      const metaMatch = html.match(/<meta itemprop="channelId" content="([^"]+)"/);
      if (metaMatch) {
        const channelId = metaMatch[1];
        console.log(`YCN: Found channel ID for @${handle}: ${channelId}`);
        
        // Cache the result
        handleCache[handle] = channelId;
        await chrome.storage.local.set({ handleCache });
        
        return channelId;
      }
      
      // Method 2: Look in browse endpoint
      const browseMatch = html.match(/"browseId":"(UC[a-zA-Z0-9_-]+)"/);
      if (browseMatch) {
        const channelId = browseMatch[1];
        console.log(`YCN: Found channel ID for @${handle}: ${channelId}`);
        
        // Cache the result
        handleCache[handle] = channelId;
        await chrome.storage.local.set({ handleCache });
        
        return channelId;
      }
      
      // Method 3: Look for canonical URL
      const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/);
      if (canonicalMatch) {
        const channelId = canonicalMatch[1];
        console.log(`YCN: Found channel ID for @${handle}: ${channelId}`);
        
        // Cache the result
        handleCache[handle] = channelId;
        await chrome.storage.local.set({ handleCache });
        
        return channelId;
      }
      
      console.warn(`YCN: Could not find channel ID for @${handle}`);
      return null;
      
    } catch (error) {
      console.warn(`YCN: Error resolving handle @${handle}:`, error);
      return null;
    }
  }

  async checkAllChannelsForNewVideos() {
    try {
      console.log('YCN: Starting RSS feed check for all approved channels');
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      
      for (const [channelId, channel] of Object.entries(channels)) {
        if (channel.approved) {
          console.log(`YCN: Checking channel ${channel.name} (${channelId}) for new videos`);
          await this.checkChannelForNewVideos(channelId, channel);
        }
      }
    } catch (error) {
      console.warn('YCN: Error in checkAllChannelsForNewVideos:', error);
    }
  }

  async checkChannelForNewVideos(channelId, channel) {
    try {
      // Validate input
      if (!channelId || !channel) {
        console.warn('YCN: Invalid parameters for checkChannelForNewVideos');
        return;
      }

      // Convert handle to real channel ID if needed
      let realChannelId = channelId;
      if (channelId.startsWith('handle_')) {
        // Check if we already have a resolved channel ID stored
        if (channel.resolvedChannelId) {
          realChannelId = channel.resolvedChannelId;
          console.log(`YCN: Using stored channel ID for ${channelId}: ${realChannelId}`);
        } else {
          try {
            realChannelId = await this.getChannelIdFromHandle(channelId.replace('handle_', ''));
            if (!realChannelId) {
              console.warn(`YCN: Could not resolve handle to channel ID for ${channelId}`);
              return;
            }
            
            // Update stored channel with real ID for future use
            const result = await chrome.storage.local.get(['channels']);
            const channels = result.channels || {};
            if (channels[channelId]) {
              channels[channelId].resolvedChannelId = realChannelId;
              await chrome.storage.local.set({ channels });
            }
          } catch (handleError) {
            console.warn(`YCN: Error resolving handle for ${channelId}:`, handleError);
            return;
          }
        }
      }
      
      // Validate channel ID format
      if (!realChannelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
        console.warn(`YCN: Invalid channel ID format: ${realChannelId}`);
        return;
      }
      
      // YouTube RSS feed URL format
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${realChannelId}`;
      
      // Fetch the RSS feed with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let response;
      try {
        response = await fetch(rssUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn(`YCN: RSS fetch timeout for channel ${channelId}`);
        } else {
          console.warn(`YCN: RSS fetch error for channel ${channelId}:`, fetchError);
        }
        return;
      }
      
      if (!response.ok) {
        console.warn(`YCN: Failed to fetch RSS for channel ${channelId} (${realChannelId}):`, response.status);
        
        // If 404, the channel might not exist or have no videos
        if (response.status === 404) {
          console.log(`YCN: Channel ${channelId} might not have public videos or RSS feed is disabled`);
        }
        return;
      }
      
      const text = await response.text();
      
      // Validate RSS response
      if (!text || text.length < 100) {
        console.warn(`YCN: Empty or invalid RSS response for channel ${channelId}`);
        return;
      }
      
      // Parse XML using regex since DOMParser is not available in service workers
      // Extract the first entry (latest video)
      const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
      if (!entryMatch) {
        console.log(`YCN: No videos found in RSS for channel ${channelId}`);
        return;
      }
      
      const entryContent = entryMatch[1];
      
      // Extract video information using regex with comprehensive fallbacks
      let videoId = null;
      
      // Try multiple patterns for video ID extraction
      const videoIdPatterns = [
        /<yt:videoId>([^<]+)<\/yt:videoId>/,
        /<id>yt:video:([^<]+)<\/id>/,
        /<id>[^:]+:([a-zA-Z0-9_-]{11})<\/id>/,
        /watch\?v=([a-zA-Z0-9_-]{11})/
      ];
      
      for (const pattern of videoIdPatterns) {
        const match = entryContent.match(pattern);
        if (match && match[1]) {
          videoId = match[1];
          break;
        }
      }
      
      if (!videoId) {
        console.warn(`YCN: Could not extract video ID for channel ${channelId}`);
        console.log(`YCN: Entry content sample: ${entryContent.substring(0, 500)}`);
        return;
      }
      
      // Validate video ID format
      if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
        console.warn(`YCN: Invalid video ID format: ${videoId}`);
        return;
      }
      
      // Extract title with CDATA handling
      let videoTitle = 'Unknown Title';
      const titlePatterns = [
        /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/,
        /<media:title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/media:title>/
      ];
      
      for (const pattern of titlePatterns) {
        const match = entryContent.match(pattern);
        if (match && match[1]) {
          videoTitle = this.decodeXmlEntities(match[1].trim());
          break;
        }
      }
      
      // Extract published date with fallbacks
      let publishedDate = new Date().toISOString();
      const datePatterns = [
        /<published>([^<]+)<\/published>/,
        /<updated>([^<]+)<\/updated>/,
        /<yt:published>([^<]+)<\/yt:published>/
      ];
      
      for (const pattern of datePatterns) {
        const match = entryContent.match(pattern);
        if (match && match[1]) {
          publishedDate = match[1];
          break;
        }
      }
      
      // Validate date
      const parsedDate = new Date(publishedDate);
      if (isNaN(parsedDate.getTime())) {
        console.warn(`YCN: Invalid date format: ${publishedDate}, using current time`);
        publishedDate = new Date().toISOString();
      }
      
      // Check if this is a new video
      const storedLatestVideoId = channel.latestVideoId;
      
      if (!storedLatestVideoId || storedLatestVideoId !== videoId) {
        console.log(`YCN: New video detected for ${channel.name}!`);
        console.log(`YCN: Video: ${videoTitle} (${videoId})`);
        
        // Update stored latest video
        const result = await chrome.storage.local.get(['channels']);
        const channels = result.channels || {};
        
        if (channels[channelId]) {
          channels[channelId].latestVideoId = videoId;
          channels[channelId].latestVideoTitle = videoTitle;
          channels[channelId].latestVideoDate = publishedDate;
          channels[channelId].lastRSSCheck = Date.now();
          
          await chrome.storage.local.set({ channels });
          
          // Only send notification for truly new videos
          try {
            const videoPublishTime = new Date(publishedDate).getTime();
            const approvalTime = channels[channelId].approvedAt || 0;
            const now = Date.now();
            
            // Determine if we should send a notification
            let shouldNotify = false;
            let notificationReason = '';
            
            if (storedLatestVideoId && storedLatestVideoId !== videoId) {
              // We have a different video than before - this is definitely new
              shouldNotify = true;
              notificationReason = 'New video detected (different from stored)';
            } else if (!storedLatestVideoId) {
              // First check - NEVER notify unless video is EXTREMELY recent
              // This prevents notifications for videos that existed before we started monitoring
              const fiveMinutesAgo = now - 300000; // 5 minutes
              
              if (videoPublishTime > fiveMinutesAgo) {
                // Video published within last 5 minutes - this is genuinely brand new
                shouldNotify = true;
                notificationReason = 'Brand new video (< 5 minutes old)';
              } else {
                // Video is older than 5 minutes - it existed before we checked
                // Store it silently for future comparison
                notificationReason = `First check, video too old (${Math.round((now - videoPublishTime) / 60000)} minutes old)`;
              }
            } else {
              // Same video as before, no notification needed
              notificationReason = 'Same video as last check';
            }
            
            if (shouldNotify) {
              console.log(`YCN: Sending notification for ${channel.name}: ${notificationReason}`);
              console.log(`YCN: Video: "${videoTitle}" (${videoId})`);
              await this.sendNewVideoNotification(channelId, channel, videoTitle, videoId);
            } else {
              console.log(`YCN: Not sending notification for ${channel.name}: ${notificationReason}`);
              console.log(`YCN: Video: "${videoTitle}" published ${new Date(publishedDate).toLocaleString()}`);
              if (approvalTime) {
                console.log(`YCN: Channel approved: ${new Date(approvalTime).toLocaleString()}`);
              }
            }
          } catch (notifyError) {
            console.warn(`YCN: Error in notification logic for ${channelId}:`, notifyError);
          }
        }
      } else {
        console.log(`YCN: No new videos for ${channel.name} (latest: ${videoTitle})`);
      }
      
    } catch (error) {
      console.warn(`YCN: Error checking RSS for channel ${channelId}:`, error);
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