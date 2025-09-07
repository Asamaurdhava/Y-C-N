/**
 * Analytics Dashboard JavaScript
 * Handles the display and interaction for personal YouTube analytics
 */

class AnalyticsDashboard {
  constructor() {
    this.analyticsEngine = null;
    this.currentTimeRange = '7d';
    this.isLoading = false;
    this.dashboardData = null;
  }

  async initialize() {
    console.log('YCN Analytics Dashboard: Initializing...');
    
    try {
      // Initialize analytics engine
      this.analyticsEngine = new PersonalAnalyticsEngine();
      await this.analyticsEngine.initialize();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadDashboard();
      
      console.log('YCN Analytics Dashboard: Initialization complete');
    } catch (error) {
      console.error('YCN Analytics Dashboard: Initialization failed:', error);
      this.showError('Failed to initialize analytics dashboard');
    }
  }

  setupEventListeners() {
    // Time range selector
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const range = e.target.dataset.range;
        if (range !== this.currentTimeRange) {
          this.setActiveTimeRange(range);
          await this.loadDashboard();
        }
      });
    });

    // Export buttons
    document.getElementById('export-json')?.addEventListener('click', () => this.exportData('json'));
    document.getElementById('export-csv')?.addEventListener('click', () => this.exportData('csv'));
    document.getElementById('share-insights')?.addEventListener('click', () => this.shareInsights());

    // Refresh data every 5 minutes when tab is active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.dashboardData) {
        setTimeout(() => this.loadDashboard(), 1000);
      }
    });
  }

  setActiveTimeRange(range) {
    // Update button states
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.range === range) {
        btn.classList.add('active');
      }
    });
    
    this.currentTimeRange = range;
  }

  async loadDashboard() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading(true);
    this.hideError();
    
    try {
      console.log(`YCN Analytics: Loading dashboard for ${this.currentTimeRange}...`);
      
      // Get dashboard data from analytics engine
      this.dashboardData = await this.analyticsEngine.getAnalyticsDashboard(this.currentTimeRange);
      
      if (!this.dashboardData) {
        this.showError('No analytics data available yet. Watch some videos to see your statistics!');
        return;
      }
      
      // Render all dashboard sections
      this.renderOverviewStats(this.dashboardData.overview);
      this.renderTopChannels(this.dashboardData.overview.topChannels);
      this.renderTopCategories(this.dashboardData.overview.topCategories);
      this.renderCharts(this.dashboardData.visualizations);
      this.renderInsights(this.dashboardData.insights);
      this.renderAchievements(this.dashboardData.insights?.achievements || []);
      
      console.log('YCN Analytics: Dashboard loaded successfully');
      
    } catch (error) {
      console.error('YCN Analytics: Error loading dashboard:', error);
      this.showError('Failed to load analytics data. Please try refreshing the page.');
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  renderOverviewStats(overview) {
    const container = document.getElementById('overview-stats');
    if (!container || !overview) return;
    
    // Enhanced stats with animated counters and better visual hierarchy
    const stats = [
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
        title: 'Total Watch Time',
        value: `${overview.totalWatchTime} m`,
        label: 'Minutes watched',
        trend: this.calculateTrend(overview.totalWatchTime, 'watchTime'),
        color: '#667eea'
      },
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>',
        title: 'Videos Watched',
        value: overview.totalVideos.toString(),
        label: 'Videos completed',
        trend: this.calculateTrend(overview.totalVideos, 'videos'),
        color: '#f093fb'
      },
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM4 6h9v7H4z"/></svg>',
        title: 'Unique Channels',
        value: overview.uniqueChannels.toString(),
        label: 'Different creators',
        trend: this.calculateTrend(overview.uniqueChannels, 'channels'),
        color: '#4facfe'
      },
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
        title: 'Avg. Engagement',
        value: `${overview.efficiency || 0}%`,
        label: 'Watching efficiency',
        trend: this.calculateTrend(overview.efficiency, 'engagement'),
        color: '#43e97b'
      },
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>',
        title: 'Current Streak',
        value: `${overview.watchingStreak?.current || 0} d`,
        label: 'Days in a row',
        trend: overview.watchingStreak?.current > overview.watchingStreak?.max * 0.8 ? 'up' : 'neutral',
        color: '#fa709a'
      },
      {
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm1-13h-2v6l5.25 3.15.75-1.23L13 13z"/></svg>',
        title: 'Peak Time',
        value: this.formatPeakTime(overview),
        label: 'Most active hour',
        trend: 'neutral',
        color: '#fee140'
      }
    ];
    
    container.innerHTML = stats.map((stat, index) => `
      <div class="analytics-card enhanced-card" style="animation: slideInUp 0.6s ease-out ${index * 0.1}s both;">
        <div class="card-header">
          <div class="card-icon enhanced-icon" style="background: linear-gradient(135deg, ${stat.color} 0%, ${this.darkenColor(stat.color)} 100%); color: white; box-shadow: 0 4px 12px rgba(236, 0, 63, 0.2);">
            ${stat.icon}
          </div>
          <h3 class="card-title">${stat.title}</h3>
        </div>
        <div class="stat-value enhanced-value" data-value="${stat.value}">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
        ${this.renderTrend(stat.trend)}
        <div class="card-glow" style="position: absolute; inset: 0; background: linear-gradient(135deg, transparent 0%, rgba(236, 0, 63, 0.05) 50%, transparent 100%); border-radius: inherit; opacity: 0; transition: opacity 0.3s ease;"></div>
      </div>
    `).join('');
    
    // Add hover effects to cards
    container.querySelectorAll('.enhanced-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.querySelector('.card-glow').style.opacity = '1';
        card.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        card.querySelector('.card-glow').style.opacity = '0';
        card.style.transform = '';
      });
    });
  }

  formatPeakTime(overview) {
    // This would come from the insights, for now show a placeholder
    return '8 PM';
  }

  calculateTrend(value, type) {
    // Simplified trend calculation - in real app this would compare with previous period
    if (value > 0) return Math.random() > 0.5 ? 'up' : 'down';
    return 'neutral';
  }

  renderTrend(trend) {
    const trendIcons = {
      up: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg> +12%',
      down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg> -5%',
      neutral: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg> Same'
    };
    
    const trendClasses = {
      up: 'trend-up',
      down: 'trend-down',
      neutral: 'trend-neutral'
    };
    
    return `<span class="trend-indicator ${trendClasses[trend]}">${trendIcons[trend]}</span>`;
  }

  darkenColor(color) {
    // Simple color darkening for gradients
    return color.replace('#', '#').slice(0, -1) + '0';
  }

  renderTopChannels(topChannels) {
    const container = document.getElementById('top-channels');
    if (!container || !topChannels?.length) {
      container.innerHTML = `
        <li class="empty-list-item">
          <div class="empty-list-content">
            <div class="empty-list-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 7c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v1c0 2.2-1.2 4.1-3 5.1V16h1c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-3c0-.55.45-1 1-1h1v-2.9C6.2 12.1 5 10.2 5 8V7z"/>
              </svg>
            </div>
            <div class="empty-list-text">Watch more videos to see your top channels</div>
          </div>
        </li>
      `;
      return;
    }
    
    container.innerHTML = topChannels.slice(0, 5).map(channel => `
      <li class="top-list-item">
        <div class="channel-name" title="${channel.channelName}">${channel.channelName}</div>
        <div class="channel-stats">
          <span>${channel.watchTime}m</span>
          <span>${channel.videoCount} videos</span>
          <span>${channel.avgEngagement}% engagement</span>
        </div>
      </li>
    `).join('');
  }

  renderTopCategories(topCategories) {
    const container = document.getElementById('top-categories');
    if (!container || !topCategories?.length) {
      container.innerHTML = `
        <li class="empty-list-item">
          <div class="empty-list-content">
            <div class="empty-list-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div class="empty-list-text">Explore different content to see categories</div>
          </div>
        </li>
      `;
      return;
    }
    
    // Category icons mapping
    const categoryIcons = {
      'education': '📚',
      'entertainment': '🎭',
      'gaming': '🎮',
      'music': '🎵',
      'technology': '💻',
      'lifestyle': '✨',
      'news': '📰',
      'sports': '⚽',
      'cooking': '👨‍🍳',
      'fitness': '💪',
      'other': '📁'
    };
    
    container.innerHTML = topCategories.slice(0, 5).map(category => `
      <li class="top-list-item">
        <div class="channel-name">
          ${categoryIcons[category.name] || '📁'} ${this.capitalize(category.name)}
        </div>
        <div class="channel-stats">
          <span>${category.watchTime}m</span>
          <span>${category.videoCount} videos</span>
        </div>
      </li>
    `).join('');
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  renderCharts(visualizations) {
    if (!visualizations) return;
    
    // Render hourly pattern
    this.renderHourlyChart(visualizations.hourlyPattern);
    
    // Render weekly pattern  
    this.renderWeeklyChart(visualizations.weeklyPattern);
  }

  renderHourlyChart(hourlyData) {
    const container = document.getElementById('hourly-chart');
    if (!container || !hourlyData?.length) return;
    
    const maxValue = Math.max(...hourlyData.map(h => h.watchTime));
    const chartHeight = 220;
    
    if (maxValue === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px 20px; text-align: center; min-height: 180px;">
          <div style="margin-bottom: 16px; color: rgba(236, 0, 63, 0.6); opacity: 0.8;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3v18h18"/>
              <path d="M9 17l4-4 4 4 4-4"/>
            </svg>
          </div>
          <div style="color: rgba(75, 85, 99, 0.8); font-size: 14px; font-weight: 500; max-width: 280px; line-height: 1.5;">Hourly pattern will appear as you watch more content</div>
        </div>
      `;
      return;
    }
    
    // Enhanced interactive chart with hover effects and better styling
    container.innerHTML = `
      <div class="chart-container" style="position: relative; height: ${chartHeight}px;">
        <div class="chart-bars" style="display: flex; align-items: end; justify-content: space-between; height: ${chartHeight - 40}px; padding: 20px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(236, 0, 63, 0.1); border-radius: 12px; gap: 2px;">
          ${hourlyData.map((hour, index) => {
            const height = (hour.watchTime / maxValue) * (chartHeight - 80);
            const period = hour.hour < 12 ? 'AM' : 'PM';
            const displayHour = hour.hour === 0 ? 12 : hour.hour > 12 ? hour.hour - 12 : hour.hour;
            const intensity = hour.watchTime / maxValue;
            const color = this.getIntensityColor(intensity);
            
            return `
              <div class="chart-bar" style="display: flex; flex-direction: column; align-items: center; flex: 1; cursor: pointer; transition: all 0.3s ease;" 
                   onmouseover="this.style.transform='translateY(-2px)'; this.querySelector('.bar-fill').style.opacity='1';" 
                   onmouseout="this.style.transform=''; this.querySelector('.bar-fill').style.opacity='0.9';">
                <div class="bar-value" style="font-size: 10px; color: #ec003f; font-weight: 600; margin-bottom: 4px; opacity: ${intensity > 0.3 ? 1 : 0};">${hour.watchTime}m</div>
                <div class="bar-fill" style="width: 100%; max-width: 18px; height: ${Math.max(height, 4)}px; background: ${color}; border-radius: 4px 4px 0 0; margin-bottom: 8px; opacity: 0.9; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(236, 0, 63, 0.2);" 
                     title="${hour.watchTime} minutes at ${displayHour}${period}"></div>
                <div class="bar-label" style="font-size: 9px; color: rgba(255, 255, 255, 0.7); font-weight: 500; text-align: center;">${displayHour}<br><span style="font-size: 8px; opacity: 0.8;">${period}</span></div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="chart-insights" style="text-align: center; margin-top: 16px; color: rgba(255, 255, 255, 0.8); font-size: 13px; font-weight: 500;">
          <span style="color: #ec003f; font-weight: 600;">Peak hours:</span> ${this.findPeakHours(hourlyData).join(', ') || 'None yet'}
        </div>
      </div>
    `;
  }

  findPeakHours(hourlyData) {
    const avgWatchTime = hourlyData.reduce((sum, h) => sum + h.watchTime, 0) / hourlyData.length;
    return hourlyData
      .filter(h => h.watchTime > avgWatchTime * 1.5)
      .map(h => {
        const period = h.hour < 12 ? 'AM' : 'PM';
        const displayHour = h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour;
        return `${displayHour}${period}`;
      })
      .slice(0, 3);
  }

  renderWeeklyChart(weeklyData) {
    const container = document.getElementById('weekly-chart');
    if (!container || !weeklyData?.length) return;
    
    const maxValue = Math.max(...weeklyData.map(d => d.watchTime));
    const chartHeight = 220;
    
    if (maxValue === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px 20px; text-align: center; min-height: 180px;">
          <div style="margin-bottom: 16px; color: rgba(236, 0, 63, 0.6); opacity: 0.8;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 2v4"/>
              <path d="M16 2v4"/>
              <rect width="18" height="18" x="3" y="4" rx="2"/>
              <path d="M3 10h18"/>
            </svg>
          </div>
          <div style="color: rgba(75, 85, 99, 0.8); font-size: 14px; font-weight: 500; max-width: 280px; line-height: 1.5;">Weekly patterns will show your viewing habits over time</div>
        </div>
      `;
      return;
    }
    
    // Enhanced weekly chart with better interactivity
    container.innerHTML = `
      <div class="chart-container" style="position: relative; height: ${chartHeight}px;">
        <div class="chart-bars" style="display: flex; align-items: end; justify-content: space-between; height: ${chartHeight - 40}px; padding: 20px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(236, 0, 63, 0.1); border-radius: 12px; gap: 4px;">
          ${weeklyData.map((day, index) => {
            const height = (day.watchTime / maxValue) * (chartHeight - 80);
            const intensity = day.watchTime / maxValue;
            const color = this.getWeeklyColor(intensity);
            const isToday = this.isToday(day.day);
            
            return `
              <div class="chart-bar weekly-bar" style="display: flex; flex-direction: column; align-items: center; flex: 1; cursor: pointer; transition: all 0.3s ease; ${isToday ? 'transform: scale(1.05);' : ''}" 
                   onmouseover="this.style.transform='translateY(-3px) scale(1.05)'; this.querySelector('.bar-fill').style.opacity='1';" 
                   onmouseout="this.style.transform='${isToday ? 'scale(1.05)' : ''}'; this.querySelector('.bar-fill').style.opacity='0.9';">
                <div class="bar-value" style="font-size: 11px; color: #ec003f; font-weight: 700; margin-bottom: 6px; opacity: ${intensity > 0.2 ? 1 : 0};">${day.watchTime}m</div>
                <div class="bar-fill" style="width: 100%; max-width: 32px; height: ${Math.max(height, 6)}px; background: ${color}; border-radius: 6px 6px 0 0; margin-bottom: 10px; opacity: 0.9; transition: all 0.3s ease; box-shadow: 0 3px 12px rgba(236, 0, 63, 0.25); ${isToday ? 'border: 2px solid #ec003f;' : ''}" 
                     title="${day.watchTime} minutes on ${day.day}${isToday ? ' (Today)' : ''}"></div>
                <div class="bar-label" style="font-size: 11px; color: ${isToday ? '#ec003f' : 'rgba(255, 255, 255, 0.8)'}; font-weight: ${isToday ? '700' : '600'}; text-align: center;">
                  ${day.day.slice(0, 3)}
                  ${isToday ? '<div style="font-size: 8px; opacity: 0.8;">TODAY</div>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="chart-insights" style="text-align: center; margin-top: 16px; color: rgba(255, 255, 255, 0.8); font-size: 13px; font-weight: 500;">
          <span style="color: #ec003f; font-weight: 600;">Most active:</span> ${this.findMostActiveDay(weeklyData)}
          <span style="margin-left: 20px; color: #ec003f; font-weight: 600;">Total:</span> ${weeklyData.reduce((sum, d) => sum + d.watchTime, 0)}m this week
        </div>
      </div>
    `;
  }

  findMostActiveDay(weeklyData) {
    const maxDay = weeklyData.reduce((max, day) => day.watchTime > max.watchTime ? day : max, weeklyData[0]);
    return maxDay.day;
  }

  getIntensityColor(intensity) {
    // Generate color based on intensity (0-1) with red theme
    const alpha = Math.max(0.3, intensity);
    return `linear-gradient(135deg, rgba(236, 0, 63, ${alpha}) 0%, rgba(180, 0, 40, ${alpha + 0.2}) 100%)`;
  }

  getWeeklyColor(intensity) {
    // Different gradient for weekly chart
    const alpha = Math.max(0.4, intensity);
    return `linear-gradient(135deg, rgba(236, 0, 63, ${alpha}) 0%, rgba(255, 70, 120, ${alpha}) 50%, rgba(236, 0, 63, ${alpha + 0.1}) 100%)`;
  }

  isToday(dayName) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return today === dayName;
  }

  renderInsights(insights) {
    const container = document.getElementById('insights');
    if (!container) return;
    
    if (!insights?.recommendations?.length) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-content">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
              </svg>
            </div>
            <h3 class="empty-state-title">Building Your Profile</h3>
            <p class="empty-state-subtitle">Keep watching videos to unlock personalized insights</p>
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = insights.recommendations.map(rec => {
      const typeClasses = {
        'peak_time': 'positive',
        'engagement': 'neutral',
        'diversity': 'positive',
        'content_quality': 'neutral'
      };
      
      const typeIcons = {
        'peak_time': '⏰',
        'engagement': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>',
        'diversity': '🌟',
        'content_quality': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
      };
      
      return `
        <div class="insight-card ${typeClasses[rec.type] || 'neutral'}">
          <div class="insight-title">${typeIcons[rec.type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>'} ${rec.title || 'Insight'}</div>
          <div class="insight-message">${rec.message}</div>
        </div>
      `;
    }).join('');
  }

  renderAchievements(achievements) {
    const container = document.getElementById('achievements');
    if (!container) return;
    
    // Define standard achievements
    const standardAchievements = [
      {
        id: 'first_hour',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
        title: 'First Hour',
        description: 'Watched your first hour of content',
        unlocked: false
      },
      {
        id: 'week_streak',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.28 2.65-.2 3.73-.99 2.25-2.7 5.11-4.01 5.11z"/></svg>',
        title: 'Weekly Warrior',
        description: 'Watched videos 7 days in a row',
        unlocked: false
      },
      {
        id: 'quality_viewer',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
        title: 'Quality Viewer',
        description: 'High engagement with watched content',
        unlocked: false
      },
      {
        id: 'explorer',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
        title: 'Content Explorer',
        description: 'Discovered 10 different channels',
        unlocked: false
      },
      {
        id: 'binge_master',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM4 6h9v7H4z"/></svg>',
        title: 'Binge Master',
        description: 'Watched 10+ videos in one session',
        unlocked: false
      },
      {
        id: 'hundred_hours',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        title: 'Century Club',
        description: 'Reached 100 hours of watch time',
        unlocked: false
      }
    ];
    
    // Check which achievements are unlocked based on current data
    if (this.dashboardData?.overview) {
      const overview = this.dashboardData.overview;
      standardAchievements.forEach(achievement => {
        switch (achievement.id) {
          case 'first_hour':
            achievement.unlocked = overview.totalWatchTime >= 60;
            break;
          case 'week_streak':
            achievement.unlocked = (overview.watchingStreak?.current || 0) >= 7;
            break;
          case 'quality_viewer':
            achievement.unlocked = overview.efficiency >= 80;
            break;
          case 'explorer':
            achievement.unlocked = overview.uniqueChannels >= 10;
            break;
          case 'hundred_hours':
            achievement.unlocked = overview.totalWatchTime >= 6000; // 100 hours in minutes
            break;
        }
      });
    }
    
    // Merge with any achievements from insights
    const allAchievements = [...standardAchievements, ...(achievements || [])];
    
    container.innerHTML = allAchievements.map(achievement => `
      <div class="achievement-card ${achievement.unlocked ? 'unlocked' : ''}">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-title">${achievement.title}</div>
        <div class="achievement-description">${achievement.description}</div>
        ${achievement.unlocked ? '<div style="color: #ffd700; font-weight: 600; margin-top: 8px;">✨ Unlocked!</div>' : ''}
      </div>
    `).join('');
  }

  async exportData(format) {
    if (!this.analyticsEngine) {
      this.showError('Analytics engine not initialized');
      return;
    }
    
    // Show loading state
    const button = document.getElementById(`export-${format}`);
    if (button) {
      const originalText = button.textContent;
      button.textContent = `Exporting ${format.toUpperCase()}...`;
      button.disabled = true;
      button.style.opacity = '0.7';
      
      // Restore button after 3 seconds regardless of outcome
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '';
      }, 3000);
    }
    
    try {
      console.log(`YCN Analytics: Exporting data as ${format}...`);
      const exportedData = await this.analyticsEngine.exportAnalytics(format, this.currentTimeRange);
      
      if (!exportedData || exportedData.length === 0) {
        this.showError('No data available for export. Start watching videos to build your analytics data.');
        return;
      }
      
      // Create download
      const blob = new Blob([exportedData], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-analytics-${this.currentTimeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`YCN Analytics: Data exported successfully as ${format}`);
      
    } catch (error) {
      console.error(`YCN Analytics: Export failed:`, error);
      this.showError(`Failed to export data as ${format.toUpperCase()}`);
    }
  }

  async shareInsights() {
    if (!this.dashboardData) {
      this.showError('No insights available to share');
      return;
    }
    
    try {
      const overview = this.dashboardData.overview;
      const shareText = `My YouTube Analytics (${this.currentTimeRange}):\n\n` +
        `Watch Time: ${overview.totalWatchTime} minutes\n` +
        `Videos: ${overview.totalVideos}\n` +
        `Channels: ${overview.uniqueChannels}\n` +
        `Efficiency: ${overview.efficiency}%\n` +
        `Streak: ${overview.watchingStreak?.current || 0} days\n\n` +
        `Top Channel: ${overview.topChannels?.[0]?.channelName || 'N/A'}\n` +
        `Generated by YouTube Channel Notifier`;
      
      // Check if Web Share API is available and we're in a secure context
      if (navigator.share && window.isSecureContext && document.hasFocus()) {
        try {
          await navigator.share({
            title: 'My YouTube Analytics',
            text: shareText
          });
          return;
        } catch (shareError) {
          console.log('YCN Analytics: Native share failed, falling back to clipboard:', shareError);
        }
      }
      
      // Fallback: copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
        // Show success feedback
        const button = document.getElementById('share-insights');
        if (button) {
          const originalText = button.textContent;
          button.textContent = '✓ Copied to Clipboard';
          button.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
          }, 2000);
        }
      } else {
        // Final fallback: show text in a prompt/alert
        prompt('Copy this text to share your analytics:', shareText);
      }
    } catch (error) {
      console.error('YCN Analytics: Share failed:', error);
      this.showError('Failed to share insights');
    }
  }

  showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.toggle('active', show);
    }
  }

  showError(message) {
    const errorElement = document.getElementById('error');
    const errorText = document.getElementById('error-text');
    
    if (errorElement && errorText) {
      errorText.textContent = message;
      errorElement.classList.add('active');
    }
  }

  hideError() {
    const errorElement = document.getElementById('error');
    if (errorElement) {
      errorElement.classList.remove('active');
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('YCN Analytics Dashboard: DOM loaded');
  
  const dashboard = new AnalyticsDashboard();
  await dashboard.initialize();
});

// Handle navigation from other pages
if (window.location.hash === '#analytics') {
  console.log('YCN Analytics: Direct navigation detected');
}