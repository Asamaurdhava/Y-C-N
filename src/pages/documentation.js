// Documentation page navigation
document.addEventListener('DOMContentLoaded', function() {
  // Navigation event listeners
  const guideNavBtn = document.getElementById('guideNavBtn');
  if (guideNavBtn) {
    guideNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
      } else {
        window.open('guide.html', '_blank');
      }
    });
  }

  const dashboardNavBtn = document.getElementById('dashboardNavBtn');
  if (dashboardNavBtn) {
    dashboardNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      } else {
        window.open('dashboard.html', '_blank');
      }
    });
  }

  const viewGuideBtn = document.getElementById('viewGuideBtn');
  if (viewGuideBtn) {
    viewGuideBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
      } else {
        window.open('guide.html', '_blank');
      }
    });
  }

  const openDashboardBtn = document.getElementById('openDashboardBtn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      } else {
        window.open('dashboard.html', '_blank');
      }
    });
  }
});