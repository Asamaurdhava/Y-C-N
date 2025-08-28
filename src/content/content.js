(() => {
  'use strict';

  class SessionIntelligence {
    constructor() {
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
      
      this.persistanceKey = 'ycn_session_data';
      this.loadSessionData();
    }

    async loadSessionData() {
      try {
        const result = await chrome.storage.local.get([this.persistanceKey]);
        if (result[this.persistanceKey]) {
          const savedData = result[this.persistanceKey];
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
      
      // Debounced save
      this.debouncedSave();
    }

    debouncedSave() {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this.saveSessionData();
      }, 5000);
    }

    async saveSessionData() {
      try {
        const dataToSave = {
          patterns: this.session.patterns,
          totalWatchTime: this.session.totalWatchTime,
          lastSave: Date.now()
        };
        
        await chrome.storage.local.set({
          [this.persistanceKey]: dataToSave
        });
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
        return 'deep_viewer'; // Watches videos completely
      } else if (summary.videoCount > 20 && avgSession < 5 * 60 * 1000) {
        return 'browser'; // Browses lots of videos quickly
      } else if (summary.channelCount < 5 && summary.videoCount > 10) {
        return 'loyal_viewer'; // Watches from few channels extensively
      } else {
        return 'casual_viewer'; // Mixed behavior
      }
    }
  }

  class YouTubeTracker {
    constructor() {
      this.currentVideoId = null;
      this.currentChannelId = null;
      this.startTime = null;
      this.lastProgress = 0;
      this.watchThreshold = 0.5;
      this.minWatchTime = 30;
      this.progressCheckInterval = null;
      this.urlCheckInterval = null;
      this.contextCheckInterval = null;
      this.isTabActive = true;
      this.isUserPresent = true;
      this.idleTimeout = null;
      this.idleThreshold = 60000; // 1 minute of inactivity
      this.lastActivity = Date.now();
      this.recordingRetryCount = 0;
      this.maxRetries = 3;
      this.sessionIntelligence = new SessionIntelligence();
      
      // New tracking variables for skip detection
      this.lastVideoTime = 0;
      this.actualWatchedTime = 0;
      this.skipDetected = false;
      this.continuousWatchStart = 0;
      this.highestContinuousProgress = 0;
      this.lastCheckTime = Date.now();
      this.isVideoPlaying = false;
      
      this.init();
    }

    init() {
      this.setupPresenceDetection();
      this.detectPageChange();
      this.startUrlMonitoring();
      this.startContextValidationCheck();
    }

    startContextValidationCheck() {
      // Check less frequently and only when actually needed
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
      }
      this.contextCheckInterval = setInterval(() => {
        // Only check during actual operations, not idle time
        if (this.currentVideoId && this.progressCheckInterval) {
          try {
            // Just try to access chrome.runtime.id without destroying on failure
            const id = chrome?.runtime?.id;
            if (!id) {
              // Only destroy if we're actually trying to track something
              console.log('YCN: Extension context lost - stopping tracker');
              this.destroy();
            }
          } catch (error) {
            // Only handle actual context invalidation, not other errors
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.log('YCN: Extension context invalidated - stopping tracker');
              this.destroy();
            }
            // Ignore other errors silently
          }
        }
      }, 120000); // Check every 2 minutes instead of 30 seconds
    }

    destroy() {
      // Clean up all intervals and stop tracking silently
      this.stopTracking();
      
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
        this.contextCheckInterval = null;
      }
      
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
      
      // Clean up video event listeners
      const video = document.querySelector('video');
      if (video && this.videoEventHandlers) {
        video.removeEventListener('seeked', this.videoEventHandlers.seeked);
        video.removeEventListener('play', this.videoEventHandlers.play);
        video.removeEventListener('pause', this.videoEventHandlers.pause);
        this.videoEventHandlers = null;
      }
      
      // Clean up session intelligence
      if (this.sessionIntelligence && this.sessionIntelligence.saveTimeout) {
        clearTimeout(this.sessionIntelligence.saveTimeout);
      }
      
      // Only log if it's a real issue, not routine cleanup
      if (this.currentVideoId) {
        console.log('YCN: Tracker stopped - extension context changed');
      }
    }

    async sendMessageWithRetry(message, maxRetries = 3) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Check if chrome.runtime is still available
          if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.log('YCN: Extension context no longer available, stopping gracefully');
            return null;
          }
          
          console.log(`YCN: Sending message (attempt ${attempt}/${maxRetries}):`, message.type);
          
          // Try to wake up service worker first if not first attempt
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
          // Don't log errors for context invalidation - just stop gracefully
          if (error.message && (error.message.includes('Extension context invalidated') ||
              error.message.includes('Could not establish connection') ||
              error.message.includes('Cannot read properties of undefined'))) {
            console.log('YCN: Extension reloaded or updated, stopping gracefully');
            return null;
          }
          
          console.warn(`YCN: Message attempt ${attempt} failed:`, error.message);
          
          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`YCN: Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw new Error(`Failed to send message after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }
    }

    async wakeUpServiceWorker() {
      try {
        // Send a ping to wake up the service worker
        await chrome.runtime.sendMessage({ type: 'PING' });
      } catch (error) {
        // Ignore ping errors, it's just to wake up the worker
        console.log('YCN: Service worker ping failed (expected):', error.message);
      }
    }

    setupPresenceDetection() {
      // Detect tab visibility changes - but continue tracking for audio
      document.addEventListener('visibilitychange', () => {
        this.isTabActive = !document.hidden;
        console.log('YCN: Tab active:', this.isTabActive);
        
        // Don't pause tracking when tab becomes hidden - user might be listening
        // Just log the state change
        if (!this.isTabActive) {
          console.log('YCN: Tab hidden but continuing to track (user may be listening)');
        } else {
          console.log('YCN: Tab visible again');
        }
      });

      // Detect user activity (mouse, keyboard, scroll)
      const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        document.addEventListener(event, () => this.handleUserActivity(), { passive: true });
      });

      // Video interaction is also activity
      document.addEventListener('play', () => {
        this.handleUserActivity();
        this.handleVideoPlay();
      }, true);
      
      document.addEventListener('pause', () => {
        this.handleUserActivity();
        this.handleVideoPause();
      }, true);
      
      document.addEventListener('ended', () => {
        this.handleVideoEnded();
      }, true);
      
      document.addEventListener('seeking', () => this.handleUserActivity(), true);

      // Start idle detection
      this.startIdleDetection();
    }

    handleUserActivity() {
      this.lastActivity = Date.now();
      
      if (!this.isUserPresent) {
        this.isUserPresent = true;
        console.log('YCN: User activity detected');
        this.resumeTracking();
      }
      
      // Reset idle timer with longer threshold for audio listeners
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
      }
      
      // Only mark as idle after 5 minutes of no activity
      // This allows for audio listening without interaction
      this.idleTimeout = setTimeout(() => {
        // Check if video is still playing before marking idle
        const video = document.querySelector('video');
        if (video && !video.paused) {
          console.log('YCN: User inactive but video still playing - continuing tracking');
          // Reset the idle timer since video is playing
          this.idleTimeout = setTimeout(() => {
            this.isUserPresent = false;
            console.log('YCN: User idle for extended period');
            this.pauseTracking();
          }, this.idleThreshold * 10); // 10 more minutes if video is playing
        } else {
          this.isUserPresent = false;
          console.log('YCN: User idle and video not playing');
          this.pauseTracking();
        }
      }, this.idleThreshold * 5); // 5 minutes base threshold
    }

    startIdleDetection() {
      // Initial idle check
      this.handleUserActivity();
    }

    handleVideoPlay() {
      // Video started playing - ensure current video info is shown
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video resumed playing');
        this.updateCurrentVideo();
      }
    }

    handleVideoPause() {
      // Video paused - immediately clear current video display
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video paused - clearing display');
        this.sendClearCurrentVideo();
      }
    }

    handleVideoEnded() {
      // Video ended - immediately clear current video display and stop tracking
      if (this.currentVideoId && this.currentChannelId) {
        console.log('YCN: Video ended - clearing display and stopping tracking');
        this.sendClearCurrentVideo();
        this.stopTracking(false); // Don't send another clear message
      }
    }

    async sendClearCurrentVideo() {
      if (this.currentChannelId && chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          await this.sendMessageWithRetry({
            type: 'CLEAR_CURRENT_VIDEO',
            channelId: this.currentChannelId
          });
        } catch (error) {
          // Silently ignore errors when extension context is invalid
          if (!error.message || (!error.message.includes('Extension context') && 
              !error.message.includes('Cannot read properties'))) {
            console.warn('YCN: Error clearing current video:', error);
          }
        }
      }
    }

    pauseTracking() {
      // Only pause if user is truly idle, not just for tab switches
      if (this.progressCheckInterval && !this.isUserPresent) {
        console.log('YCN: Pausing tracking - user idle');
        clearInterval(this.progressCheckInterval);
        this.progressCheckInterval = null;
      }
    }

    resumeTracking() {
      if (this.isUserPresent && this.currentVideoId && !this.progressCheckInterval) {
        console.log('YCN: Resuming tracking - user returned');
        // Reset skip detection when resuming
        const video = document.querySelector('video');
        if (video) {
          this.lastVideoTime = video.currentTime;
          this.lastCheckTime = Date.now();
        }
        this.progressCheckInterval = setInterval(() => {
          this.checkProgress();
        }, 5000);
      }
    }

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
          // Immediately clear video info when leaving video pages
          if (this.currentChannelId) {
            console.log('YCN: Left video page - clearing display');
            this.sendClearCurrentVideo();
          }
          this.stopTracking(false); // Don't send another clear message
        }
      } catch (error) {
        console.warn('YCN: Error detecting page change:', error);
      }
    }

    isVideoPage() {
      return location.pathname === '/watch' && location.search.includes('v=');
    }

    initVideoTracking() {
      try {
        const videoId = this.extractVideoId();
        const channelId = this.extractChannelId();
        
        if (!videoId || !channelId) {
          setTimeout(() => this.initVideoTracking(), 1000);
          return;
        }

        if (videoId !== this.currentVideoId) {
          this.stopTracking();
          this.startTracking(videoId, channelId); // async call is fine here
        }
      } catch (error) {
        console.warn('YCN: Error initializing video tracking:', error);
      }
    }

    extractVideoId() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v');
    }

    extractChannelId() {
      try {
        // Try multiple methods to get channel ID, prioritizing most reliable
        
        // Method 1: Meta tag (most reliable)
        const metaChannelId = document.querySelector('meta[itemprop="channelId"]');
        if (metaChannelId && metaChannelId.content) {
          console.log('YCN: Found channel ID via meta tag:', metaChannelId.content);
          return metaChannelId.content;
        }
        
        // Method 2: Channel links in video owner section
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
          if (channelLink && channelLink.href) {
            const href = channelLink.href;
            const channelMatch = href.match(/\/channel\/([a-zA-Z0-9_-]+)/);
            if (channelMatch) {
              console.log('YCN: Found channel ID via link:', channelMatch[1]);
              return channelMatch[1];
            }
            
            const handleMatch = href.match(/\/@([a-zA-Z0-9_.-]+)/);
            if (handleMatch) {
              const handleId = 'handle_' + handleMatch[1];
              console.log('YCN: Found channel handle:', handleId);
              return handleId;
            }
          }
        }
        
        // Method 3: Try to find in page data
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent && script.textContent.includes('"channelId"')) {
            const channelMatch = script.textContent.match(/"channelId":"([a-zA-Z0-9_-]+)"/);
            if (channelMatch) {
              console.log('YCN: Found channel ID in script data:', channelMatch[1]);
              return channelMatch[1];
            }
          }
        }

        console.warn('YCN: Could not extract channel ID using any method');
        return null;
      } catch (error) {
        console.warn('YCN: Error extracting channel ID:', error);
        return null;
      }
    }

    async startTracking(videoId, channelId) {
      // Always set tracking info so pause/stop events work
      this.currentVideoId = videoId;
      this.currentChannelId = channelId;
      this.startTime = Date.now();
      this.lastProgress = 0;
      
      // Initialize skip detection variables
      this.lastVideoTime = 0;
      this.actualWatchedTime = 0;
      this.skipDetected = false;
      this.continuousWatchStart = 0;
      this.highestContinuousProgress = 0;
      this.lastCheckTime = Date.now();
      
      const video = document.querySelector('video');
      if (video) {
        this.lastVideoTime = video.currentTime;
        this.isVideoPlaying = !video.paused;
        this.setupVideoEventListeners(video);
      }

      // Check if this video was already watched
      let alreadyWatched = false;
      try {
        const result = await chrome.storage.local.get(['channels']);
        const channels = result.channels || {};
        
        if (channels[channelId] && 
            channels[channelId].watchedVideos && 
            channels[channelId].watchedVideos.includes(videoId)) {
          console.log('YCN: Video already counted, not tracking progress again:', videoId);
          alreadyWatched = true;
        }
      } catch (error) {
        // Continue tracking if we can't check
      }

      console.log('YCN: Started tracking video:', videoId, 'from channel:', channelId);

      // Always update the current playing video for display
      this.updateCurrentVideo();

      // Start progress checking regardless of tab state (for background audio)
      if (!alreadyWatched) {
        if (this.progressCheckInterval) {
          clearInterval(this.progressCheckInterval);
        }
        this.progressCheckInterval = setInterval(() => {
          this.checkProgress();
        }, 2000); // Check more frequently for better skip detection
        console.log('YCN: Started progress tracking (will continue in background)');
      } else {
        console.log('YCN: Video already watched - tracking for pause/stop only');
      }
    }

    stopTracking(sendClearMessage = false) {
      if (this.progressCheckInterval) {
        clearInterval(this.progressCheckInterval);
        this.progressCheckInterval = null;
      }
      
      // Only clear current video when explicitly requested
      if (sendClearMessage && this.currentChannelId) {
        this.sendClearCurrentVideo();
      }
      
      this.currentVideoId = null;
      this.currentChannelId = null;
      this.startTime = null;
      this.lastProgress = 0;
    }

    async updateCurrentVideo() {
      try {
        // Check if extension context is still valid before trying to send message
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          return;
        }
        
        const channelInfo = await this.getChannelInfo();
        const videoTitle = document.title.replace(' - YouTube', '');
        
        // Send message to update current playing video
        const response = await this.sendMessageWithRetry({
          type: 'UPDATE_CURRENT_VIDEO',
          channelId: this.currentChannelId,
          videoId: this.currentVideoId,
          channelInfo: channelInfo,
          videoTitle: videoTitle
        });
        
        if (response) {
          console.log('YCN: Updated current video for channel:', channelInfo.name, 'Video:', videoTitle);
        }
      } catch (error) {
        // Silently ignore context invalidation errors
        if (!error.message || (!error.message.includes('Extension context') && 
            !error.message.includes('Cannot read properties'))) {
          console.warn('YCN: Error updating current video:', error);
        }
      }
    }

    checkProgress() {
      try {
        const video = document.querySelector('video');
        if (!video || video.duration === 0) return;

        const currentVideoTime = video.currentTime;
        const currentProgress = currentVideoTime / video.duration;
        const now = Date.now();
        const timeSinceLastCheck = (now - this.lastCheckTime) / 1000;
        
        // Detect skipping: if video time advanced more than real time elapsed (+0.5s buffer)
        const videoTimeAdvanced = currentVideoTime - this.lastVideoTime;
        const skipThreshold = timeSinceLastCheck + 0.5; // Add small buffer for network lag
        
        if (videoTimeAdvanced > skipThreshold && videoTimeAdvanced > 2) {
          // User skipped forward
          console.log(`YCN: Skip detected! Jumped ${videoTimeAdvanced.toFixed(1)}s in ${timeSinceLastCheck.toFixed(1)}s`);
          this.skipDetected = true;
          // Reset continuous tracking from current position
          this.continuousWatchStart = currentVideoTime;
          this.highestContinuousProgress = currentProgress;
        } else if (videoTimeAdvanced < -1) {
          // User went backward - reset continuous tracking
          console.log('YCN: Rewind detected, resetting continuous tracking');
          this.continuousWatchStart = currentVideoTime;
          this.highestContinuousProgress = currentProgress;
          this.skipDetected = false; // Give them another chance
        } else if (video.paused) {
          // Video is paused, don't count time
          console.log('YCN: Video paused, not counting time');
        } else {
          // Normal playback - accumulate actual watched time
          const timeWatched = Math.min(videoTimeAdvanced, timeSinceLastCheck);
          this.actualWatchedTime += timeWatched;
          
          // Update highest continuous progress (no skips)
          if (!this.skipDetected) {
            const continuousProgress = (currentVideoTime - this.continuousWatchStart) / video.duration;
            this.highestContinuousProgress = Math.max(this.highestContinuousProgress, continuousProgress);
          }
        }
        
        // Log tracking status
        if (this.actualWatchedTime > 0 && Math.floor(this.actualWatchedTime) % 10 === 0) {
          console.log(`YCN: Actual watched: ${this.actualWatchedTime.toFixed(1)}s, ` +
                     `Continuous progress: ${(this.highestContinuousProgress * 100).toFixed(1)}%, ` +
                     `Skip detected: ${this.skipDetected}`);
        }
        
        // Check if threshold met with continuous watching (no skips)
        const realWatchTime = this.actualWatchedTime;
        const continuousProgressThreshold = this.skipDetected ? 
          this.highestContinuousProgress : currentProgress;
        
        if (continuousProgressThreshold >= this.watchThreshold && 
            realWatchTime >= this.minWatchTime && 
            !this.skipDetected) {
          
          console.log('YCN: Watch threshold met with continuous viewing!');
          this.recordVideoWatch();
          // Stop checking progress but keep tracking for pause/stop
          if (this.progressCheckInterval) {
            clearInterval(this.progressCheckInterval);
            this.progressCheckInterval = null;
          }
        } else if (this.skipDetected && currentProgress >= this.watchThreshold) {
          console.log('YCN: User reached 50% but skipped to get there - not counting');
        }
        
        // Update for next check
        this.lastVideoTime = currentVideoTime;
        this.lastCheckTime = now;
        this.lastProgress = currentProgress;
        
      } catch (error) {
        console.warn('YCN: Error checking progress:', error);
      }
    }
    
    setupVideoEventListeners(video) {
      // Remove existing listeners if any
      if (this.videoEventHandlers) {
        video.removeEventListener('seeked', this.videoEventHandlers.seeked);
        video.removeEventListener('play', this.videoEventHandlers.play);
        video.removeEventListener('pause', this.videoEventHandlers.pause);
      }
      
      // Create new handlers
      this.videoEventHandlers = {
        seeked: () => {
          const seekDistance = Math.abs(video.currentTime - this.lastVideoTime);
          if (seekDistance > 2) { // Significant seek
            console.log(`YCN: Seek detected - jumped ${seekDistance.toFixed(1)}s`);
            if (video.currentTime > this.lastVideoTime) {
              this.skipDetected = true;
            }
            // Reset continuous tracking from new position
            this.continuousWatchStart = video.currentTime;
            this.highestContinuousProgress = video.currentTime / video.duration;
          }
          this.lastVideoTime = video.currentTime;
        },
        play: () => {
          this.isVideoPlaying = true;
          this.lastCheckTime = Date.now();
          this.lastVideoTime = video.currentTime;
          console.log('YCN: Video playing');
        },
        pause: () => {
          this.isVideoPlaying = false;
          console.log('YCN: Video paused');
        }
      };
      
      // Add new listeners
      video.addEventListener('seeked', this.videoEventHandlers.seeked);
      video.addEventListener('play', this.videoEventHandlers.play);
      video.addEventListener('pause', this.videoEventHandlers.pause);
    }

    async recordVideoWatch() {
      try {
        // Check if chrome.runtime is available for messaging
        if (typeof chrome === 'undefined' || 
            !chrome || 
            typeof chrome.runtime === 'undefined' || 
            !chrome.runtime ||
            typeof chrome.runtime.sendMessage !== 'function') {
          console.warn('YCN: Chrome runtime API not available, retrying in 2 seconds...');
          setTimeout(() => this.recordVideoWatch(), 2000);
          return;
        }
        
        // Re-extract channel ID to ensure accuracy at recording time
        const currentChannelId = this.extractChannelId();
        const currentVideoId = this.extractVideoId();
        
        if (!currentChannelId || !currentVideoId) {
          console.warn('YCN: Cannot record watch - missing channel or video ID');
          return;
        }
        
        // Verify we're still on the same video we started tracking
        if (currentVideoId !== this.currentVideoId) {
          console.warn('YCN: Video changed during tracking, not recording');
          return;
        }
        
        // Verify channel ID matches what we started with
        if (currentChannelId !== this.currentChannelId) {
          console.warn('YCN: Channel ID mismatch!', 
                      'Started with:', this.currentChannelId, 
                      'Now shows:', currentChannelId);
          return;
        }
        
        // Check if this video was already watched before sending any messages
        try {
          const result = await chrome.storage.local.get(['channels']);
          const channels = result.channels || {};
          
          if (channels[currentChannelId] && 
              channels[currentChannelId].watchedVideos && 
              channels[currentChannelId].watchedVideos.includes(currentVideoId)) {
            console.log('YCN: Video already watched and counted, skipping:', 
                       document.title.replace(' - YouTube', ''),
                       'Channel:', channels[currentChannelId].name,
                       'Count remains:', channels[currentChannelId].count);
            
            // Just stop progress checking, but keep tracking for pause/stop events
            if (this.progressCheckInterval) {
              clearInterval(this.progressCheckInterval);
              this.progressCheckInterval = null;
            }
            return;
          }
        } catch (error) {
          console.warn('YCN: Error checking watched videos:', error);
        }
        
        const channelInfo = await this.getChannelInfo();
        
        // Use runtime messaging to background script for reliable storage
        const response = await this.sendMessageWithRetry({
          type: 'RECORD_VIDEO_WATCH',
          channelId: currentChannelId,
          videoId: currentVideoId,
          channelInfo: channelInfo,
          videoTitle: document.title.replace(' - YouTube', '')
        });

        // Reset retry count on successful recording
        this.recordingRetryCount = 0;

        if (response && response.success) {
          console.log('YCN: Recorded watch for channel:', 
                     channelInfo.name, '(' + currentChannelId + ')', 
                     'Count:', response.count,
                     'Video:', document.title.replace(' - YouTube', ''));

          // Track in session intelligence
          const watchDuration = Date.now() - this.startTime;
          const watchPercentage = this.lastProgress;
          this.sessionIntelligence.trackVideo(
            currentVideoId, 
            currentChannelId, 
            watchPercentage, 
            watchDuration
          );

          // Check if we should request notification permission
          if (response.count >= 10 && !response.approved && !response.askedPermission) {
            this.requestNotificationPermission();
          }
        } else {
          throw new Error('Background script failed to record video watch');
        }

      } catch (error) {
        console.warn('YCN: Error recording video watch:', error);
        
        // Handle extension context invalidation
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('YCN: Extension context invalidated - stopping tracking gracefully');
          this.stopTracking();
          this.recordingRetryCount = 0;
          return;
        }
        
        // Handle connection errors (extension reload/update)
        if (error.message && (error.message.includes('Could not establish connection') || 
            error.message.includes('Receiving end does not exist') ||
            error.message.includes('The message port closed'))) {
          console.log('YCN: Extension connection lost - stopping tracking gracefully');
          this.stopTracking();
          this.recordingRetryCount = 0;
          return;
        }
        
        // Debug Chrome API state when error occurs
        console.log('YCN: Debug - Chrome API state:', {
          chrome: typeof chrome,
          chromeRuntime: typeof chrome?.runtime,
          chromeSendMessage: typeof chrome?.runtime?.sendMessage,
          errorMessage: error.message
        });
        
        // Prevent infinite retries
        if (this.recordingRetryCount >= this.maxRetries) {
          console.warn('YCN: Maximum retries reached for video recording, giving up');
          this.recordingRetryCount = 0;
          return;
        }
        
        // Check if it's a Chrome API availability issue
        if (typeof chrome === 'undefined' || 
            !chrome || 
            typeof chrome.runtime === 'undefined' || 
            !chrome.runtime) {
          this.recordingRetryCount++;
          console.log(`YCN: Chrome runtime API unavailable, retrying in 3 seconds... (attempt ${this.recordingRetryCount}/${this.maxRetries})`);
          setTimeout(() => this.recordVideoWatch(), 3000);
          return;
        }
        
        // If it's a runtime messaging error, retry after a delay
        if (error.message && (error.message.includes('runtime') || 
            error.message.includes('sendMessage') ||
            error.message.includes('Background script failed'))) {
          this.recordingRetryCount++;
          console.log(`YCN: Runtime messaging error detected, retrying video watch recording in 3 seconds... (attempt ${this.recordingRetryCount}/${this.maxRetries})`);
          setTimeout(() => this.recordVideoWatch(), 3000);
        }
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
          if (nameElement && nameElement.textContent.trim()) {
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
        // Check if chrome APIs are available
        if (!chrome || !chrome.storage || !chrome.runtime) {
          console.warn('YCN: Chrome APIs not available for permission request');
          return;
        }
        
        const result = await chrome.storage.local.get(['channels']);
        const channels = result.channels || {};
        
        if (!channels[this.currentChannelId]) {
          console.warn('YCN: Channel not found for permission request');
          return;
        }
        
        channels[this.currentChannelId].askedPermission = true;
        await chrome.storage.local.set({ channels });

        chrome.runtime.sendMessage({
          type: 'REQUEST_PERMISSION',
          channelId: this.currentChannelId,
          channelName: channels[this.currentChannelId].name
        });
      } catch (error) {
        console.warn('YCN: Error requesting permission:', error);
        
        // Handle extension context invalidation gracefully
        if (error.message && (error.message.includes('Extension context invalidated') ||
            error.message.includes('Could not establish connection') ||
            error.message.includes('Receiving end does not exist'))) {
          console.log('YCN: Extension context invalidated during permission request - stopping gracefully');
          this.stopTracking();
          return;
        }
      }
    }
  }

  // Wait for Chrome APIs to be available
  function initializeTracker() {
    try {
      // Simple check - if we can access chrome.runtime.id, we're good
      if (chrome?.runtime?.id) {
        console.log('YCN: Initializing tracker');
        window.youtubeTracker = new YouTubeTracker();
      } else {
        // Only retry a few times, then give up
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
      // Don't retry on actual context invalidation
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('YCN: Extension not available');
        return;
      }
      // For other errors, try once more
      if (!window.ycnErrorRetry) {
        window.ycnErrorRetry = true;
        setTimeout(initializeTracker, 2000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracker);
  } else {
    initializeTracker();
  }

  window.addEventListener('beforeunload', () => {
    if (window.youtubeTracker) {
      // Clear video display immediately when page is unloading
      if (window.youtubeTracker.currentChannelId) {
        window.youtubeTracker.sendClearCurrentVideo();
      }
      window.youtubeTracker.stopTracking(false);
    }
  });
})();