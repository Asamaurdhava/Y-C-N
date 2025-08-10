document.addEventListener('DOMContentLoaded', async () => {
  await updateStats();
  await updateCurrentVideo();
  
  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
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
    const titleDiv = document.querySelector('.current-video-title');
    
    // Update the title and indicator based on status
    if (!isYouTube) {
      // Not on YouTube at all
      titleDiv.innerHTML = `
        <span class="live-dot" style="background: #dc3545;"></span>
        <span>Away from YouTube</span>
      `;
      contentDiv.innerHTML = `
        <div class="no-video">
          <div class="no-video-icon">💤</div>
          <div>Open YouTube to start tracking</div>
        </div>
      `;
      return;
    } else if (!isYouTubeVideo) {
      // On YouTube but not watching a video
      titleDiv.innerHTML = `
        <span class="live-dot" style="background: #28a745;"></span>
        <span>On YouTube</span>
      `;
      contentDiv.innerHTML = `
        <div class="no-video">
          <div class="no-video-icon">🏠</div>
          <div>Browsing YouTube</div>
        </div>
      `;
      return;
    } else {
      // Watching a video
      titleDiv.innerHTML = `
        <span class="live-dot" style="background: #ffc107;"></span>
        <span>Currently Playing</span>
      `;
    }
    
    // Extract video ID from URL
    const urlParams = new URLSearchParams(new URL(currentTab.url).search);
    const currentVideoId = urlParams.get('v');
    
    if (!currentVideoId) {
      contentDiv.innerHTML = `
        <div class="no-video">
          <div class="no-video-icon">📺</div>
          <div>No video currently playing</div>
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
        <div class="video-info">
          <div class="video-title">${currentVideo.title}</div>
          <div class="channel-name">
            <span>📺</span>
            <span>${currentChannel.name}</span>
            ${isAlreadyCounted ? '<span style="color: #28a745; margin-left: 8px;">✓ Counted</span>' : ''}
          </div>
        </div>
      `;
    } else {
      // Video is playing but not tracked yet
      const videoTitle = currentTab.title.replace(' - YouTube', '');
      contentDiv.innerHTML = `
        <div class="video-info">
          <div class="video-title">${videoTitle}</div>
          <div class="channel-name">
            <span>⏱️</span>
            <span>Tracking in progress...</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.warn('YCN: Error updating current video:', error);
    const contentDiv = document.getElementById('currentVideoContent');
    const titleDiv = document.querySelector('.current-video-title');
    
    // Show offline/error state
    titleDiv.innerHTML = `
      <span class="live-dot" style="background: #6c757d;"></span>
      <span>Status Unknown</span>
    `;
    contentDiv.innerHTML = `
      <div class="no-video">
        <div class="no-video-icon">❓</div>
        <div>Unable to check status</div>
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
      status.style.color = '#ff0000';
    } else if (approvedCount > 0) {
      status.textContent = approvedCount === 1
        ? `❤️ Your favorite creator will keep you posted!`
        : `❤️ ${approvedCount} beloved channels in your inner circle!`;
      status.style.color = '#00aa00';
    } else if (channelCount > 0) {
      status.textContent = `🔍 I'm learning about your YouTube relationships...`;
      status.style.color = '#0084FF';
    } else {
      status.textContent = `👋 Your YouTube journey starts here!`;
      status.style.color = '#6c757d';
    }
  } catch (error) {
    console.warn('YCN: Error updating popup stats:', error);
  }
}