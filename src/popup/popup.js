document.addEventListener('DOMContentLoaded', async () => {
  await updateStats();
  await updateCurrentVideo();
  
  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/dashboard.html') });
  });
  
  document.getElementById('openGhostProtocol').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/ghost-dashboard.html?demo=true') });
  });
  
  // Add check button after dashboard button
  const dashboardBtn = document.getElementById('openDashboard');
  const buttonsContainer = dashboardBtn.parentElement;
  
  const checkButton = document.createElement('button');
  checkButton.textContent = 'Check for New Videos';
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
  const ghostBtn = document.getElementById('openGhostProtocol');
  buttonsContainer.insertBefore(checkButton, ghostBtn.nextSibling);
});

async function updateCurrentVideo() {
  try {
    // First check current tab status
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const isYouTube = currentTab && currentTab.url && currentTab.url.includes('youtube.com');
    const isYouTubeVideo = currentTab && currentTab.url && 
                          currentTab.url.includes('youtube.com/watch');
    
    const contentDiv = document.getElementById('currentVideoContent');
    const titleDiv = document.getElementById('currentVideoTitle');
    
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
      // Watching a video
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
      // Check if this video was already counted
      const watchedVideoData = currentChannel.watchedVideoData || {};
      const isAlreadyCounted = currentChannel.watchedVideos && 
                               currentChannel.watchedVideos.includes(currentVideo.id);
      
      contentDiv.innerHTML = `
        <div class="video-card">
          <div class="video-title">${currentVideo.title}</div>
          <div class="video-meta">
            <span>📺</span>
            <span class="video-channel">${currentChannel.name}</span>
            ${isAlreadyCounted ? '<span class="status-badge badge-counted">✓ Counted</span>' : '<span class="status-badge badge-learning">⏱ Learning</span>'}
          </div>
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
    const contentDiv = document.getElementById('currentVideoContent');
    const titleDiv = document.getElementById('currentVideoTitle');
    
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
    
    document.getElementById('channelCount').textContent = channelCount;
    document.getElementById('approvedCount').textContent = approvedCount;
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