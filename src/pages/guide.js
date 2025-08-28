// Guide page navigation and interactions
document.addEventListener('DOMContentLoaded', function() {
  // Navigation event listeners
  const docsNavBtn = document.getElementById('docsNavBtn');
  if (docsNavBtn) {
    docsNavBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('documentation.html') });
      } else {
        window.open('documentation.html', '_blank');
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

  const goToYouTubeBtn = document.getElementById('goToYouTubeBtn');
  if (goToYouTubeBtn) {
    goToYouTubeBtn.addEventListener('click', () => {
      window.open('https://youtube.com', '_blank');
    });
  }
});