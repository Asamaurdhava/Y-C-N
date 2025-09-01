/**
 * Email System Debug Utilities
 * Helper functions for testing and debugging email functionality
 */

class EmailDebugger {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run comprehensive email system diagnostics
   */
  async runDiagnostics() {
    console.log('🔍 YCN Email Debug: Starting comprehensive diagnostics...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, warnings: 0 }
    };

    // Test 1: Extension Setup
    results.tests.push(await this.testExtensionSetup());
    
    // Test 2: Gmail API Authentication
    results.tests.push(await this.testGmailAuthentication());
    
    // Test 3: Email Template Generation
    results.tests.push(await this.testEmailTemplateGeneration());
    
    // Test 4: Background Script Integration
    results.tests.push(await this.testBackgroundIntegration());
    
    // Test 5: Storage System
    results.tests.push(await this.testStorageSystem());
    
    // Test 6: Email Scheduler
    results.tests.push(await this.testEmailScheduler());

    // Calculate summary
    results.tests.forEach(test => {
      if (test.status === 'PASS') results.summary.passed++;
      else if (test.status === 'FAIL') results.summary.failed++;
      else if (test.status === 'WARN') results.summary.warnings++;
    });

    console.log('📊 YCN Email Debug: Diagnostics complete', results.summary);
    return results;
  }

  async testExtensionSetup() {
    const test = {
      name: 'Extension Setup',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Check manifest permissions
      const manifest = chrome.runtime.getManifest();
      
      if (!manifest.permissions.includes('identity')) {
        test.details.push('❌ Missing identity permission');
        test.status = 'FAIL';
      } else {
        test.details.push('✅ Identity permission granted');
      }

      if (!manifest.oauth2 || !manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/gmail.send')) {
        test.details.push('❌ Missing Gmail send scope');
        test.status = 'FAIL';
      } else {
        test.details.push('✅ Gmail send scope configured');
      }

      // Test background script email module availability
      try {
        const moduleTest = await chrome.runtime.sendMessage({ type: 'EMAIL_MODULE_TEST' });
        
        if (moduleTest && moduleTest.emailTemplatesAvailable) {
          test.details.push('✅ EmailTemplates loaded in background script');
        } else {
          test.details.push('❌ EmailTemplates not available in background script');
          test.status = 'FAIL';
        }

        if (moduleTest && moduleTest.emailSchedulerAvailable) {
          test.details.push('✅ EmailScheduler loaded in background script');
        } else {
          test.details.push('❌ EmailScheduler not available in background script');
          test.status = 'FAIL';
        }
      } catch (error) {
        test.details.push('❌ Could not test background script modules');
        test.status = 'FAIL';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  async testGmailAuthentication() {
    const test = {
      name: 'Gmail API Authentication',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test email system token retrieval via background script
      const tokenTest = await chrome.runtime.sendMessage({ 
        type: 'EMAIL_AUTH_TEST'
      });
      
      if (tokenTest && tokenTest.success) {
        test.details.push('✅ Email system authentication successful');
        
        if (tokenTest.tokenSource) {
          test.details.push(`✅ Using ${tokenTest.tokenSource} token`);
        }
        
        if (tokenTest.userEmail) {
          test.details.push(`✅ User authenticated: ${tokenTest.userEmail}`);
        }
        
        if (tokenTest.tokenLength > 50) {
          test.details.push('✅ Token format appears valid');
        } else {
          test.details.push('⚠️ Token format may be invalid');
          test.status = 'WARN';
        }
      } else {
        test.details.push('❌ Email system authentication failed');
        if (tokenTest && tokenTest.error) {
          test.details.push(`❌ Error: ${tokenTest.error}`);
        }
        test.status = 'FAIL';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  async testEmailTemplateGeneration() {
    const test = {
      name: 'Email Template Generation',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test template generation via background script
      const testVideos = this.generateTestVideos();
      const testUser = { name: 'Test User', emailHash: 'test_hash' };
      
      const templateTest = await chrome.runtime.sendMessage({ 
        type: 'EMAIL_TEMPLATE_TEST', 
        videos: testVideos,
        user: testUser
      });
      
      if (templateTest && templateTest.success) {
        test.details.push('✅ Email template generation successful');
        
        if (templateTest.html && templateTest.subject) {
          test.details.push('✅ Template contains HTML and subject');
          
          // Basic HTML validation
          if (templateTest.html.includes('<html') && templateTest.html.includes('</html>')) {
            test.details.push('✅ HTML structure valid');
          } else {
            test.details.push('⚠️ HTML structure may be invalid');
            test.status = 'WARN';
          }
        } else {
          test.details.push('❌ Template missing HTML or subject');
          test.status = 'FAIL';
        }
      } else {
        test.details.push('❌ Email template generation failed');
        test.status = 'FAIL';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  async testBackgroundIntegration() {
    const test = {
      name: 'Background Script Integration',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test message communication
      const response = await chrome.runtime.sendMessage({ type: 'GHOST_STATUS' });
      
      if (response) {
        test.details.push('✅ Background script communication working');
        
        if (response.authenticated !== undefined) {
          test.details.push(`✅ Authentication status: ${response.authenticated}`);
        }
      } else {
        test.details.push('❌ No response from background script');
        test.status = 'FAIL';
      }

      // Test email service availability
      try {
        const testResponse = await chrome.runtime.sendMessage({ 
          type: 'SEND_TEST_EMAIL', 
          videos: this.generateTestVideos(),
          emailType: 'daily_evening'
        });
        
        if (testResponse !== undefined) {
          test.details.push('✅ Test email endpoint responds');
        } else {
          test.details.push('⚠️ Test email endpoint may not be configured');
          test.status = 'WARN';
        }
      } catch (error) {
        test.details.push('⚠️ Test email endpoint not available');
        test.status = 'WARN';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  async testStorageSystem() {
    const test = {
      name: 'Storage System',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test basic storage operations
      const testData = { 
        emailDebugTest: true, 
        timestamp: Date.now() 
      };
      
      await chrome.storage.local.set(testData);
      const retrieved = await chrome.storage.local.get(['emailDebugTest']);
      
      if (retrieved.emailDebugTest) {
        test.details.push('✅ Storage write/read operations working');
        
        // Cleanup
        await chrome.storage.local.remove(['emailDebugTest']);
      } else {
        test.details.push('❌ Storage operations failed');
        test.status = 'FAIL';
      }

      // Check for existing email settings
      const settings = await chrome.storage.local.get(['emailPreferences']);
      if (settings.emailPreferences) {
        test.details.push('✅ Email preferences found in storage');
      } else {
        test.details.push('⚠️ No email preferences configured');
        test.status = 'WARN';
      }

      // Check for Ghost Protocol data
      const ghostUser = await chrome.storage.local.get(['ghostUser']);
      if (ghostUser.ghostUser) {
        test.details.push('✅ Ghost Protocol user data found');
      } else {
        test.details.push('⚠️ Ghost Protocol not configured');
        test.status = 'WARN';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  async testEmailScheduler() {
    const test = {
      name: 'Email Scheduler',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test EmailScheduler via background script
      const schedulerTest = await chrome.runtime.sendMessage({ 
        type: 'EMAIL_SCHEDULER_TEST' 
      });
      
      if (schedulerTest && schedulerTest.success) {
        test.details.push('✅ EmailScheduler available in background script');
        
        if (schedulerTest.nextSendTime && schedulerTest.nextSendTime > Date.now()) {
          test.details.push('✅ Next send time calculated correctly');
        } else {
          test.details.push('⚠️ Next send time calculation may be incorrect');
          test.status = 'WARN';
        }
        
        if (schedulerTest.queueTest) {
          test.details.push('✅ Video queueing functionality available');
        } else {
          test.details.push('⚠️ Video queueing test failed');
          test.status = 'WARN';
        }
      } else {
        test.details.push('❌ EmailScheduler test failed');
        test.status = 'FAIL';
      }

    } catch (error) {
      test.status = 'FAIL';
      test.errors.push(error.message);
    }

    return test;
  }

  generateTestVideos() {
    return [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Test Video: Email System Debug',
        channelName: 'Debug Channel',
        channelId: 'UC_DEBUG_123',
        publishedAt: Date.now() - 30000,
        relationshipScore: 85
      },
      {
        videoId: 'jNQXAC9IVRw',
        title: 'Another Test Video for Email',
        channelName: 'Test Channel Pro',
        channelId: 'UC_TEST_456',
        publishedAt: Date.now() - 120000,
        relationshipScore: 92
      }
    ];
  }

  /**
   * Test email rendering compatibility
   */
  generateCompatibilityTestEmail() {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YCN Email Compatibility Test</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Header Test -->
  <div style="background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">📧 Email Compatibility Test</h1>
    <p style="margin: 10px 0 0 0; font-size: 14px;">Testing rendering across email clients</p>
  </div>

  <!-- Content Test -->
  <div style="background: white; padding: 30px; max-width: 600px;">
    <h2 style="color: #333;">Rendering Tests:</h2>
    
    <div style="margin: 20px 0;">
      <h3>✅ Text Formatting</h3>
      <p><strong>Bold text</strong> | <em>Italic text</em> | <u>Underlined text</u></p>
    </div>

    <div style="margin: 20px 0;">
      <h3>🎨 Colors & Backgrounds</h3>
      <div style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 15px; border-radius: 8px;">
        Gradient background test
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h3>🔘 Buttons</h3>
      <a href="https://youtube.com" style="display: inline-block; padding: 12px 24px; background: #ff0000; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Test Button
      </a>
    </div>

    <div style="margin: 20px 0;">
      <h3>📱 Responsive Test</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; padding: 10px; background: #f8f9fa; border: 1px solid #e9ecef;">Left Column</td>
          <td style="width: 50%; padding: 10px; background: #e9ecef; border: 1px solid #dee2e6;">Right Column</td>
        </tr>
      </table>
    </div>

    <div style="margin: 20px 0;">
      <h3>🖼️ Image Test</h3>
      <div style="width: 100%; height: 100px; background: #ddd; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
        [Image Placeholder - YouTube Thumbnail]
      </div>
    </div>
  </div>

  <!-- Footer Test -->
  <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-radius: 0 0 12px 12px;">
    <p>YouTube Channel Notifier Compatibility Test</p>
    <p>If you can read this clearly, email rendering is working! ✅</p>
  </div>

</body>
</html>`;

    return html;
  }

  /**
   * Log formatted debug info
   */
  log(message, data = null) {
    const timestamp = new Date().toTimeString().substring(0, 8);
    console.log(`🔍 [${timestamp}] YCN Email Debug: ${message}`, data || '');
  }

  /**
   * Performance timing helper
   */
  time(label) {
    console.time(`⏱️ YCN Email Debug: ${label}`);
  }

  timeEnd(label) {
    console.timeEnd(`⏱️ YCN Email Debug: ${label}`);
  }
}

// Make available globally for testing
if (typeof window !== 'undefined') {
  window.EmailDebugger = EmailDebugger;
}

// Console shortcut for quick testing
if (typeof console !== 'undefined') {
  console.ycnEmailTest = async function() {
    const emailDebugger = new EmailDebugger();
    const results = await emailDebugger.runDiagnostics();
    
    console.log('\n📊 YCN EMAIL SYSTEM DIAGNOSTICS REPORT');
    console.log('=====================================');
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`⚠️ Warnings: ${results.summary.warnings}`);
    console.log('\nDetailed Results:', results.tests);
    
    return results;
  };
  
  console.log('🔍 YCN Email Debug loaded! Run console.ycnEmailTest() for diagnostics');
}

// Export for Node.js/module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailDebugger;
}