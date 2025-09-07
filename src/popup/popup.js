document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements for better performance - make global for reuse
  window.popupElements = {
    openDashboard: document.getElementById('openDashboard'),
    openGhostProtocol: document.getElementById('openGhostProtocol'),
    currentVideoContent: document.getElementById('currentVideoContent'),
    currentVideoTitle: document.getElementById('currentVideoTitle'),
    channelCount: document.getElementById('channelCount'),
    approvedCount: document.getElementById('approvedCount')
  };
  
  await updateStats();
  await updateCurrentVideo();
  
  // Auto-refresh every 2 seconds for real-time updates
  setInterval(async () => {
    try {
      await updateCurrentVideo();
      await updateStats();
    } catch (error) {
      console.log('YCN Popup: Auto-refresh error:', error);
    }
  }, 2000);
  
  window.popupElements.openDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/dashboard.html') });
  });
  
  window.popupElements.openGhostProtocol.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/ghost-dashboard.html?demo=true') });
  });
  
  // Add check button after dashboard button
  const dashboardBtn = window.popupElements.openDashboard;
  const buttonsContainer = dashboardBtn.parentElement;
  
  const checkButton = document.createElement('button');
  checkButton.textContent = 'Check Now';
  checkButton.className = 'btn btn-check';
  
  checkButton.addEventListener('click', async () => {
    const originalText = checkButton.textContent;
    const originalClass = checkButton.className;
    
    checkButton.textContent = 'Checking...';
    checkButton.disabled = true;
    checkButton.style.opacity = '0.7';
    
    try {
      await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
      checkButton.textContent = 'Check Complete';
      checkButton.style.background = 'linear-gradient(135deg, var(--ruby-500), var(--ruby-600))';
      setTimeout(() => {
        checkButton.textContent = originalText;
        checkButton.disabled = false;
        checkButton.className = originalClass;
        checkButton.style.opacity = '';
        checkButton.style.background = '';
      }, 2000);
    } catch (error) {
      checkButton.textContent = 'Check Failed';
      setTimeout(() => {
        checkButton.textContent = originalText;
        checkButton.disabled = false;
        checkButton.className = originalClass;
        checkButton.style.opacity = '';
      }, 2000);
    }
  });
  
  // Insert after Ghost Protocol button
  const ghostBtn = window.popupElements.openGhostProtocol;
  buttonsContainer.insertBefore(checkButton, ghostBtn.nextSibling);
  
  // Add analytics button
  const analyticsButton = document.createElement('button');
  analyticsButton.textContent = 'Analytics';
  analyticsButton.className = 'btn btn-analytics';
  
  analyticsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/analytics.html') });
  });
  
  // Insert after check button
  buttonsContainer.insertBefore(analyticsButton, checkButton.nextSibling);
});

async function updateCurrentVideo() {
  try {
    // First check current tab status
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const isYouTube = currentTab && currentTab.url && currentTab.url.includes('youtube.com');
    const isYouTubeVideo = currentTab && currentTab.url && 
                          currentTab.url.includes('youtube.com/watch');
    
    const contentDiv = window.popupElements?.currentVideoContent || document.getElementById('currentVideoContent');
    const titleDiv = window.popupElements?.currentVideoTitle || document.getElementById('currentVideoTitle');
    
    // Update the title and indicator based on status
    if (!isYouTube) {
      // Not on YouTube at all
      titleDiv.innerHTML = `
        <span class="status-dot pulse-glow dot-red"></span>
        <span>Away from YouTube</span>
      `;
      contentDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon float">💤</div>
          <div class="empty-text">Open YouTube to start tracking</div>
        </div>
      `;
      return;
    } else if (!isYouTubeVideo) {
      // On YouTube but not watching a video
      titleDiv.innerHTML = `
        <span class="status-dot pulse-glow dot-green"></span>
        <span>On YouTube</span>
      `;
      contentDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon float">🏠</div>
          <div class="empty-text">Browsing YouTube</div>
        </div>
      `;
      return;
    } else {
      // Watching a video - will be updated with intelligent status
      titleDiv.innerHTML = `
        <span class="status-dot pulse-glow dot-yellow"></span>
        <span>Currently Playing</span>
      `;
    }
    
    // Extract video ID from URL
    const urlParams = new URLSearchParams(new URL(currentTab.url).search);
    const currentVideoId = urlParams.get('v');
    
    if (!currentVideoId) {
      contentDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon float">📺</div>
          <div class="empty-text">No video currently playing</div>
        </div>
      `;
      return;
    }
    
    // Get all channels data
    const result = await chrome.storage.local.get(['channels']);
    const channels = result.channels || {};
    
    // Find the channel that has this video as current
    let currentVideo = null;
    let currentChannel = null;
    
    for (const [channelId, channel] of Object.entries(channels)) {
      if (channel.currentVideo && channel.currentVideo.id === currentVideoId) {
        currentVideo = channel.currentVideo;
        currentChannel = channel;
        break;
      }
    }
    
    if (currentVideo && currentChannel) {
      // Get intelligent engagement data from content script
      let engagementData = null;
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_ENGAGEMENT_STATUS' });
        engagementData = response;
      } catch (error) {
        console.log('YCN Popup: Content script not ready for engagement data');
      }
      
      // Check if this video was already counted
      const watchedVideoData = currentChannel.watchedVideoData || {};
      const isAlreadyCounted = currentChannel.watchedVideos && 
                               currentChannel.watchedVideos.includes(currentVideo.id);
      const crossDevice = watchedVideoData[currentVideo.id]?.crossDeviceDetected;
      
      // Generate intelligent status
      const intelligentStatus = generateIntelligentStatus(engagementData, isAlreadyCounted, crossDevice);
      
      // Update title with intelligent status
      const titleStatus = getIntelligentTitleStatus(engagementData, isAlreadyCounted);
      titleDiv.innerHTML = `
        <span class="status-dot pulse-glow ${titleStatus.dotClass}"></span>
        <span>${titleStatus.text}</span>
      `;
      
      contentDiv.innerHTML = `
        <div class="video-card">
          <div class="video-title">${currentVideo.title}</div>
          <div class="video-meta">
            <span>📺</span>
            <span class="video-channel">${currentChannel.name}</span>
            ${intelligentStatus.badge}
          </div>
          ${intelligentStatus.progress ? `
            <div class="engagement-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${intelligentStatus.progress}%"></div>
              </div>
              <div class="progress-text">${intelligentStatus.progressText}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // Video is playing but not tracked yet
      const videoTitle = currentTab.title.replace(' - YouTube', '');
      contentDiv.innerHTML = `
        <div class="video-card">
          <div class="video-title">${videoTitle}</div>
          <div class="video-meta">
            <span class="status-dot pulse-glow dot-blue" style="width: 6px; height: 6px;"></span>
            <span class="video-channel">Tracking in progress...</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.warn('YCN: Error updating current video:', error);
    const contentDiv = window.popupElements?.currentVideoContent || document.getElementById('currentVideoContent');
    const titleDiv = window.popupElements?.currentVideoTitle || document.getElementById('currentVideoTitle');
    
    // Show offline/error state
    titleDiv.innerHTML = `
      <span class="status-dot pulse-glow dot-gray"></span>
      <span>Status Unknown</span>
    `;
    contentDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon float">❓</div>
        <div class="empty-text">Unable to check status</div>
      </div>
    `;
  }
}

function getIntelligentTitleStatus(engagementData, isAlreadyCounted) {
  if (isAlreadyCounted) {
    return { text: 'Video Counted ✓', dotClass: 'dot-green' };
  }
  
  if (!engagementData || !engagementData.isTracking) {
    return { text: 'Not Tracking', dotClass: 'dot-gray' };
  }
  
  const { engagementScore = 0, videoPaused = false } = engagementData;
  
  if (videoPaused) {
    return { text: 'Video Paused', dotClass: 'dot-yellow' };
  }
  
  if (engagementScore >= 60) {
    return { text: 'Ready to Count!', dotClass: 'dot-green' };
  } else if (engagementScore >= 40) {
    return { text: 'Almost There', dotClass: 'dot-blue' };
  } else if (engagementScore >= 20) {
    return { text: 'Building Progress', dotClass: 'dot-blue' };
  } else {
    return { text: 'Just Started', dotClass: 'dot-yellow' };
  }
}

function generateIntelligentStatus(engagementData, isAlreadyCounted, crossDevice) {
  if (isAlreadyCounted) {
    return {
      badge: `<span class="status-badge badge-counted">✓ Counted</span>`,
      progress: null,
      progressText: null
    };
  }
  
  if (!engagementData) {
    return {
      badge: `<span class="status-badge badge-learning">📊 Analyzing</span>`,
      progress: null,
      progressText: null
    };
  }
  
  const { 
    engagementScore = 0, 
    actualWatchedTime = 0, 
    crossDeviceDetected = false,
    sessionWatchedTime = 0,
    isTracking = false,
    skipped = 0
  } = engagementData;
  
  // Use cross-device aware progress
  const progress = Math.min(engagementScore, 100);
  const watchedTime = crossDeviceDetected ? sessionWatchedTime : actualWatchedTime;
  const deviceIcon = crossDeviceDetected ? '📱' : '💻';
  
  // Generate intelligent status based on progress
  let badge, progressText;
  
  if (progress >= 60) {
    badge = `<span class="status-badge badge-ready">${deviceIcon} Ready!</span>`;
    progressText = `${progress.toFixed(1)}% watched • Qualifying for count`;
  } else if (progress >= 40) {
    badge = `<span class="status-badge badge-close">${deviceIcon} Close</span>`;
    progressText = `${progress.toFixed(1)}% watched • ${(60 - progress).toFixed(1)}% more needed`;
  } else if (progress >= 20) {
    badge = `<span class="status-badge badge-progress">${deviceIcon} Tracking</span>`;
    progressText = `${progress.toFixed(1)}% watched • ${watchedTime.toFixed(0)}s engaged`;
  } else if (isTracking) {
    badge = `<span class="status-badge badge-starting">${deviceIcon} Starting</span>`;
    progressText = `${progress.toFixed(1)}% watched • Just started`;
  } else {
    badge = `<span class="status-badge badge-paused">⏸ Paused</span>`;
    progressText = `${progress.toFixed(1)}% watched • Resume to continue`;
  }
  
  // Add cross-device context
  if (crossDeviceDetected && progress > 0) {
    progressText += ' (desktop session)';
  }
  
  // Add skip warning if excessive
  if (skipped > 2) {
    progressText += ` • ${skipped} skips`;
  }
  
  return { badge, progress, progressText };
}

async function updateStats() {
  try {
    const result = await chrome.storage.local.get(['channels']);
    const channels = result.channels || {};
    
    let channelCount = 0;
    let approvedCount = 0;
    let readyCount = 0;
    
    for (const channel of Object.values(channels)) {
      channelCount++;
      if (channel.approved) {
        approvedCount++;
      } else if (channel.count >= 10) {
        readyCount++;
      }
    }
    
    const channelCountEl = window.popupElements?.channelCount || document.getElementById('channelCount');
    const approvedCountEl = window.popupElements?.approvedCount || document.getElementById('approvedCount');
    
    channelCountEl.textContent = channelCount;
    approvedCountEl.textContent = approvedCount;
    document.getElementById('readyCount').textContent = readyCount;
    
    const status = document.getElementById('status');
    if (readyCount > 0) {
      status.textContent = readyCount === 1 
        ? `💕 One channel wants to join your inner circle!`
        : `💕 ${readyCount} creators waiting to join your favorites!`;
      status.className = 'status-text status-ready';
    } else if (approvedCount > 0) {
      status.textContent = approvedCount === 1
        ? `Your favorite creator will keep you posted!`
        : `${approvedCount} beloved channels in your inner circle!`;
      status.className = 'status-text status-approved';
    } else if (channelCount > 0) {
      status.textContent = `Learning about your YouTube relationships...`;
      status.className = 'status-text status-learning';
    } else {
      status.textContent = `👋 Your YouTube journey starts here!`;
      status.className = 'status-text status-default';
    }
  } catch (error) {
    console.warn('YCN: Error updating popup stats:', error);
  }
}