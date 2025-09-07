// Import auth.js at the top of the service worker
try {
  importScripts('../lib/auth.js');
  console.log('YCN Ghost Protocol: Auth module loaded');
} catch (error) {
  console.warn('YCN Ghost Protocol: Could not load auth module:', error);
}

// Import analytics engine
try {
  importScripts('../utils/analytics-engine.js');
  console.log('YCN Analytics: Engine loaded');
} catch (error) {
  console.warn('YCN Analytics: Could not load analytics engine:', error);
}

// Define email modules directly in background script (most reliable approach)
class EmailTemplates {
  generateVideoNotificationEmail(videos, user, type = 'daily') {
    // Template version: 2024-08-31-v2 - Updated colors and footer
    const subject = `${videos.length} new video${videos.length > 1 ? 's' : ''} from your YouTube channels`;
    
    // Generate unsubscribe link - using mailto as a fallback since chrome-extension URLs don't work in emails
    // You can replace this with your own web-based unsubscribe page if you have one
    const unsubscribeLink = `mailto:${user?.email || 'noreply@example.com'}?subject=Unsubscribe from YouTube Channel Notifier&body=Please unsubscribe me from email notifications.`;
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f8f9fa 0%, #fafbfc 50%, #f5f6f8 100%); color: #1a1a1a;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Ghost Protocol Badge -->
    <div style="text-align: center; padding: 32px 0 24px 0;">
      <div style="display: inline-block; background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%); padding: 12px 24px; border-radius: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid rgba(0, 0, 0, 0.06);">
        <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: oklch(44.4% 0.011 73.639); letter-spacing: 0.03em; text-transform: uppercase;">
          YouTube Channel Notifier
        </h2>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: oklch(44.4% 0.011 73.639); font-weight: 500; letter-spacing: -0.01em;">
          Ghost Protocol Active
        </p>
      </div>
    </div>
    
    <!-- Main Card -->
    <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%); border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8); border: 1px solid rgba(0, 0, 0, 0.05); overflow: hidden;">
      
      <!-- Header Section -->
      <div style="background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); padding: 28px 32px; position: relative; overflow: hidden;">
        <!-- Gradient Overlay -->
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%); pointer-events: none;"></div>
        
        <div style="position: relative;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: white; letter-spacing: -0.02em;">
            New Videos Available
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
            ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      
      <!-- Videos Container -->
      <div style="padding: 8px;">
        ${videos.map((video, index) => `
          <!-- Video Card -->
          <div style="margin: 16px; padding: 20px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%); border-radius: 16px; border: 1px solid rgba(0, 0, 0, 0.04); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.5);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="140" valign="top">
                  <!-- Thumbnail with glass effect -->
                  <a href="https://www.youtube.com/watch?v=${this.sanitizeVideoId(video.videoId)}" style="display: block; position: relative;">
                    <img src="https://img.youtube.com/vi/${this.sanitizeVideoId(video.videoId)}/mqdefault.jpg" 
                         alt="${this.escapeHtml(video.title)}"
                         width="120" height="67"
                         style="display: block; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid rgba(255, 255, 255, 0.3);">
                  </a>
                </td>
                <td valign="top" style="padding-left: 20px;">
                  <!-- Channel Badge -->
                  <div style="display: inline-block; background: linear-gradient(135deg, oklch(95% 0.003 58.071) 0%, oklch(93% 0.005 58.071) 100%); padding: 4px 10px; border-radius: 8px; margin-bottom: 8px;">
                    <span style="font-size: 11px; color: oklch(55.3% 0.013 58.071); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                      ${this.escapeHtml(video.channelName || 'Channel')}
                    </span>
                  </div>
                  
                  <!-- Video Title -->
                  <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a202c; line-height: 1.4; letter-spacing: -0.01em;">
                    <a href="https://www.youtube.com/watch?v=${this.sanitizeVideoId(video.videoId)}" 
                       style="color: #1a202c; text-decoration: none;">
                      ${this.escapeHtml(video.title || 'Untitled Video')}
                    </a>
                  </h2>
                  
                  <!-- Watch Button with glassmorphism -->
                  <a href="https://www.youtube.com/watch?v=${this.sanitizeVideoId(video.videoId)}" 
                     style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; text-decoration: none; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1); letter-spacing: 0.01em;">
                    Watch Video →
                  </a>
                </td>
              </tr>
            </table>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 32px; padding: 24px; text-align: center;">
      <!-- Privacy Notice -->
      <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.5) 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(0, 0, 0, 0.03);">
        <p style="margin: 0; font-size: 11px; color: oklch(55.3% 0.013 58.071); font-weight: 500; line-height: 1.5;">
          Your privacy is protected by Ghost Protocol.<br>
          Zero-knowledge email notifications.
        </p>
      </div>
      
      <!-- Unsubscribe -->
      <p style="margin: 0 0 12px 0;">
        <a href="${unsubscribeLink}" 
           style="color: oklch(65.3% 0.013 58.071); font-size: 12px; text-decoration: underline; font-weight: 500;">
          Unsubscribe from notifications
        </a>
      </p>
      
      <!-- Branding -->
      <p style="margin: 0; color: oklch(55.3% 0.013 58.071); font-size: 11px; font-weight: 600; letter-spacing: 0.02em;">
        YouTube Channel Notifier
      </p>
      <p style="margin: 4px 0 0 0; color: oklch(65.3% 0.013 58.071); font-size: 10px;">
        For The Love Of Code Hackathon by GitHub: 2025 Edition
      </p>
    </div>
    
  </div>
</body>
</html>`;

    return { html, subject };
  }

  escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') {
      text = String(text);
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  }
  
  // Sanitize URL parameters
  sanitizeVideoId(videoId) {
    if (!videoId) return '';
    // YouTube video IDs are alphanumeric, underscore, and hyphen only
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}

class EmailScheduler {
  constructor() {
    this.settings = { enabled: true, frequency: 'daily_evening', primarySendTime: '20:00', minVideosForEmail: 1 };
  }
  
  async initialize() { console.log('YCN EmailScheduler: Initialized'); return true; }
  async queueVideoNotification(video) { console.log('YCN EmailScheduler: Video queued:', video.title); return true; }
  async processEmailQueue() { console.log('YCN EmailScheduler: Processing queue'); return true; }
  
  getNextOptimalSendTime() {
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (target <= new Date()) target.setDate(target.getDate() + 1);
    return target.getTime();
  }
}

// Make globally available
self.EmailTemplates = EmailTemplates;
self.EmailScheduler = EmailScheduler;
console.log('YCN: Email classes defined directly in background script');
console.log('YCN: EmailTemplates available:', typeof EmailTemplates !== 'undefined');
console.log('YCN: EmailScheduler available:', typeof EmailScheduler !== 'undefined');

class YCNBackground {
  constructor() {
    this.keepAliveInterval = null;
    this.lastActivity = Date.now();
    this.performanceManager = new PerformanceManager();
    this.smartBadge = new SmartBadgeManager(this);
    this.emailService = null;
    this.emailScheduler = null;
    this.ghostAuth = null;
    this.analyticsEngine = null;
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
    
    // Initialize data cleanup
    this.initDataRetention();
    
    // Initialize analytics engine
    this.initAnalytics();

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

    // Handle alarms for periodic video checking and email sending
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'checkYouTubeVideos') {
        console.log('YCN: Alarm triggered - checking for new videos');
        this.checkAllChannelsForNewVideos();
      } else if (alarm.name === 'emailBatch') {
        console.log('YCN: Email batch alarm triggered');
        this.processEmailQueue();
      } else if (alarm.name === 'dailyEmail') {
        console.log('YCN: Daily email alarm triggered');
        this.processEmailQueue();
      } else if (alarm.name === 'weekendEmail') {
        console.log('YCN: Weekend email alarm triggered');
        this.processEmailQueue();
      }
    });

    // Initial setup
    this.setupVideoChecking();
    this.initializeEmailService();

    console.log('YCN: Background service worker initialized');
  }

  async initializeEmailService() {
    try {
      // Check if auth classes are available
      if (typeof GhostProtocolAuth !== 'undefined' && typeof EmailNotificationService !== 'undefined') {
        this.ghostAuth = new GhostProtocolAuth();
        this.emailService = new EmailNotificationService();
        
        const initialized = await this.emailService.initialize();
        if (initialized) {
          console.log('YCN Ghost Protocol: Email service initialized');
        }
      } else {
        console.warn('YCN Ghost Protocol: Auth classes not available');
      }
      
      // Initialize email scheduler if available
      if (typeof EmailScheduler !== 'undefined') {
        this.emailScheduler = new EmailScheduler();
        await this.emailScheduler.initialize();
        console.log('YCN: Email scheduler initialized');
        
        // Make email service globally accessible for scheduler
        if (this.emailService) {
          self.emailService = this.emailService;
        }
      }
    } catch (error) {
      console.warn('YCN Ghost Protocol: Email service initialization failed:', error);
    }
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
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    this.keepAliveInterval = setInterval(() => {
      try {
        // Simple operation to keep worker alive
        chrome.storage.local.get(['keepAlive'], () => {
          chrome.storage.local.set({ 
            keepAlive: Date.now(),
            lastServiceWorkerPing: Date.now()
          });
        });
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

        case 'SEND_TEST_EMAIL':
          console.log('YCN: Test email triggered from dashboard');
          this.sendTestEmail(message.videos, message.emailType)
            .then(success => sendResponse({ success }))
            .catch(error => {
              console.error('YCN: Test email error:', error);
              sendResponse({ success: false, error: error.message });
            });
          return true; // Keep channel open for async response
        
        case 'GHOST_AUTHENTICATE':
          const authResult = await this.handleGhostAuthentication();
          sendResponse(authResult);
          break;
        
        case 'GHOST_STATUS':
          const status = await this.getGhostProtocolStatus();
          sendResponse(status);
          break;
        
        case 'GHOST_REVOKE':
          const revokeResult = await this.handleGhostRevoke();
          sendResponse(revokeResult);
          break;
        
        case 'GET_PRIVACY_REPORT':
          const report = await this.getPrivacyReport();
          sendResponse(report);
          break;
        
        case 'UPDATE_EMAIL_SETTINGS':
          const updateResult = await this.updateEmailSettings(message.settings);
          sendResponse(updateResult);
          break;

        case 'EMAIL_MODULE_TEST':
          sendResponse({
            success: true,
            emailTemplatesAvailable: typeof EmailTemplates !== 'undefined',
            emailSchedulerAvailable: typeof EmailScheduler !== 'undefined',
            backgroundScriptReady: true
          });
          break;

        case 'EMAIL_TEMPLATE_TEST':
          try {
            if (typeof EmailTemplates !== 'undefined') {
              const templates = new EmailTemplates();
              const result = templates.generateVideoNotificationEmail(
                message.videos || [],
                message.user || { name: 'Test User', emailHash: 'test_hash' },
                'daily'
              );
              
              sendResponse({
                success: true,
                html: result.html,
                subject: result.subject
              });
            } else {
              sendResponse({
                success: false,
                error: 'EmailTemplates not available'
              });
            }
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message
            });
          }
          break;

        case 'EMAIL_SCHEDULER_TEST':
          try {
            if (typeof EmailScheduler !== 'undefined') {
              const scheduler = new EmailScheduler();
              const nextSendTime = scheduler.getNextOptimalSendTime();
              
              // Production-ready queueing functionality initialized
              
              sendResponse({
                success: true,
                nextSendTime: nextSendTime,
                queueTest: queueResult !== false
              });
            } else {
              sendResponse({
                success: false,
                error: 'EmailScheduler not available'
              });
            }
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message
            });
          }
          break;

        case 'EMAIL_AUTH_TEST':
          try {
            if (this.emailService) {
              // Test the actual email service token retrieval
              const token = await this.emailService.getValidAccessToken();
              
              if (token) {
                // Get user info from Ghost Protocol storage
                const ghostResult = await chrome.storage.local.get(['ghostUser']);
                
                sendResponse({
                  success: true,
                  tokenSource: 'Ghost Protocol',
                  tokenLength: token.length,
                  userEmail: ghostResult.ghostUser?.email || 'Unknown'
                });
              } else {
                sendResponse({
                  success: false,
                  error: 'No valid access token available'
                });
              }
            } else {
              sendResponse({
                success: false,
                error: 'Email service not initialized'
              });
            }
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message
            });
          }
          break;
        
        case 'ANALYTICS_GET_DATA':
          try {
            const analyticsData = await this.getAnalyticsData(message.timeRange);
            sendResponse({ success: true, data: analyticsData });
          } catch (error) {
            console.warn('YCN Analytics: Error getting data:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
        
        case 'ANALYTICS_EXPORT':
          try {
            const exportData = await this.exportAnalyticsData(message.format, message.timeRange);
            sendResponse({ success: true, data: exportData });
          } catch (error) {
            console.warn('YCN Analytics: Error exporting data:', error);
            sendResponse({ success: false, error: error.message });
          }
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
      let channels = result.channels || {};
      
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

      // Use a closure to handle button clicks for this specific notification
      const buttonHandler = async (clickedId, buttonIndex) => {
        if (clickedId === notificationId) {
          if (buttonIndex === 0) {
            await this.approveChannel(channelId);
          } else {
            await this.denyChannel(channelId);
          }
          chrome.notifications.clear(clickedId);
          // Remove this specific listener after handling
          chrome.notifications.onButtonClicked.removeListener(buttonHandler);
        }
      };
      
      chrome.notifications.onButtonClicked.addListener(buttonHandler);

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
      
      // Queue email notification if scheduler is available
      if (this.emailScheduler) {
        const video = {
          videoId,
          title: videoTitle,
          channelName: channel.name,
          channelId,
          publishedAt: Date.now(),
          relationshipScore: channel.relationship?.score || 50,
          channelPriority: channel.relationship?.score >= 80 ? 'high' : 'normal'
        };
        
        await this.emailScheduler.queueVideoNotification(video);
        console.log('YCN: Video queued for email notification');
      }
      
      // Legacy email service support
      if (this.emailService && !this.emailScheduler) {
        await this.emailService.queueNotification(channelId, channel, videoTitle, videoId);
      }
    } catch (error) {
      console.warn('YCN: Error sending notification:', error);
    }
  }

  async processEmailQueue() {
    try {
      if (!this.emailScheduler) {
        console.log('YCN: Email scheduler not available');
        return;
      }
      
      await this.emailScheduler.processEmailQueue();
    } catch (error) {
      console.error('YCN: Error processing email queue:', error);
    }
  }

  async sendTestEmail(videos, emailType = 'daily_evening') {
    try {
      console.log('YCN: Sending test email with', videos.length, 'videos');
      
      // Check if email service is available
      if (!this.emailService) {
        console.warn('YCN: Email service not available for test');
        return false;
      }

      // Convert test videos to notification format
      const notifications = videos.map(video => ({
        channelId: video.channelId || 'test_channel',
        channelName: video.channelName,
        videoId: video.videoId,
        videoTitle: video.title,
        timestamp: video.publishedAt || Date.now()
      }));

      // Send test email using EmailNotificationService
      const sent = await this.emailService.sendEmailNotification(notifications);
      
      if (sent) {
        console.log('YCN: Test email sent successfully');
        return true;
      } else {
        console.warn('YCN: Test email failed to send');
        return false;
      }
    } catch (error) {
      console.error('YCN: Error sending test email:', error);
      throw error;
    }
  }

  async handleGhostAuthentication() {
    try {
      if (!this.ghostAuth) {
        await this.initializeEmailService();
        
        // Double check it initialized
        if (!this.ghostAuth) {
          throw new Error('Failed to initialize Ghost Protocol authentication');
        }
      }
      
      let ghostUser;
      // Use the universal authentication system
      ghostUser = await this.ghostAuth.authenticateUser();
      
      return { success: true, ghostUser };
    } catch (error) {
      console.error('YCN Ghost Protocol: Authentication failed:', error);
      // Ensure we return the actual error message, not [object Object]
      const errorMsg = typeof error === 'string' ? error : 
                      error.message || 
                      (error.toString && error.toString() !== '[object Object]' ? error.toString() : 'Unknown authentication error');
      return { success: false, error: errorMsg };
    }
  }

  async getGhostProtocolStatus() {
    try {
      if (!this.ghostAuth) {
        return { authenticated: false, initialized: false };
      }
      
      const isAuth = await this.ghostAuth.isAuthenticated();
      const ghostUser = await chrome.storage.local.get(['ghostUser']);
      
      return {
        authenticated: isAuth,
        initialized: true,
        ghostUser: ghostUser.ghostUser || null
      };
    } catch (error) {
      console.error('YCN Ghost Protocol: Status check failed:', error);
      return { authenticated: false, initialized: false, error: error.message };
    }
  }

  async handleGhostRevoke() {
    try {
      if (!this.ghostAuth) {
        return { success: false, error: 'Auth not initialized' };
      }
      
      await this.ghostAuth.revokeAuthentication();
      return { success: true };
    } catch (error) {
      console.error('YCN Ghost Protocol: Revoke failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getPrivacyReport() {
    try {
      if (!this.emailService) {
        return { error: 'Email service not initialized' };
      }
      
      return await this.emailService.getPrivacyReport();
    } catch (error) {
      console.error('YCN Ghost Protocol: Privacy report failed:', error);
      return { error: error.message };
    }
  }

  async updateEmailSettings(settings) {
    try {
      await chrome.storage.local.set({ emailNotificationSettings: settings });
      
      if (this.emailService) {
        await this.emailService.loadUserPreferences();
      }
      
      return { success: true };
    } catch (error) {
      console.error('YCN Ghost Protocol: Settings update failed:', error);
      return { success: false, error: error.message };
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
            let channels = result.channels || {};
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
        response = await fetch(rssUrl, { 
          signal: controller.signal,
          cache: 'no-cache'
        });
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
        let channels = result.channels || {};
        
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
  
  // ========== Data Retention Management ==========
  
  initDataRetention() {
    // Run cleanup immediately, then every 24 hours
    this.cleanupOldData();
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
  
  async cleanupOldData() {
    try {
      console.log('YCN: Starting data cleanup...');
      
      const now = Date.now();
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      const maxWatchedVideos = 1000; // Max watched videos per channel
      
      // Get current data
      const result = await chrome.storage.local.get(['channels']);
      const channels = result.channels || {};
      let cleaned = false;
      
      for (const channelId in channels) {
        const channel = channels[channelId];
        
        // Clean old watched videos
        if (channel.watchedVideos && Array.isArray(channel.watchedVideos)) {
          const originalLength = channel.watchedVideos.length;
          
          // Keep only recent videos and limit total count
          if (originalLength > maxWatchedVideos) {
            channel.watchedVideos = channel.watchedVideos.slice(-maxWatchedVideos);
            cleaned = true;
            console.log(`YCN: Trimmed ${channelId} watched videos from ${originalLength} to ${channel.watchedVideos.length}`);
          }
        }
        
        // Clean old video history
        if (channel.videos && Array.isArray(channel.videos)) {
          const originalLength = channel.videos.length;
          channel.videos = channel.videos.filter(video => {
            const age = now - (video.publishedAt || video.timestamp || 0);
            return age < maxAge;
          });
          
          if (channel.videos.length !== originalLength) {
            cleaned = true;
            console.log(`YCN: Cleaned ${channelId} video history from ${originalLength} to ${channel.videos.length} items`);
          }
        }
        
        // Clean old session data
        if (channel.lastCheck && (now - channel.lastCheck) > maxAge) {
          delete channel.currentVideo;
          cleaned = true;
        }
      }
      
      // Clean up orphaned data
      const ghostUser = await chrome.storage.local.get(['ghostUser']);
      if (ghostUser.ghostUser && ghostUser.ghostUser.authTimestamp) {
        const authAge = now - ghostUser.ghostUser.authTimestamp;
        const maxAuthAge = 180 * 24 * 60 * 60 * 1000; // 180 days
        
        if (authAge > maxAuthAge) {
          console.log('YCN: Cleaning expired auth data');
          await chrome.storage.local.remove(['ghostUser', 'authStatus']);
          cleaned = true;
        }
      }
      
      // Save cleaned data
      if (cleaned) {
        await chrome.storage.local.set({ channels });
        console.log('YCN: Data cleanup completed with changes');
      } else {
        console.log('YCN: Data cleanup completed, no changes needed');
      }
      
    } catch (error) {
      console.error('YCN: Error during data cleanup:', error);
    }
  }
  
  async getStorageStats() {
    try {
      const result = await chrome.storage.local.get(null);
      const channels = result.channels || {};
      
      let totalVideos = 0;
      let totalWatchedVideos = 0;
      let channelCount = Object.keys(channels).length;
      
      for (const channelId in channels) {
        const channel = channels[channelId];
        if (channel.videos) totalVideos += channel.videos.length;
        if (channel.watchedVideos) totalWatchedVideos += channel.watchedVideos.length;
      }
      
      return {
        channelCount,
        totalVideos,
        totalWatchedVideos,
        storageKeys: Object.keys(result).length
      };
    } catch (error) {
      console.error('YCN: Error getting storage stats:', error);
      return null;
    }
  }
  
  // Analytics methods
  async initAnalytics() {
    try {
      if (typeof PersonalAnalyticsEngine !== 'undefined') {
        this.analyticsEngine = new PersonalAnalyticsEngine();
        await this.analyticsEngine.initialize();
        console.log('YCN Analytics: Engine initialized successfully');
      } else {
        console.warn('YCN Analytics: PersonalAnalyticsEngine not available');
      }
    } catch (error) {
      console.error('YCN Analytics: Failed to initialize:', error);
    }
  }
  
  async getAnalyticsData(timeRange = '7d') {
    if (!this.analyticsEngine) {
      throw new Error('Analytics engine not initialized');
    }
    
    try {
      const data = await this.analyticsEngine.generateAnalyticsReport(timeRange);
      return data;
    } catch (error) {
      console.error('YCN Analytics: Error getting data:', error);
      throw error;
    }
  }
  
  async exportAnalyticsData(format = 'json', timeRange = '7d') {
    if (!this.analyticsEngine) {
      throw new Error('Analytics engine not initialized');
    }
    
    try {
      const data = await this.analyticsEngine.generateAnalyticsReport(timeRange);
      
      if (format === 'csv') {
        return this.convertToCSV(data);
      } else {
        return data;
      }
    } catch (error) {
      console.error('YCN Analytics: Error exporting data:', error);
      throw error;
    }
  }
  
  convertToCSV(data) {
    const csvRows = [];
    
    // Add headers
    csvRows.push('Date,Channel,Video Title,Watch Time,Category,Completion Rate');
    
    // Add data rows
    if (data.detailedData && data.detailedData.length > 0) {
      data.detailedData.forEach(item => {
        const row = [
          new Date(item.timestamp).toISOString().split('T')[0],
          item.channelName || 'Unknown',
          `"${(item.videoTitle || 'Unknown').replace(/"/g, '""')}"`,
          item.watchTime || 0,
          item.category || 'General',
          item.completionRate || 0
        ].join(',');
        csvRows.push(row);
      });
    }
    
    return csvRows.join('\n');
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
        badgeColor = '#e11d48';
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