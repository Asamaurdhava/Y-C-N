/**
 * Simple encryption utility for securing sensitive data in storage
 * Uses Web Crypto API for secure encryption
 */

class EncryptionUtils {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.saltLength = 16;
    this.ivLength = 12;
    this.tagLength = 128;
  }

  /**
   * Generates a cryptographic key from a password
   * @param {string} password - The password to derive key from
   * @param {Uint8Array} salt - Salt for key derivation
   * @returns {Promise<CryptoKey>} The derived key
   */
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts data using AES-GCM
   * @param {string} data - The data to encrypt
   * @param {string} password - The password for encryption
   * @returns {Promise<Object>} Encrypted data with metadata
   */
  async encrypt(data, password) {
    try {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
      const key = await this.deriveKey(password, salt);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv,
          tagLength: this.tagLength
        },
        key,
        encoder.encode(data)
      );

      // Convert to base64 for storage
      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        salt: this.arrayBufferToBase64(salt),
        iv: this.arrayBufferToBase64(iv)
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts data encrypted with encrypt()
   * @param {Object} encryptedData - The encrypted data object
   * @param {string} password - The password for decryption
   * @returns {Promise<string>} The decrypted data
   */
  async decrypt(encryptedData, password) {
    try {
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      const key = await this.deriveKey(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv,
          tagLength: this.tagLength
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generates a secure encryption key
   * @returns {string} A random key suitable for encryption
   */
  generateSecureKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }

  /**
   * Converts ArrayBuffer to base64 string
   * @param {ArrayBuffer} buffer - The buffer to convert
   * @returns {string} Base64 encoded string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts base64 string to ArrayBuffer
   * @param {string} base64 - The base64 string to convert
   * @returns {ArrayBuffer} The converted buffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Simplified token storage with encryption
 */
class SecureTokenStorage {
  constructor() {
    this.encryption = new EncryptionUtils();
    this.storageKey = 'ycn_secure_tokens';
    this.initKey();
  }

  /**
   * Initializes or retrieves the encryption key
   */
  async initKey() {
    try {
      const result = await chrome.storage.local.get(['ycn_encryption_key']);
      if (!result.ycn_encryption_key) {
        // Generate a new key for this installation
        const key = this.encryption.generateSecureKey();
        await chrome.storage.local.set({ ycn_encryption_key: key });
        this.encryptionKey = key;
      } else {
        this.encryptionKey = result.ycn_encryption_key;
      }
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      // Fallback to a deterministic key based on extension ID
      this.encryptionKey = chrome.runtime.id || 'default_key';
    }
  }

  /**
   * Stores a token securely
   * @param {string} tokenType - Type of token (e.g., 'gmail_access')
   * @param {string} token - The token to store
   * @returns {Promise<void>}
   */
  async storeToken(tokenType, token) {
    try {
      if (!this.encryptionKey) {
        await this.initKey();
      }

      const encrypted = await this.encryption.encrypt(token, this.encryptionKey);
      
      // Get existing tokens
      const result = await chrome.storage.local.get([this.storageKey]);
      const tokens = result[this.storageKey] || {};
      
      // Add encrypted token
      tokens[tokenType] = {
        ...encrypted,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ [this.storageKey]: tokens });
    } catch (error) {
      console.error('Failed to store token securely:', error);
      throw error;
    }
  }

  /**
   * Retrieves a token securely
   * @param {string} tokenType - Type of token to retrieve
   * @returns {Promise<string|null>} The decrypted token or null
   */
  async getToken(tokenType) {
    try {
      if (!this.encryptionKey) {
        await this.initKey();
      }

      const result = await chrome.storage.local.get([this.storageKey]);
      const tokens = result[this.storageKey] || {};
      
      if (!tokens[tokenType]) {
        return null;
      }
      
      const decrypted = await this.encryption.decrypt(
        tokens[tokenType],
        this.encryptionKey
      );
      
      return decrypted;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  /**
   * Removes a stored token
   * @param {string} tokenType - Type of token to remove
   * @returns {Promise<void>}
   */
  async removeToken(tokenType) {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const tokens = result[this.storageKey] || {};
      
      delete tokens[tokenType];
      
      await chrome.storage.local.set({ [this.storageKey]: tokens });
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  }

  /**
   * Clears all stored tokens
   * @returns {Promise<void>}
   */
  async clearAllTokens() {
    try {
      await chrome.storage.local.remove([this.storageKey]);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EncryptionUtils, SecureTokenStorage };
}