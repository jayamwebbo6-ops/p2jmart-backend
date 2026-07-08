const redis = require('redis');
const fs = require('fs');

let redisClient = null;
let isConnected = false;

const REDIS_SOCKET_PATH = process.env.REDIS_SOCKET_PATH || '/home/jayam/.redis/redis.sock';
const CACHE_KEY = 'home_cms_config_cache';

const connectRedis = async () => {
  // If socket path does not exist, skip connection to avoid infinite connection loops locally
  if (!fs.existsSync(REDIS_SOCKET_PATH)) {
    console.warn(`Redis socket not found at "${REDIS_SOCKET_PATH}". Skipping Redis initialization.`);
    return;
  }

  try {
    redisClient = redis.createClient({
      socket: {
        path: REDIS_SOCKET_PATH,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('Redis reconnection stopped after 3 attempts.');
            return false; // Stop reconnecting
          }
          return 2000; // Retry after 2 seconds
        }
      },
      database: 4
    });

    redisClient.on('error', (err) => {
      console.warn('Redis connection/socket error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully via Unix socket');
      isConnected = true;
    });

    await redisClient.connect();
  } catch (err) {
    console.error('Failed to initialize Redis client:', err.message);
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
