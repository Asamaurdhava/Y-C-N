class YCNDashboard {
  constructor() {
    this.channels = {};
    this.currentFilter = 'all';
    this.previousCounts = {};
    this.notificationQueue = new Set();
    this.updateInterval = null;
    
    // Initialize intelligence engines
    this.relationshipCalculator = new RelationshipScoreCalculator();
    this.recommendationEngine = new RecommendationEngine();
    this.profileAnalyzer = new UserProfileAnalyzer();
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.setupNavigationListeners();
    this.render();
    
    // Start with more responsive updates
    this.startDataUpdates();
    
    // Listen for storage changes from other tabs/content scripts
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.channels) {
        this.handleStorageChange(changes.channels);
      }
    });
    
    // Handle tab visibility changes
    this.setupVisibilityHandling();
  }

  startDataUpdates() {
    // More frequent updates for better responsiveness
    this.updateInterval = setInterval(() => {
      this.loadData();
    }, 500); // Update every 500ms for real-time feel
  }

  stopDataUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('YCN: Dashboard tab hidden - reducing update frequency');
        this.stopDataUpdates();
        // Slower updates when hidden
        this.updateInterval = setInterval(() => {
          this.loadData();
        }, 30000); // 30 seconds when hidden
      } else {
        console.log('YCN: Dashboard tab visible - increasing update frequency');
        this.stopDataUpdates();
        this.startDataUpdates(); // Back to 2-second updates
        // Immediately update when tab becomes visible
        this.loadData();
      }
    });

    // Handle page focus/blur
    window.addEventListener('focus', () => {
      console.log('YCN: Dashboard focused - refreshing data');
      this.loadData();
    });

    window.addEventListener('beforeunload', () => {
      this.stopDataUpdates();
    });
  }

  async loadData() {
    try {
      // Test connection to extension first
      await this.testExtensionConnection();
      
      const result = await chrome.storage.local.get(['channels']);
      const newChannels = result.channels || {};
      
      // Check for count increases and channels reaching 10
      for (const [channelId, channel] of Object.entries(newChannels)) {
        const prevCount = this.previousCounts[channelId] || 0;
        const currentCount = channel.count || 0;
        
        // Animate counter if count increased
        if (currentCount > prevCount && this.previousCounts[channelId] !== undefined) {
          this.animateCounter(channelId, prevCount, currentCount);
        }
        
        // Auto-prompt when channel reaches 10 videos
        if (currentCount >= 10 && prevCount < 10 && !channel.approved && !channel.denied && !channel.askedPermission) {
          this.showPermissionPrompt(channelId, channel);
          channel.askedPermission = true;
        }
        
        this.previousCounts[channelId] = currentCount;
      }
      
      // Calculate relationship scores for all channels
      this.updateRelationshipScores(newChannels);
      
      this.channels = newChannels;
      // Only update stats and specific channel content, preserve expanded states
      this.renderStats();
      this.updateChannelContent();
      this.updateConnectionStatus(true);
    } catch (error) {
      console.warn('YCN: Error loading dashboard data:', error);
      this.updateConnectionStatus(false);
    }
  }

  async testExtensionConnection() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalid');
      }
      // Test storage access
      await chrome.storage.local.get(['test']);
    } catch (error) {
      throw new Error(`Extension connection failed: ${error.message}`);
    }
  }

  updateRelationshipScores(channels) {
    try {
      const now = Date.now();
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes
      
      for (const [channelId, channel] of Object.entries(channels)) {
        if (channel.count > 0) {
          // Check if we need to recalculate (cache for 5 minutes)
          const lastUpdate = channel.relationship?.lastScoreUpdate || 0;
          const needsUpdate = !channel.relationship || (now - lastUpdate) > cacheTimeout;
          
          if (needsUpdate) {
            const relationshipData = this.relationshipCalculator.calculateScore(channel);
            
            // Update the channel's relationship data
            if (!channel.relationship) {
              channel.relationship = {};
            }
            
            channel.relationship.score = relationshipData.score;
            channel.relationship.trend = relationshipData.trend;
            channel.relationship.badge = relationshipData.badge;
            channel.relationship.lastScoreUpdate = now;
            channel.relationship.factors = relationshipData.factors;
          }
        }
      }
    } catch (error) {
      console.warn('YCN: Error updating relationship scores:', error);
    }
  }

  updateConnectionStatus(isConnected) {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
      if (isConnected) {
        // Normal operation
        if (!lastUpdatedEl.textContent.includes('Updated')) {
          lastUpdatedEl.textContent = 'Live updates active';
        }
      } else {
        lastUpdatedEl.textContent = 'Connection lost - reload page';
        lastUpdatedEl.style.color = '#ff6b6b';
      }
    }
  }

  handleStorageChange(channelsChange) {
    try {
      if (channelsChange.newValue) {
        const newChannels = channelsChange.newValue;
        const oldChannels = this.channels;
        
        // Check for changes and add visual feedback
        for (const [channelId, newChannel] of Object.entries(newChannels)) {
          const oldChannel = oldChannels[channelId];
          
          // If count increased, show visual update
          if (!oldChannel || newChannel.count > oldChannel.count) {
            this.showUpdateNotification(newChannel);
          }
        }
        
        this.channels = newChannels;
        this.render();
        this.flashUpdateIndicator();
        this.updateLastUpdatedTime();
      }
    } catch (error) {
      console.warn('YCN: Error handling storage change:', error);
    }
  }

  showUpdateNotification(channel) {
    // Create a brief flash notification
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    
    const updateIcon = document.createElement('span');
    updateIcon.className = 'update-icon';
    updateIcon.textContent = '↗';
    
    const updateText = document.createElement('span');
    updateText.className = 'update-text';
    updateText.textContent = `${channel.name}: ${channel.count} videos tracked!`;
    
    notification.appendChild(updateIcon);
    notification.appendChild(updateText);
    
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  flashUpdateIndicator() {
    // Add a subtle flash to the header to indicate update
    const header = document.querySelector('.header');
    if (header) {
      header.classList.add('updated');
      setTimeout(() => {
        header.classList.remove('updated');
      }, 1000);
    }
  }

  updateLastUpdatedTime() {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      lastUpdatedEl.textContent = `Updated ${timeStr}`;
      
      // Reset to "Live updates active" after 10 seconds
      setTimeout(() => {
        if (lastUpdatedEl) {
          lastUpdatedEl.textContent = 'Live updates active';
        }
      }, 10000);
    }
  }

  setupEventListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.renderChannels();
      });
    });


    const exportData = document.getElementById('exportData');
    if (exportData) {
      exportData.addEventListener('click', () => {
        this.exportData();
      });
    }

    const storageViewer = document.getElementById('storageViewer');
    if (storageViewer) {
      storageViewer.addEventListener('click', () => {
        // Open storage viewer in a new tab
        chrome.tabs.create({ 
          url: chrome.runtime.getURL('src/pages/storage-viewer.html') 
        });
      });
    }

    const clearData = document.getElementById('clearData');
    if (clearData) {
      clearData.addEventListener('click', () => {
        this.clearData();
      });
    }
  }

  render() {
    this.renderStats();
    this.renderChannels();
    this.renderSettings();
  }
  
  updateChannelContent() {
    // Save current expanded states
    const expandedVideos = new Set();
    document.querySelectorAll('.watched-videos-list').forEach(list => {
      if (list.style.display !== 'none') {
        const channelId = list.id.replace('videos-', '');
        expandedVideos.add(channelId);
      }
    });
    
    // Re-render channels
    this.renderChannels();
    
    // Restore expanded states
    expandedVideos.forEach(channelId => {
      const videosList = document.getElementById(`videos-${channelId}`);
      const toggleBtn = document.querySelector(`.toggle-videos-btn[data-channel="${channelId}"]`);
      if (videosList && toggleBtn) {
        videosList.style.display = 'block';
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▲';
        }
      }
    });
  }

  renderStats() {
    const channels = Object.values(this.channels);
    const total = channels.length;
    const approved = channels.filter(c => c.approved).length;
    const ready = channels.filter(c => c.count >= 10 && !c.approved && !c.denied).length;

    const totalEl = document.getElementById('totalChannels');
    const approvedEl = document.getElementById('approvedChannels');
    const readyEl = document.getElementById('readyChannels');
    
    // Check if values changed and add animation
    if (totalEl && totalEl.textContent !== total.toString()) {
      totalEl.classList.add('updating');
      totalEl.textContent = total;
      setTimeout(() => totalEl.classList.remove('updating'), 600);
    }
    
    if (approvedEl && approvedEl.textContent !== approved.toString()) {
      approvedEl.classList.add('updating');
      approvedEl.textContent = approved;
      setTimeout(() => approvedEl.classList.remove('updating'), 600);
    }
    
    if (readyEl && readyEl.textContent !== ready.toString()) {
      readyEl.classList.add('updating');
      readyEl.textContent = ready;
      setTimeout(() => readyEl.classList.remove('updating'), 600);
    }
    
    // Set values if elements don't have content yet
    if (totalEl && !totalEl.textContent) totalEl.textContent = total;
    if (approvedEl && !approvedEl.textContent) approvedEl.textContent = approved;
    if (readyEl && !readyEl.textContent) readyEl.textContent = ready;
  }

  renderChannels() {
    const channelsList = document.getElementById('channelsList');
    if (!channelsList) {
      console.warn('YCN: channelsList element not found');
      return;
    }
    
    const filteredChannels = this.getFilteredChannels();
    
    if (filteredChannels.length === 0) {
      // Clear existing content
      channelsList.innerHTML = '';
      
      // Create no-data container
      const noDataDiv = document.createElement('div');
      noDataDiv.className = 'no-data';
      noDataDiv.id = 'noData';
      
      const title = document.createElement('h3');
      title.textContent = '👋 Your YouTube journey starts here!';
      
      const p1 = document.createElement('p');
      p1.textContent = "I'll quietly learn about your viewing habits as you watch videos.";
      
      const p2 = document.createElement('p');
      p2.textContent = "When I notice you love a channel (10+ videos with 50%+ watched), I'll ask if you want notifications.";
      
      const p3 = document.createElement('p');
      p3.className = 'no-data-subtitle';
      p3.textContent = "No tracking, no creepiness – just helping you stay connected to creators you actually care about.";
      
      noDataDiv.appendChild(title);
      noDataDiv.appendChild(p1);
      noDataDiv.appendChild(p2);
      noDataDiv.appendChild(p3);
      
      channelsList.appendChild(noDataDiv);
      return;
    }
    
    const channelsHtml = filteredChannels.map(([channelId, channel]) => {
      return this.renderChannelCard(channelId, channel);
    }).join('');
    
    // Use safe DOM manipulation instead of innerHTML
    channelsList.innerHTML = channelsHtml; // Note: channelsHtml is generated from escapeHtml() sanitized content
    
    this.attachChannelEventListeners();
  }

  getFilteredChannels() {
    const entries = Object.entries(this.channels);
    
    let filteredEntries;
    switch (this.currentFilter) {
      case 'ready':
        filteredEntries = entries.filter(([_, channel]) => 
          channel.count >= 10 && !channel.approved && !channel.denied
        );
        break;
      case 'approved':
        filteredEntries = entries.filter(([_, channel]) => channel.approved);
        break;
      case 'tracking':
        filteredEntries = entries.filter(([_, channel]) => 
          channel.count < 10 && !channel.denied
        );
        break;
      default:
        filteredEntries = entries;
    }
    
    // Sort alphabetically by channel name (case-insensitive)
    return filteredEntries.sort((a, b) => {
      const nameA = (a[1].name || '').toLowerCase();
      const nameB = (b[1].name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  renderChannelCard(channelId, channel) {
    const progress = Math.min((channel.count / 10) * 100, 100);
    const status = this.getChannelStatus(channel);
    const lastVideo = channel.lastVideo ? 
      new Date(channel.lastVideo.timestamp).toLocaleDateString() : 'Never';
    
    // Get list of watched videos
    const watchedVideos = channel.watchedVideos || [];
    const hasWatchedVideos = watchedVideos.length > 0;

    return `
      <div class="channel-card ${status.class}" data-channel-id="${channelId}">
        <div class="channel-header">
          <h3 class="channel-name">${this.escapeHtml(channel.name)}</h3>
          <div class="channel-status ${status.class}">
            ${status.text}
          </div>
        </div>
        
        <div class="channel-content">
          <div class="current-video-section">
            <div class="section-label">Currently Playing</div>
            <div class="current-video-box">
              ${channel.currentVideo ? `
                <div class="video-playing-indicator"></div>
                <div class="current-video-info">
                  <div class="current-video-title">${this.escapeHtml(channel.currentVideo.title)}</div>
                  <div class="current-video-meta">Now Playing</div>
                </div>
              ` : `
                <div class="no-video-placeholder">
                  <span class="placeholder-icon">⏸</span>
                  <span class="placeholder-text">No video currently playing</span>
                </div>
              `}
            </div>
          </div>
          
          <div class="relationship-section">
            <div class="section-label">Channel Relationship</div>
            <div class="relationship-box">
              ${this.renderRelationshipIndicator(channel)}
            </div>
          </div>
          
          <div class="counter-section">
            <div class="section-label">Progress Tracker</div>
            <div class="counter-box">
              <div class="counter-display" id="counter-${channelId}">
                <span class="counter-number">${channel.count}</span>
                <span class="counter-total">/10</span>
              </div>
              <div class="counter-label">videos crossed 50%</div>
              ${channel.count >= 10 ? `
                <div class="milestone-badge ${channel.approved ? 'approved' : 'ready'}">
                  ${channel.approved ? 'Active' : 'Goal Reached!'}
                </div>
              ` : `
                <div class="progress-ring">
                  <svg width="80" height="80">
                    <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/>
                    <circle cx="40" cy="40" r="35" fill="none" stroke="var(--primary-color)" stroke-width="4"
                            stroke-dasharray="${progress * 2.2} 220" stroke-dashoffset="0"
                            transform="rotate(-90 40 40)"/>
                  </svg>
                  <div class="progress-percentage">${Math.round(progress)}%</div>
                </div>
              `}
            </div>
          </div>
          
          ${watchedVideos.length > 0 ? `
            <div class="watched-videos-section">
              <div class="section-label">Counted Videos</div>
              <button class="view-videos-btn" data-channel="${channelId}" data-channel-name="${this.escapeHtml(channel.name)}">
                <span class="videos-count">${watchedVideos.length}</span>
                <span class="videos-text">${watchedVideos.length === 1 ? 'video' : 'videos'}</span>
                <svg class="view-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
        
        <div class="channel-actions">
          ${this.renderChannelActions(channelId, channel)}
        </div>
      </div>
    `;
  }

  getChannelStatus(channel) {
    if (channel.approved) {
      return { text: 'Notifications ON', class: 'approved' };
    } else if (channel.denied) {
      return { text: 'Notifications OFF', class: 'denied' };
    } else if (channel.count >= 10) {
      return { text: 'Ready for approval', class: 'ready' };
    } else {
      return { text: `Tracking (${channel.count}/10)`, class: 'tracking' };
    }
  }

  renderRelationshipIndicator(channel) {
    const relationship = channel.relationship;
    if (!relationship) {
      return `
        <div class="relationship-placeholder">
          <span class="relationship-icon"></span>
          <span class="relationship-text">Building relationship...</span>
        </div>
      `;
    }

    const score = relationship.score || 0;
    const badge = relationship.badge || 'New';
    const trend = relationship.trend || 'new';
    
    // Get trend indicator
    const trendIndicator = trend === 'growing' ? '↗' : trend === 'declining' ? '↘' : '→';
    
    return `
      <div class="relationship-indicator">
        <div class="relationship-score-circle">
          <div class="relationship-score">${score}</div>
          <div class="relationship-score-label">Score</div>
        </div>
        <div class="relationship-details">
          <div class="relationship-badge">${badge}</div>
          <div class="relationship-trend">
            <span class="trend-icon">${trendIndicator}</span>
            <span class="trend-text">${trend}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderChannelActions(channelId, channel) {
    const relationshipScore = channel.relationship?.score || 0;
    const relationshipBadge = channel.relationship?.badge || '';
    
    if (channel.approved) {
      return `
        <button class="btn danger-btn" data-action="unapprove" data-channel="${channelId}">
          💔 Remove from Inner Circle
        </button>
      `;
    } else if (channel.denied) {
      return `
        <button class="btn primary-btn" data-action="approve" data-channel="${channelId}">
          💕 Add to Favorites
        </button>
      `;
    } else if (channel.count >= 10) {
      const actionText = relationshipScore >= 80 
        ? 'Join Your Inner Circle'
        : relationshipScore >= 60 
          ? 'Add to Favorites' 
          : 'Enable Notifications';
          
      return `
        <button class="btn primary-btn" data-action="approve" data-channel="${channelId}">
          ${actionText}
        </button>
        <button class="btn secondary-btn" data-action="deny" data-channel="${channelId}">
          Not Interested
        </button>
      `;
    } else {
      return `
        <button class="btn secondary-btn" data-action="remove" data-channel="${channelId}">
          Stop Tracking
        </button>
      `;
    }
  }

  renderSettings() {
    // Settings UI has been simplified - no dynamic rendering needed
    // Export and Clear buttons are handled by event listeners only
  }

  attachChannelEventListeners() {
    // Add modal functionality for watched videos
    document.querySelectorAll('.view-videos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const channelId = btn.dataset.channel;
        const channelName = btn.dataset.channelName;
        const channel = this.channels[channelId];
        
        if (channel && channel.watchedVideos) {
          this.showVideosModal(channelId, channelName, channel);
        }
      });
    });
    
    const buttons = document.querySelectorAll('.channel-actions button');
    buttons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const channelId = e.target.dataset.channel;
        
        if (!action || !channelId) {
          console.warn('YCN: Missing action or channelId in button click');
          return;
        }
        
        try {
          switch(action) {
            case 'approve':
              await this.approveChannel(channelId);
              break;
            case 'unapprove':
              await this.unapproveChannel(channelId);
              break;
            case 'deny':
              await this.denyChannel(channelId);
              break;
            case 'remove':
              await this.removeChannel(channelId);
              break;
            default:
              console.warn('YCN: Unknown action:', action);
          }
        } catch (error) {
          console.warn('YCN: Error handling channel action:', error);
        }
      });
    });
  }

  async approveChannel(channelId) {
    try {
      if (this.channels[channelId]) {
        this.channels[channelId].approved = true;
        this.channels[channelId].denied = false;
        this.channels[channelId].approvedAt = Date.now();
        
        await chrome.storage.local.set({ channels: this.channels });
        
        chrome.runtime.sendMessage({
          type: 'APPROVE_CHANNEL',
          channelId: channelId
        });
        
        this.render();
      }
    } catch (error) {
      console.warn('YCN: Error approving channel:', error);
    }
  }

  async unapproveChannel(channelId) {
    try {
      if (this.channels[channelId]) {
        this.channels[channelId].approved = false;
        delete this.channels[channelId].approvedAt;
        
        await chrome.storage.local.set({ channels: this.channels });
        this.render();
      }
    } catch (error) {
      console.warn('YCN: Error unapproving channel:', error);
    }
  }

  async denyChannel(channelId) {
    try {
      if (this.channels[channelId]) {
        this.channels[channelId].denied = true;
        this.channels[channelId].approved = false;
        this.channels[channelId].deniedAt = Date.now();
        
        await chrome.storage.local.set({ channels: this.channels });
        
        chrome.runtime.sendMessage({
          type: 'DENY_CHANNEL',
          channelId: channelId
        });
        
        this.render();
      }
    } catch (error) {
      console.warn('YCN: Error denying channel:', error);
    }
  }

  async removeChannel(channelId) {
    try {
      if (confirm('Are you sure you want to stop tracking this channel? All data will be lost.')) {
        delete this.channels[channelId];
        await chrome.storage.local.set({ channels: this.channels });
        this.render();
      }
    } catch (error) {
      console.warn('YCN: Error removing channel:', error);
    }
  }


  exportData() {
    try {
      this.showExportModal();
    } catch (error) {
      console.warn('YCN: Error showing export options:', error);
      alert('Error showing export options. Please try again.');
    }
  }

  showExportModal() {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
      <div class="export-content">
        <div class="export-header">
          <h2>📦 Export Your Data</h2>
          <p>Take your YouTube relationships anywhere</p>
        </div>
        
        <div class="export-formats">
          <button class="export-format-btn" data-format="json">
            <div class="format-icon">📄</div>
            <div class="format-info">
              <div class="format-name">JSON Format</div>
              <div class="format-desc">Complete data for backup or other extensions</div>
            </div>
          </button>
          
          <button class="export-format-btn" data-format="csv">
            <div class="format-icon">CSV</div>
            <div class="format-info">
              <div class="format-name">CSV Spreadsheet</div>
              <div class="format-desc">Channel stats for analysis in Excel/Sheets</div>
            </div>
          </button>
          
          <button class="export-format-btn" data-format="opml">
            <div class="format-icon">🔗</div>
            <div class="format-info">
              <div class="format-name">OPML Feed List</div>
              <div class="format-desc">Import into RSS readers like Feedly</div>
            </div>
          </button>
          
          <button class="export-format-btn" data-format="urls">
            <div class="format-icon">📺</div>
            <div class="format-info">
              <div class="format-name">YouTube URLs</div>
              <div class="format-desc">Channel links for easy subscription</div>
            </div>
          </button>
        </div>
        
        <div class="export-actions">
          <button class="btn secondary-btn" id="export-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = e.currentTarget.dataset.format;
        this.performExport(format);
        modal.remove();
      });
    });

    document.getElementById('export-cancel').addEventListener('click', () => {
      modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  performExport(format) {
    try {
      let content, filename, mimeType;
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case 'json':
          content = this.generateJSON();
          filename = `ycn-data-${timestamp}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          content = this.generateCSV();
          filename = `ycn-channels-${timestamp}.csv`;
          mimeType = 'text/csv';
          break;
        case 'opml':
          content = this.generateOPML();
          filename = `ycn-feeds-${timestamp}.opml`;
          mimeType = 'text/x-opml';
          break;
        case 'urls':
          content = this.generateURLs();
          filename = `ycn-urls-${timestamp}.txt`;
          mimeType = 'text/plain';
          break;
        default:
          throw new Error('Unknown export format');
      }

      this.downloadFile(content, filename, mimeType);
    } catch (error) {
      console.warn('YCN: Error performing export:', error);
      alert(`Error exporting as ${format}. Please try again.`);
    }
  }

  generateJSON() {
    return JSON.stringify({
      channels: this.channels,
      exportDate: new Date().toISOString(),
      version: '2.0.0',
      format: 'json'
    }, null, 2);
  }

  generateCSV() {
    const headers = [
      'Channel Name',
      'Videos Watched', 
      'Relationship Score',
      'Relationship Badge',
      'Status',
      'First Seen',
      'Last Video',
      'Approved'
    ];

    // Sort channels alphabetically by name
    const sortedChannels = Object.values(this.channels).sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const rows = sortedChannels.map(channel => [
      this.escapeCSV(channel.name),
      channel.count,
      channel.relationship?.score || 0,
      this.escapeCSV(channel.relationship?.badge || 'New'),
      channel.approved ? 'Approved' : channel.denied ? 'Denied' : 'Tracking',
      new Date(channel.firstSeen).toLocaleDateString(),
      channel.lastVideo ? new Date(channel.lastVideo.timestamp).toLocaleDateString() : 'Never',
      channel.approved ? 'Yes' : 'No'
    ]);

    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }

  generateOPML() {
    let opml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    opml += '<opml version="2.0">\n';
    opml += '  <head>\n';
    opml += '    <title>YouTube Channel Notifier Feeds</title>\n';
    opml += `    <dateCreated>${new Date().toUTCString()}</dateCreated>\n`;
    opml += '  </head>\n';
    opml += '  <body>\n';

    // Sort channels alphabetically by name
    const sortedChannels = Object.entries(this.channels).sort((a, b) => {
      const nameA = (a[1].name || '').toLowerCase();
      const nameB = (b[1].name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const [channelId, channel] of sortedChannels) {
      if (channel.count >= 10) { // Only export channels with significant watching
        const channelUrl = channelId.startsWith('handle_') 
          ? `https://www.youtube.com/@${channelId.replace('handle_', '')}`
          : `https://www.youtube.com/channel/${channelId}`;
        
        const feedUrl = channelId.startsWith('handle_')
          ? `https://www.youtube.com/feeds/videos.xml?user=${channelId.replace('handle_', '')}`
          : `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

        opml += `    <outline text="${this.escapeXml(channel.name)}" `;
        opml += `title="${this.escapeXml(channel.name)}" `;
        opml += `type="rss" `;
        opml += `xmlUrl="${feedUrl}" `;
        opml += `htmlUrl="${channelUrl}" `;
        opml += `description="YouTube channel tracked by YCN (${channel.count} videos watched)" />\n`;
      }
    }

    opml += '  </body>\n';
    opml += '</opml>';
    return opml;
  }

  generateURLs() {
    const urls = [];
    urls.push('# YouTube Channel URLs from YouTube Channel Notifier');
    urls.push(`# Exported on ${new Date().toLocaleString()}`);
    urls.push('# Channels you watch frequently:\n');

    // Sort channels alphabetically by name
    const sortedChannels = Object.entries(this.channels).sort((a, b) => {
      const nameA = (a[1].name || '').toLowerCase();
      const nameB = (b[1].name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const [channelId, channel] of sortedChannels) {
      if (channel.count >= 5) { // Export channels with moderate watching
        const channelUrl = channelId.startsWith('handle_') 
          ? `https://www.youtube.com/@${channelId.replace('handle_', '')}`
          : `https://www.youtube.com/channel/${channelId}`;

        const relationshipInfo = channel.relationship?.badge || 'Tracked';
        urls.push(`# ${channel.name} - ${relationshipInfo} (${channel.count} videos)`);
        urls.push(channelUrl);
        urls.push('');
      }
    }

    return urls.join('\n');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  escapeCSV(str) {
    if (typeof str !== 'string') return str;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  escapeXml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async clearData() {
    try {
      const confirmed = confirm(
        'Are you sure you want to clear all data? This cannot be undone.\n\n' +
        'This will remove:\n' +
        '• All tracked channels\n' +
        '• All notification approvals\n' +
        '• All watch history'
      );
      
      if (confirmed) {
        await chrome.storage.local.clear();
        this.channels = {};
        this.render();
        alert('All data cleared successfully.');
      }
    } catch (error) {
      console.warn('YCN: Error clearing data:', error);
      alert('Error clearing data. Please try again.');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  animateCounter(channelId, oldCount, newCount) {
    setTimeout(() => {
      const counterElement = document.getElementById(`counter-${channelId}`);
      if (!counterElement) return;
      
      const numberSpan = counterElement.querySelector('.counter-number');
      if (!numberSpan) return;
      
      // Add animation class
      counterElement.classList.add('counter-updating');
      
      // Create ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'counter-ripple';
      ripple.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(40, 167, 69, 0.3), transparent);
        animation: rippleExpand 1s ease-out;
        pointer-events: none;
      `;
      counterElement.style.position = 'relative';
      counterElement.appendChild(ripple);
      
      // Animate the number change with easing
      let current = oldCount;
      const duration = 800;
      const startTime = Date.now();
      const diff = newCount - oldCount;
      
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        current = oldCount + (diff * easeOutQuart);
        
        if (progress >= 1) {
          current = newCount;
          clearInterval(timer);
          
          // Flash effect when done
          counterElement.classList.add('counter-flash');
          
          // Milestone celebration for reaching 10
          if (newCount === 10 && oldCount < 10) {
            this.celebrateMilestone(counterElement);
          }
          
          setTimeout(() => {
            counterElement.classList.remove('counter-updating', 'counter-flash');
            if (ripple.parentNode) ripple.remove();
          }, 1000);
        }
        
        numberSpan.textContent = Math.floor(current);
      }, 16);
    }, 100);
  }
  
  celebrateMilestone(counterElement) {
    // Create particle effects
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: linear-gradient(135deg, #e11d48, #be185d);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: particleFly-${i} 1s ease-out forwards;
        pointer-events: none;
      `;
      
      // Dynamic keyframe for each particle
      const angle = (i * 45) * Math.PI / 180;
      const distance = 60;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes particleFly-${i} {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
      counterElement.appendChild(particle);
      
      setTimeout(() => {
        if (particle.parentNode) particle.remove();
        if (style.parentNode) style.remove();
      }, 1000);
    }
  }

  showVideosModal(channelId, channelName, channel) {
    // Remove any existing modal
    const existingModal = document.getElementById('videos-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'videos-modal';
    modal.className = 'videos-modal';
    
    const watchedVideos = channel.watchedVideos || [];
    
    modal.innerHTML = `
      <div class="videos-modal-content">
        <div class="videos-modal-header">
          <h3>${this.escapeHtml(channelName)}</h3>
          <p class="videos-modal-subtitle">Watched ${watchedVideos.length} videos</p>
          <button class="close-modal-btn" id="close-videos-modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="videos-modal-list">
          ${watchedVideos.slice().reverse().map((videoId, index) => {
            const videoData = channel.watchedVideoData && channel.watchedVideoData[videoId];
            const videoTitle = videoData ? videoData.title : videoId;
            const isLatest = channel.lastVideo && channel.lastVideo.id === videoId;
            const originalIndex = watchedVideos.length - index; // Show original numbering
            const crossDevice = videoData && videoData.crossDeviceDetected;
            
            let deviceIndicator = '';
            if (crossDevice) {
              deviceIndicator = '<span class="device-indicator cross-device" title="Started on mobile/other device, completed on desktop">📱</span>';
            }
            
            return `
              <div class="modal-video-item ${isLatest ? 'latest' : ''}">
                <span class="modal-video-number">${originalIndex}</span>
                <span class="modal-video-title">${this.escapeHtml(videoTitle)}</span>
                ${deviceIndicator}
                ${isLatest ? '<span class="modal-latest-badge">Latest</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('close-videos-modal').addEventListener('click', () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 300);
      }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 300);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  showPermissionPrompt(channelId, channel) {
    // Create modal overlay
    const existingModal = document.getElementById('permission-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'permission-modal';
    modal.className = 'permission-modal';
    modal.innerHTML = `
      <div class="permission-content">
        <div class="permission-icon">✓</div>
        <h2>Channel Milestone Reached!</h2>
        <p class="channel-highlight">${this.escapeHtml(channel.name)}</p>
        <p>You've watched <strong>10 videos</strong> from this channel!</p>
        <p>Would you like to receive notifications when they upload new videos?</p>
        
        <div class="permission-actions">
          <button class="btn primary-btn" id="approve-${channelId}">
            Yes, Notify Me!
          </button>
          <button class="btn secondary-btn" id="deny-${channelId}">
            No Thanks
          </button>
        </div>
        
        <p class="permission-note">You can always change this later in settings</p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById(`approve-${channelId}`).addEventListener('click', async () => {
      await this.approveChannel(channelId);
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    });
    
    document.getElementById(`deny-${channelId}`).addEventListener('click', async () => {
      await this.denyChannel(channelId);
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    });
    
    // Auto-save the asked permission state
    this.channels[channelId].askedPermission = true;
    chrome.storage.local.set({ channels: this.channels });
  }

  setupNavigationListeners() {
    // Navigation buttons for documentation
    const guideBtn = document.getElementById('guideBtn');
    const docsBtn = document.getElementById('docsBtn');
    
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/guide.html') });
      });
    }
    
    if (docsBtn) {
      docsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/documentation.html') });
      });
    }
  }
}

const dashboard = new YCNDashboard();