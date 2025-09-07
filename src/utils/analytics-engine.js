/**
 * Personal YouTube Analytics Engine
 * Advanced analytics system for tracking and analyzing YouTube viewing patterns
 */

class PersonalAnalyticsEngine {
  constructor() {
    this.dataCollector = new ViewingDataCollector();
    this.patternAnalyzer = new PatternAnalyzer();
    this.insightGenerator = new InsightGenerator();
    this.storageManager = new AnalyticsStorageManager();
  }

  async initialize() {
    console.log('YCN Analytics: Initializing analytics engine...');
    await this.storageManager.initialize();
    await this.dataCollector.initialize();
    
    // Start background data collection
    this.startDataCollection();
    
    console.log('YCN Analytics: Engine initialized successfully');
  }

  startDataCollection() {
    // Collect analytics every 30 seconds when active
    setInterval(async () => {
      await this.collectCurrentSession();
    }, 30000);

    // Generate insights every hour
    setInterval(async () => {
      await this.generateInsights();
    }, 3600000);
  }

  async collectCurrentSession() {
    try {
      const sessionData = await this.dataCollector.getCurrentSessionData();
      if (sessionData) {
        await this.storageManager.recordSession(sessionData);
      }
    } catch (error) {
      console.error('YCN Analytics: Error collecting session data:', error);
    }
  }

  async generateInsights() {
    try {
      const rawData = await this.storageManager.getAllData();
      const insights = await this.insightGenerator.generateInsights(rawData);
      await this.storageManager.storeInsights(insights);
    } catch (error) {
      console.error('YCN Analytics: Error generating insights:', error);
    }
  }

  async getAnalyticsDashboard(timeRange = '7d') {
    try {
      const data = await this.storageManager.getDataForRange(timeRange);
      const insights = await this.storageManager.getLatestInsights();
      
      return {
        overview: this.buildOverview(data),
        patterns: this.patternAnalyzer.analyzePatterns(data),
        insights: insights,
        recommendations: this.generateRecommendations(data, insights),
        visualizations: this.buildVisualizationData(data)
      };
    } catch (error) {
      console.error('YCN Analytics: Error building dashboard:', error);
      return null;
    }
  }

  buildOverview(data) {
    // Add null checks and default values
    if (!data || !data.sessions || data.sessions.length === 0) {
      return {
        totalWatchTime: 0,
        totalVideos: 0,
        uniqueChannels: 0,
        averageSessionLength: 0,
        topChannels: [],
        topCategories: [],
        watchingStreak: 0,
        efficiency: 0
      };
    }
    
    const totalWatchTime = data.sessions.reduce((total, session) => total + (session.watchTime || 0), 0);
    const totalVideos = data.sessions.reduce((total, session) => total + (session.videosWatched || 0), 0);
    const uniqueChannels = new Set(data.sessions.map(s => s.channelId).filter(Boolean)).size;
    
    return {
      totalWatchTime: Math.round(totalWatchTime / 60), // Convert to minutes
      totalVideos,
      uniqueChannels,
      averageSessionLength: data.sessions.length > 0 ? Math.round(totalWatchTime / data.sessions.length / 60) : 0,
      topChannels: this.getTopChannels(data),
      topCategories: this.getTopCategories(data),
      watchingStreak: this.calculateWatchingStreak(data),
      efficiency: this.calculateWatchingEfficiency(data)
    };
  }

  getTopChannels(data) {
    const channelStats = {};
    
    data.sessions.forEach(session => {
      if (!channelStats[session.channelId]) {
        channelStats[session.channelId] = {
          channelId: session.channelId,
          channelName: session.channelName,
          watchTime: 0,
          videoCount: 0,
          engagementScore: 0
        };
      }
      
      channelStats[session.channelId].watchTime += session.watchTime;
      channelStats[session.channelId].videoCount += session.videosWatched;
      channelStats[session.channelId].engagementScore += session.engagementScore || 0;
    });
    
    return Object.values(channelStats)
      .sort((a, b) => b.watchTime - a.watchTime)
      .slice(0, 10)
      .map(channel => ({
        ...channel,
        watchTime: Math.round(channel.watchTime / 60), // Convert to minutes
        avgEngagement: Math.round(channel.engagementScore / channel.videoCount)
      }));
  }

  getTopCategories(data) {
    const categories = {};
    
    data.sessions.forEach(session => {
      if (session.category) {
        if (!categories[session.category]) {
          categories[session.category] = {
            name: session.category,
            watchTime: 0,
            videoCount: 0
          };
        }
        categories[session.category].watchTime += session.watchTime;
        categories[session.category].videoCount += session.videosWatched;
      }
    });
    
    return Object.values(categories)
      .sort((a, b) => b.watchTime - a.watchTime)
      .slice(0, 8)
      .map(cat => ({
        ...cat,
        watchTime: Math.round(cat.watchTime / 60)
      }));
  }

  calculateWatchingStreak(data) {
    const sortedSessions = data.sessions
      .sort((a, b) => a.timestamp - b.timestamp);
    
    let currentStreak = 0;
    let maxStreak = 0;
    let lastDate = null;
    
    sortedSessions.forEach(session => {
      const sessionDate = new Date(session.timestamp).toDateString();
      
      if (lastDate === null || sessionDate === lastDate) {
        currentStreak = 1;
      } else {
        const dayDiff = (new Date(sessionDate) - new Date(lastDate)) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      
      maxStreak = Math.max(maxStreak, currentStreak);
      lastDate = sessionDate;
    });
    
    return { current: currentStreak, max: maxStreak };
  }

  calculateWatchingEfficiency(data) {
    // Add null check
    if (!data || !data.sessions || data.sessions.length === 0) {
      return 0;
    }
    
    const totalTime = data.sessions.reduce((total, session) => total + (session?.totalTime || 0), 0);
    const watchTime = data.sessions.reduce((total, session) => total + (session?.watchTime || 0), 0);
    
    return totalTime > 0 ? Math.round((watchTime / totalTime) * 100) : 0;
  }

  buildVisualizationData(data) {
    return {
      hourlyPattern: this.buildHourlyPattern(data),
      weeklyPattern: this.buildWeeklyPattern(data),
      monthlyTrend: this.buildMonthlyTrend(data),
      channelDistribution: this.buildChannelDistribution(data),
      categoryBreakdown: this.buildCategoryBreakdown(data),
      engagementTrend: this.buildEngagementTrend(data)
    };
  }

  buildHourlyPattern(data) {
    const hourlyStats = Array(24).fill(0).map((_, hour) => ({
      hour,
      watchTime: 0,
      videoCount: 0,
      sessions: 0
    }));
    
    data.sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourlyStats[hour].watchTime += session.watchTime;
      hourlyStats[hour].videoCount += session.videosWatched;
      hourlyStats[hour].sessions += 1;
    });
    
    return hourlyStats.map(stat => ({
      ...stat,
      watchTime: Math.round(stat.watchTime / 60)
    }));
  }

  buildWeeklyPattern(data) {
    const weeklyStats = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .map((day, index) => ({
        day,
        dayIndex: index,
        watchTime: 0,
        videoCount: 0,
        sessions: 0
      }));
    
    data.sessions.forEach(session => {
      const dayIndex = new Date(session.timestamp).getDay();
      weeklyStats[dayIndex].watchTime += session.watchTime;
      weeklyStats[dayIndex].videoCount += session.videosWatched;
      weeklyStats[dayIndex].sessions += 1;
    });
    
    return weeklyStats.map(stat => ({
      ...stat,
      watchTime: Math.round(stat.watchTime / 60)
    }));
  }

  buildMonthlyTrend(data) {
    const monthlyStats = {};
    
    data.sessions.forEach(session => {
      const monthKey = new Date(session.timestamp).toISOString().substring(0, 7); // YYYY-MM
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          watchTime: 0,
          videoCount: 0,
          sessions: 0,
          uniqueChannels: new Set()
        };
      }
      
      monthlyStats[monthKey].watchTime += session.watchTime;
      monthlyStats[monthKey].videoCount += session.videosWatched;
      monthlyStats[monthKey].sessions += 1;
      monthlyStats[monthKey].uniqueChannels.add(session.channelId);
    });
    
    return Object.values(monthlyStats)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(stat => ({
        ...stat,
        watchTime: Math.round(stat.watchTime / 60),
        uniqueChannels: stat.uniqueChannels.size
      }));
  }

  buildChannelDistribution(data) {
    const channelStats = this.getTopChannels(data);
    const totalWatchTime = channelStats.reduce((total, channel) => total + channel.watchTime, 0);
    
    return channelStats.map(channel => ({
      ...channel,
      percentage: Math.round((channel.watchTime / totalWatchTime) * 100)
    }));
  }

  buildCategoryBreakdown(data) {
    const categoryStats = this.getTopCategories(data);
    const totalWatchTime = categoryStats.reduce((total, cat) => total + cat.watchTime, 0);
    
    return categoryStats.map(category => ({
      ...category,
      percentage: Math.round((category.watchTime / totalWatchTime) * 100)
    }));
  }

  buildEngagementTrend(data) {
    const dailyEngagement = {};
    
    data.sessions.forEach(session => {
      const dateKey = new Date(session.timestamp).toISOString().substring(0, 10);
      
      if (!dailyEngagement[dateKey]) {
        dailyEngagement[dateKey] = {
          date: dateKey,
          totalEngagement: 0,
          sessionCount: 0
        };
      }
      
      dailyEngagement[dateKey].totalEngagement += session.engagementScore || 0;
      dailyEngagement[dateKey].sessionCount += 1;
    });
    
    return Object.values(dailyEngagement)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => ({
        ...day,
        averageEngagement: Math.round(day.totalEngagement / day.sessionCount)
      }));
  }

  generateRecommendations(data, insights) {
    const recommendations = [];
    
    // Null check for data
    if (!data || !data.sessions) {
      return recommendations;
    }
    
    // Peak time recommendations
    const peakHours = this.findPeakHours(data);
    if (peakHours && peakHours.length > 0) {
      recommendations.push({
        type: 'peak_time',
        title: 'Optimize Your Schedule',
        message: `You're most active watching YouTube at ${peakHours.join(', ')}. Consider scheduling important videos during these times.`,
        priority: 'medium'
      });
    }
    
    // Engagement recommendations - with proper null check
    const avgEngagement = (insights && insights.averageEngagement !== undefined) ? insights.averageEngagement : 0;
    if (avgEngagement < 50) {
      recommendations.push({
        type: 'engagement',
        title: 'Improve Content Quality',
        message: `Your average engagement is ${avgEngagement}%. Consider being more selective with video choices.`,
        priority: 'high'
      });
    }
    
    // Diversity recommendations
    const channelDiversity = this.calculateChannelDiversity(data);
    if (channelDiversity < 0.3) {
      recommendations.push({
        type: 'diversity',
        title: 'Explore New Content',
        message: 'You\'re watching from a limited set of channels. Try exploring new creators in your favorite categories.',
        priority: 'low'
      });
    }
    
    return recommendations;
  }

  findPeakHours(data) {
    // Add null check
    if (!data || !data.sessions || data.sessions.length === 0) {
      return [];
    }
    
    const hourlyPattern = this.buildHourlyPattern(data);
    if (!hourlyPattern || hourlyPattern.length === 0) {
      return [];
    }
    
    const avgWatchTime = hourlyPattern.reduce((sum, h) => sum + (h?.watchTime || 0), 0) / 24;
    
    return hourlyPattern
      .filter(hour => hour.watchTime > avgWatchTime * 1.5)
      .map(hour => {
        const period = hour.hour < 12 ? 'AM' : 'PM';
        const displayHour = hour.hour === 0 ? 12 : hour.hour > 12 ? hour.hour - 12 : hour.hour;
        return `${displayHour}${period}`;
      });
  }

  calculateChannelDiversity(data) {
    // Add null check
    if (!data || !data.sessions || data.sessions.length === 0) {
      return 0;
    }
    
    const totalSessions = data.sessions.length;
    const uniqueChannels = new Set(data.sessions.filter(s => s?.channelId).map(s => s.channelId)).size;
    
    return totalSessions > 0 ? uniqueChannels / totalSessions : 0;
  }

  async exportAnalytics(format = 'json', timeRange = '30d') {
    try {
      const data = await this.getAnalyticsDashboard(timeRange);
      
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        // Get raw session data for CSV export
        const rawData = await this.storageManager.getDataForRange(timeRange);
        return this.convertToCSV(data, rawData);
      }
      
      return data;
    } catch (error) {
      console.error('YCN Analytics: Error exporting data:', error);
      return null;
    }
  }

  convertToCSV(analyticsData, rawData) {
    const headers = ['Date', 'Time', 'Video Title', 'Channel', 'Watch Time (min)', 'Total Duration (min)', 'Completion %', 'Category'];
    let csv = headers.join(',') + '\n';
    
    // If no raw session data, create CSV from overview data
    if (!rawData || !rawData.sessions || rawData.sessions.length === 0) {
      // Fallback: Use overview data to create summary CSV
      const overview = analyticsData.overview || {};
      const summaryHeaders = ['Metric', 'Value'];
      csv = summaryHeaders.join(',') + '\n';
      
      const summaryData = [
        ['Total Watch Time (minutes)', overview.totalWatchTime || 0],
        ['Videos Watched', overview.totalVideos || 0],
        ['Unique Channels', overview.uniqueChannels || 0],
        ['Average Session Length (minutes)', overview.averageSessionLength || 0],
        ['Watching Efficiency %', overview.efficiency || 0],
        ['Current Streak (days)', overview.watchingStreak?.current || 0]
      ];
      
      summaryData.forEach(row => {
        csv += row.map(field => `"${field}"`).join(',') + '\n';
      });
      
      return csv;
    }
    
    // Use raw session data for detailed CSV
    const sessions = Array.isArray(rawData.sessions) ? rawData.sessions : (Array.isArray(rawData) ? rawData : []);
    sessions.forEach(session => {
      if (!session) return;
      
      const date = session.timestamp ? new Date(session.timestamp) : new Date();
      const completionRate = session.totalTime > 0 
        ? Math.round((session.watchTime / session.totalTime) * 100) 
        : 0;
      
      const row = [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        `"${(session.videoTitle || 'Unknown Video').replace(/"/g, '""')}"`,
        `"${(session.channelName || 'Unknown Channel').replace(/"/g, '""')}"`,
        Math.round((session.watchTime || 0) / 60),
        Math.round((session.totalTime || 0) / 60),
        completionRate,
        `"${(session.category || 'General').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }
}

class ViewingDataCollector {
  constructor() {
    this.currentSession = null;
    this.sessionStartTime = null;
  }

  async initialize() {
    console.log('YCN Analytics: Data collector initialized');
  }

  async getCurrentSessionData() {
    try {
      // Get current tab information
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.url || !currentTab.url.includes('youtube.com/watch')) {
        return null;
      }
      
      // Extract video and channel information
      const videoId = this.extractVideoId(currentTab.url);
      if (!videoId) return null;
      
      // Get engagement data from content script with enhanced error handling
      let response;
      try {
        response = await chrome.tabs.sendMessage(currentTab.id, {
          type: 'GET_SESSION_DATA'
        });
      } catch (messageError) {
        // Handle "Receiving end does not exist" error gracefully
        if (messageError.message && messageError.message.includes('Receiving end does not exist')) {
          console.warn('YCN Analytics: Content script not ready yet, skipping session data collection');
          return null;
        } else if (messageError.message && messageError.message.includes('Could not establish connection')) {
          console.warn('YCN Analytics: Connection failed to content script, skipping session data collection');
          return null;
        } else {
          throw messageError; // Re-throw other errors
        }
      }
      
      if (!response || !response.success) return null;
      
      return {
        timestamp: Date.now(),
        videoId: videoId,
        channelId: response.channelId,
        channelName: response.channelName,
        videoTitle: response.videoTitle,
        watchTime: response.watchTime || 0,
        totalTime: response.totalTime || 0,
        engagementScore: response.engagementScore || 0,
        videosWatched: 1,
        category: response.category || 'unknown',
        deviceType: this.getDeviceType(),
        sessionId: this.generateSessionId()
      };
    } catch (error) {
      console.error('YCN Analytics: Error collecting session data:', error);
      return null;
    }
  }

  extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  getDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad/.test(userAgent)) return 'mobile';
    if (/tablet/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

class PatternAnalyzer {
  analyzePatterns(data) {
    return {
      peakWatchingTimes: this.findPeakTimes(data),
      bingeSessions: this.detectBingeSessions(data),
      contentPreferences: this.analyzeContentPreferences(data),
      engagementPatterns: this.analyzeEngagementPatterns(data),
      seasonalTrends: this.detectSeasonalTrends(data)
    };
  }

  findPeakTimes(data) {
    const hourlyData = Array(24).fill(0);
    
    data.sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourlyData[hour] += session.watchTime;
    });
    
    const maxTime = Math.max(...hourlyData);
    const threshold = maxTime * 0.7;
    
    return hourlyData
      .map((time, hour) => ({ hour, time }))
      .filter(item => item.time >= threshold)
      .map(item => item.hour);
  }

  detectBingeSessions(data) {
    const bingeSessions = [];
    const sortedSessions = data.sessions.sort((a, b) => a.timestamp - b.timestamp);
    
    let currentBinge = [];
    let lastSessionTime = 0;
    
    sortedSessions.forEach(session => {
      const timeDiff = session.timestamp - lastSessionTime;
      
      // If sessions are within 30 minutes of each other, consider it a binge
      if (timeDiff < 30 * 60 * 1000 && currentBinge.length > 0) {
        currentBinge.push(session);
      } else {
        if (currentBinge.length >= 3) { // 3+ videos = binge
          bingeSessions.push({
            start: currentBinge[0].timestamp,
            end: currentBinge[currentBinge.length - 1].timestamp,
            videoCount: currentBinge.length,
            totalWatchTime: currentBinge.reduce((sum, s) => sum + s.watchTime, 0)
          });
        }
        currentBinge = [session];
      }
      
      lastSessionTime = session.timestamp;
    });
    
    return bingeSessions;
  }

  analyzeContentPreferences(data) {
    const preferences = {
      videoLength: { short: 0, medium: 0, long: 0 },
      categories: {},
      channels: {}
    };
    
    data.sessions.forEach(session => {
      // Analyze video length preference
      if (session.totalTime < 300) preferences.videoLength.short += session.watchTime;
      else if (session.totalTime < 1200) preferences.videoLength.medium += session.watchTime;
      else preferences.videoLength.long += session.watchTime;
      
      // Category preferences
      if (session.category) {
        preferences.categories[session.category] = 
          (preferences.categories[session.category] || 0) + session.watchTime;
      }
      
      // Channel preferences
      preferences.channels[session.channelId] = 
        (preferences.channels[session.channelId] || 0) + session.watchTime;
    });
    
    return preferences;
  }

  analyzeEngagementPatterns(data) {
    const patterns = {
      byTimeOfDay: Array(24).fill(0).map(() => ({ totalEngagement: 0, count: 0 })),
      byDayOfWeek: Array(7).fill(0).map(() => ({ totalEngagement: 0, count: 0 })),
      byCategory: {}
    };
    
    data.sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      const dayOfWeek = new Date(session.timestamp).getDay();
      const engagement = session.engagementScore || 0;
      
      patterns.byTimeOfDay[hour].totalEngagement += engagement;
      patterns.byTimeOfDay[hour].count += 1;
      
      patterns.byDayOfWeek[dayOfWeek].totalEngagement += engagement;
      patterns.byDayOfWeek[dayOfWeek].count += 1;
      
      if (session.category) {
        if (!patterns.byCategory[session.category]) {
          patterns.byCategory[session.category] = { totalEngagement: 0, count: 0 };
        }
        patterns.byCategory[session.category].totalEngagement += engagement;
        patterns.byCategory[session.category].count += 1;
      }
    });
    
    // Calculate averages
    patterns.byTimeOfDay = patterns.byTimeOfDay.map((item, hour) => ({
      hour,
      averageEngagement: item.count > 0 ? Math.round(item.totalEngagement / item.count) : 0
    }));
    
    patterns.byDayOfWeek = patterns.byDayOfWeek.map((item, day) => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      averageEngagement: item.count > 0 ? Math.round(item.totalEngagement / item.count) : 0
    }));
    
    for (const category in patterns.byCategory) {
      const data = patterns.byCategory[category];
      patterns.byCategory[category] = {
        averageEngagement: Math.round(data.totalEngagement / data.count)
      };
    }
    
    return patterns;
  }

  detectSeasonalTrends(data) {
    const monthlyData = {};
    
    data.sessions.forEach(session => {
      const month = new Date(session.timestamp).getMonth();
      if (!monthlyData[month]) {
        monthlyData[month] = { watchTime: 0, videoCount: 0, categories: {} };
      }
      
      monthlyData[month].watchTime += session.watchTime;
      monthlyData[month].videoCount += 1;
      
      if (session.category) {
        monthlyData[month].categories[session.category] = 
          (monthlyData[month].categories[session.category] || 0) + 1;
      }
    });
    
    return monthlyData;
  }
}

class InsightGenerator {
  async generateInsights(data) {
    const insights = {
      timestamp: Date.now(),
      summary: this.generateSummary(data),
      trends: this.identifyTrends(data),
      achievements: this.identifyAchievements(data),
      recommendations: this.generateRecommendations(data),
      predictions: this.generatePredictions(data)
    };
    
    return insights;
  }

  generateSummary(data) {
    const totalWatchTime = data.sessions.reduce((sum, s) => sum + s.watchTime, 0);
    const totalVideos = data.sessions.length;
    const uniqueChannels = new Set(data.sessions.map(s => s.channelId)).size;
    const avgEngagement = data.sessions.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / totalVideos;
    
    return {
      totalWatchTime: Math.round(totalWatchTime / 60), // minutes
      totalVideos,
      uniqueChannels,
      averageEngagement: Math.round(avgEngagement),
      mostActiveDay: this.findMostActiveDay(data),
      peakHour: this.findPeakHour(data)
    };
  }

  identifyTrends(data) {
    return {
      watchTimeChange: this.calculateTrendChange(data, 'watchTime'),
      engagementChange: this.calculateTrendChange(data, 'engagement'),
      diversityChange: this.calculateDiversityChange(data),
      popularCategories: this.getPopularCategories(data)
    };
  }

  calculateTrendChange(data, metric) {
    // Compare last 7 days to previous 7 days
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    
    const recent = data.sessions.filter(s => s.timestamp > now - week);
    const previous = data.sessions.filter(s => 
      s.timestamp > now - 2 * week && s.timestamp <= now - week
    );
    
    let recentValue = 0, previousValue = 0;
    
    if (metric === 'watchTime') {
      recentValue = recent.reduce((sum, s) => sum + s.watchTime, 0);
      previousValue = previous.reduce((sum, s) => sum + s.watchTime, 0);
    } else if (metric === 'engagement') {
      recentValue = recent.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / recent.length;
      previousValue = previous.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / previous.length;
    }
    
    if (previousValue === 0) return 0;
    return Math.round(((recentValue - previousValue) / previousValue) * 100);
  }

  calculateDiversityChange(data) {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    
    const recent = data.sessions.filter(s => s.timestamp > now - week);
    const previous = data.sessions.filter(s => 
      s.timestamp > now - 2 * week && s.timestamp <= now - week
    );
    
    const recentChannels = new Set(recent.map(s => s.channelId)).size;
    const previousChannels = new Set(previous.map(s => s.channelId)).size;
    
    if (previousChannels === 0) return 0;
    return Math.round(((recentChannels - previousChannels) / previousChannels) * 100);
  }

  getPopularCategories(data) {
    const categories = {};
    
    data.sessions.forEach(session => {
      if (session.category) {
        categories[session.category] = (categories[session.category] || 0) + 1;
      }
    });
    
    return Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  }

  identifyAchievements(data) {
    const achievements = [];
    
    // Watch time milestones
    const totalHours = data.sessions.reduce((sum, s) => sum + s.watchTime, 0) / 3600;
    if (totalHours >= 100) achievements.push({ type: 'milestone', title: '100 Hours Watched', description: 'You\'ve watched over 100 hours of content!' });
    
    // Consistency achievements
    const streak = this.calculateCurrentStreak(data);
    if (streak >= 7) achievements.push({ type: 'streak', title: 'Weekly Warrior', description: `${streak} days of consistent watching!` });
    
    // Engagement achievements
    const avgEngagement = data.sessions.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / data.sessions.length;
    if (avgEngagement >= 80) achievements.push({ type: 'engagement', title: 'Quality Viewer', description: 'High engagement with watched content!' });
    
    return achievements;
  }

  calculateCurrentStreak(data) {
    const sortedSessions = data.sessions.sort((a, b) => b.timestamp - a.timestamp);
    let streak = 0;
    let currentDate = new Date().toDateString();
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.timestamp).toDateString();
      if (sessionDate === currentDate) {
        streak = Math.max(streak, 1);
      } else {
        const dayDiff = (new Date(currentDate) - new Date(sessionDate)) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) {
          streak++;
          currentDate = sessionDate;
        } else {
          break;
        }
      }
    }
    
    return streak;
  }

  generateRecommendations(data) {
    const recommendations = [];
    
    // Based on engagement patterns
    const lowEngagementChannels = this.findLowEngagementChannels(data);
    if (lowEngagementChannels.length > 0) {
      recommendations.push({
        type: 'content_quality',
        message: `Consider reducing notifications from ${lowEngagementChannels.length} channels with low engagement.`,
        channels: lowEngagementChannels
      });
    }
    
    // Based on time patterns
    const peakHours = this.findOptimalWatchingHours(data);
    recommendations.push({
      type: 'scheduling',
      message: `You're most engaged during ${peakHours.join(', ')}. Schedule important videos during these times.`,
      hours: peakHours
    });
    
    return recommendations;
  }

  findLowEngagementChannels(data) {
    const channelEngagement = {};
    
    data.sessions.forEach(session => {
      if (!channelEngagement[session.channelId]) {
        channelEngagement[session.channelId] = {
          channelName: session.channelName,
          totalEngagement: 0,
          sessionCount: 0
        };
      }
      
      channelEngagement[session.channelId].totalEngagement += session.engagementScore || 0;
      channelEngagement[session.channelId].sessionCount += 1;
    });
    
    return Object.values(channelEngagement)
      .map(channel => ({
        ...channel,
        avgEngagement: channel.totalEngagement / channel.sessionCount
      }))
      .filter(channel => channel.avgEngagement < 30)
      .sort((a, b) => a.avgEngagement - b.avgEngagement);
  }

  findOptimalWatchingHours(data) {
    const hourlyEngagement = Array(24).fill(0).map(() => ({ totalEngagement: 0, count: 0 }));
    
    data.sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourlyEngagement[hour].totalEngagement += session.engagementScore || 0;
      hourlyEngagement[hour].count += 1;
    });
    
    return hourlyEngagement
      .map((data, hour) => ({
        hour,
        avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0
      }))
      .filter(item => item.avgEngagement > 0)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => {
        const period = item.hour < 12 ? 'AM' : 'PM';
        const displayHour = item.hour === 0 ? 12 : item.hour > 12 ? item.hour - 12 : item.hour;
        return `${displayHour}${period}`;
      });
  }

  generatePredictions(data) {
    // Simple trend-based predictions
    const recent = data.sessions.filter(s => s.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
    const avgDailyWatchTime = recent.reduce((sum, s) => sum + s.watchTime, 0) / 7;
    
    return {
      weeklyWatchTime: Math.round(avgDailyWatchTime * 7 / 60), // minutes
      monthlyWatchTime: Math.round(avgDailyWatchTime * 30 / 60),
      suggestedDailyLimit: Math.round(avgDailyWatchTime * 1.2 / 60), // 20% buffer
      nextPeakDay: this.predictNextPeakDay(data)
    };
  }

  predictNextPeakDay(data) {
    const weeklyPattern = this.buildWeeklyPattern(data);
    const today = new Date().getDay();
    
    const sortedDays = weeklyPattern
      .map((day, index) => ({ day: index, watchTime: day.watchTime }))
      .sort((a, b) => b.watchTime - a.watchTime);
    
    // Find the next highest watch time day
    for (const day of sortedDays) {
      if (day.day > today) {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.day];
      }
    }
    
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sortedDays[0].day];
  }

  buildWeeklyPattern(data) {
    const weeklyStats = Array(7).fill(0).map(() => ({ watchTime: 0, count: 0 }));
    
    data.sessions.forEach(session => {
      const dayIndex = new Date(session.timestamp).getDay();
      weeklyStats[dayIndex].watchTime += session.watchTime;
      weeklyStats[dayIndex].count += 1;
    });
    
    return weeklyStats.map(stat => ({
      watchTime: stat.count > 0 ? stat.watchTime / stat.count : 0
    }));
  }

  findMostActiveDay(data) {
    const weeklyPattern = this.buildWeeklyPattern(data);
    const maxIndex = weeklyPattern.reduce((maxIndex, current, index, array) => 
      current.watchTime > array[maxIndex].watchTime ? index : maxIndex, 0
    );
    
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][maxIndex];
  }

  findPeakHour(data) {
    const hourlyPattern = Array(24).fill(0);
    
    data.sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourlyPattern[hour] += session.watchTime;
    });
    
    const maxIndex = hourlyPattern.reduce((maxIndex, current, index, array) => 
      current > array[maxIndex] ? index : maxIndex, 0
    );
    
    const period = maxIndex < 12 ? 'AM' : 'PM';
    const displayHour = maxIndex === 0 ? 12 : maxIndex > 12 ? maxIndex - 12 : maxIndex;
    return `${displayHour}${period}`;
  }
}

class AnalyticsStorageManager {
  constructor() {
    this.storageKey = 'ycn_analytics_data';
    this.insightsKey = 'ycn_analytics_insights';
    this.maxSessions = 10000; // Limit stored sessions
    this.maxAge = 180 * 24 * 60 * 60 * 1000; // 180 days
  }

  async initialize() {
    console.log('YCN Analytics: Storage manager initialized');
    await this.cleanOldData();
  }

  async recordSession(sessionData) {
    try {
      const existingData = await this.getAllData();
      existingData.sessions.push(sessionData);
      
      // Maintain size limits
      if (existingData.sessions.length > this.maxSessions) {
        existingData.sessions = existingData.sessions.slice(-this.maxSessions);
      }
      
      await chrome.storage.local.set({ [this.storageKey]: existingData });
    } catch (error) {
      console.error('YCN Analytics: Error recording session:', error);
    }
  }

  async getAllData() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || { sessions: [] };
    } catch (error) {
      console.error('YCN Analytics: Error getting data:', error);
      return { sessions: [] };
    }
  }

  async getDataForRange(timeRange) {
    const data = await this.getAllData();
    const now = Date.now();
    
    let cutoffTime;
    switch (timeRange) {
      case '1d': cutoffTime = now - 24 * 60 * 60 * 1000; break;
      case '7d': cutoffTime = now - 7 * 24 * 60 * 60 * 1000; break;
      case '30d': cutoffTime = now - 30 * 24 * 60 * 60 * 1000; break;
      case '90d': cutoffTime = now - 90 * 24 * 60 * 60 * 1000; break;
      default: cutoffTime = 0;
    }
    
    return {
      sessions: (data.sessions || []).filter(session => session && session.timestamp > cutoffTime)
    };
  }

  async storeInsights(insights) {
    try {
      await chrome.storage.local.set({ [this.insightsKey]: insights });
    } catch (error) {
      console.error('YCN Analytics: Error storing insights:', error);
    }
  }

  async getLatestInsights() {
    try {
      const result = await chrome.storage.local.get([this.insightsKey]);
      return result[this.insightsKey] || null;
    } catch (error) {
      console.error('YCN Analytics: Error getting insights:', error);
      return null;
    }
  }

  async cleanOldData() {
    try {
      const data = await this.getAllData();
      const now = Date.now();
      
      const filteredSessions = data.sessions.filter(session => 
        (now - session.timestamp) < this.maxAge
      );
      
      if (filteredSessions.length !== data.sessions.length) {
        await chrome.storage.local.set({ 
          [this.storageKey]: { sessions: filteredSessions } 
        });
        console.log(`YCN Analytics: Cleaned ${data.sessions.length - filteredSessions.length} old sessions`);
      }
    } catch (error) {
      console.error('YCN Analytics: Error cleaning old data:', error);
    }
  }

  async exportData(format = 'json') {
    const data = await this.getAllData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }

  convertToCSV(data) {
    const headers = ['Timestamp', 'Video ID', 'Channel Name', 'Watch Time (s)', 'Engagement %', 'Category'];
    let csv = headers.join(',') + '\n';
    
    data.sessions.forEach(session => {
      const row = [
        new Date(session.timestamp).toISOString(),
        session.videoId || '',
        `"${session.channelName || 'Unknown'}"`,
        session.watchTime || 0,
        session.engagementScore || 0,
        session.category || 'unknown'
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PersonalAnalyticsEngine, ViewingDataCollector, PatternAnalyzer, InsightGenerator, AnalyticsStorageManager };
}

// Make globally available for extension
if (typeof self !== 'undefined') {
  self.PersonalAnalyticsEngine = PersonalAnalyticsEngine;
  self.ViewingDataCollector = ViewingDataCollector;
  self.PatternAnalyzer = PatternAnalyzer;
  self.InsightGenerator = InsightGenerator;
  self.AnalyticsStorageManager = AnalyticsStorageManager;
}