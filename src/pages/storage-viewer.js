/**
 * Storage Viewer JavaScript
 * Handles all functionality for the YCN Storage Viewer page
 */

let storageData = {};

async function loadStorageData() {
  console.log('loadStorageData called');
  try {
    // Clear previous messages
    document.getElementById('error-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';
    
    // Check if running in Chrome extension context
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      throw new Error('Chrome storage API not available. Please open this page from the extension.');
    }
    
    // Update status
    updateStatus('Loading storage data...');
    
    // Get all storage data
    const data = await chrome.storage.local.get(null);
    storageData = data;
    
    // Display overview
    displayStorageOverview(data);
    
    // Display channels
    displayChannels(data.channels || {});
    
    // Display session data
    displaySessionData(data.ycn_session_data || {});
    
    // Display storage keys
    displayStorageKeys(data);
    
    // Display raw JSON
    const jsonContent = document.getElementById('json-content');
    if (jsonContent) {
      jsonContent.textContent = JSON.stringify(data, null, 2);
      console.log('Raw JSON updated with', Object.keys(data).length, 'keys');
    } else {
      console.error('json-content element not found');
    }
    
    // Calculate total size
    calculateStorageSize();
    
    updateStatus('Storage data loaded successfully', 'success');
    showSuccess('Data refreshed successfully at ' + new Date().toLocaleTimeString());
    
  } catch (error) {
    console.error('Error loading storage:', error);
    showError('Failed to load storage data: ' + error.message);
    updateStatus('Error loading storage', 'error');
  }
}

function displayStorageOverview(data) {
  const keys = Object.keys(data);
  document.getElementById('storage-badge').textContent = `Local - ${keys.length} keys`;
}

function displayChannels(channels) {
  const container = document.getElementById('channels-container');
  const channelIds = Object.keys(channels);
  
  document.getElementById('channel-count').textContent = channelIds.length;
  
  if (channelIds.length === 0) {
    container.innerHTML = '<p style="color: #718096; text-align: center; padding: 40px;">No channels tracked yet</p>';
    return;
  }
  
  let html = '';
  channelIds.forEach(id => {
    const channel = channels[id];
    const watchedCount = channel.watchedVideos ? channel.watchedVideos.length : 0;
    const relationshipScore = channel.relationship ? Math.round(channel.relationship.score * 100) / 100 : 0;
    
    // Determine channel status based on watched videos and approval
    let statusBadge = '';
    if (channel.approved) {
      statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #48bb78, #38a169); color: white; font-weight: 600;"><svg style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Approved</span>';
    } else if (watchedCount >= 10) {
      statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; font-weight: 600;"><svg style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>Pending</span>';
    } else {
      statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #4285f4, #155dfc); color: white; font-weight: 600;"><svg style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>Learning</span>';
    }
    
    html += `
      <div class="channel-card">
        <div class="channel-header">
          <div>
            <div class="channel-name">${escapeHtml(channel.name || 'Unknown Channel')}</div>
            ${statusBadge}
          </div>
        </div>
        <div class="channel-content">
          <div class="channel-stats">
            <div class="stat-item">
              <div class="stat-value">${channel.count || 0}</div>
              <div class="stat-label">Videos Found</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${watchedCount}</div>
              <div class="stat-label">Watched</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${relationshipScore}</div>
              <div class="stat-label">Score</div>
            </div>
          </div>
          <div class="channel-details">
            <div style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.4);">
              <div class="data-key">Channel ID</div>
              <div class="data-value" style="font-size: 0.8rem; word-break: break-all; font-family: 'SF Mono', Monaco, monospace;">${escapeHtml(id)}</div>
              ${channel.lastVideo ? `
                <div style="margin-top: 12px;">
                  <div class="data-key">Latest Video</div>
                  <div class="data-value" style="font-size: 0.85rem; line-height: 1.4;">${escapeHtml(channel.lastVideo.title)}</div>
                  ${channel.lastVideo.publishedAt ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${new Date(channel.lastVideo.publishedAt).toLocaleDateString()}</div>` : ''}
                </div>
              ` : '<div style="margin-top: 12px;"><div class="data-key">Latest Video</div><div class="data-value" style="font-size: 0.85rem; opacity: 0.6;">No videos found</div></div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function displaySessionData(sessionData) {
  const container = document.getElementById('session-container');
  
  if (!sessionData || Object.keys(sessionData).length === 0) {
    container.innerHTML = '<p style="color: #718096;">No session data found</p>';
    return;
  }
  
  let html = '<div class="data-grid">';
  
  if (sessionData.patterns) {
    html += `
      <div class="data-item">
        <div class="data-key">Peak Hours</div>
        <div class="data-value">${sessionData.patterns.hourlyActivity ? 
          sessionData.patterns.hourlyActivity.map((v, i) => v > 0 ? i : null).filter(v => v !== null).join(', ') : 
          'No data'}</div>
      </div>
    `;
  }
  
  html += `
    <div class="data-item">
      <div class="data-key">Total Watch Time</div>
      <div class="data-value">${formatTime(sessionData.totalWatchTime || 0)}</div>
    </div>
    <div class="data-item">
      <div class="data-key">Video Count</div>
      <div class="data-value">${sessionData.videoCount || 0}</div>
    </div>
    <div class="data-item">
      <div class="data-key">Last Save</div>
      <div class="data-value">${sessionData.lastSave ? new Date(sessionData.lastSave).toLocaleString() : 'Never'}</div>
    </div>
  `;
  
  html += '</div>';
  container.innerHTML = html;
}

function displayStorageKeys(data) {
  const container = document.getElementById('keys-container');
  const keys = Object.keys(data);
  
  let html = '<div class="data-grid">';
  keys.forEach(key => {
    const value = data[key];
    const size = JSON.stringify(value).length;
    html += `
      <div class="data-item">
        <div class="data-key">${escapeHtml(key)}</div>
        <div class="data-value">
          Type: ${typeof value === 'object' ? (Array.isArray(value) ? 'array' : 'object') : typeof value} | 
          Size: ${formatBytes(size)}
        </div>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

function calculateStorageSize() {
  try {
    // Show loading state
    updateStatus('Calculating storage size...', 'normal');
    document.getElementById('total-size').textContent = 'Calculating...';
    
    const jsonString = JSON.stringify(storageData);
    const bytes = new Blob([jsonString]).size;
    document.getElementById('total-size').textContent = formatBytes(bytes);
    
    // Also get chrome.storage.local.getBytesInUse if available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (!chrome.runtime.lastError) {
          document.getElementById('total-size').textContent = formatBytes(bytesInUse) + ' (actual)';
          updateStatus('Storage size updated successfully', 'success');
          // Only show success message if manually triggered
          if (document.activeElement && document.activeElement.id === 'calculateSizeBtn') {
            showLocalMessage('storage-actions-message', `Storage size calculated: ${formatBytes(bytesInUse)}`, 'success');
          }
        } else {
          showError('Failed to get actual storage size');
          updateStatus('Size calculation completed with warnings', 'error');
        }
      });
    } else {
      updateStatus('Storage size updated successfully', 'success');
      // Only show success message if manually triggered
      if (document.activeElement && document.activeElement.id === 'calculateSizeBtn') {
        showLocalMessage('storage-actions-message', `Storage size calculated: ${formatBytes(bytes)} (estimated)`, 'success');
      }
    }
  } catch (error) {
    console.error('Error calculating size:', error);
    document.getElementById('total-size').textContent = 'Unknown';
    showError('Failed to calculate storage size: ' + error.message);
    updateStatus('Size calculation failed', 'error');
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(ms) {
  if (!ms) return '0s';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function exportData() {
  console.log('exportData called, storageData:', storageData);
  if (!storageData || Object.keys(storageData).length === 0) {
    showError('No data to export. Please refresh data first.');
    return;
  }
  const dataStr = JSON.stringify(storageData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `ycn-storage-${Date.now()}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  
  showSuccess('Data exported successfully');
}

function toggleRawView() {
  console.log('toggleRawView called');
  const viewer = document.getElementById('raw-data');
  const button = document.getElementById('toggleRawBtn');
  const currentDisplay = viewer.style.display;
  console.log('Current display:', currentDisplay);
  viewer.style.display = currentDisplay === 'none' ? 'block' : 'none';
  console.log('New display:', viewer.style.display);
  
  // Update button text
  if (button) {
    button.textContent = viewer.style.display === 'none' ? 'Show Raw View' : 'Hide Raw View';
  }
}

async function verifyStorageIntegrity() {
  try {
    updateStatus('Verifying storage integrity...', 'normal');
    
    // Test write
    const testKey = 'ycn_integrity_test';
    const testValue = { timestamp: Date.now(), test: true };
    
    updateStatus('Testing storage write operation...', 'normal');
    await chrome.storage.local.set({ [testKey]: testValue });
    
    // Test read
    updateStatus('Testing storage read operation...', 'normal');
    const result = await chrome.storage.local.get([testKey]);
    
    if (result[testKey] && result[testKey].test === true) {
      // Clean up
      await chrome.storage.local.remove([testKey]);
      showSuccess('✅ Storage integrity verified - Read/Write operations working correctly');
      updateStatus('Storage integrity check passed', 'success');
    } else {
      showError('❌ Storage integrity check failed - Data mismatch detected');
      updateStatus('Storage integrity check failed', 'error');
    }
    
  } catch (error) {
    showError('❌ Storage integrity check failed: ' + error.message);
    updateStatus('Verification failed - ' + error.message, 'error');
  }
}

async function clearTestData() {
  if (confirm('This will only clear test data (integrity tests, debug data). Continue?')) {
    try {
      const keysToRemove = [
        'ycn_integrity_test',
        'emailDebugTest',
        'testData'
      ];
      
      await chrome.storage.local.remove(keysToRemove);
      showSuccess('Test data cleared successfully');
      loadStorageData();
    } catch (error) {
      showError('Failed to clear test data: ' + error.message);
    }
  }
}

function updateStatus(text, type = 'normal') {
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.querySelector('.status-indicator');
  
  statusText.textContent = text;
  
  if (type === 'success') {
    statusIndicator.style.background = '#48bb78';
  } else if (type === 'error') {
    statusIndicator.style.background = '#fc8181';
  } else {
    statusIndicator.style.background = '#667eea';
  }
}

function showError(message) {
  const container = document.getElementById('error-container');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  container.innerHTML = '';
  container.appendChild(errorDiv);
  
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showSuccess(message) {
  const container = document.getElementById('success-container');
  const successDiv = document.createElement('div');
  successDiv.className = 'success';
  successDiv.textContent = message;
  container.innerHTML = '';
  container.appendChild(successDiv);
  
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showLocalMessage(containerId, message, type = 'success') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = type;
  messageDiv.textContent = message;
  messageDiv.style.marginTop = '16px';
  container.innerHTML = '';
  container.appendChild(messageDiv);
  
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

// Utility function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions globally for onclick handlers
window.loadStorageData = loadStorageData;
window.exportData = exportData;
window.toggleRawView = toggleRawView;
window.verifyStorageIntegrity = verifyStorageIntegrity;
window.calculateStorageSize = calculateStorageSize;
window.clearTestData = clearTestData;

// Initialize on page load
let refreshInterval = null;
let isExtensionContext = false;

document.addEventListener('DOMContentLoaded', () => {
  // Check if we're in extension context
  isExtensionContext = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  
  // Add event listeners to buttons
  const refreshBtn = document.getElementById('refreshDataBtn');
  const exportBtn = document.getElementById('exportDataBtn');
  const toggleBtn = document.getElementById('toggleRawBtn');
  const verifyBtn = document.getElementById('verifyIntegrityBtn');
  const calculateBtn = document.getElementById('calculateSizeBtn');
  const clearBtn = document.getElementById('clearTestBtn');
  
  if (refreshBtn) refreshBtn.addEventListener('click', loadStorageData);
  if (exportBtn) exportBtn.addEventListener('click', exportData);
  if (toggleBtn) toggleBtn.addEventListener('click', toggleRawView);
  if (verifyBtn) verifyBtn.addEventListener('click', verifyStorageIntegrity);
  if (calculateBtn) calculateBtn.addEventListener('click', calculateStorageSize);
  if (clearBtn) clearBtn.addEventListener('click', clearTestData);
  
  if (isExtensionContext) {
    loadStorageData();
    
    // Removed auto-refresh to prevent interference with manual operations
  } else {
    updateStatus('Error: This page must be opened from the Chrome extension.', 'error');
    const jsonContent = document.getElementById('json-content');
    if (jsonContent) {
      jsonContent.textContent = 
        'Chrome storage API not available.\n\n' +
        'To view storage data:\n' +
        '1. Open the extension popup\n' +
        '2. Click on Dashboard\n' +
        '3. Navigate to Storage Viewer from there';
    }
  }
});

// Global functions for onclick handlers
window.loadStorageData = loadStorageData;
window.exportData = exportData;
window.toggleRawView = toggleRawView;
window.verifyStorageIntegrity = verifyStorageIntegrity;
window.calculateStorageSize = calculateStorageSize;
window.clearTestData = clearTestData;