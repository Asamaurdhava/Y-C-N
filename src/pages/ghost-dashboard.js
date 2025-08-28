class GhostDashboard {
  constructor() {
    this.authStatus = false;
    this.settings = {
      enabled: false,
      frequency: 'instant',
      batchTime: '09:00',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    this.setupEventListeners();
    await this.loadSettings();
    this.updateUI();
  }

  async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GHOST_STATUS' });
      this.authStatus = response.authenticated;
      
      if (this.authStatus) {
        await this.loadPrivacyReport();
      }
      
      this.updateAuthUI();
    } catch (error) {
      console.error('Ghost Dashboard: Error checking auth status:', error);
    }
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
        <span>Universal Browser Support: <span style="color: #28a745;">✓</span></span>
      </div>
    `;

    // Show universal compatibility info if available
    if (report.universalCompatibility) {
      const compatibilityInfo = document.createElement('div');
      compatibilityInfo.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
        color: white;
        font-size: 12px;
      `;
      compatibilityInfo.innerHTML = `
        <strong><span style="color: #667eea;">◎</span> Universal Browser Support:</strong><br>
        ${report.universalCompatibility.supportedBrowsers.join(', ')}<br><br>
        <strong><span style="color: #667eea;">⚙</span> Authentication Methods:</strong><br>
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
    document.getElementById('emailEnabled').checked = this.settings.enabled;
    document.getElementById('frequency').value = this.settings.frequency;
    document.getElementById('batchTime').value = this.settings.batchTime;
    document.getElementById('quietHoursEnabled').checked = this.settings.quietHours.enabled;
    document.getElementById('quietStart').value = this.settings.quietHours.start;
    document.getElementById('quietEnd').value = this.settings.quietHours.end;

    this.toggleDailyTimeVisibility();
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

    document.getElementById('frequency').addEventListener('change', () => {
      this.toggleDailyTimeVisibility();
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
    this.settings = {
      enabled: document.getElementById('emailEnabled').checked,
      frequency: document.getElementById('frequency').value,
      batchTime: document.getElementById('batchTime').value,
      quietHours: {
        enabled: document.getElementById('quietHoursEnabled').checked,
        start: document.getElementById('quietStart').value,
        end: document.getElementById('quietEnd').value
      }
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_EMAIL_SETTINGS',
        settings: this.settings
      });

      if (response.success) {
        this.showSuccessMessage('Settings saved successfully!');
      } else {
        this.showErrorMessage('Failed to save settings.');
      }
    } catch (error) {
      console.error('Ghost Dashboard: Error saving settings:', error);
      this.showErrorMessage('Error saving settings.');
    }
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
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? 
        'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
        'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'};
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
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