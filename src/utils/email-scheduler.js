/**
 * Smart Email Scheduler for YouTube Channel Notifier
 * Handles intelligent timing of email notifications based on user behavior
 */

class EmailScheduler {
  constructor() {
    this.defaultSettings = {
      frequency: 'daily_evening', // instant, daily_evening, weekend_digest
      primarySendTime: '20:00',   // 8 PM default
      secondarySendTime: '12:00',  // Noon for lunch break
      weekendTime: '10:00',       // Saturday morning
      timezone: null,              // Auto-detect
      quietHours: {
        start: '22:00',
        end: '09:00'
      },
      minVideosForEmail: 1,        // Minimum videos to trigger email
      batchWindow: 30,             // Minutes to wait for batching
      smartDigest: true,           // Enable behavioral learning
      maxEmailsPerDay: 3           // Prevent spam
    };
    
    this.emailQueue = [];
    this.lastSentTime = null;
    this.dailyEmailCount = 0;
    this.userBehavior = {
      openTimes: [],              // Track when user opens emails
      clickTimes: [],             // Track when user clicks videos
      peakEngagementHour: 20,    // Default to 8 PM
      preferredDay: 6             // Saturday by default
    };
  }

  /**
   * Initialize scheduler with user preferences
   */
  async initialize() {
    try {
      // Load user preferences from storage
      const result = await chrome.storage.local.get([
        'emailPreferences',
        'emailQueue',
        'emailBehavior',
        'lastEmailSent'
      ]);
      
      if (result.emailPreferences) {
        this.settings = { ...this.defaultSettings, ...result.emailPreferences };
      } else {
        this.settings = { ...this.defaultSettings };
      }
      
      if (result.emailQueue) {
        this.emailQueue = result.emailQueue;
      }
      
      if (result.emailBehavior) {
        this.userBehavior = { ...this.userBehavior, ...result.emailBehavior };
      }
      
      if (result.lastEmailSent) {
        this.lastSentTime = result.lastEmailSent;
        // Reset daily count if it's a new day
        if (!this.isSameDay(this.lastSentTime, Date.now())) {
          this.dailyEmailCount = 0;
        }
      }
      
      // Detect timezone if not set
      if (!this.settings.timezone) {
        this.settings.timezone = this.detectTimezone();
      }
      
      // Set up scheduled checks
      this.setupScheduledAlarms();
      
      console.log('YCN Email Scheduler: Initialized with settings:', this.settings);
    } catch (error) {
      console.error('YCN Email Scheduler: Initialization error:', error);
    }
  }

  /**
   * Queue a new video for email notification
   */
  async queueVideoNotification(video) {
    try {
      // Add to queue with metadata
      const queueItem = {
        ...video,
        queuedAt: Date.now(),
        priority: this.calculatePriority(video)
      };
      
      this.emailQueue.push(queueItem);
      
      // Save queue to storage
      await chrome.storage.local.set({ emailQueue: this.emailQueue });
      
      // Decide whether to send immediately or batch
      if (this.shouldSendImmediately(video)) {
        await this.sendImmediateNotification([queueItem]);
      } else {
        await this.scheduleNextBatch();
      }
      
      console.log('YCN Email Scheduler: Video queued:', video.title);
    } catch (error) {
      console.error('YCN Email Scheduler: Queue error:', error);
    }
  }

  /**
   * Determine if email should be sent immediately
   */
  shouldSendImmediately(video) {
    // Check user frequency preference
    if (this.settings.frequency === 'instant') {
      return true;
    }
    
    // Check if it's from a priority channel
    if (video.channelPriority === 'high' || video.relationshipScore >= 80) {
      return true;
    }
    
    // Check if we've hit daily limit
    if (this.dailyEmailCount >= this.settings.maxEmailsPerDay) {
      return false;
    }
    
    // Otherwise batch it
    return false;
  }

  /**
   * Schedule the next batch send
   */
  async scheduleNextBatch() {
    const now = new Date();
    const targetTime = this.getNextOptimalSendTime();
    
    // Calculate delay in minutes
    const delayMs = targetTime - now.getTime();
    const delayMinutes = Math.floor(delayMs / 60000);
    
    if (delayMinutes > 0) {
      // Create an alarm for the batch send
      chrome.alarms.create('emailBatch', {
        delayInMinutes: delayMinutes
      });
      
      console.log(`YCN Email Scheduler: Batch scheduled for ${new Date(targetTime).toLocaleString()}`);
    }
  }

  /**
   * Get the next optimal send time based on user preferences and behavior
   */
  getNextOptimalSendTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    // Weekend digest logic
    if (this.settings.frequency === 'weekend_digest') {
      return this.getNextWeekendTime();
    }
    
    // Smart digest with behavioral learning
    if (this.settings.smartDigest && this.userBehavior.openTimes.length > 5) {
      const optimalHour = this.calculateOptimalHourFromBehavior();
      return this.getNextTimeForHour(optimalHour);
    }
    
    // Daily evening digest (default)
    if (this.settings.frequency === 'daily_evening') {
      const [targetHour, targetMinute] = this.settings.primarySendTime.split(':').map(Number);
      
      // If we haven't passed today's send time yet
      if (currentHour < targetHour || (currentHour === targetHour && now.getMinutes() < targetMinute)) {
        const targetTime = new Date(now);
        targetTime.setHours(targetHour, targetMinute, 0, 0);
        return targetTime.getTime();
      }
      
      // Otherwise schedule for tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(targetHour, targetMinute, 0, 0);
      return tomorrow.getTime();
    }
    
    // Default to next available slot outside quiet hours
    return this.getNextAvailableSlot();
  }

  /**
   * Calculate optimal send hour from user behavior
   */
  calculateOptimalHourFromBehavior() {
    // Analyze open times to find peak engagement
    const hourCounts = new Array(24).fill(0);
    
    this.userBehavior.openTimes.forEach(timestamp => {
      const hour = new Date(timestamp).getHours();
      hourCounts[hour]++;
    });
    
    // Weight recent behavior more heavily
    const recentOpenTimes = this.userBehavior.openTimes
      .filter(t => Date.now() - t < 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    recentOpenTimes.forEach(timestamp => {
      const hour = new Date(timestamp).getHours();
      hourCounts[hour] += 2; // Double weight for recent
    });
    
    // Find peak hour
    let maxCount = 0;
    let optimalHour = 20; // Default to 8 PM
    
    hourCounts.forEach((count, hour) => {
      // Only consider reasonable hours (not middle of night)
      if (hour >= 7 && hour <= 22 && count > maxCount) {
        maxCount = count;
        optimalHour = hour;
      }
    });
    
    return optimalHour;
  }

  /**
   * Get next weekend digest time
   */
  getNextWeekendTime() {
    const now = new Date();
    const currentDay = now.getDay();
    const [targetHour, targetMinute] = this.settings.weekendTime.split(':').map(Number);
    
    // Calculate days until Saturday (6)
    let daysUntilSaturday = (6 - currentDay + 7) % 7;
    if (daysUntilSaturday === 0 && now.getHours() >= targetHour) {
      daysUntilSaturday = 7; // Next Saturday
    }
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysUntilSaturday);
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    
    return targetDate.getTime();
  }

  /**
   * Get next available time for a specific hour
   */
  getNextTimeForHour(hour) {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour < hour) {
      // Today at the specified hour
      const targetTime = new Date(now);
      targetTime.setHours(hour, 0, 0, 0);
      return targetTime.getTime();
    } else {
      // Tomorrow at the specified hour
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, 0, 0, 0);
      return tomorrow.getTime();
    }
  }

  /**
   * Get next available slot outside quiet hours
   */
  getNextAvailableSlot() {
    const now = new Date();
    const [quietStart, quietStartMin] = this.settings.quietHours.start.split(':').map(Number);
    const [quietEnd, quietEndMin] = this.settings.quietHours.end.split(':').map(Number);
    
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Check if we're in quiet hours
    const inQuietHours = this.isInQuietHours(currentHour, currentMinutes);
    
    if (!inQuietHours) {
      // Send in 5 minutes (quick batch)
      return Date.now() + (5 * 60 * 1000);
    } else {
      // Schedule for end of quiet hours
      const targetTime = new Date(now);
      if (quietEnd < quietStart) {
        // Quiet hours span midnight
        targetTime.setDate(targetTime.getDate() + 1);
      }
      targetTime.setHours(quietEnd, quietEndMin, 0, 0);
      return targetTime.getTime();
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(hour, minute = 0) {
    const [quietStart, quietStartMin] = this.settings.quietHours.start.split(':').map(Number);
    const [quietEnd, quietEndMin] = this.settings.quietHours.end.split(':').map(Number);
    
    const currentMinutes = hour * 60 + minute;
    const startMinutes = quietStart * 60 + quietStartMin;
    const endMinutes = quietEnd * 60 + quietEndMin;
    
    if (startMinutes <= endMinutes) {
      // Quiet hours don't span midnight
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Calculate priority for a video
   */
  calculatePriority(video) {
    let priority = 0;
    
    // Channel relationship score
    priority += (video.relationshipScore || 0) / 10;
    
    // Video age (newer = higher priority)
    const ageHours = (Date.now() - video.publishedAt) / (1000 * 60 * 60);
    if (ageHours < 1) priority += 10;
    else if (ageHours < 6) priority += 5;
    else if (ageHours < 24) priority += 2;
    
    // Channel priority flag
    if (video.channelPriority === 'high') priority += 10;
    
    return priority;
  }

  /**
   * Process the email queue and send batch
   */
  async processEmailQueue() {
    try {
      if (this.emailQueue.length === 0) {
        console.log('YCN Email Scheduler: No emails in queue');
        return;
      }
      
      // Check if we're in quiet hours
      const now = new Date();
      if (this.isInQuietHours(now.getHours(), now.getMinutes())) {
        console.log('YCN Email Scheduler: In quiet hours, postponing');
        await this.scheduleNextBatch();
        return;
      }
      
      // Check daily limit
      if (this.dailyEmailCount >= this.settings.maxEmailsPerDay) {
        console.log('YCN Email Scheduler: Daily limit reached');
        return;
      }
      
      // Sort queue by priority
      this.emailQueue.sort((a, b) => b.priority - a.priority);
      
      // Take videos for this batch
      const batchSize = Math.min(this.emailQueue.length, 10); // Max 10 videos per email
      const batch = this.emailQueue.splice(0, batchSize);
      
      // Send the email
      const emailSent = await this.sendBatchEmail(batch);
      
      if (emailSent) {
        // Update counters and storage
        this.dailyEmailCount++;
        this.lastSentTime = Date.now();
        
        await chrome.storage.local.set({
          emailQueue: this.emailQueue,
          lastEmailSent: this.lastSentTime,
          dailyEmailCount: this.dailyEmailCount
        });
        
        console.log(`YCN Email Scheduler: Batch email sent with ${batch.length} videos`);
      } else {
        // Put videos back in queue if send failed
        this.emailQueue.unshift(...batch);
        await chrome.storage.local.set({ emailQueue: this.emailQueue });
      }
      
      // Schedule next batch if queue not empty
      if (this.emailQueue.length > 0) {
        await this.scheduleNextBatch();
      }
      
    } catch (error) {
      console.error('YCN Email Scheduler: Process queue error:', error);
    }
  }

  /**
   * Send batch email using Gmail API via EmailNotificationService
   */
  async sendBatchEmail(videos) {
    try {
      // Get EmailNotificationService instance
      let emailService = null;
      
      // Try to access global service instance
      if (typeof self !== 'undefined' && self.emailService) {
        emailService = self.emailService;
      } else if (typeof EmailNotificationService !== 'undefined') {
        emailService = new EmailNotificationService();
        await emailService.initialize();
      }
      
      if (!emailService) {
        console.warn('YCN Email Scheduler: EmailNotificationService not available');
        return false;
      }
      
      // Convert videos to notification format
      const notifications = videos.map(video => ({
        channelId: video.channelId,
        channelName: video.channelName,
        videoId: video.videoId,
        videoTitle: video.title,
        timestamp: video.publishedAt || Date.now()
      }));
      
      // Send via EmailNotificationService
      const sent = await emailService.sendEmailNotification(notifications);
      
      if (sent) {
        // Track send time for behavioral learning
        await this.trackEmailSent(Date.now());
        console.log('YCN Email Scheduler: Batch email sent successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('YCN Email Scheduler: Send error:', error);
      return false;
    }
  }

  /**
   * Send immediate notification for high-priority videos
   */
  async sendImmediateNotification(videos) {
    try {
      // Check quiet hours even for immediate
      const now = new Date();
      if (this.isInQuietHours(now.getHours(), now.getMinutes())) {
        console.log('YCN Email Scheduler: Immediate email delayed due to quiet hours');
        // Add back to queue for later
        this.emailQueue.push(...videos);
        await chrome.storage.local.set({ emailQueue: this.emailQueue });
        await this.scheduleNextBatch();
        return;
      }
      
      // Send immediately
      await this.sendBatchEmail(videos);
      
    } catch (error) {
      console.error('YCN Email Scheduler: Immediate send error:', error);
    }
  }

  /**
   * Track when email was sent for learning
   */
  async trackEmailSent(timestamp) {
    this.userBehavior.openTimes.push(timestamp);
    
    // Keep only last 50 send times
    if (this.userBehavior.openTimes.length > 50) {
      this.userBehavior.openTimes = this.userBehavior.openTimes.slice(-50);
    }
    
    await chrome.storage.local.set({ emailBehavior: this.userBehavior });
  }

  /**
   * Track when user opens/clicks email
   */
  async trackEmailEngagement(type, timestamp = Date.now()) {
    if (type === 'open') {
      this.userBehavior.openTimes.push(timestamp);
    } else if (type === 'click') {
      this.userBehavior.clickTimes.push(timestamp);
    }
    
    // Recalculate optimal time
    if (this.userBehavior.openTimes.length > 10) {
      this.userBehavior.peakEngagementHour = this.calculateOptimalHourFromBehavior();
    }
    
    await chrome.storage.local.set({ emailBehavior: this.userBehavior });
  }

  /**
   * Set up Chrome alarms for scheduled sends
   */
  setupScheduledAlarms() {
    // Clear existing alarms
    chrome.alarms.clear('dailyEmail');
    chrome.alarms.clear('weekendEmail');
    
    if (this.settings.frequency === 'daily_evening') {
      // Set up daily alarm
      const [hour, minute] = this.settings.primarySendTime.split(':').map(Number);
      const now = new Date();
      const targetTime = new Date(now);
      targetTime.setHours(hour, minute, 0, 0);
      
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      chrome.alarms.create('dailyEmail', {
        when: targetTime.getTime(),
        periodInMinutes: 24 * 60 // Repeat daily
      });
    } else if (this.settings.frequency === 'weekend_digest') {
      // Set up weekly alarm for Saturday
      const nextSaturday = this.getNextWeekendTime();
      
      chrome.alarms.create('weekendEmail', {
        when: nextSaturday,
        periodInMinutes: 7 * 24 * 60 // Repeat weekly
      });
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(newPreferences) {
    this.settings = { ...this.settings, ...newPreferences };
    await chrome.storage.local.set({ emailPreferences: this.settings });
    
    // Reconfigure alarms
    this.setupScheduledAlarms();
    
    console.log('YCN Email Scheduler: Preferences updated:', this.settings);
  }

  /**
   * Detect user's timezone
   */
  detectTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      return 'America/New_York'; // Default fallback
    }
  }

  /**
   * Check if two timestamps are on the same day
   */
  isSameDay(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return date1.toDateString() === date2.toDateString();
  }

  /**
   * Get scheduler status for debugging
   */
  getStatus() {
    return {
      settings: this.settings,
      queueLength: this.emailQueue.length,
      dailyEmailCount: this.dailyEmailCount,
      lastSentTime: this.lastSentTime,
      nextSendTime: this.getNextOptimalSendTime(),
      userBehavior: {
        peakHour: this.userBehavior.peakEngagementHour,
        dataPoints: this.userBehavior.openTimes.length
      }
    };
  }
}

// Export for use in background script and global access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailScheduler;
}

// Make globally available for service workers
if (typeof self !== 'undefined') {
  self.EmailScheduler = EmailScheduler;
}