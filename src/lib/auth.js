// Import encryption utilities
try {
  importScripts('../utils/encryption.js');
} catch (error) {
  console.error('Failed to load encryption utilities:', error);
}

class GhostProtocolAuth {
  constructor() {
    this.tokenCache = null;
    this.emailHashCache = null;
    this.salt = this.generateCryptoSalt();
    this.secureStorage = new SecureTokenStorage();
    this.rateLimiter = new Map();
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
    return new Promise(async (resolve, reject) => {
      console.log('YCN Ghost Protocol: Starting authentication');
      
      // Since browser sign-in is often disabled, try web flow first
      try {
        console.log('YCN Ghost Protocol: Trying web flow first (browser sign-in may be disabled)');
        const result = await this.authenticateViaWebFlow();
        resolve(result);
      } catch (webFlowError) {
        console.warn('YCN Ghost Protocol: Web flow failed, trying identity API:', webFlowError.message);
        
        // Try identity API as fallback
        try {
          const identityResult = await this.tryIdentityApiAuth();
          resolve(identityResult);
        } catch (primaryError) {
          console.error('YCN Ghost Protocol: Both auth methods failed');
          
          // If both fail, provide helpful guidance
          if (primaryError.message.includes('browser signin') || primaryError.message.includes('turned off')) {
            const helpMessage = this.getBrowserSpecificInstructions();
            reject(new Error(helpMessage));
          } else {
            reject(webFlowError); // Report web flow error since that was primary
          }
        }
      }
    });
  }

  async tryIdentityApiAuth() {
    return new Promise((resolve, reject) => {
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
  }

  async processAuthToken(token) {
    const userInfo = await this.fetchUserInfo(token);
    
    if (!userInfo || !userInfo.email) {
      throw new Error('Could not retrieve email from Google account');
    }
    
    const hashedEmail = await this.hashEmail(userInfo.email);
    
    // SECURITY ENHANCEMENT: In production, use SecureTokenStorage from encryption.js
    // to encrypt the access token before storage. Example:
    // const secureStorage = new SecureTokenStorage();
    // await secureStorage.storeToken('gmail_access', token);
    
    // Store tokens securely using encryption
    await this.secureStorage.storeToken('gmail_access', token);
    
    const ghostUser = {
      emailHash: hashedEmail,
      domain: userInfo.email.split('@')[1],
      verified: userInfo.verified_email || false,
      locale: userInfo.locale || 'en',
      authTimestamp: Date.now(),
      ghostProtocolVersion: '1.0.1',
      browserInfo: this.getBrowserInfo(),
      secureTokensStored: true // Indicator that tokens are encrypted
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
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                     `client_id=440708243624-95qh3upn1rejedp501nec674md33ksm3.apps.googleusercontent.com&` +
                     `response_type=token&` +
                     `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                     `scope=${encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send')}&` +
                     `access_type=online`;
      
      console.log('🔗 YCN Ghost Protocol: OAuth URL:', authUrl);
      console.log('📧 YCN Ghost Protocol: Requesting scopes: userinfo.email, userinfo.profile, gmail.send');
      
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
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
          const scope = params.get('scope');

          if (!accessToken) {
            throw new Error('No access token received in OAuth response');
          }

          console.log(`🔍 YCN Ghost Protocol: Token length: ${accessToken.length}`);
          console.log(`🔍 YCN Ghost Protocol: Granted scopes from web flow:`, scope ? scope.split(' ') : 'Not provided');
          
          // Check if Gmail scope was granted
          if (scope && scope.includes('gmail.send')) {
            console.log('✅ YCN Ghost Protocol: Gmail.send scope was granted in web flow!');
          } else {
            console.warn('⚠️ YCN Ghost Protocol: Gmail.send scope was NOT granted in web flow');
            console.warn('⚠️ YCN Ghost Protocol: This means email sending will fail');
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
      enabled: true,
      frequency: 'daily', // instant, batch, daily
      batchTime: '20:00',
      primarySendTime: '20:00',
      minVideosForEmail: 1,
      includeCategories: ['all'],
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };

    // Ensure settings are saved if they didn't exist
    if (!result.emailNotificationSettings) {
      await chrome.storage.local.set({ emailNotificationSettings: this.settings });
      console.log('YCN Email Service: Default settings saved to storage');
    }
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

    // Ensure settings are loaded
    if (!this.settings) {
      await this.loadUserPreferences();
    }

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
      if (!ghostUser.ghostUser || !ghostUser.ghostUser.email) {
        console.warn('YCN Email Service: No ghost user found or email missing');
        return false;
      }

      // Get access token for Gmail API
      const token = await this.getValidAccessToken();
      if (!token) {
        console.error('YCN Email Service: No valid access token');
        return false;
      }

      // Prepare video data for email template
      const videos = notifications.map(n => ({
        videoId: n.videoId,
        title: n.videoTitle,
        channelName: n.channelName,
        channelId: n.channelId,
        publishedAt: n.timestamp || Date.now(),
        isNewChannel: false
      }));

      // Ensure settings are loaded
      if (!this.settings) {
        await this.loadUserPreferences();
      }

      // Determine email type based on settings
      const emailType = this.settings.frequency === 'instant' ? 'instant' : 
                       this.settings.frequency === 'weekly' ? 'weekend' : 'daily';

      // Generate email content
      const { html, subject } = this.generateEmailContent(videos, ghostUser.ghostUser, emailType);

      // Send via Gmail API
      const emailSent = await this.sendViaGmailAPI(
        ghostUser.ghostUser.email,
        subject,
        html,
        token
      );

      if (emailSent) {
        console.log('YCN Ghost Protocol: Email sent successfully');
        console.log('YCN Ghost Protocol: User hash:', ghostUser.ghostUser.emailHash.substring(0, 8) + '...');
        console.log('YCN Ghost Protocol: Notifications:', notifications.length);

        await chrome.storage.local.set({
          lastEmailNotification: {
            timestamp: Date.now(),
            count: notifications.length,
            success: true
          }
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('YCN Email Service: Error sending notification:', error);
      return false;
    }
  }

  async getValidAccessToken(forceRefresh = false) {
    try {
      // First try to use Ghost Protocol token if not forcing refresh
      if (!forceRefresh) {
        const result = await chrome.storage.local.get(['ghostUser']);
        console.log('YCN Email Service: Checking for Ghost Protocol token:', !!result.ghostUser);
        
        if (result.ghostUser && result.ghostUser.secureTokensStored) {
          console.log('YCN Email Service: Found secure token storage');
          
          // Get token from secure storage
          const token = await this.secureStorage.getToken('gmail_access');
          if (token) {
            // Validate token before using it
            const isValid = await this.validateToken(token);
            if (isValid) {
              console.log('YCN Email Service: Stored token is valid, using it');
              return token;
            } else {
              console.log('YCN Email Service: Stored token is invalid, will refresh');
            }
          }
        }
      }
      
      // Token is invalid or we're forcing refresh - get a new one
      console.log('YCN Email Service: Getting fresh token...');
      return await this.refreshAccessToken();
      
    } catch (error) {
      console.warn('YCN Email Service: Error getting access token:', error);
      return null;
    }
  }
  
  async validateToken(token) {
    try {
      // Make a simple API call to check if token is valid
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
      
      if (response.ok) {
        const tokenInfo = await response.json();
        const expiresIn = tokenInfo.expires_in || 0;
        console.log('YCN Email Service: Token expires in', expiresIn, 'seconds');
        
        // Consider token invalid if it expires in less than 5 minutes
        return expiresIn > 300;
      } else {
        console.log('YCN Email Service: Token validation failed:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('YCN Email Service: Token validation error:', error);
      return false;
    }
  }
  
  async refreshAccessToken() {
    return new Promise((resolve, reject) => {
      console.log('YCN Email Service: Starting token refresh process...');
      
      // Clear any cached tokens first
      chrome.identity.clearAllCachedAuthTokens(() => {
        console.log('YCN Email Service: Cleared cached tokens');
        
        // Try to get a fresh token interactively (more reliable than silent)
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
          if (chrome.runtime.lastError) {
            console.error('YCN Email Service: Token refresh failed:', chrome.runtime.lastError.message);
            
            // If interactive fails, the user might not be signed in
            console.log('YCN Email Service: User may need to sign in to browser');
            resolve(null);
          } else if (token) {
            console.log('YCN Email Service: Successfully got fresh token');
            console.log('YCN Email Service: New token length:', token.length);
            
            // Validate the new token before storing
            const isValid = await this.validateToken(token);
            if (isValid) {
              await this.updateStoredToken(token);
              console.log('YCN Email Service: Token validated and stored');
              resolve(token);
            } else {
              console.error('YCN Email Service: New token is invalid!');
              resolve(null);
            }
          } else {
            console.error('YCN Email Service: No token returned');
            resolve(null);
          }
        });
      });
    });
  }
  
  async updateStoredToken(newToken) {
    try {
      // Store new token securely
      await this.secureStorage.storeToken('gmail_access', newToken);
      
      // Update user data to indicate secure storage
      const result = await chrome.storage.local.get(['ghostUser']);
      if (result.ghostUser) {
        result.ghostUser.secureTokensStored = true;
        delete result.ghostUser.accessToken; // Remove any old plaintext token
        await chrome.storage.local.set({ ghostUser: result.ghostUser });
        console.log('YCN Email Service: Updated stored token securely');
      }
    } catch (error) {
      console.error('YCN Email Service: Error updating stored token:', error);
    }
  }

  async sendViaGmailAPI(to, subject, htmlBody, accessToken, isRetry = false) {
    try {
      // Create email in RFC 2822 format
      const email = this.createEmailMessage(to, subject, htmlBody);
      console.log('YCN Email Service: Sending to:', to);
      console.log('YCN Email Service: Subject:', subject);
      console.log('YCN Email Service: Email size:', email.length);
      console.log('YCN Email Service: Token length:', accessToken ? accessToken.length : 'No token');
      console.log('YCN Email Service: Is retry attempt:', isRetry);
      
      // Gmail API endpoint
      const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: this.base64UrlEncode(email)
        })
      });

      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          errorDetails = await response.text();
        }
        
        // Parse error details for better debugging
        let errorMessage = `Status: ${response.status} ${response.statusText}`;
        let errorHint = '';
        
        if (response.status === 401) {
          errorHint = 'Authentication failed. Token may be expired or invalid.';
        } else if (response.status === 403) {
          errorHint = 'Permission denied. Check if Gmail API is enabled and scopes are correct.';
          if (errorDetails?.error?.message?.includes('gmail.send')) {
            errorHint += ' Missing gmail.send scope.';
          }
        } else if (response.status === 400) {
          errorHint = 'Bad request. Check email format and content.';
        } else if (response.status === 429) {
          errorHint = 'Rate limit exceeded. Too many requests.';
        }
        
        console.error('YCN Email Service: Gmail API error:', 
          errorMessage,
          '\nHint:', errorHint,
          '\nDetails:', typeof errorDetails === 'object' ? JSON.stringify(errorDetails, null, 2) : errorDetails
        );
        
        // If token expired and this is not already a retry, try to refresh and retry
        if (response.status === 401 && !isRetry) {
          console.log('YCN Email Service: Token expired, attempting to refresh...');
          
          try {
            // Get a fresh token with force refresh
            const newToken = await this.getValidAccessToken(true);
            
            if (newToken && newToken !== accessToken) {
              console.log('YCN Email Service: Got new token, retrying email send...');
              return await this.sendViaGmailAPI(to, subject, htmlBody, newToken, true);
            } else {
              console.error('YCN Email Service: Token refresh failed or returned same token');
              
              // Store the authentication failure for user notification
              await chrome.storage.local.set({
                authenticationError: {
                  timestamp: Date.now(),
                  message: 'Email authentication expired. Please re-authenticate in Ghost Protocol settings.',
                  needsReauth: true
                }
              });
              
              return false;
            }
          } catch (refreshError) {
            console.error('YCN Email Service: Token refresh threw error:', refreshError);
            return false;
          }
        }
        return false;
      }

      const result = await response.json();
      console.log('YCN Email Service: Email sent successfully, message ID:', result.id);
      return true;
      
    } catch (error) {
      console.error('YCN Email Service: Gmail API send error:', 
        error.message || 'Unknown error',
        '\nStack:', error.stack || 'No stack trace',
        '\nFull error:', error
      );
      return false;
    }
  }
  
  // Rate limiting for API calls
  async checkRateLimit(endpoint) {
    const now = Date.now();
    const key = endpoint;
    const limit = this.rateLimiter.get(key) || { count: 0, resetTime: now + 60000 };
    
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 60000;
    }
    
    if (limit.count >= 10) { // Max 10 requests per minute
      throw new Error('Rate limit exceeded for ' + endpoint);
    }
    
    limit.count++;
    this.rateLimiter.set(key, limit);
  }

  async validateToken(token) {
    try {
      if (!token) return false;
      
      // Check rate limiting
      await this.checkRateLimit('tokeninfo');
      
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async checkTokenScopes(token) {
    try {
      await this.checkRateLimit('tokeninfo');
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      if (response.ok) {
        const tokenInfo = await response.json();
        const scopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
        console.log('🔍 YCN Email Service: Current token scopes:', scopes);
        console.log('🔍 YCN Email Service: Has gmail.send scope:', scopes.includes('https://www.googleapis.com/auth/gmail.send'));
        console.log('🔍 YCN Email Service: Has userinfo.email scope:', scopes.includes('https://www.googleapis.com/auth/userinfo.email'));
        console.log('🔍 YCN Email Service: Has userinfo.profile scope:', scopes.includes('https://www.googleapis.com/auth/userinfo.profile'));
        
        // If missing gmail.send scope, suggest re-authentication
        if (!scopes.includes('https://www.googleapis.com/auth/gmail.send')) {
          console.warn('⚠️ YCN Email Service: Token is missing gmail.send scope! Email sending will fail.');
          console.warn('⚠️ YCN Email Service: Please clear auth data and sign in again to get Gmail permissions.');
        }
        
        return scopes;
      } else {
        console.warn('🔍 YCN Email Service: Could not check token scopes:', response.status);
        return [];
      }
    } catch (error) {
      console.warn('🔍 YCN Email Service: Error checking token scopes:', error);
      return [];
    }
  }

  createEmailMessage(to, subject, htmlBody) {
    const boundary = '----=_Part_' + Math.random().toString(36).substr(2);
    
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      this.htmlToPlainText(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`
    ].join('\r\n');

    return message;
  }

  base64UrlEncode(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  htmlToPlainText(html) {
    // Simple HTML to plain text conversion
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  generateEmailContent(videos, user, type) {
    // Try to use the advanced template if available
    try {
      if (typeof EmailTemplates !== 'undefined') {
        const templates = new EmailTemplates();
        return templates.generateVideoNotificationEmail(videos, user, type);
      }
    } catch (e) {
      // Fall back to basic template
    }

    // Basic email template fallback
    const subject = `YouTube Channel Notifier: ${videos.length} new video${videos.length > 1 ? 's' : ''}`;
    
    let html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f8f9fa 0%, #fafbfc 50%, #f5f6f8 100%); color: #1a1a1a; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto;">
          
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
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%); pointer-events: none;"></div>
              <div style="position: relative;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: white; letter-spacing: -0.02em;">New Videos Available</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">You have ${videos.length} new video${videos.length > 1 ? 's' : ''} to watch!</p>
              </div>
            </div>
            
            <!-- Videos Container -->
            <div style="padding: 8px;">`;
    
    videos.forEach(video => {
      html += `
              <!-- Video Card -->
              <div style="margin: 16px; padding: 20px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%); border-radius: 16px; border: 1px solid rgba(0, 0, 0, 0.04); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.5);">
                <div style="display: flex; gap: 20px; align-items: flex-start;">
                  <div style="width: 120px; height: 67px; background: linear-gradient(45deg, oklch(55.3% 0.013 58.071), oklch(45.3% 0.013 58.071)); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid rgba(255, 255, 255, 0.3); flex-shrink: 0;">
                    📺
                  </div>
                  <div style="flex: 1;">
                    <div style="display: inline-block; background: linear-gradient(135deg, oklch(95% 0.003 58.071) 0%, oklch(93% 0.005 58.071) 100%); padding: 4px 10px; border-radius: 8px; margin-bottom: 8px;">
                      <span style="font-size: 11px; color: oklch(55.3% 0.013 58.071); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                        ${this.escapeHtml(video.channelName)}
                      </span>
                    </div>
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a202c; line-height: 1.4; letter-spacing: -0.01em;">
                      ${this.escapeHtml(video.title)}
                    </h2>
                    <a href="https://www.youtube.com/watch?v=${video.videoId}" 
                       style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; text-decoration: none; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1); letter-spacing: 0.01em;">
                      Watch Video →
                    </a>
                  </div>
                </div>
              </div>`;
    });
    
    html += `
            </div>
          </div>
          
          <!-- Footer -->
          <div style="margin-top: 32px; padding: 24px; text-align: center;">
            <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.5) 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(0, 0, 0, 0.03);">
              <p style="margin: 0; font-size: 11px; color: oklch(55.3% 0.013 58.071); font-weight: 500; line-height: 1.5;">
                Your privacy is protected by Ghost Protocol.<br>
                Zero-knowledge email notifications.
              </p>
            </div>
            <p style="margin: 0; color: oklch(55.3% 0.013 58.071); font-size: 11px; font-weight: 600; letter-spacing: 0.02em;">YouTube Channel Notifier</p>
            <p style="margin: 4px 0 0 0; color: oklch(65.3% 0.013 58.071); font-size: 10px;">For The Love Of Code Hackathon by GitHub: 2025 Edition</p>
          </div>
          
        </div>
      </div>`;
    
    return { html, subject };
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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