class GhostDashboard {
  constructor() {
    this.authStatus = false;
    this.settings = {
      enabled: false,
      frequency: 'daily_evening',
      primarySendTime: '20:00',
      smartDigest: true,
      quietHours: {
        start: '22:00',
        end: '09:00'
      },
      minVideosForEmail: 2,
      maxEmailsPerDay: 3
    };
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    this.setupEventListeners();
    await this.loadSettings();
    await this.initializeEmailPreferences();
    this.updateUI();
  }

  async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GHOST_STATUS' });
      this.authStatus = response.authenticated;
      
      if (this.authStatus) {
        await this.loadPrivacyReport();
        await this.checkForAuthErrors(); // Check for any stored auth errors
      }
      
      this.updateAuthUI();
    } catch (error) {
      console.error('Ghost Dashboard: Error checking auth status:', error);
    }
  }
  
  async checkForAuthErrors() {
    try {
      const result = await chrome.storage.local.get(['authenticationError']);
      
      if (result.authenticationError && result.authenticationError.needsReauth) {
        const error = result.authenticationError;
        const timeSinceError = Date.now() - error.timestamp;
        
        // Show error if it's less than 30 minutes old
        if (timeSinceError < 30 * 60 * 1000) {
          this.showAuthError(error.message);
          
          // Clear the error after showing it
          await chrome.storage.local.remove(['authenticationError']);
        }
      }
    } catch (error) {
      console.error('Ghost Dashboard: Error checking for auth errors:', error);
    }
  }
  
  showAuthError(message) {
    // Create a prominent error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(220, 53, 69, 0.3);
      z-index: 10001;
      font-weight: 600;
      text-align: center;
      max-width: 400px;
    `;
    
    errorDiv.innerHTML = `
      <div style="margin-bottom: 8px;">⚠️ Authentication Issue</div>
      <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px;">${message}</div>
      <button onclick="this.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      ">Dismiss</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 10000);
  }

  async loadPrivacyReport() {
    try {
      const report = await chrome.runtime.sendMessage({ type: 'GET_PRIVACY_REPORT' });
      this.displayPrivacyReport(report);
    } catch (error) {
      console.error('Ghost Dashboard: Error loading privacy report:', error);
    }
  }

  displayPrivacyReport(report) {
    const whatWeKnow = document.getElementById('whatWeKnow');
    const whatWeDontKnow = document.getElementById('whatWeDontKnow');
    const yourStats = document.getElementById('yourStats');

    whatWeKnow.innerHTML = '';
    if (report.dataWeHave) {
      whatWeKnow.innerHTML = `
        <div class="privacy-item">
          <span class="icon">@</span>
          <span>Email Hash: ${report.dataWeHave.emailHash || 'Not set'}</span>
        </div>
        <div class="privacy-item">
          <span class="icon">•</span>
          <span>Domain: ${report.dataWeHave.domain || 'Unknown'}</span>
        </div>
        <div class="privacy-item">
          <span class="icon">•</span>
          <span>Browser: ${report.dataWeHave.browserName || 'Unknown'}</span>
        </div>
        <div class="privacy-item">
          <span class="icon">▢</span>
          <span>Queued: ${report.dataWeHave.queuedNotifications || 0} notifications</span>
        </div>
      `;
    }

    whatWeDontKnow.innerHTML = '';
    if (report.dataWeDontHave) {
      report.dataWeDontHave.forEach(item => {
        whatWeDontKnow.innerHTML += `
          <div class="privacy-item">
            <span class="icon">×</span>
            <span>${item}</span>
          </div>
        `;
      });
    }

    yourStats.innerHTML = `
      <div class="privacy-item">
        <span class="icon">◈</span>
        <span>Privacy Level: Maximum</span>
      </div>
      <div class="privacy-item">
        <span class="icon">●</span>
        <span>Data Protection: Active</span>
      </div>
      <div class="privacy-item">
        <span class="icon">●</span>
        <span>Ghost Mode: Enabled</span>
      </div>
      <div class="privacy-item">
        <span class="icon">◎</span>
        <span>Universal Browser Support: <span style="color: #e11d48;">✓</span></span>
      </div>
    `;

    // Show universal compatibility info if available
    if (report.universalCompatibility) {
      const compatibilityInfo = document.createElement('div');
      compatibilityInfo.style.cssText = `
        background: oklch(94.4% 0.005 73.639);
        border: 1px solid oklch(84.4% 0.008 73.639);
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
        color: oklch(44.4% 0.011 73.639);
        font-size: 12px;
      `;
      compatibilityInfo.innerHTML = `
        <strong><span style="color: oklch(44.4% 0.011 73.639);">◎</span> Universal Browser Support:</strong><br>
        ${report.universalCompatibility.supportedBrowsers.join(', ')}<br><br>
        <strong><span style="color: oklch(44.4% 0.011 73.639);">⚙</span> Authentication Methods:</strong><br>
        ${report.universalCompatibility.authMethods.join(', ')}
      `;
      yourStats.appendChild(compatibilityInfo);
    }

    document.getElementById('privacyReport').style.display = 'grid';
    document.getElementById('settingsSection').style.display = 'block';
    document.getElementById('channelsSection').style.display = 'block';
    
    // Load and display approved channels
    this.loadApprovedChannels();

    if (report.dataWeHave && report.dataWeHave.emailHash) {
      document.getElementById('hashDemo').textContent = report.dataWeHave.emailHash;
    }
  }

  updateAuthUI() {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('authStatusText');
    const authButton = document.getElementById('authButton');

    if (this.authStatus) {
      indicator.classList.remove('not-authenticated');
      indicator.classList.add('authenticated');
      statusText.textContent = 'Ghost Protocol Active - Your email is protected';
      authButton.textContent = 'Revoke Ghost Protocol';
      authButton.classList.add('revoke');
    } else {
      indicator.classList.remove('authenticated');
      indicator.classList.add('not-authenticated');
      statusText.textContent = 'Ghost Protocol Inactive - Click to enable email notifications';
      authButton.textContent = 'Enable Ghost Protocol';
      authButton.classList.remove('revoke');
      document.getElementById('privacyReport').style.display = 'none';
      document.getElementById('settingsSection').style.display = 'none';
      document.getElementById('channelsSection').style.display = 'none';
    }
  }

  async loadApprovedChannels() {
    try {
      const result = await chrome.storage.local.get(['channels']);
      const channelsList = document.getElementById('approvedChannelsList');
      const noChannelsMessage = document.getElementById('noChannelsMessage');
      
      if (result.channels) {
        const approvedChannels = Object.entries(result.channels)
          .filter(([id, channel]) => channel.approved)
          .sort((a, b) => a[1].name.localeCompare(b[1].name));
        
        if (approvedChannels.length > 0) {
          channelsList.style.display = 'grid';
          noChannelsMessage.style.display = 'none';
          
          channelsList.innerHTML = approvedChannels.map(([id, channel]) => `
            <div class="channel-item">
              <div class="channel-name">${this.escapeHtml(channel.name)}</div>
              <div class="channel-videos">
                <span class="video-count">${channel.count}</span>
                <span>videos watched</span>
              </div>
            </div>
          `).join('');
        } else {
          channelsList.style.display = 'none';
          noChannelsMessage.style.display = 'block';
        }
      } else {
        channelsList.style.display = 'none';
        noChannelsMessage.style.display = 'block';
      }
    } catch (error) {
      console.error('Ghost Dashboard: Error loading channels:', error);
    }
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['emailNotificationSettings']);
      if (result.emailNotificationSettings) {
        this.settings = result.emailNotificationSettings;
        this.updateSettingsUI();
      }
    } catch (error) {
      console.error('Ghost Dashboard: Error loading settings:', error);
    }
  }

  updateSettingsUI() {
    try {
      const emailEnabled = document.getElementById('emailEnabled');
      const frequency = document.getElementById('frequency');
      const primarySendTime = document.getElementById('primarySendTime');
      const smartDigest = document.getElementById('smartDigest');
      const quietStart = document.getElementById('quietStart');
      const quietEnd = document.getElementById('quietEnd');
      const minVideos = document.getElementById('minVideos');
      const maxEmails = document.getElementById('maxEmails');
      const minVideosValue = document.getElementById('minVideosValue');
      const maxEmailsValue = document.getElementById('maxEmailsValue');

      if (emailEnabled) emailEnabled.checked = this.settings.enabled;
      if (frequency) frequency.value = this.settings.frequency;
      if (primarySendTime) primarySendTime.value = this.settings.primarySendTime;
      if (smartDigest) smartDigest.checked = this.settings.smartDigest;
      if (quietStart) quietStart.value = this.settings.quietHours.start;
      if (quietEnd) quietEnd.value = this.settings.quietHours.end;
      if (minVideos) minVideos.value = this.settings.minVideosForEmail;
      if (maxEmails) maxEmails.value = this.settings.maxEmailsPerDay;
      
      // Update range value displays
      if (minVideosValue) minVideosValue.textContent = this.settings.minVideosForEmail;
      if (maxEmailsValue) maxEmailsValue.textContent = this.settings.maxEmailsPerDay;
    } catch (error) {
      console.error('Ghost Dashboard: Error updating settings UI:', error);
    }
  }

  toggleDailyTimeVisibility() {
    const dailyTimeGroup = document.getElementById('dailyTimeGroup');
    if (document.getElementById('frequency').value === 'daily') {
      dailyTimeGroup.style.display = 'block';
    } else {
      dailyTimeGroup.style.display = 'none';
    }
  }

  setupEventListeners() {
    document.getElementById('authButton').addEventListener('click', async () => {
      if (this.authStatus) {
        await this.revokeAuth();
      } else {
        await this.authenticate();
      }
    });

    document.getElementById('saveSettings').addEventListener('click', async () => {
      await this.saveSettings();
    });

    document.getElementById('emailEnabled').addEventListener('change', (e) => {
      if (e.target.checked && !this.authStatus) {
        e.target.checked = false;
        this.showAuthPrompt();
      }
    });

    // Range sliders live update
    document.getElementById('minVideos').addEventListener('input', (e) => {
      document.getElementById('minVideosValue').textContent = e.target.value;
    });

    document.getElementById('maxEmails').addEventListener('input', (e) => {
      document.getElementById('maxEmailsValue').textContent = e.target.value;
    });

    // Form validation
    document.getElementById('primarySendTime').addEventListener('change', () => {
      this.validateTimeSettings();
    });

    document.getElementById('quietStart').addEventListener('change', () => {
      this.validateTimeSettings();
    });

    document.getElementById('quietEnd').addEventListener('change', () => {
      this.validateTimeSettings();
    });

    // Email testing buttons
    document.getElementById('testEmail').addEventListener('click', async () => {
      await this.sendTestEmail();
    });

    document.getElementById('previewEmail').addEventListener('click', () => {
      this.showEmailPreview();
    });

    document.getElementById('closePreview').addEventListener('click', () => {
      this.hideEmailPreview();
    });

    document.getElementById('sendTestFromPreview').addEventListener('click', async () => {
      await this.sendTestEmail();
    });

    document.getElementById('runDiagnostics').addEventListener('click', async () => {
      await this.runEmailDiagnostics();
    });

    document.getElementById('closeDebug').addEventListener('click', () => {
      this.hideDebugModal();
    });

    document.getElementById('copyDebugResults').addEventListener('click', () => {
      this.copyDebugResults();
    });

    // Close modals on outside click
    document.getElementById('emailPreviewModal').addEventListener('click', (e) => {
      if (e.target.id === 'emailPreviewModal') {
        this.hideEmailPreview();
      }
    });

    document.getElementById('debugModal').addEventListener('click', (e) => {
      if (e.target.id === 'debugModal') {
        this.hideDebugModal();
      }
    });
  }

  validateTimeSettings() {
    // Add visual feedback for time conflicts
    const primaryTime = document.getElementById('primarySendTime').value;
    const quietStart = document.getElementById('quietStart').value;
    const quietEnd = document.getElementById('quietEnd').value;
    
    // Simple validation - show warning if primary time is in quiet hours
    console.log('YCN: Validating time settings', { primaryTime, quietStart, quietEnd });
  }

  showAuthPrompt() {
    const authButton = document.getElementById('authButton');
    authButton.style.animation = 'pulse 1s 3';
    setTimeout(() => {
      authButton.style.animation = '';
    }, 3000);
    
    alert('Please enable Ghost Protocol first to use email notifications');
  }

  async authenticate() {
    try {
      const authButton = document.getElementById('authButton');
      authButton.disabled = true;
      authButton.textContent = 'Authenticating...';

      const response = await chrome.runtime.sendMessage({ type: 'GHOST_AUTHENTICATE' });
      
      if (response.success) {
        this.authStatus = true;
        await this.checkAuthStatus();
        this.showSuccessMessage('Ghost Protocol Activated! Your privacy is protected.');
      } else {
        // Show detailed error message
        const errorMsg = response.error || 'Authentication failed';
        console.log('Ghost Dashboard: Auth error received:', errorMsg);
        
        if (errorMsg.includes('browser sign-in') || errorMsg.includes('Chrome browser sign-in') || errorMsg.includes('turned off')) {
          // Show special message for browser sign-in issue
          this.showBrowserSignInError();
        } else {
          this.showErrorMessage(errorMsg);
        }
      }
    } catch (error) {
      console.error('Ghost Dashboard: Authentication error:', error);
      this.showErrorMessage('Authentication error. Please try again.');
    } finally {
      document.getElementById('authButton').disabled = false;
      this.updateAuthUI();
    }
  }

  showBrowserSignInError() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10001;
      max-width: 500px;
      color: #333;
    `;
    
    modal.innerHTML = `
      <h2 style="color: #dc3545; margin-bottom: 15px;">Browser Sign-in Required</h2>
      <p style="margin-bottom: 20px;">Ghost Protocol requires browser sign-in to be enabled for Google OAuth authentication.</p>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 10px;">For All Chromium Browsers:</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Open Browser Settings: <code style="background: #e9ecef; padding: 2px 5px; border-radius: 3px;">chrome://settings/</code> or <code>edge://settings/</code></li>
          <li>Look for "You and Google", "Profiles", or "Sign in" section</li>
          <li>Turn ON "Allow browser sign-in" or "Sync and Google services"</li>
          <li>Sign in with your Google account</li>
          <li>Reload this extension and try again</li>
        </ol>
        
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="font-size: 14px; color: #666; margin: 0;">
            <strong>Universal Support:</strong> Works in Chrome, Edge, Brave, Opera, Comet, and all Chromium browsers.
            Ghost Protocol automatically detects your browser and adapts authentication accordingly.
          </p>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="openSettingsBtn" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        ">Open Browser Settings</button>
        <button id="closeModalBtn" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
    `;
    
    // Close modal function
    const closeModal = () => {
      modal.remove();
      backdrop.remove();
    };
    
    // Add event listeners after modal is in DOM
    setTimeout(() => {
      const openSettingsBtn = document.getElementById('openSettingsBtn');
      const closeModalBtn = document.getElementById('closeModalBtn');
      
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
          // Try to open settings page
          try {
            window.open('chrome://settings/syncSetup', '_blank');
          } catch (error) {
            // Fallback - copy settings URL to clipboard
            navigator.clipboard.writeText('chrome://settings/').then(() => {
              alert('Settings URL copied to clipboard: chrome://settings/\n\nPaste this in your address bar to open settings.');
            }).catch(() => {
              alert('Please manually open: chrome://settings/ in a new tab');
            });
          }
          closeModal();
        });
      }
      
      if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
      }
    }, 100);
    
    // Backdrop click to close
    backdrop.onclick = closeModal;
    
    document.body.appendChild(backdrop);
  }

  async revokeAuth() {
    if (!confirm('Are you sure you want to revoke Ghost Protocol? This will stop email notifications.')) {
      return;
    }

    try {
      const authButton = document.getElementById('authButton');
      authButton.disabled = true;
      authButton.textContent = 'Revoking...';

      const response = await chrome.runtime.sendMessage({ type: 'GHOST_REVOKE' });
      
      if (response.success) {
        this.authStatus = false;
        this.showSuccessMessage('Ghost Protocol deactivated. Your data has been erased.');
      } else {
        this.showErrorMessage('Failed to revoke authentication.');
      }
    } catch (error) {
      console.error('Ghost Dashboard: Revoke error:', error);
      this.showErrorMessage('Error revoking authentication.');
    } finally {
      document.getElementById('authButton').disabled = false;
      this.updateAuthUI();
    }
  }

  async saveSettings() {
    // Show saving status
    const saveStatus = document.getElementById('saveStatus');
    saveStatus.textContent = 'Saving...';
    saveStatus.className = 'save-status';
    saveStatus.style.opacity = '1';
    
    this.settings = {
      enabled: document.getElementById('emailEnabled').checked,
      frequency: document.getElementById('frequency').value,
      primarySendTime: document.getElementById('primarySendTime').value,
      smartDigest: document.getElementById('smartDigest').checked,
      quietHours: {
        start: document.getElementById('quietStart').value,
        end: document.getElementById('quietEnd').value
      },
      minVideosForEmail: parseInt(document.getElementById('minVideos').value),
      maxEmailsPerDay: parseInt(document.getElementById('maxEmails').value)
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_EMAIL_SETTINGS',
        settings: this.settings
      });

      if (response.success) {
        saveStatus.textContent = 'Settings saved successfully!';
        saveStatus.className = 'save-status success';
        console.log('YCN: Email preferences saved:', this.settings);
      } else {
        saveStatus.textContent = 'Failed to save settings';
        saveStatus.className = 'save-status error';
      }
    } catch (error) {
      console.error('Ghost Dashboard: Error saving settings:', error);
      saveStatus.textContent = 'Error saving settings';
      saveStatus.className = 'save-status error';
    }
    
    // Hide status after 3 seconds
    setTimeout(() => {
      saveStatus.style.opacity = '0';
    }, 3000);
  }

  async sendTestEmail() {
    if (!this.authStatus) {
      this.showAuthPrompt();
      return;
    }

    const testButton = document.getElementById('testEmail');
    const originalText = testButton.textContent;
    testButton.disabled = true;
    testButton.textContent = 'Sending...';

    try {
      // Generate sample test data
      const testVideos = this.generateTestVideoData();
      
      // Send test email via background script
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_TEST_EMAIL',
        videos: testVideos,
        emailType: this.settings.frequency
      });

      if (response && response.success) {
        this.showSuccessMessage('Test email sent successfully! Check your inbox.');
      } else {
        this.showErrorMessage('Failed to send test email. Check console for details.');
      }
    } catch (error) {
      console.error('Ghost Dashboard: Test email error:', error);
      this.showErrorMessage('Error sending test email: ' + error.message);
    } finally {
      testButton.disabled = false;
      testButton.textContent = originalText;
    }
  }

  showEmailPreview() {
    const modal = document.getElementById('emailPreviewModal');
    const iframe = document.getElementById('emailPreviewFrame');
    
    // Generate sample test data
    const testVideos = this.generateTestVideoData();
    const testUser = {
      name: 'Test User',
      emailHash: 'test_hash_preview'
    };

    // Generate email HTML
    try {
      // Create a temporary EmailTemplates instance
      const templates = {
        generateVideoNotificationEmail: (videos, user, type) => {
          const emailType = type || this.settings.frequency;
          const subject = `YouTube Channel Notifier: ${videos.length} new video${videos.length > 1 ? 's' : ''}`;
          
          let html = this.generatePreviewEmailHTML(videos, user, emailType);
          return { html, subject };
        }
      };

      const { html } = templates.generateVideoNotificationEmail(testVideos, testUser, this.settings.frequency);
      
      // Create blob URL for preview
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframe.src = url;
      
      modal.style.display = 'flex';
    } catch (error) {
      console.error('Ghost Dashboard: Preview error:', error);
      this.showErrorMessage('❌ Error generating preview');
    }
  }

  hideEmailPreview() {
    const modal = document.getElementById('emailPreviewModal');
    const iframe = document.getElementById('emailPreviewFrame');
    
    modal.style.display = 'none';
    if (iframe.src) {
      URL.revokeObjectURL(iframe.src);
      iframe.src = '';
    }
  }

  generateTestVideoData() {
    return [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Amazing React Tutorial: Build a Complete App in 2025',
        channelName: 'Code with Confidence',
        channelId: 'UC123456789',
        publishedAt: Date.now() - 30000,
        isNewChannel: false
      },
      {
        videoId: 'jNQXAC9IVRw',
        title: 'JavaScript ES2025 Features You Need to Know',
        channelName: 'JavaScript Mastery',
        channelId: 'UC987654321',
        publishedAt: Date.now() - 120000,
        isNewChannel: false
      },
      {
        videoId: 'ZXsQAXx_ao0',
        title: 'Chrome Extensions: Advanced Techniques & Best Practices',
        channelName: 'WebDev Pro',
        channelId: 'UC456789123',
        publishedAt: Date.now() - 300000,
        isNewChannel: true
      }
    ];
  }

  generatePreviewEmailHTML(videos, user, type) {
    const greeting = this.getPersonalizedGreeting(user, type);
    const videoCards = videos.map(video => this.createVideoCard(video)).join('');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Channel Notifier - Preview</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f8f9fa 0%, #fafbfc 50%, #f5f6f8 100%); color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; padding: 28px 32px; text-align: left; position: relative; overflow: hidden; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.95; }
    .summary { padding: 20px 30px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
    .badge { background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .content { padding: 8px; }
    .video-card { margin: 16px; padding: 20px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%); border-radius: 16px; border: 1px solid rgba(0, 0, 0, 0.04); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.5); display: flex; gap: 20px; align-items: flex-start; }
    .video-thumbnail { width: 120px; height: 67px; background: linear-gradient(45deg, oklch(55.3% 0.013 58.071), oklch(45.3% 0.013 58.071)); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid rgba(255, 255, 255, 0.3); flex-shrink: 0; }
    .video-info { flex: 1; }
    .video-title { margin: 0 0 12px 0; font-size: 16px; font-weight: 600; line-height: 1.4; color: #1a202c; letter-spacing: -0.01em; }
    .channel-name { margin: 0 0 10px 0; font-size: 11px; color: oklch(55.3% 0.013 58.071); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .watch-btn { display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; text-decoration: none; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1); letter-spacing: 0.01em; }
    .cta { padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
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
      
      <div class="header">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%); pointer-events: none;"></div>
        <div style="position: relative;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: white; letter-spacing: -0.02em;">New Videos Available</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">${greeting}</p>
        </div>
      </div>
      
      <div class="content">
        ${videoCards}
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
</body>
</html>`;
  }

  createVideoCard(video) {
    return `
    <div class="video-card">
      <div class="video-thumbnail">
        <img src="https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg" 
             alt="${this.escapeHtml(video.title)}"
             style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">
      </div>
      <div class="video-info">
        <div style="display: inline-block; background: linear-gradient(135deg, oklch(95% 0.003 58.071) 0%, oklch(93% 0.005 58.071) 100%); padding: 4px 10px; border-radius: 8px; margin-bottom: 8px;">
          <span class="channel-name">${this.escapeHtml(video.channelName)}${video.isNewChannel ? ' • NEW!' : ''}</span>
        </div>
        <h3 class="video-title">${this.escapeHtml(video.title)}</h3>
        <div>
          <a href="https://www.youtube.com/watch?v=${video.videoId}" class="watch-btn">Watch Video →</a>
          <span style="color: oklch(65.3% 0.013 58.071); font-size: 12px; margin-left: 12px;">
            ${this.getRelativeTime(video.publishedAt)}
          </span>
        </div>
      </div>
    </div>`;
  }

  getPersonalizedGreeting(user, type) {
    const hour = new Date().getHours();
    const name = user.name ? user.name.split(' ')[0] : 'there';
    
    if (type === 'weekend_digest') {
      return `Happy weekend${name !== 'Test' ? `, ${name}` : ''}! Time to catch up on your favorite creators`;
    }
    
    if (hour < 12) {
      return `Good morning${name !== 'Test' ? `, ${name}` : ''}! Here's what's new`;
    } else if (hour < 17) {
      return `Good afternoon${name !== 'Test' ? `, ${name}` : ''}! Take a break with these videos`;
    } else {
      return `Good evening${name !== 'Test' ? `, ${name}` : ''}! Perfect time to unwind`;
    }
  }

  getEmailTypeBadge(type) {
    const badges = {
      instant: '⚡ Instant Update',
      daily_evening: '🌙 Evening Digest',
      weekend_digest: '🎉 Weekend Special',
      daily: '📬 Daily Summary'
    };
    return badges[type] || badges.daily_evening;
  }

  getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  async runEmailDiagnostics() {
    const diagnosticsBtn = document.getElementById('runDiagnostics');
    const originalText = diagnosticsBtn.textContent;
    diagnosticsBtn.disabled = true;
    diagnosticsBtn.textContent = 'Running...';

    try {
      if (typeof EmailDebugger === 'undefined') {
        throw new Error('EmailDebugger not available');
      }

      const emailDebugger = new EmailDebugger();
      const results = await emailDebugger.runDiagnostics();
      
      this.showDebugResults(results);
    } catch (error) {
      console.error('Ghost Dashboard: Diagnostics error:', error);
      this.showErrorMessage('Error running diagnostics: ' + error.message);
    } finally {
      diagnosticsBtn.disabled = false;
      diagnosticsBtn.textContent = originalText;
    }
  }

  showDebugResults(results) {
    const modal = document.getElementById('debugModal');
    const resultsDiv = document.getElementById('debugResults');
    
    // Format results as HTML
    let html = `
      <div style="margin-bottom: 20px;">
        <h4>📊 Summary</h4>
        <div style="background: rgba(0,255,0,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
          ✅ Passed: ${results.summary.passed}
        </div>
        <div style="background: rgba(255,255,0,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
          ⚠️ Warnings: ${results.summary.warnings}
        </div>
        <div style="background: rgba(255,0,0,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
          ❌ Failed: ${results.summary.failed}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4>📋 Detailed Results</h4>
    `;

    results.tests.forEach(test => {
      const statusColor = test.status === 'PASS' ? '#e11d48' : 
                         test.status === 'WARN' ? '#ffc107' : '#dc3545';
      const statusIcon = test.status === 'PASS' ? '✅' : 
                        test.status === 'WARN' ? '⚠️' : '❌';

      html += `
        <div style="border: 1px solid ${statusColor}; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <h5 style="margin: 0 0 10px 0; color: ${statusColor};">
            ${statusIcon} ${test.name}
          </h5>
          <div style="margin: 10px 0;">
            ${test.details.map(detail => `<div>${detail}</div>`).join('')}
          </div>
          ${test.errors.length > 0 ? `
            <div style="background: rgba(255,0,0,0.1); padding: 10px; border-radius: 4px; margin-top: 10px;">
              <strong>Errors:</strong><br>
              ${test.errors.map(error => `<div style="color: #ff6b6b;">${error}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `
      </div>
      <div style="margin-top: 20px; font-size: 12px; color: #888;">
        Generated: ${new Date(results.timestamp).toLocaleString()}
      </div>
    `;

    resultsDiv.innerHTML = html;
    modal.style.display = 'flex';
    
    // Store results for copying
    this.lastDiagnosticResults = results;
  }

  hideDebugModal() {
    const modal = document.getElementById('debugModal');
    modal.style.display = 'none';
  }

  async initializeEmailPreferences() {
    try {
      // Check if email preferences exist, if not create defaults
      const result = await chrome.storage.local.get(['emailPreferences']);
      if (!result.emailPreferences) {
        console.log('YCN: Initializing default email preferences');
        await chrome.storage.local.set({ emailPreferences: this.settings });
      }
    } catch (error) {
      console.warn('YCN: Error initializing email preferences:', error);
    }
  }

  copyDebugResults() {
    if (!this.lastDiagnosticResults) {
      this.showErrorMessage('No diagnostic results to copy');
      return;
    }

    const results = this.lastDiagnosticResults;
    const textOutput = `
YouTube Channel Notifier - Email System Diagnostics
==================================================

Summary:
✅ Passed: ${results.summary.passed}
⚠️ Warnings: ${results.summary.warnings}  
❌ Failed: ${results.summary.failed}

Detailed Results:
${results.tests.map(test => `
${test.status === 'PASS' ? '✅' : test.status === 'WARN' ? '⚠️' : '❌'} ${test.name}
${test.details.map(detail => `  - ${detail}`).join('\n')}
${test.errors.length > 0 ? `  Errors:\n${test.errors.map(error => `    • ${error}`).join('\n')}` : ''}
`).join('\n')}

Generated: ${new Date(results.timestamp).toLocaleString()}
`.trim();

    navigator.clipboard.writeText(textOutput).then(() => {
      this.showSuccessMessage('Diagnostic results copied to clipboard');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textOutput;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showSuccessMessage('Diagnostic results copied to clipboard');
    });
  }

  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 40px;
      right: 40px;
      padding: 20px 28px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      background: ${type === 'success' ? 
        'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)' : 
        'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)'};
      color: ${type === 'success' ? 'oklch(44.4% 0.011 73.639)' : '#dc3545'};
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6);
      border: 1px solid ${type === 'success' ? 'rgba(225, 29, 72, 0.2)' : 'rgba(220, 53, 69, 0.2)'};
      backdrop-filter: blur(20px) saturate(1.1);
      letter-spacing: -0.01em;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  updateUI() {
    const demoSection = document.getElementById('demoSection');
    if (window.location.search.includes('demo=true')) {
      demoSection.style.display = 'block';
      this.startDemoAnimations();
    }
  }

  startDemoAnimations() {
    const hashDemo = document.getElementById('hashDemo');
    const originalHash = hashDemo.textContent;
    
    setInterval(() => {
      const chars = '0123456789abcdef';
      let newHash = originalHash.substring(0, 6);
      for (let i = 0; i < 2; i++) {
        newHash += chars[Math.floor(Math.random() * chars.length)];
      }
      newHash += '...';
      hashDemo.textContent = newHash;
    }, 3000);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

new GhostDashboard();