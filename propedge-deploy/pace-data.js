/**
 * Netlify Function: Serve player pace data and predictions
 * Endpoint: /.netlify/functions/pace-data
 * Pure Node.js - no external dependencies
 */

const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  try {
    // Parse query parameters
    const { action = 'all', playerId, days = '30' } = event.queryStringParameters || {};

    // Read database file (located in same directory as function)
    const dbPath = path.join(__dirname, 'propedge-data.json');
    const dbContent = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(dbContent);

    let result;

    switch (action) {
      case 'all':
        result = getAllPlayersWithLatestPace(db);
        break;

      case 'player':
        if (!playerId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'playerId required' }),
          };
        }
        result = getPlayerPaceHistory(db, parseInt(playerId), parseInt(days));
        break;

      case 'trends':
        result = getTrendsForAllPlayers(db);
        break;

      case 'player-trends':
        if (!playerId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'playerId required' }),
          };
        }
        result = getPlayerTrends(db, parseInt(playerId));
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' }),
        };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error in pace-data function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function getAllPlayersWithLatestPace(db) {
  return {
    timestamp: new Date().toISOString(),
    count: db.players.length,
    players: db.players.map(player => {
      const latestPace = db.paceData
        .filter(d => d.playerId === player.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const latestPrediction = db.predictions
        .filter(p => p.playerId === player.id)
        .sort((a, b) => new Date(b.predictionDate) - new Date(a.predictionDate))[0];

      return {
        id: player.id,
        espnId: player.espnId,
        name: player.name,
        team: player.team,
        position: player.position,
        date: latestPace?.date,
        pace: latestPace?.pace,
        possessions: latestPace?.possessions,
        minutes: latestPace?.minutes,
        trend: latestPrediction?.trend,
        volatility: latestPrediction?.volatility,
        ma7: latestPrediction?.ma7,
        ma14: latestPrediction?.ma14,
        confidence: latestPrediction?.confidence,
      };
    }),
  };
}

function getPlayerPaceHistory(db, playerId, days) {
  const player = db.players.find(p => p.id === playerId);
  if (!player) {
    return { error: 'Player not found', player: null, history: [] };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const history = db.paceData
    .filter(d => d.playerId === playerId && new Date(d.date) >= cutoffDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(d => ({
      date: d.date,
      pace: d.pace,
      possessions: d.possessions,
      minutes: d.minutes,
    }));

  return {
    player: { id: player.id, name: player.name, team: player.team },
    history,
    count: history.length,
  };
}

function getTrendsForAllPlayers(db) {
  return {
    timestamp: new Date().toISOString(),
    count: db.players.length,
    trends: db.players.map(player => {
      const latestPrediction = db.predictions
        .filter(p => p.playerId === player.id)
        .sort((a, b) => new Date(b.predictionDate) - new Date(a.predictionDate))[0];

      return {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        predictionDate: latestPrediction?.predictionDate,
        predictedPace: latestPrediction?.predictedPace,
        trend: latestPrediction?.trend,
        volatility: latestPrediction?.volatility,
        ma7: latestPrediction?.ma7,
        ma14: latestPrediction?.ma14,
        confidence: latestPrediction?.confidence,
      };
    }),
  };
}

function getPlayerTrends(db, playerId) {
  const player = db.players.find(p => p.id === playerId);
  if (!player) {
    return { error: 'Player not found', player: null, trends: [] };
  }

  const trends = db.predictions
    .filter(p => p.playerId === playerId)
    .sort((a, b) => new Date(b.predictionDate) - new Date(a.predictionDate))
    .slice(0, 30)
    .map(p => ({
      predictionDate: p.predictionDate,
      predictedPace: p.predictedPace,
      trend: p.trend,
      volatility: p.volatility,
      ma7: p.ma7,
      ma14: p.ma14,
      confidence: p.confidence,
    }));

  return {
    player: { id: player.id, name: player.name, team: player.team },
    trends,
    count: trends.length,
  };
}
