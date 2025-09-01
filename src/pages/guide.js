// Guide page navigation and interactions
document.addEventListener('DOMContentLoaded', function() {
  // Navigation event listeners
  const docsNavBtn = document.getElementById('docsNavBtn');
  if (docsNavBtn) {
    docsNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/documentation.html') });
      } else {
        window.location.href = 'documentation.html';
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

  const goToYouTubeBtn = document.getElementById('goToYouTubeBtn');
  if (goToYouTubeBtn) {
    goToYouTubeBtn.addEventListener('click', () => {
      window.open('https://youtube.com', '_blank');
    });
  }
});