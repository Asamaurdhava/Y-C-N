/**
 * Security validation utilities for YouTube Channel Notifier
 * Prevents injection attacks and validates all user inputs
 */

class ValidationUtils {
  /**
   * Validates YouTube video ID format
   * @param {string} videoId - The video ID to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidVideoId(videoId) {
    if (!videoId || typeof videoId !== 'string') return false;
    // YouTube video IDs are exactly 11 characters, alphanumeric with - and _
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  /**
   * Validates YouTube channel ID format
   * @param {string} channelId - The channel ID to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidChannelId(channelId) {
    if (!channelId || typeof channelId !== 'string') return false;
    
    // Regular channel IDs start with UC and are 24 characters total
    if (channelId.startsWith('UC')) {
      return /^UC[a-zA-Z0-9_-]{22}$/.test(channelId);
    }
    
    // Handle-based channel IDs (stored as handle_username)
    if (channelId.startsWith('handle_')) {
      const handle = channelId.substring(7);
      // YouTube handles: 3-30 chars, alphanumeric, dots, underscores, hyphens
      return /^[a-zA-Z0-9._-]{3,30}$/.test(handle);
    }
    
    return false;
  }

  /**
   * Validates YouTube URL format
   * @param {string} url - The URL to validate
   * @returns {boolean} True if valid YouTube URL, false otherwise
   */
  static isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      const validHosts = [
        'www.youtube.com',
        'youtube.com',
        'm.youtube.com',
        'youtu.be',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com'
      ];
      
      return validHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes channel name for safe display
   * @param {string} name - The channel name to sanitize
   * @returns {string} Sanitized channel name
   */
  static sanitizeChannelName(name) {
    if (!name || typeof name !== 'string') return '';
    
    // Remove any HTML tags and limit length
    return name
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '')     // Remove angle brackets
      .substring(0, 100);       // Limit to 100 characters
  }

  /**
   * Sanitizes video title for safe display
   * @param {string} title - The video title to sanitize
   * @returns {string} Sanitized video title
   */
  static sanitizeVideoTitle(title) {
    if (!title || typeof title !== 'string') return '';
    
    // Remove any HTML tags and limit length
    return title
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '')     // Remove angle brackets
      .substring(0, 200);       // Limit to 200 characters
  }

  /**
   * Validates email address format
   * @param {string} email - The email to validate
   * @returns {boolean} True if valid email, false otherwise
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Basic email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254; // RFC 5321 max length
  }

  /**
   * Validates storage key format to prevent injection
   * @param {string} key - The storage key to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidStorageKey(key) {
    if (!key || typeof key !== 'string') return false;
    
    // Only allow alphanumeric, underscore, and hyphen
    return /^[a-zA-Z0-9_-]+$/.test(key) && key.length <= 100;
  }

  /**
   * Validates numeric values are within expected ranges
   * @param {number} value - The value to validate
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return typeof value === 'number' && 
           !isNaN(value) && 
           value >= min && 
           value <= max;
  }

  /**
   * Validates timestamp is reasonable (not too old or in future)
   * @param {number} timestamp - The timestamp to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidTimestamp(timestamp) {
    if (!this.isValidNumber(timestamp)) return false;
    
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneHourFromNow = now + (60 * 60 * 1000);
    
    return timestamp >= oneYearAgo && timestamp <= oneHourFromNow;
  }

  /**
   * Escapes HTML entities to prevent XSS
   * @param {string} text - The text to escape
   * @returns {string} Escaped text safe for HTML
   */
  static escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Validates OAuth token format
   * @param {string} token - The token to validate
   * @returns {boolean} True if valid format, false otherwise
   */
  static isValidOAuthToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    // OAuth tokens are typically base64 or JWT format
    // Check for reasonable length and character set
    return token.length >= 20 && 
           token.length <= 2048 && 
           /^[a-zA-Z0-9._-]+$/.test(token);
  }

  /**
   * Validates completion percentage
   * @param {number} percentage - The percentage to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidPercentage(percentage) {
    return this.isValidNumber(percentage, 0, 100);
  }

  /**
   * Validates watch duration in seconds
   * @param {number} duration - The duration to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidDuration(duration) {
    // Max 24 hours in seconds
    return this.isValidNumber(duration, 0, 86400);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationUtils;
}