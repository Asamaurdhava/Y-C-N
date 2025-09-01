// Documentation page navigation
document.addEventListener('DOMContentLoaded', function() {
  // Navigation event listeners
  const guideNavBtn = document.getElementById('guideNavBtn');
  if (guideNavBtn) {
    guideNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/guide.html') });
      } else {
        window.location.href = 'guide.html';
      }
    });
  }

  const dashboardNavBtn = document.getElementById('dashboardNavBtn');
  if (dashboardNavBtn) {
    dashboardNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/dashboard.html') });
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }

  const viewGuideBtn = document.getElementById('viewGuideBtn');
  if (viewGuideBtn) {
    viewGuideBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/guide.html') });
      } else {
        window.location.href = 'guide.html';
      }
    });
  }

  const openDashboardBtn = document.getElementById('openDashboardBtn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/dashboard.html') });
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }
});