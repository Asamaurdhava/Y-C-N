(() => {
  'use strict';

  // ============================================================================
  // Storage Manager - Optimized batch storage operations
  // ============================================================================
  class StorageManager {
    constructor() {
      this.pendingWrites = new Map();
      this.writeDebounceTime = 1000;
      this.writeTimeout = null;
      this.cache = new Map();
      this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    }

    async get(keys) {
      // Check cache first
      if (typeof keys === 'string') {
        const cached = this.cache.get(keys);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
          return { [keys]: cached.value };
        }
      }

      const result = await chrome.storage.local.get(keys);
      
      // Update cache
      if (typeof keys === 'string' && result[keys]) {
        this.cache.set(keys, { value: result[keys], timestamp: Date.now() });
      }

      return result;
    }

    async set(key, value) {
      // Update cache immediately
      this.cache.set(key, { value, timestamp: Date.now() });
      
      // Queue for batch write
      this.pendingWrites.set(key, value);
      this.scheduleWrite();
    }

    scheduleWrite() {
      if (this.writeTimeout) clearTimeout(this.writeTimeout);
      
      this.writeTimeout = setTimeout(async () => {
        if (this.pendingWrites.size > 0) {
          try {
            const writes = Object.fromEntries(this.pendingWrites);
            await chrome.storage.local.set(writes);
            this.pendingWrites.clear();
          } catch (error) {
            console.warn('YCN: Storage write failed:', error);
          }
        }
      }, this.writeDebounceTime);
    }

    clearCache() {
      this.cache.clear();
    }

    async flush() {
      if (this.writeTimeout) {
        clearTimeout(this.writeTimeout);
        this.writeTimeout = null;
      }
      if (this.pendingWrites.size > 0) {
        const writes = Object.fromEntries(this.pendingWrites);
        await chrome.storage.local.set(writes);
        this.pendingWrites.clear();
      }
    }
  }

  // ============================================================================
  // Channel ID Cache - Reduces DOM queries
  // ============================================================================
  class ChannelIdCache {
    constructor() {
      this.cache = new Map();
      this.maxAge = 5 * 60 * 1000; // 5 minutes
      this.maxSize = 50;
    }

    get(videoId) {
      const entry = this.cache.get(videoId);
      if (entry && Date.now() - entry.timestamp < this.maxAge) {
        return entry.channelId;
      }
      this.cache.delete(videoId);
      return null;
    }

    set(videoId, channelId) {
      // Limit cache size
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(videoId, { 
        channelId, 
        timestamp: Date.now() 
      });
    }

    clear() {
      this.cache.clear();
    }
  }

  // ============================================================================
  // Session Intelligence - Enhanced with better memory management
  // ============================================================================
  class SessionIntelligence {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.session = {
        startTime: Date.now(),
        videosWatched: [],
        channelsVisited: new Set(),
        totalWatchTime: 0,
        patterns: {
          hourlyActivity: new Array(24).fill(0),
          dailyActivity: new Array(7).fill(0)
        }
      };
      
      this.persistenceKey = 'ycn_session_data';
      this.maxVideosToStore = 100; // Limit memory usage
      this.loadSessionData();
    }

    async loadSessionData() {
      try {
        const result = await this.storageManager.get(this.persistenceKey);
        if (result[this.persistenceKey]) {
          const savedData = result[this.persistenceKey];
          // Merge with current session if within 30 minutes
          if (Date.now() - savedData.lastSave < 30 * 60 * 1000) {
            this.session.patterns = { ...this.session.patterns, ...savedData.patterns };
            this.session.totalWatchTime += savedData.totalWatchTime || 0;
          }
        }
      } catch (error) {
        console.warn('YCN: Error loading session data:', error);
      }
    }

    trackVideo(videoId, channelId, watchPercentage, watchDuration) {
      const now = Date.now();
      const hour = new Date(now).getHours();
      const day = new Date(now).getDay();
      
      // Limit stored videos to prevent memory issues
      if (this.session.videosWatched.length >= this.maxVideosToStore) {
        this.session.videosWatched.shift(); // Remove oldest
      }
      
      this.session.videosWatched.push({
        videoId,
        channelId,
        watchPercentage,
        watchDuration,
        timestamp: now,
        hour,
        day
      });
      
      this.session.channelsVisited.add(channelId);
      this.session.totalWatchTime += watchDuration;
      
      // Update patterns
      this.session.patterns.hourlyActivity[hour]++;
      this.session.patterns.dailyActivity[day]++;
      
      // Save session data
      this.saveSessionData();
    }

    async saveSessionData() {
      try {
        const dataToSave = {
          patterns: this.session.patterns,
          totalWatchTime: this.session.totalWatchTime,
          lastSave: Date.now(),
          videoCount: this.session.videosWatched.length,
          channelCount: this.session.channelsVisited.size
        };
        
        await this.storageManager.set(this.persistenceKey, dataToSave);
      } catch (error) {
        console.warn('YCN: Error saving session data:', error);
      }
    }

    getSessionSummary() {
      const duration = Date.now() - this.session.startTime;
      const avgWatchPercentage = this.session.videosWatched.length > 0 
        ? this.session.videosWatched.reduce((sum, v) => sum + v.watchPercentage, 0) / this.session.videosWatched.length
        : 0;

      return {
        duration,
        videoCount: this.session.videosWatched.length,
        channelCount: this.session.channelsVisited.size,
        avgWatchPercentage: Math.round(avgWatchPercentage * 100),
        totalWatchTime: this.session.totalWatchTime,
        patterns: this.session.patterns
      };
    }

    getPeakWatchingHours() {
      const hourlyActivity = this.session.patterns.hourlyActivity;
      const maxActivity = Math.max(...hourlyActivity);
      
      return hourlyActivity
        .map((count, hour) => ({ hour, count }))
        .filter(item => item.count >= maxActivity * 0.8)
        .map(item => item.hour);
    }

    getMostActiveDay() {
      const dailyActivity = this.session.patterns.dailyActivity;
      const maxIndex = dailyActivity.indexOf(Math.max(...dailyActivity));
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[maxIndex];
    }

    getWatchingTypeProfile() {
      const summary = this.getSessionSummary();
      const avgSession = summary.duration / (summary.videoCount || 1);
      
      if (summary.avgWatchPercentage > 80 && avgSession > 10 * 60 * 1000) {
        return 'deep_viewer';
      } else if (summary.videoCount > 20 && avgSession < 5 * 60 * 1000) {
        return 'browser';
      } else if (summary.channelCount < 5 && summary.videoCount > 10) {
        return 'loyal_viewer';
      } else {
        return 'casual_viewer';
      }
    }

    cleanup() {
      // Clear large data structures
      this.session.videosWatched = [];
      this.session.channelsVisited.clear();
    }
  }

  // ============================================================================
  // Message Handler - Centralized message management with retry logic
  // ============================================================================
  class MessageHandler {
    constructor() {
      this.maxRetries = 3;
      this.retryDelay = 2000;
      this.contextValid = true;
    }

    async validateContext() {
      try {
        // Quick validation check
        return !!(chrome?.runtime?.id);
      } catch {
        this.contextValid = false;
        return false;
      }
    }

    async sendMessage(message, retries = this.maxRetries) {
      // Quick context check
      if (!this.contextValid || !(await this.validateContext())) {
        console.log('YCN: Extension context not available');
        return null;
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`YCN: Sending message (attempt ${attempt}/${retries}):`, message.type);
          
          // Try to wake up service worker on retry
          if (attempt > 1) {
            await this.wakeUpServiceWorker();
          }
          
          const response = await chrome.runtime.sendMessage(message);
          
          if (response) {
            console.log('YCN: Message sent successfully');
            return response;
          } else {
            throw new Error('No response from background script');
          }
        } catch (error) {
          // Check for context invalidation
          if (this.isContextInvalidated(error)) {
            console.log('YCN: Extension context invalidated, stopping gracefully');
            this.contextValid = false;
            return null;
          }
          
          console.warn(`YCN: Message attempt ${attempt} failed:`, error.message);
          
          // Wait before retry with exponential backoff
          if (attempt < retries) {
            const delay = Math.min(this.retryDelay * Math.pow(2, attempt - 1), 8000);
            console.log(`YCN: Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return null;
    }

    async wakeUpServiceWorker() {
      try {
        await chrome.runtime.sendMessage({ type: 'PING' });
      } catch (error) {
        // Expected to fail, just waking up the worker
      }
    }

    isContextInvalidated(error) {
      const invalidationMessages = [
        'Extension context invalidated',
        'Could not establish connection',
        'Cannot read properties of undefined',
        'The message port closed',
        'Receiving end does not exist'
      ];
      
      return error.message && invalidationMessages.some(msg => 
        error.message.includes(msg)
      );
    }
  }

  // ============================================================================
  // YouTube Tracker - Main tracking class with improved architecture
  // ============================================================================
  class YouTubeTracker {
    constructor() {
      // Core components
      this.storageManager = new StorageManager();
      this.channelIdCache = new ChannelIdCache();
      this.sessionIntelligence = new SessionIntelligence(this.storageManager);
      this.messageHandler = new MessageHandler();
      
      // Tracking state
      this.currentVideoId = null;
      this.currentChannelId = null;
      this.startTime = null;
      this.lastProgress = 0;
      this.watchThreshold = 0.6;
      this.minWatchTime = 30;
      
      // Intervals
      this.progressCheckInterval = null;
      this.urlCheckInterval = null;
      
      // User presence
      this.isTabActive = true;
      this.isUserPresent = true;
      this.idleTimeout = null;
      this.idleThreshold = 60000; // 1 minute
      this.lastActivity = Date.now();
      
      // Skip detection
      this.lastVideoTime = 0;
      this.actualWatchedTime = 0;
      this.continuousSegments = [];
      this.currentSegmentStart = 0;
      this.totalSkips = 0;
      this.majorSkipsDetected = false;
      this.lastCheckTime = Date.now();
      
      // Event handlers (bound for proper cleanup)
      this.boundHandlers = {
        userActivity: this.handleUserActivity.bind(this),
        visibilityChange: this.handleVisibilityChange.bind(this),
        videoPlay: this.handleVideoPlay.bind(this),
        videoPause: this.handleVideoPause.bind(this),
        videoEnded: this.handleVideoEnded.bind(this),
        videoSeeking: this.handleUserActivity.bind(this),
        beforeUnload: this.handleBeforeUnload.bind(this)
      };
      
      // Video element handlers
      this.videoEventHandlers = null;
      
      // Initialize
      this.init();
    }

    init() {
      this.setupPresenceDetection();
      this.detectPageChange();
      this.startUrlMonitoring();
      console.log('YCN: Tracker initialized');
    }

    // ========== Presence Detection ==========
    setupPresenceDetection() {
      // Tab visibility
      document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);
      
      // User activity events
      const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        document.addEventListener(event, this.boundHandlers.userActivity, { passive: true });
      });
      
      // Video events
      document.addEventListener('play', this.boundHandlers.videoPlay, true);
      document.addEventListener('pause', this.boundHandlers.videoPause, true);
      document.addEventListener('ended', this.boundHandlers.videoEnded, true);
      document.addEventListener('seeking', this.boundHandlers.videoSeeking, true);
      
      // Cleanup on page unload
      window.addEventListener('beforeunload', this.boundHandlers.beforeUnload);
      
      // Start idle detection
      this.startIdleDetection();
    }

    handleVisibilityChange() {
      this.isTabActive = !document.hidden;
      console.log('YCN: Tab active:', this.isTabActive);
      
      if (!this.isTabActive) {
        console.log('YCN: Tab hidden but continuing to track (user may be listening)');
      }
    }

    handleUserActivity() {
      this.lastActivity = Date.now();
      
      if (!this.isUserPresent) {
        this.isUserPresent = true;
        console.log('YCN: User activity detected');
        this.resumeTracking();
      }
      
      // Reset idle timer
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
      }
      
      this.idleTimeout = setTimeout(() => {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          console.log('YCN: User inactive but video playing - continuing tracking');
          // Extended timer for video playback
          this.idleTimeout = setTimeout(() => {
            this.isUserPresent = false;
            console.log('YCN: User idle for extended period');
            this.pauseTracking();
          }, this.idleThreshold * 10);
        } else {
          this.isUserPresent = false;
          console.log('YCN: User idle and video not playing');
          this.pauseTracking();
        }
      }, this.idleThreshold * 5);
    }

    startIdleDetection() {
      this.handleUserActivity();
    }

    pauseTracking() {
      if (this.progressCheckInterval && !this.isUserPresent) {
        console.log('YCN: Pausing tracking - user idle');
        clearInterval(this.progressCheckInterval);
        this.progressCheckInterval = null;
      }
    }

    resumeTracking() {
      if (this.isUserPresent && this.currentVideoId && !this.progressCheckInterval) {
        console.log('YCN: Resuming tracking - user returned');
        
        const video = document.querySelector('video');
        if (video) {
          this.lastVideoTime = video.currentTime;
          this.lastCheckTime = Date.now();
        }
        
        this.progressCheckInterval = setInterval(() => {
          this.checkProgress();
        }, 2000);
      }
    }

    // ========== Video Event Handlers ==========
    handleVideoPlay() {
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video resumed playing');
        this.updateCurrentVideo();
      }
    }

    handleVideoPause() {
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video paused - clearing display');
        this.sendClearCurrentVideo();
      }
    }

    handleVideoEnded() {
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video ended - clearing display and stopping tracking');
        this.sendClearCurrentVideo();
        this.stopTracking(false);
      }
    }

    handleBeforeUnload() {
      this.cleanup();
    }

    // ========== URL Monitoring ==========
    startUrlMonitoring() {
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
      }
      
      let lastUrl = location.href;
      this.urlCheckInterval = setInterval(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          this.detectPageChange();
        }
      }, 1000);
    }

    detectPageChange() {
      try {
        if (this.isVideoPage()) {
          setTimeout(() => this.initVideoTracking(), 2000);
        } else {
          if (this.currentChannelId) {
            console.log('YCN: Left video page - clearing display');
            this.sendClearCurrentVideo();
          }
          this.stopTracking(false);
        }
      } catch (error) {
        console.warn('YCN: Error detecting page change:', error);
      }
    }

    isVideoPage() {
      return location.pathname === '/watch' && location.search.includes('v=');
    }

    // ========== Video Tracking ==========
    async initVideoTracking() {
      try {
        const videoId = this.extractVideoId();
        if (!videoId) {
          setTimeout(() => this.initVideoTracking(), 1000);
          return;
        }

        // Check cache first
        let channelId = this.channelIdCache.get(videoId);
        
        if (!channelId) {
          channelId = this.extractChannelId();
          if (!channelId) {
            setTimeout(() => this.initVideoTracking(), 1000);
            return;
          }
          // Cache the channel ID
          this.channelIdCache.set(videoId, channelId);
        }

        if (videoId !== this.currentVideoId) {
          this.stopTracking();
          await this.startTracking(videoId, channelId);
        }
      } catch (error) {
        console.warn('YCN: Error initializing video tracking:', error);
      }
    }

    extractVideoId() {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      
      // Validate video ID format for security
      if (videoId && this.isValidVideoId(videoId)) {
        return videoId;
      }
      
      console.warn('YCN: Invalid video ID format detected:', videoId);
      return null;
    }
    
    isValidVideoId(videoId) {
      // YouTube video IDs are exactly 11 characters, alphanumeric with - and _
      return typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    }
    
    isValidChannelId(channelId) {
      if (!channelId || typeof channelId !== 'string') return false;
      
      // Regular channel IDs start with UC and are 24 characters total
      if (channelId.startsWith('UC')) {
        return /^UC[a-zA-Z0-9_-]{22}$/.test(channelId);
      }
      
      // Handle-based channel IDs (stored as handle_username)
      if (channelId.startsWith('handle_')) {
        const handle = channelId.substring(7);
        // YouTube handles: 3-30 chars, alphanumeric, dots, underscores, hyphens
        return /^[a-zA-Z0-9._-]{3,30}$/.test(handle);
      }
      
      return false;
    }

    extractChannelId() {
      try {
        // Method 1: Meta tag (most reliable)
        const metaChannelId = document.querySelector('meta[itemprop="channelId"]');
        if (metaChannelId?.content && this.isValidChannelId(metaChannelId.content)) {
          console.log('YCN: Found channel ID via meta tag:', metaChannelId.content);
          return metaChannelId.content;
        }
        
        // Method 2: Channel links
        const channelLinkSelectors = [
          'ytd-video-owner-renderer #channel-name a[href*="/channel/"]',
          'ytd-video-owner-renderer #channel-name a[href*="/@"]',
          'ytd-video-owner-renderer a[href*="/channel/"]',
          'ytd-video-owner-renderer a[href*="/@"]',
          '.ytd-channel-name a[href*="/channel/"]',
          '.ytd-channel-name a[href*="/@"]'
        ];

        for (const selector of channelLinkSelectors) {
          const channelLink = document.querySelector(selector);
          if (channelLink?.href) {
            const href = channelLink.href;
            
            const channelMatch = href.match(/\/channel\/([a-zA-Z0-9_-]+)/);
            if (channelMatch && this.isValidChannelId(channelMatch[1])) {
              console.log('YCN: Found channel ID via link:', channelMatch[1]);
              return channelMatch[1];
            }
            
            const handleMatch = href.match(/\/@([a-zA-Z0-9_.-]+)/);
            if (handleMatch) {
              const handleId = 'handle_' + handleMatch[1];
              if (this.isValidChannelId(handleId)) {
                console.log('YCN: Found channel handle:', handleId);
                return handleId;
              }
            }
          }
        }
        
        // Method 3: Script data
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent?.includes('"channelId"')) {
            const channelMatch = script.textContent.match(/"channelId":"([a-zA-Z0-9_-]+)"/);
            if (channelMatch && this.isValidChannelId(channelMatch[1])) {
              console.log('YCN: Found channel ID in script:', channelMatch[1]);
              return channelMatch[1];
            }
          }
        }

        console.warn('YCN: Could not extract channel ID');
        return null;
      } catch (error) {
        console.warn('YCN: Error extracting channel ID:', error);
        return null;
      }
    }

    async startTracking(videoId, channelId) {
      this.currentVideoId = videoId;
      this.currentChannelId = channelId;
      this.startTime = Date.now();
      this.lastProgress = 0;
      
      // Reset skip detection
      this.lastVideoTime = 0;
      this.actualWatchedTime = 0;
      this.continuousSegments = [];
      this.currentSegmentStart = 0;
      this.totalSkips = 0;
      this.majorSkipsDetected = false;
      this.lastCheckTime = Date.now();
      
      const video = document.querySelector('video');
      if (video) {
        this.lastVideoTime = video.currentTime;
        this.setupVideoEventListeners(video);
      }

      // Check if already watched
      let alreadyWatched = false;
      try {
        const result = await this.storageManager.get('channels');
        const channels = result.channels || {};
        
        if (channels[channelId]?.watchedVideos?.includes(videoId)) {
          console.log('YCN: Video already watched, not tracking progress again');
          alreadyWatched = true;
        }
      } catch (error) {
        console.warn('YCN: Error checking watched videos:', error);
      }

      console.log('YCN: Started tracking video:', videoId, 'from channel:', channelId);

      // Update current video display
      await this.updateCurrentVideo();

      // Start progress checking if not already watched
      if (!alreadyWatched) {
        if (this.progressCheckInterval) {
          clearInterval(this.progressCheckInterval);
        }
        this.progressCheckInterval = setInterval(() => {
          this.checkProgress();
        }, 2000);
        console.log('YCN: Started progress tracking');
      }
    }

    stopTracking(sendClearMessage = false) {
      if (this.progressCheckInterval) {
        clearInterval(this.progressCheckInterval);
        this.progressCheckInterval = null;
      }
      
      if (sendClearMessage && this.currentChannelId) {
        this.sendClearCurrentVideo();
      }
      
      // Clean up video event listeners
      const video = document.querySelector('video');
      if (video && this.videoEventHandlers) {
        video.removeEventListener('seeked', this.videoEventHandlers.seeked);
        video.removeEventListener('play', this.videoEventHandlers.play);
        video.removeEventListener('pause', this.videoEventHandlers.pause);
        this.videoEventHandlers = null;
      }
      
      this.currentVideoId = null;
      this.currentChannelId = null;
      this.startTime = null;
      this.lastProgress = 0;
    }

    setupVideoEventListeners(video) {
      // Remove existing listeners
      if (this.videoEventHandlers) {
        video.removeEventListener('seeked', this.videoEventHandlers.seeked);
        video.removeEventListener('play', this.videoEventHandlers.play);
        video.removeEventListener('pause', this.videoEventHandlers.pause);
      }
      
      // Create new handlers
      this.videoEventHandlers = {
        seeked: () => {
          const seekDistance = Math.abs(video.currentTime - this.lastVideoTime);
          if (seekDistance > 2) {
            console.log(`YCN: Manual seek detected - ${seekDistance.toFixed(1)}s jump`);
            
            if (this.currentSegmentStart < this.lastVideoTime) {
              this.continuousSegments.push({
                start: this.currentSegmentStart,
                end: this.lastVideoTime,
                duration: this.lastVideoTime - this.currentSegmentStart
              });
            }
            
            const seekPercentage = seekDistance / video.duration;
            if (seekDistance > 120 || seekPercentage > 0.25) {
              this.majorSkipsDetected = true;
            } else if (seekDistance > 30) {
              this.totalSkips++;
            }
            
            this.currentSegmentStart = video.currentTime;
          }
          this.lastVideoTime = video.currentTime;
        },
        play: () => {
          this.lastCheckTime = Date.now();
          this.lastVideoTime = video.currentTime;
          console.log('YCN: Video playing');
        },
        pause: () => {
          console.log('YCN: Video paused');
        }
      };
      
      // Add listeners
      video.addEventListener('seeked', this.videoEventHandlers.seeked);
      video.addEventListener('play', this.videoEventHandlers.play);
      video.addEventListener('pause', this.videoEventHandlers.pause);
    }

    // ========== Progress Checking ==========
    checkProgress() {
      try {
        const video = document.querySelector('video');
        if (!video || video.duration === 0) return;

        const currentVideoTime = video.currentTime;
        const currentProgress = currentVideoTime / video.duration;
        const now = Date.now();
        const timeSinceLastCheck = (now - this.lastCheckTime) / 1000;
        
        // Skip detection
        const videoTimeAdvanced = currentVideoTime - this.lastVideoTime;
        const skipThreshold = timeSinceLastCheck + 0.5;
        
        if (videoTimeAdvanced > skipThreshold && videoTimeAdvanced > 2) {
          // Skip detected
          const skipDuration = videoTimeAdvanced;
          const skipPercentage = skipDuration / video.duration;
          
          if (this.currentSegmentStart < currentVideoTime - skipDuration) {
            this.continuousSegments.push({
              start: this.currentSegmentStart,
              end: currentVideoTime - skipDuration,
              duration: (currentVideoTime - skipDuration) - this.currentSegmentStart
            });
          }
          
          if (skipDuration > 120 || skipPercentage > 0.25) {
            this.majorSkipsDetected = true;
            console.log(`YCN: Major skip detected! ${skipDuration.toFixed(1)}s`);
          } else if (skipDuration > 30) {
            this.totalSkips++;
            console.log(`YCN: Minor skip detected! ${skipDuration.toFixed(1)}s`);
          }
          
          this.currentSegmentStart = currentVideoTime;
          
        } else if (videoTimeAdvanced < -1) {
          // Rewind detected
          console.log('YCN: Rewind detected');
          if (this.currentSegmentStart < currentVideoTime + 1) {
            this.continuousSegments.push({
              start: this.currentSegmentStart,
              end: currentVideoTime + 1,
              duration: (currentVideoTime + 1) - this.currentSegmentStart
            });
          }
          this.currentSegmentStart = currentVideoTime;
          
        } else if (!video.paused) {
          // Normal playback
          const timeWatched = Math.min(videoTimeAdvanced, timeSinceLastCheck);
          this.actualWatchedTime += timeWatched;
        }
        
        // Calculate engagement
        const engagementScore = this.calculateEngagementScore(video.duration, currentProgress);
        
        // Log status periodically
        if (this.actualWatchedTime > 0 && Math.floor(this.actualWatchedTime) % 15 === 0) {
          console.log(`YCN: Engagement: ${engagementScore.toFixed(1)}%, ` +
                     `Watched: ${this.actualWatchedTime.toFixed(1)}s`);
        }
        
        // Check threshold
        if (engagementScore >= (this.watchThreshold * 100) && 
            this.actualWatchedTime >= this.minWatchTime && 
            !this.majorSkipsDetected &&
            this.totalSkips <= 3) {
          
          console.log(`YCN: Threshold met! Score: ${engagementScore.toFixed(1)}%`);
          this.recordVideoWatch();
          
          if (this.progressCheckInterval) {
            clearInterval(this.progressCheckInterval);
            this.progressCheckInterval = null;
          }
        }
        
        // Update state
        this.lastVideoTime = currentVideoTime;
        this.lastCheckTime = now;
        this.lastProgress = currentProgress;
        
      } catch (error) {
        console.warn('YCN: Error checking progress:', error);
      }
    }

    calculateEngagementScore(videoDuration, currentProgress) {
      const tempSegments = [...this.continuousSegments];
      if (this.currentSegmentStart < this.lastVideoTime) {
        tempSegments.push({
          start: this.currentSegmentStart,
          end: this.lastVideoTime,
          duration: this.lastVideoTime - this.currentSegmentStart
        });
      }
      
      const totalContinuousTime = tempSegments.reduce((total, segment) => {
        return total + Math.max(0, segment.duration);
      }, 0);
      
      const engagementScore = (totalContinuousTime / videoDuration) * 100;
      return Math.min(engagementScore, currentProgress * 100);
    }

    // ========== Communication ==========
    async updateCurrentVideo() {
      try {
        const channelInfo = await this.getChannelInfo();
        const videoTitle = document.title.replace(' - YouTube', '');
        
        const response = await this.messageHandler.sendMessage({
          type: 'UPDATE_CURRENT_VIDEO',
          channelId: this.currentChannelId,
          videoId: this.currentVideoId,
          channelInfo: channelInfo,
          videoTitle: videoTitle
        });
        
        if (response) {
          console.log('YCN: Updated current video display');
        }
      } catch (error) {
        console.warn('YCN: Error updating current video:', error);
      }
    }

    async sendClearCurrentVideo() {
      if (this.currentChannelId) {
        try {
          await this.messageHandler.sendMessage({
            type: 'CLEAR_CURRENT_VIDEO',
            channelId: this.currentChannelId
          });
        } catch (error) {
          console.warn('YCN: Error clearing current video:', error);
        }
      }
    }

    async recordVideoWatch() {
      try {
        // Verify we're still on the same video
        const currentVideoId = this.extractVideoId();
        const currentChannelId = this.extractChannelId();
        
        if (currentVideoId !== this.currentVideoId || 
            currentChannelId !== this.currentChannelId) {
          console.warn('YCN: Video/channel changed during tracking');
          return;
        }
        
        // Check if already watched
        const result = await this.storageManager.get('channels');
        const channels = result.channels || {};
        
        if (channels[currentChannelId]?.watchedVideos?.includes(currentVideoId)) {
          console.log('YCN: Video already watched');
          return;
        }
        
        const channelInfo = await this.getChannelInfo();
        const videoTitle = document.title.replace(' - YouTube', '');
        
        const response = await this.messageHandler.sendMessage({
          type: 'RECORD_VIDEO_WATCH',
          channelId: currentChannelId,
          videoId: currentVideoId,
          channelInfo: channelInfo,
          videoTitle: videoTitle
        });

        if (response?.success) {
          console.log('YCN: Recorded watch for:', channelInfo.name, 'Count:', response.count);

          // Track in session intelligence
          const watchDuration = Date.now() - this.startTime;
          const watchPercentage = this.lastProgress;
          this.sessionIntelligence.trackVideo(
            currentVideoId, 
            currentChannelId, 
            watchPercentage, 
            watchDuration
          );

          // Check notification permission
          if (response.count >= 10 && !response.approved && !response.askedPermission) {
            await this.requestNotificationPermission();
          }
        }

      } catch (error) {
        console.warn('YCN: Error recording video watch:', error);
      }
    }

    async getChannelInfo() {
      try {
        const channelNameSelectors = [
          'ytd-video-owner-renderer .ytd-channel-name a',
          '.ytd-channel-name a',
          '#channel-name a',
          '#owner-text a'
        ];

        for (const selector of channelNameSelectors) {
          const nameElement = document.querySelector(selector);
          if (nameElement?.textContent?.trim()) {
            return { name: nameElement.textContent.trim() };
          }
        }

        return { name: 'Unknown Channel' };
      } catch (error) {
        console.warn('YCN: Error getting channel info:', error);
        return { name: 'Unknown Channel' };
      }
    }

    async requestNotificationPermission() {
      try {
        const result = await this.storageManager.get('channels');
        const channels = result.channels || {};
        
        if (!channels[this.currentChannelId]) {
          console.warn('YCN: Channel not found for permission request');
          return;
        }
        
        channels[this.currentChannelId].askedPermission = true;
        await this.storageManager.set('channels', channels);

        await this.messageHandler.sendMessage({
          type: 'REQUEST_PERMISSION',
          channelId: this.currentChannelId,
          channelName: channels[this.currentChannelId].name
        });
      } catch (error) {
        console.warn('YCN: Error requesting permission:', error);
      }
    }

    // ========== Cleanup ==========
    async cleanup() {
      console.log('YCN: Cleaning up tracker');
      
      // Stop tracking
      this.stopTracking(true);
      
      // Clear intervals
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', this.boundHandlers.visibilityChange);
      document.removeEventListener('play', this.boundHandlers.videoPlay, true);
      document.removeEventListener('pause', this.boundHandlers.videoPause, true);
      document.removeEventListener('ended', this.boundHandlers.videoEnded, true);
      document.removeEventListener('seeking', this.boundHandlers.videoSeeking, true);
      
      const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        document.removeEventListener(event, this.boundHandlers.userActivity);
      });
      
      window.removeEventListener('beforeunload', this.boundHandlers.beforeUnload);
      
      // Flush storage
      await this.storageManager.flush();
      
      // Clear caches
      this.channelIdCache.clear();
      this.storageManager.clearCache();
      
      // Clean up session intelligence
      this.sessionIntelligence.cleanup();
      
      console.log('YCN: Tracker cleaned up');
    }

    destroy() {
      this.cleanup();
      console.log('YCN: Tracker destroyed');
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================
  function initializeTracker() {
    try {
      // Check if extension context is available
      if (chrome?.runtime?.id) {
        console.log('YCN: Initializing YouTube Channel Notifier');
        
        // Clean up any existing tracker
        if (window.youtubeTracker) {
          window.youtubeTracker.destroy();
        }
        
        // Create new tracker instance
        window.youtubeTracker = new YouTubeTracker();
        
        // Mark initialization complete
        window.ycnInitialized = true;
        
      } else {
        // Retry a few times then give up
        if (!window.ycnRetryCount) window.ycnRetryCount = 0;
        window.ycnRetryCount++;
        
        if (window.ycnRetryCount < 3) {
          console.log('YCN: Waiting for extension context...');
          setTimeout(initializeTracker, 2000);
        } else {
          console.log('YCN: Could not initialize after 3 attempts');
        }
      }
    } catch (error) {
      // Don't retry on context invalidation
      if (error.message?.includes('Extension context invalidated')) {
        console.log('YCN: Extension not available');
        return;
      }
      
      // Retry once for other errors
      if (!window.ycnErrorRetry) {
        window.ycnErrorRetry = true;
        setTimeout(initializeTracker, 2000);
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracker);
  } else {
    initializeTracker();
  }

  // Handle extension updates/reloads
  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        console.log('YCN: Extension disconnected, cleaning up');
        if (window.youtubeTracker) {
          window.youtubeTracker.destroy();
        }
      }
    });
  });

})();