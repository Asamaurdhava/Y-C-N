/**
 * Inline Email Modules - Simplified version for service worker
 * This combines EmailTemplates and EmailScheduler into a single file
 */

// Simple Email Templates Class
class EmailTemplates {
  generateVideoNotificationEmail(videos, user, type = 'daily') {
    const subject = `YouTube Channel Notifier: ${videos.length} new video${videos.length > 1 ? 's' : ''}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
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
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">New Videos Available</h1>
      <p style="margin: 10px 0 0 0; font-size: 14px;">New videos from your favorite creators!</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #333; margin: 0 0 20px 0;">You have ${videos.length} new video${videos.length > 1 ? 's' : ''}:</h2>
      
      ${videos.map(video => `
        <div style="border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
          <div style="height: 200px; background: linear-gradient(45deg, oklch(55.3% 0.013 58.071), oklch(45.3% 0.013 58.071)); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold;">
            📺 ${video.title ? video.title.substring(0, 30) + '...' : 'Video Thumbnail'}
          </div>
          <div style="padding: 15px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #212529;">
              ${this.escapeHtml(video.title || 'Video Title')}
            </h3>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6c757d;">
              Channel: ${this.escapeHtml(video.channelName || 'Channel Name')}
            </p>
            <a href="https://www.youtube.com/watch?v=${video.videoId || 'dQw4w9WgXcQ'}" 
               style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">
              Watch Now →
            </a>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
      <p>YouTube Channel Notifier • For The Love Of Code Hackathon by GitHub: 2025 Edition</p>
      <p><a href="chrome-extension://${chrome.runtime.id}/src/pages/ghost-dashboard.html" style="color: #ff0000;">Manage Preferences</a></p>
    </div>
    
  </div>
</body>
</html>`;

    return { html, subject };
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Simple Email Scheduler Class  
class EmailScheduler {
  constructor() {
    this.settings = {
      enabled: true,
      frequency: 'daily_evening',
      primarySendTime: '20:00',
      minVideosForEmail: 1
    };
  }

  async initialize() {
    console.log('YCN EmailScheduler: Simple version initialized');
    return true;
  }

  async queueVideoNotification(video) {
    console.log('YCN EmailScheduler: Video queued:', video.title);
    return true;
  }

  async processEmailQueue() {
    console.log('YCN EmailScheduler: Processing email queue');
    return true;
  }

  getNextOptimalSendTime() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(20, 0, 0, 0); // 8 PM
    
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    return target.getTime();
  }
}

// Make globally available
if (typeof self !== 'undefined') {
  self.EmailTemplates = EmailTemplates;
  self.EmailScheduler = EmailScheduler;
  console.log('YCN: Inline email modules made globally available');
}

// Also make available in window context (for dashboard)
if (typeof window !== 'undefined') {
  window.EmailTemplates = EmailTemplates;
  window.EmailScheduler = EmailScheduler;
}