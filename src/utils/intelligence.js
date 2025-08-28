class RelationshipScoreCalculator {
  constructor() {
    this.weights = {
      frequency: 0.3,    // How often videos are watched
      recency: 0.2,      // How recently watched
      depth: 0.2,        // How much of videos watched (percentage)
      loyalty: 0.2,      // How consistently returned
      growth: 0.1        // Trending up or down
    };
  }

  calculateScore(channel, sessionData = null) {
    try {
      const factors = this.calculateFactors(channel, sessionData);
      
      const score = (
        factors.frequency * this.weights.frequency +
        factors.recency * this.weights.recency +
        factors.depth * this.weights.depth +
        factors.loyalty * this.weights.loyalty +
        factors.growth * this.weights.growth
      );

      return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        factors,
        trend: this.determineTrend(channel, factors),
        badge: this.getRelationshipBadge(score)
      };
    } catch (error) {
      console.warn('YCN: Error calculating relationship score:', error);
      return {
        score: Math.min(channel.count * 8, 100), // Fallback
        factors: {},
        trend: 'stable',
        badge: 'Casual'
      };
    }
  }

  calculateFactors(channel, sessionData) {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Factor 1: Frequency (0-100)
    const frequency = this.calculateFrequency(channel, now, dayInMs);
    
    // Factor 2: Recency (0-100) 
    const recency = this.calculateRecency(channel, now, dayInMs);
    
    // Factor 3: Depth (0-100)
    const depth = this.calculateDepth(channel, sessionData);
    
    // Factor 4: Loyalty (0-100)
    const loyalty = this.calculateLoyalty(channel, now, dayInMs);
    
    // Factor 5: Growth (0-100)
    const growth = this.calculateGrowth(channel, now, dayInMs);

    return { frequency, recency, depth, loyalty, growth };
  }

  calculateFrequency(channel, now, dayInMs) {
    const daysSinceFirstSeen = Math.max(1, (now - channel.firstSeen) / dayInMs);
    const videosPerDay = channel.count / daysSinceFirstSeen;
    
    // Scale: 1+ video per day = 100, 1 per week = 50, 1 per month = 25
    if (videosPerDay >= 1) return 100;
    if (videosPerDay >= 0.14) return 50 + (videosPerDay - 0.14) * 58; // 0.14 = 1/7
    if (videosPerDay >= 0.033) return 25 + (videosPerDay - 0.033) * 233; // 0.033 = 1/30
    return Math.max(0, videosPerDay * 757); // Scale small values
  }

  calculateRecency(channel, now, dayInMs) {
    if (!channel.lastVideo) return 0;
    
    const daysSinceLastWatch = (now - channel.lastVideo.timestamp) / dayInMs;
    
    // Scale: same day = 100, 1 week = 70, 1 month = 30, 3 months = 0
    if (daysSinceLastWatch <= 1) return 100;
    if (daysSinceLastWatch <= 7) return 100 - (daysSinceLastWatch - 1) * 5;
    if (daysSinceLastWatch <= 30) return 70 - (daysSinceLastWatch - 7) * 1.74;
    if (daysSinceLastWatch <= 90) return 30 - (daysSinceLastWatch - 30) * 0.5;
    return 0;
  }

  calculateDepth(channel, sessionData) {
    // Use patterns data if available, otherwise estimate
    if (channel.patterns && channel.patterns.averageWatchPercentage > 0) {
      return channel.patterns.averageWatchPercentage;
    }
    
    // Fallback: assume good engagement if they have many videos from channel
    if (channel.count >= 10) return 70;
    if (channel.count >= 5) return 60;
    return 50;
  }

  calculateLoyalty(channel, now, dayInMs) {
    if (channel.count <= 1) return 0;
    
    const daysSinceFirstSeen = Math.max(1, (now - channel.firstSeen) / dayInMs);
    const expectedReturns = Math.max(1, Math.floor(daysSinceFirstSeen / 7)); // Expected weekly returns
    const actualReturns = channel.count;
    
    const loyaltyRatio = Math.min(2, actualReturns / expectedReturns);
    return Math.round(loyaltyRatio * 50);
  }

  calculateGrowth(channel, now, dayInMs) {
    // Look at recent activity vs overall average
    if (!channel.watchedVideoData || channel.count < 3) return 50; // Neutral for new channels
    
    const recentThreshold = now - (30 * dayInMs); // Last 30 days
    const recentVideos = Object.values(channel.watchedVideoData)
      .filter(video => video.timestamp > recentThreshold);
    
    const totalDays = Math.max(30, (now - channel.firstSeen) / dayInMs);
    const recentDays = 30;
    
    const overallRate = channel.count / totalDays;
    const recentRate = recentVideos.length / recentDays;
    
    if (recentRate > overallRate * 1.5) return 80; // Growing fast
    if (recentRate > overallRate * 1.2) return 65; // Growing
    if (recentRate > overallRate * 0.8) return 50; // Stable
    if (recentRate > overallRate * 0.5) return 35; // Declining
    return 20; // Declining fast
  }

  determineTrend(channel, factors) {
    if (factors.growth > 65) return 'growing';
    if (factors.growth < 35) return 'declining';
    return 'stable';
  }

  getRelationshipBadge(score) {
    if (score >= 80) return 'Favorite';
    if (score >= 60) return 'Regular';
    if (score >= 40) return 'Casual';
    if (score >= 20) return 'New';
    return '💤 Dormant';
  }
}

class RecommendationEngine {
  constructor() {
    this.relationshipCalculator = new RelationshipScoreCalculator();
  }

  findSimilarChannels(targetChannelId, allChannels, maxResults = 3) {
    try {
      const targetChannel = allChannels[targetChannelId];
      if (!targetChannel) return [];

      const similarities = {};
      
      for (const [channelId, channel] of Object.entries(allChannels)) {
        if (channelId === targetChannelId || channel.count < 3) continue;
        
        similarities[channelId] = this.calculateChannelSimilarity(
          targetChannel,
          channel
        );
      }

      return Object.entries(similarities)
        .filter(([_, similarity]) => similarity > 0.3) // Minimum similarity threshold
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxResults)
        .map(([channelId, similarity]) => ({
          channelId,
          channel: allChannels[channelId],
          similarity: Math.round(similarity * 100)
        }));
    } catch (error) {
      console.warn('YCN: Error finding similar channels:', error);
      return [];
    }
  }

  calculateChannelSimilarity(channel1, channel2) {
    let similarity = 0;
    let factors = 0;

    // Factor 1: Similar engagement levels (watch count similarity)
    const countSimilarity = 1 - Math.abs(channel1.count - channel2.count) / Math.max(channel1.count, channel2.count);
    similarity += countSimilarity * 0.3;
    factors += 0.3;

    // Factor 2: Similar watch patterns (if available)
    if (channel1.patterns && channel2.patterns) {
      const patternSimilarity = this.calculatePatternSimilarity(channel1.patterns, channel2.patterns);
      similarity += patternSimilarity * 0.4;
      factors += 0.4;
    }

    // Factor 3: Similar relationship scores
    const score1 = channel1.relationship?.score || 0;
    const score2 = channel2.relationship?.score || 0;
    if (score1 > 0 && score2 > 0) {
      const scoreSimilarity = 1 - Math.abs(score1 - score2) / 100;
      similarity += scoreSimilarity * 0.3;
      factors += 0.3;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  calculatePatternSimilarity(patterns1, patterns2) {
    let similarity = 0;
    let count = 0;

    // Compare watch percentages
    if (patterns1.averageWatchPercentage > 0 && patterns2.averageWatchPercentage > 0) {
      const percentageDiff = Math.abs(patterns1.averageWatchPercentage - patterns2.averageWatchPercentage);
      similarity += (100 - percentageDiff) / 100;
      count++;
    }

    // Compare watch hours overlap
    if (patterns1.watchHours.length > 0 && patterns2.watchHours.length > 0) {
      const commonHours = patterns1.watchHours.filter(hour => patterns2.watchHours.includes(hour));
      const totalHours = new Set([...patterns1.watchHours, ...patterns2.watchHours]).size;
      if (totalHours > 0) {
        similarity += commonHours.length / totalHours;
        count++;
      }
    }

    // Compare watch days overlap
    if (patterns1.watchDays.length > 0 && patterns2.watchDays.length > 0) {
      const commonDays = patterns1.watchDays.filter(day => patterns2.watchDays.includes(day));
      const totalDays = new Set([...patterns1.watchDays, ...patterns2.watchDays]).size;
      if (totalDays > 0) {
        similarity += commonDays.length / totalDays;
        count++;
      }
    }

    return count > 0 ? similarity / count : 0;
  }

  predictNextWatch(channels, sessionData = null) {
    try {
      const now = Date.now();
      const currentHour = new Date(now).getHours();
      const currentDay = new Date(now).getDay();
      
      const predictions = [];

      for (const [channelId, channel] of Object.entries(channels)) {
        if (!channel.approved || channel.count < 5) continue;

        const prediction = this.calculateWatchProbability(
          channel, 
          currentHour, 
          currentDay, 
          now,
          sessionData
        );

        if (prediction.probability > 0.3) {
          predictions.push({
            channelId,
            channel,
            probability: prediction.probability,
            factors: prediction.factors,
            suggestedTime: prediction.suggestedTime
          });
        }
      }

      return predictions
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);
    } catch (error) {
      console.warn('YCN: Error predicting next watch:', error);
      return [];
    }
  }

  calculateWatchProbability(channel, currentHour, currentDay, now, sessionData) {
    let probability = 0;
    const factors = {};

    // Base probability from relationship score
    const relationshipScore = channel.relationship?.score || 0;
    probability += (relationshipScore / 100) * 0.4;
    factors.relationship = relationshipScore / 100;

    // Time-based probability
    if (channel.patterns && channel.patterns.watchHours.length > 0) {
      const hourProbability = channel.patterns.watchHours.includes(currentHour) ? 0.8 : 0.2;
      probability += hourProbability * 0.3;
      factors.timeMatch = hourProbability;
    }

    // Day-based probability  
    if (channel.patterns && channel.patterns.watchDays.length > 0) {
      const dayProbability = channel.patterns.watchDays.includes(currentDay) ? 0.8 : 0.2;
      probability += dayProbability * 0.2;
      factors.dayMatch = dayProbability;
    }

    // Recency factor (more likely if watched recently but not too recently)
    if (channel.lastVideo) {
      const daysSinceLastWatch = (now - channel.lastVideo.timestamp) / (24 * 60 * 60 * 1000);
      let recencyFactor = 0;
      
      if (daysSinceLastWatch >= 1 && daysSinceLastWatch <= 3) {
        recencyFactor = 0.8; // Sweet spot
      } else if (daysSinceLastWatch <= 7) {
        recencyFactor = 0.6;
      } else if (daysSinceLastWatch <= 14) {
        recencyFactor = 0.4;
      } else {
        recencyFactor = 0.2;
      }
      
      probability += recencyFactor * 0.1;
      factors.recency = recencyFactor;
    }

    // Suggested time (when they usually watch this channel)
    let suggestedTime = null;
    if (channel.patterns && channel.patterns.watchHours.length > 0) {
      // Find most common hour
      const hourCounts = {};
      channel.patterns.watchHours.forEach(hour => {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const mostCommonHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      suggestedTime = `${mostCommonHour}:00`;
    }

    return {
      probability: Math.min(1, probability),
      factors,
      suggestedTime
    };
  }
}

class UserProfileAnalyzer {
  analyzeProfile(channels, sessionData = null) {
    const profile = {
      type: 'casual_viewer',
      characteristics: [],
      peakHours: [],
      favoriteDay: 'Saturday',
      totalChannels: Object.keys(channels).length,
      approvedChannels: Object.values(channels).filter(c => c.approved).length,
      averageRelationshipScore: 0,
      totalVideosWatched: 0,
      achievements: []
    };

    try {
      // Calculate totals
      const channelList = Object.values(channels);
      profile.totalVideosWatched = channelList.reduce((sum, c) => sum + c.count, 0);
      profile.averageRelationshipScore = channelList.length > 0 
        ? Math.round(channelList.reduce((sum, c) => sum + (c.relationship?.score || 0), 0) / channelList.length)
        : 0;

      // Determine viewer type
      profile.type = this.determineViewerType(channelList, sessionData);
      
      // Find peak hours and favorite day
      profile.peakHours = this.findPeakHours(channelList);
      profile.favoriteDay = this.findFavoriteDay(channelList);
      
      // Add characteristics
      profile.characteristics = this.analyzeCharacteristics(channelList, profile);
      
      // Check achievements
      profile.achievements = this.checkAchievements(channelList, profile);

    } catch (error) {
      console.warn('YCN: Error analyzing user profile:', error);
    }

    return profile;
  }

  determineViewerType(channels, sessionData) {
    const totalVideos = channels.reduce((sum, c) => sum + c.count, 0);
    const avgPerChannel = channels.length > 0 ? totalVideos / channels.length : 0;
    const highEngagementChannels = channels.filter(c => (c.relationship?.score || 0) > 70).length;
    
    if (highEngagementChannels >= 3 && avgPerChannel > 8) {
      return 'loyal_viewer';
    } else if (totalVideos > 50 && channels.length > 10) {
      return 'explorer';
    } else if (avgPerChannel > 12) {
      return 'deep_viewer';
    } else if (totalVideos > 100) {
      return 'binger';
    } else {
      return 'casual_viewer';
    }
  }

  findPeakHours(channels) {
    const hourCounts = {};
    
    channels.forEach(channel => {
      if (channel.patterns && channel.patterns.watchHours) {
        channel.patterns.watchHours.forEach(hour => {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
      }
    });

    return Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  findFavoriteDay(channels) {
    const dayCounts = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    channels.forEach(channel => {
      if (channel.patterns && channel.patterns.watchDays) {
        channel.patterns.watchDays.forEach(day => {
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
      }
    });

    const maxDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    return maxDay ? days[parseInt(maxDay[0])] : 'Saturday';
  }

  analyzeCharacteristics(channels, profile) {
    const characteristics = [];
    
    if (profile.averageRelationshipScore > 70) {
      characteristics.push('Forms strong channel relationships');
    }
    
    if (channels.filter(c => c.count >= 10).length > 5) {
      characteristics.push('Consistent viewer across multiple channels');
    }
    
    if (profile.peakHours.length > 0) {
      characteristics.push(`Most active during ${profile.peakHours[0]}:00-${profile.peakHours[0] + 1}:00`);
    }
    
    const newChannels = channels.filter(c => {
      const age = Date.now() - c.firstSeen;
      return age < 30 * 24 * 60 * 60 * 1000; // Last 30 days
    });
    
    if (newChannels.length > 3) {
      characteristics.push('Actively discovering new channels');
    }

    return characteristics;
  }

  checkAchievements(channels, profile) {
    const achievements = [];
    
    if (profile.totalVideosWatched >= 100) {
      achievements.push({ id: 'century_club', name: 'Century Club', description: '100+ videos tracked' });
    }
    
    if (channels.filter(c => c.relationship?.score >= 80).length >= 3) {
      achievements.push({ id: 'loyal_fan', name: 'Loyal Fan', description: '3+ favorite channels' });
    }
    
    if (channels.length >= 20) {
      achievements.push({ id: 'channel_explorer', name: 'Channel Explorer', description: '20+ channels discovered' });
    }
    
    if (profile.approvedChannels >= 10) {
      achievements.push({ id: 'notification_master', name: 'Notification Master', description: '10+ notification channels' });
    }

    return achievements;
  }
}

// Export classes for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RelationshipScoreCalculator,
    RecommendationEngine, 
    UserProfileAnalyzer
  };
}