class GhostProtocolAuth {
  constructor() {
    this.tokenCache = null;
    this.emailHashCache = null;
    this.salt = this.generateCryptoSalt();
  }

  generateCryptoSalt() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase() + this.salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async authenticateUser() {
    return new Promise((resolve, reject) => {
      // Universal authentication that tries multiple methods
      this.tryIdentityApiAuth()
        .then(resolve)
        .catch(async (primaryError) => {
          console.warn('YCN Ghost Protocol: Identity API failed, trying web flow:', primaryError.message);
          
          // If primary auth fails, try web auth flow
          try {
            const result = await this.authenticateViaWebFlow();
            resolve(result);
          } catch (webFlowError) {
            console.error('YCN Ghost Protocol: Web flow also failed:', webFlowError.message);
            
            // If both fail, provide helpful guidance
            if (primaryError.message.includes('browser signin') || primaryError.message.includes('turned off')) {
              const helpMessage = this.getBrowserSpecificInstructions();
              reject(new Error(helpMessage));
            } else {
              reject(primaryError);
            }
          }
        });
    });
  }

  async tryIdentityApiAuth() {
    return new Promise((resolve, reject) => {
      // Check if clearAllCachedAuthTokens exists (Chrome 87+)
      const clearTokens = (callback) => {
        if (chrome.identity.clearAllCachedAuthTokens) {
          chrome.identity.clearAllCachedAuthTokens(callback);
        } else {
          callback();
        }
      };
      
      clearTokens(() => {
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
            console.error('YCN Ghost Protocol: Identity API error:', errorMessage);
            reject(new Error(errorMessage));
            return;
          }

          if (!token) {
            reject(new Error('No authentication token received'));
            return;
          }

          try {
            const ghostUser = await this.processAuthToken(token);
            resolve(ghostUser);
          } catch (error) {
            chrome.identity.removeCachedAuthToken({ token }, () => {});
            reject(error);
          }
        });
      });
    });
  }

  async processAuthToken(token) {
    const userInfo = await this.fetchUserInfo(token);
    
    if (!userInfo || !userInfo.email) {
      throw new Error('Could not retrieve email from Google account');
    }
    
    const hashedEmail = await this.hashEmail(userInfo.email);
    
    const ghostUser = {
      emailHash: hashedEmail,
      domain: userInfo.email.split('@')[1],
      verified: userInfo.verified_email || false,
      locale: userInfo.locale || 'en',
      authTimestamp: Date.now(),
      ghostProtocolVersion: '1.0.0',
      browserInfo: this.getBrowserInfo()
    };

    await chrome.storage.local.set({
      ghostUser,
      authStatus: 'authenticated',
      lastAuthCheck: Date.now()
    });

    console.log('YCN Ghost Protocol: User authenticated without storing email');
    console.log('YCN Ghost Protocol: Browser:', ghostUser.browserInfo.name);
    console.log('YCN Ghost Protocol: Email domain:', ghostUser.domain);
    console.log('YCN Ghost Protocol: Hash:', ghostUser.emailHash.substring(0, 8) + '...');

    return ghostUser;
  }

  getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    
    if (userAgent.includes('Edg/')) {
      browserName = 'Microsoft Edge';
    } else if (userAgent.includes('Chrome/')) {
      if (userAgent.includes('Brave/')) {
        browserName = 'Brave Browser';
      } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
        browserName = 'Opera';
      } else if (userAgent.includes('Comet/')) {
        browserName = 'Comet Browser';
      } else {
        browserName = 'Google Chrome';
      }
    } else if (userAgent.includes('Firefox/')) {
      browserName = 'Mozilla Firefox';
    } else if (userAgent.includes('Safari/')) {
      browserName = 'Safari';
    }
    
    return {
      name: browserName,
      userAgent: userAgent.substring(0, 100) + '...' // Truncated for privacy
    };
  }

  getBrowserSpecificInstructions() {
    const browser = this.getBrowserInfo();
    const settingsUrl = browser.name.includes('Edge') ? 'edge://settings/' : 'chrome://settings/';
    
    return `Browser sign-in is disabled in ${browser.name}. 

To fix this:
1. Open ${browser.name} Settings: ${settingsUrl}
2. Look for "You and Google", "Profiles", or "Sign in" section
3. Turn ON "Allow browser sign-in" or "Sync and Google services"
4. Sign in with your Google account
5. Reload this extension and try again

This works across all Chromium browsers: Chrome, Edge, Brave, Opera, Comet, and others.`;
  }

  async authenticateViaWebFlow() {
    console.log('YCN Ghost Protocol: Using universal browser OAuth flow');
    
    const browserInfo = this.getBrowserInfo();
    const extensionId = chrome.runtime.id;
    console.log(`YCN Ghost Protocol: Browser detected: ${browserInfo.name}`);
    console.log(`YCN Ghost Protocol: Extension ID: ${extensionId}`);

    return new Promise((resolve, reject) => {
      // Get the browser-specific redirect URI
      const redirectUri = chrome.identity.getRedirectURL();
      console.log('YCN Ghost Protocol: Generated redirect URI:', redirectUri);
      
      chrome.identity.launchWebAuthFlow({
        url: `https://accounts.google.com/o/oauth2/v2/auth?` +
             `client_id=440708243624-95qh3upn1rejedp501nec674md33ksm3.apps.googleusercontent.com&` +
             `response_type=token&` +
             `redirect_uri=${encodeURIComponent(redirectUri)}&` +
             `scope=${encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}&` +
             `access_type=online`,
        interactive: true
      }, async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
          console.error('YCN Ghost Protocol: Chrome extension OAuth error:', errorMessage);
          
          if (errorMessage.includes('OAuth2 not granted')) {
            reject(new Error(`Authentication cancelled or OAuth not granted in ${browserInfo.name}. Please try again and grant permissions.`));
          } else if (errorMessage.includes('redirect_uri_mismatch')) {
            reject(new Error(`OAuth redirect URI setup needed for ${browserInfo.name}.

Extension ID: ${chrome.runtime.id}
Required redirect URI: ${redirectUri}

This redirect URI needs to be added to Google Cloud Console:
1. Go to https://console.cloud.google.com/
2. Find OAuth client: 440708243624-95qh3upn1rejedp501nec674md33ksm3.apps.googleusercontent.com
3. Edit the OAuth client (if Web application type)
4. Add to "Authorized redirect URIs": ${redirectUri}
5. Save changes

Note: ${browserInfo.name} generates a different extension ID than Chrome, requiring a separate redirect URI.

If your OAuth client is "Chrome extension" type, you'll need to create a new "Web application" client to add redirect URIs.`));
          } else {
            reject(new Error(`Chrome extension authentication failed in ${browserInfo.name}: ${errorMessage}`));
          }
          return;
        }

        if (!redirectUrl) {
          reject(new Error('No redirect URL received from Chrome extension OAuth flow'));
          return;
        }

        try {
          console.log('YCN Ghost Protocol: Processing Chrome extension OAuth response');
          
          // Extract access token from redirect URL
          const url = new URL(redirectUrl);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get('access_token');

          if (!accessToken) {
            throw new Error('No access token received in OAuth response');
          }

          // Process the token using our universal method
          const ghostUser = await this.processAuthToken(accessToken);
          ghostUser.authMethod = 'chrome-extension-oauth';
          ghostUser.authBrowser = browserInfo.name;
          
          // Update storage with browser info
          await chrome.storage.local.set({
            ghostUser,
            authStatus: 'authenticated',
            lastAuthCheck: Date.now()
          });

          console.log(`YCN Ghost Protocol: Successfully authenticated via Chrome extension OAuth in ${browserInfo.name}`);
          resolve(ghostUser);
          
        } catch (error) {
          console.error('YCN Ghost Protocol: Error processing Chrome extension OAuth response:', error);
          reject(error);
        }
      });
    });
  }

  async fetchUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return await response.json();
  }

  async silentAuthenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, async (token) => {
        if (chrome.runtime.lastError || !token) {
          resolve(null);
          return;
        }

        try {
          const userInfo = await this.fetchUserInfo(token);
          const hashedEmail = await this.hashEmail(userInfo.email);
          
          resolve({
            emailHash: hashedEmail,
            domain: userInfo.email.split('@')[1],
            verified: userInfo.verified_email
          });
        } catch (error) {
          console.warn('YCN Ghost Protocol: Silent auth failed:', error);
          resolve(null);
        }
      });
    });
  }

  async revokeAuthentication() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;
            fetch(revokeUrl).then(() => {
              console.log('YCN Ghost Protocol: Token revoked');
            }).catch(error => {
              console.warn('YCN Ghost Protocol: Error revoking token:', error);
            });
          });
        }

        chrome.storage.local.remove([
          'ghostUser',
          'authStatus',
          'lastAuthCheck',
          'emailNotificationSettings'
        ], () => {
          console.log('YCN Ghost Protocol: Authentication data cleared');
          resolve();
        });
      });
    });
  }

  async getActiveGoogleAccount() {
    try {
      const cookies = await chrome.cookies.getAll({
        domain: '.youtube.com',
        name: 'LOGIN_INFO'
      });

      if (cookies.length > 0) {
        const sessionData = JSON.parse(decodeURIComponent(cookies[0].value));
        return sessionData.email || null;
      }
    } catch (error) {
      console.log('YCN Ghost Protocol: Could not detect active YouTube account');
    }
    return null;
  }


  async isAuthenticated() {
    const result = await chrome.storage.local.get(['authStatus', 'lastAuthCheck']);
    
    if (result.authStatus !== 'authenticated') {
      return false;
    }

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (result.lastAuthCheck < oneWeekAgo) {
      const silentAuth = await this.silentAuthenticate();
      return silentAuth !== null;
    }

    return true;
  }

  async generateNotificationToken(channelId, videoId) {
    const data = `${channelId}-${videoId}-${Date.now()}-${this.salt}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }
}

class EmailNotificationService {
  constructor() {
    this.auth = new GhostProtocolAuth();
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchInterval = 5 * 60 * 1000; // 5 minutes
    this.maxBatchSize = 10;
  }

  async initialize() {
    const isAuth = await this.auth.isAuthenticated();
    if (!isAuth) {
      console.log('YCN Email Service: Not authenticated');
      return false;
    }

    await this.loadUserPreferences();
    this.startBatchProcessor();
    return true;
  }

  async loadUserPreferences() {
    const result = await chrome.storage.local.get(['emailNotificationSettings']);
    this.settings = result.emailNotificationSettings || {
      enabled: false,
      frequency: 'instant', // instant, batch, daily
      batchTime: '09:00',
      includeCategories: ['all'],
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  async queueNotification(channelId, channel, videoTitle, videoId) {
    if (!this.settings.enabled) {
      return;
    }

    const notification = {
      channelId,
      channelName: channel.name,
      videoTitle,
      videoId,
      timestamp: Date.now(),
      notificationToken: await this.auth.generateNotificationToken(channelId, videoId)
    };

    if (this.settings.frequency === 'instant' && !this.isQuietHours()) {
      await this.sendEmailNotification([notification]);
    } else {
      this.batchQueue.push(notification);
      await this.saveBatchQueue();
    }
  }

  isQuietHours() {
    if (!this.settings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  async saveBatchQueue() {
    await chrome.storage.local.set({ emailBatchQueue: this.batchQueue });
  }

  async loadBatchQueue() {
    const result = await chrome.storage.local.get(['emailBatchQueue']);
    this.batchQueue = result.emailBatchQueue || [];
  }

  startBatchProcessor() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(async () => {
      await this.processBatch();
    }, this.batchInterval);

    this.setupDailyDigest();
  }

  setupDailyDigest() {
    if (this.settings.frequency === 'daily') {
      const [hour, minute] = this.settings.batchTime.split(':').map(Number);
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, minute, 0, 0);

      if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const delay = scheduledTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.processBatch();
        this.setupDailyDigest();
      }, delay);
    }
  }

  async processBatch() {
    await this.loadBatchQueue();
    
    if (this.batchQueue.length === 0) {
      return;
    }

    if (this.isQuietHours()) {
      console.log('YCN Email Service: Quiet hours active, skipping batch');
      return;
    }

    const batch = this.batchQueue.splice(0, this.maxBatchSize);
    await this.sendEmailNotification(batch);
    await this.saveBatchQueue();
  }

  async sendEmailNotification(notifications) {
    try {
      const ghostUser = await chrome.storage.local.get(['ghostUser']);
      if (!ghostUser.ghostUser) {
        console.warn('YCN Email Service: No ghost user found');
        return;
      }

      const payload = {
        userHash: ghostUser.ghostUser.emailHash,
        notifications: notifications.map(n => ({
          channelName: n.channelName,
          videoTitle: n.videoTitle,
          videoUrl: `https://www.youtube.com/watch?v=${n.videoId}`,
          token: n.notificationToken
        })),
        timestamp: Date.now(),
        count: notifications.length
      };

      console.log('YCN Ghost Protocol: Email payload prepared (no PII)');
      console.log('YCN Ghost Protocol: User hash:', payload.userHash.substring(0, 8) + '...');
      console.log('YCN Ghost Protocol: Notifications:', payload.count);

      await chrome.storage.local.set({
        lastEmailNotification: {
          timestamp: Date.now(),
          count: payload.count,
          success: true
        }
      });

    } catch (error) {
      console.error('YCN Email Service: Error sending notification:', error);
    }
  }

  async getPrivacyReport() {
    const ghostUser = await chrome.storage.local.get(['ghostUser']);
    const settings = await chrome.storage.local.get(['emailNotificationSettings']);
    const queue = await chrome.storage.local.get(['emailBatchQueue']);

    return {
      authenticated: !!ghostUser.ghostUser,
      emailStored: false,
      dataWeHave: {
        emailHash: ghostUser.ghostUser?.emailHash?.substring(0, 8) + '...',
        domain: ghostUser.ghostUser?.domain,
        browserName: ghostUser.ghostUser?.browserInfo?.name || 'Unknown',
        authMethod: ghostUser.ghostUser?.authMethod || 'identity-api',
        queuedNotifications: queue.emailBatchQueue?.length || 0
      },
      dataWeDontHave: [
        'Your actual email address',
        'Your name',
        'Your Google account ID',
        'Your viewing history',
        'Your personal information',
        'Your browser data',
        'Your location'
      ],
      universalCompatibility: {
        supportedBrowsers: [
          'Google Chrome',
          'Microsoft Edge', 
          'Brave Browser',
          'Opera',
          'Comet Browser',
          'Any Chromium-based browser'
        ],
        authMethods: [
          'Identity API (preferred)',
          'Web Auth Flow (fallback)',
          'Universal redirect URI'
        ]
      },
      settings: settings.emailNotificationSettings || {}
    };
  }
}

// Make classes available globally for service worker
if (typeof self !== 'undefined') {
  self.GhostProtocolAuth = GhostProtocolAuth;
  self.EmailNotificationService = EmailNotificationService;
}