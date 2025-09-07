/**
 * Email Template System for YouTube Channel Notifier
 * Generates beautiful, responsive HTML emails for video notifications
 */

class EmailTemplates {
  constructor() {
    this.brandColors = {
      primary: 'oklch(55.3% 0.013 58.071)',
      primaryDark: 'oklch(45.3% 0.013 58.071)',
      primaryLight: 'oklch(65.3% 0.013 58.071)',
      secondary: '#282828',
      accent: 'oklch(55.3% 0.013 58.071)',
      success: 'oklch(55.3% 0.013 58.071)',
      background: '#f8f9fa',
      text: '#212529'
    };
  }

  /**
   * Generate the main email template for video notifications
   * @param {Array} videos - Array of video objects
   * @param {Object} user - User preferences and data
   * @param {String} type - Email type: 'instant', 'daily', 'weekend'
   * @returns {String} Complete HTML email
   */
  generateVideoNotificationEmail(videos, user, type = 'daily') {
    const subject = this.generateSubject(videos, type);
    const greeting = this.getPersonalizedGreeting(user, type);
    const videoCards = videos.map(video => this.createVideoCard(video)).join('');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Remove default styling */
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; }
    
    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 10px !important; }
      .video-card { margin-bottom: 20px !important; }
      .video-thumbnail { height: 180px !important; }
      h1 { font-size: 24px !important; }
      .channel-name { font-size: 12px !important; }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a1a !important; }
      .container { background-color: #2a2a2a !important; }
      .video-card { background-color: #3a3a3a !important; border-color: #4a4a4a !important; }
      h1, h2, h3, p { color: #ffffff !important; }
      .text-muted { color: #aaaaaa !important; }
    }
    
    /* Hover effects */
    .video-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0,0,0,0.15);
    }
    
    /* Primary accent color */
    .primary-accent { color: oklch(55.3% 0.013 58.071); }
    .badge { 
      background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      display: inline-block;
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
  
  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Content Container -->
        <table class="container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Ghost Protocol Badge -->
          <tr>
            <td style="padding: 32px 0 24px 0; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%); padding: 12px 24px; border-radius: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid rgba(0, 0, 0, 0.06);">
                <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: oklch(44.4% 0.011 73.639); letter-spacing: 0.03em; text-transform: uppercase;">
                  YouTube Channel Notifier
                </h2>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: oklch(44.4% 0.011 73.639); font-weight: 500; letter-spacing: -0.01em;">
                  Ghost Protocol Active
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                New Videos Available
              </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">
                ${greeting}
              </p>
            </td>
          </tr>
          
          <!-- Summary Badge -->
          <tr>
            <td style="padding: 20px 30px; border-bottom: 1px solid #e9ecef;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <span class="badge">${this.getEmailTypeBadge(type)}</span>
                  </td>
                  <td align="right">
                    <span style="color: #6c757d; font-size: 14px;">
                      ${videos.length} new video${videos.length > 1 ? 's' : ''}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Video Cards Container -->
          <tr>
            <td style="padding: 20px 30px;">
              ${videoCards}
            </td>
          </tr>
          
          <!-- Call to Action -->
          <tr>
            <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <a href="https://youtube.com" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Watch on YouTube
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
              <p style="color: #6c757d; font-size: 12px; margin: 0 0 10px 0;">
                You're receiving this because you watch these channels frequently.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${this.getUnsubscribeLink(user)}" style="color: #6c757d; font-size: 12px; text-decoration: underline;">
                      Manage Preferences
                    </a>
                    <span style="color: #6c757d; margin: 0 10px;">•</span>
                    <a href="${this.getUnsubscribeLink(user)}" style="color: #6c757d; font-size: 12px; text-decoration: underline;">
                      Unsubscribe
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #adb5bd; font-size: 10px; margin: 15px 0 0 0;">
                YouTube Channel Notifier • For The Love Of Code Hackathon by GitHub: 2025 Edition
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;

    return { html, subject };
  }

  /**
   * Create individual video card component
   */
  createVideoCard(video) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`;
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    const channelUrl = `https://www.youtube.com/channel/${video.channelId}`;
    
    return `
    <!-- Video Card -->
    <table class="video-card" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
      <tr>
        <td>
          <a href="${videoUrl}" style="text-decoration: none;">
            <img src="${thumbnailUrl}" alt="${this.escapeHtml(video.title)}" style="width: 100%; height: 280px; object-fit: cover; display: block;" class="video-thumbnail">
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 15px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; line-height: 1.3;">
            <a href="${videoUrl}" style="color: #212529; text-decoration: none;">
              ${this.escapeHtml(video.title)}
            </a>
          </h3>
          <p class="channel-name" style="margin: 0 0 10px 0; font-size: 14px;">
            <a href="${channelUrl}" style="color: #6c757d; text-decoration: none;">
              ${this.escapeHtml(video.channelName)}
            </a>
            ${video.isNewChannel ? '<span style="color: oklch(55.3% 0.013 58.071); margin-left: 8px;">• New Channel!</span>' : ''}
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td>
                <a href="${videoUrl}" style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, oklch(55.3% 0.013 58.071) 0%, oklch(45.3% 0.013 58.071) 100%); color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 500;">
                  Watch Now →
                </a>
              </td>
              <td style="padding-left: 10px;">
                <span style="color: #6c757d; font-size: 12px;">
                  ${this.getRelativeTime(video.publishedAt)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
  }

  /**
   * Generate email subject line based on content and type
   */
  generateSubject(videos, type) {
    const channelCount = [...new Set(videos.map(v => v.channelId))].length;
    const topChannel = this.getMostFrequentChannel(videos);
    
    const subjects = {
      instant: `🔴 New: "${this.escapeHtml(videos[0].title)}" from ${this.escapeHtml(videos[0].channelName)}`,
      daily: `📺 Your Evening Watch List: ${videos.length} new videos from ${channelCount} channel${channelCount > 1 ? 's' : ''}`,
      weekend: `🎬 Weekend Binge Alert: ${videos.length} videos ready to watch!`,
      digest: `🌙 Tonight's YouTube: New from ${this.escapeHtml(topChannel)} ${channelCount > 1 ? `and ${channelCount - 1} more` : ''}`
    };
    
    return subjects[type] || subjects.daily;
  }

  /**
   * Get personalized greeting based on time and type
   */
  getPersonalizedGreeting(user, type) {
    const hour = new Date().getHours();
    const name = user.name ? user.name.split(' ')[0] : 'there';
    
    if (type === 'weekend') {
      return `Happy weekend${name ? `, ${name}` : ''}! Time to catch up on your favorite creators`;
    }
    
    if (hour < 12) {
      return `Good morning${name ? `, ${name}` : ''}! Here's what's new`;
    } else if (hour < 17) {
      return `Good afternoon${name ? `, ${name}` : ''}! Take a break with these videos`;
    } else {
      return `Good evening${name ? `, ${name}` : ''}! Perfect time to unwind`;
    }
  }

  /**
   * Get email type badge text
   */
  getEmailTypeBadge(type) {
    const badges = {
      instant: '⚡ Instant Update',
      daily: '🌙 Evening Digest',
      weekend: '🎉 Weekend Special',
      digest: '📬 Daily Summary'
    };
    return badges[type] || badges.daily;
  }

  /**
   * Generate unsubscribe link
   */
  getUnsubscribeLink(user) {
    // This will be handled by the extension's internal pages
    return `chrome-extension://${chrome.runtime.id}/src/pages/ghost-dashboard.html?action=unsubscribe`;
  }

  /**
   * Get most frequent channel from video list
   */
  getMostFrequentChannel(videos) {
    const channelCounts = {};
    videos.forEach(v => {
      channelCounts[v.channelName] = (channelCounts[v.channelName] || 0) + 1;
    });
    return Object.keys(channelCounts).reduce((a, b) => 
      channelCounts[a] > channelCounts[b] ? a : b
    );
  }

  /**
   * Convert timestamp to relative time
   */
  getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Escape HTML entities to prevent XSS
   */
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
  
  /**
   * Sanitize YouTube video IDs
   */
  sanitizeVideoId(videoId) {
    if (!videoId) return '';
    // YouTube video IDs are alphanumeric, underscore, and hyphen only
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /**
   * Generate plain text version for accessibility
   */
  generatePlainText(videos, user, type) {
    const greeting = this.getPersonalizedGreeting(user, type);
    let text = `YouTube Channel Notifier\n${greeting}\n\n`;
    
    text += `You have ${videos.length} new video${videos.length > 1 ? 's' : ''}:\n\n`;
    
    videos.forEach((video, index) => {
      text += `${index + 1}. ${this.escapeHtml(video.title)}\n`;
      text += `   Channel: ${this.escapeHtml(video.channelName)}\n`;
      text += `   Watch: https://www.youtube.com/watch?v=${this.sanitizeVideoId(video.videoId)}\n\n`;
    });
    
    text += `\n---\nManage preferences: ${this.getUnsubscribeLink(user)}`;
    
    return text;
  }
}

// Export for use in background script and global access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailTemplates;
}

// Make globally available for service workers
if (typeof self !== 'undefined') {
  self.EmailTemplates = EmailTemplates;
}