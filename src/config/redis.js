const redis = require('redis');
const fs = require('fs');

let redisClient = null;
let isConnected = false;

const CACHE_KEY = 'home_cms_config_cache';

const connectRedis = async () => {
  const socketPath = process.env.REDIS_SOCKET_PATH;
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const dbIndex = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 1;

  const clientOptions = {
    database: dbIndex
  };

  let connectionType = 'TCP';

  // Check if Unix socket path is provided and exists
  if (socketPath && fs.existsSync(socketPath)) {
    clientOptions.socket = {
      path: socketPath,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn('Redis Unix socket reconnection stopped after 3 attempts.');
          return false; // Stop reconnecting
        }
        return 2000; // Retry after 2 seconds
      }
    };
    connectionType = 'Unix socket';
    console.log(`Connecting to Redis via Unix socket: ${socketPath}`);
  } else {
    // Fallback to TCP connection
    clientOptions.url = redisUrl;
    clientOptions.socket = {
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn('Redis TCP reconnection stopped after 3 attempts.');
          return false; // Stop reconnecting
        }
        return 2000; // Retry after 2 seconds
      }
    };
    connectionType = `TCP (${redisUrl})`;
    if (socketPath) {
      console.warn(`Redis Unix socket not found at "${socketPath}". Falling back to TCP: ${redisUrl}`);
    } else {
      console.log(`Connecting to Redis via TCP: ${redisUrl}`);
    }
  }

  try {
    redisClient = redis.createClient(clientOptions);

    redisClient.on('error', (err) => {
      console.warn(`Redis connection error (${connectionType}):`, err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log(`Redis connected successfully via ${connectionType}`);
      isConnected = true;
    });

    await redisClient.connect();
  } catch (err) {
    console.error(`Failed to connect to Redis (${connectionType}):`, err.message);
    isConnected = false;
  }
};

// Initialize connection immediately
connectRedis();

const getCache = async (key) => {
  if (!isConnected || !redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error('Redis getCache error:', err.message);
    return null;
  }
};

const setCache = async (key, value, ttlSeconds = 86400) => {
  if (!isConnected || !redisClient) return false;
  try {
    await redisClient.set(key, value, {
      EX: ttlSeconds
    });
    return true;
  } catch (err) {
    console.error('Redis setCache error:', err.message);
    return false;
  }
};

const deleteCache = async (key) => {
  if (!isConnected || !redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.error('Redis deleteCache error:', err.message);
    return false;
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  isConnected: () => isConnected,
  CACHE_KEY
};
