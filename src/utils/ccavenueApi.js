const https = require('https');
const queryString = require('querystring');
const ccavenueConfig = require('../config/ccavenueConfig');
const ccavenueCrypto = require('./ccavenueCrypto');
const logger = require('./logger');

/**
 * Checks the status of an order with the CCAvenue Order Status API
 * @param {string} orderId - The Order ID to query
 * @returns {Promise<object>} - Decrypted order status response object
 */
exports.checkOrderStatus = (orderId) => {
  return new Promise((resolve, reject) => {
    try {
      const payload = JSON.stringify({ order_no: orderId });
      const encRequest = ccavenueCrypto.encrypt(payload, ccavenueConfig.workingKey);

      const postData = queryString.stringify({
        request_type: 'JSON',
        access_code: ccavenueConfig.accessCode,
        command: 'orderStatusTracker',
        response_type: 'JSON',
        version: '1.2',
        enc_request: encRequest
      });

      const urlObj = new URL(ccavenueConfig.apiUrl);

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      logger.order.info(`Querying CCAvenue Order Status API for Order ${orderId}`, { url: ccavenueConfig.apiUrl });

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            logger.order.info(`CCAvenue API response received for Order ${orderId}`);
            
            // Check if response is empty
            if (!body) {
              return reject(new Error('Empty response from CCAvenue API'));
            }

            // CCAvenue API responses are typically form urlencoded strings e.g. status=0&enc_response=...
            const responseParams = queryString.parse(body);

            if (responseParams.status === '1') {
              // Failure status returned from API
              logger.order.error(`CCAvenue API returned failure status for Order ${orderId}`, { response: responseParams });
              return resolve({
                order_no: orderId,
                order_status: 'Failure',
                status_message: responseParams.enc_response || 'API returned status 1'
              });
            }

            if (!responseParams.enc_response) {
              logger.order.error(`CCAvenue API response missing enc_response parameter for Order ${orderId}`, { body });
              return reject(new Error('Missing enc_response in API response'));
            }

            // Decrypt response
            const decrypted = ccavenueCrypto.decrypt(responseParams.enc_response.trim(), ccavenueConfig.workingKey);
            if (!decrypted) {
              return reject(new Error('Failed to decrypt CCAvenue API response'));
            }

            let decryptedObj;
            try {
              decryptedObj = JSON.parse(decrypted);
            } catch (jsonErr) {
              decryptedObj = queryString.parse(decrypted);
            }

            logger.order.info(`CCAvenue API response decrypted for Order ${orderId}`, { orderStatus: decryptedObj.order_status });
            resolve(decryptedObj);
          } catch (err) {
            logger.order.error(`Error parsing CCAvenue API response for Order ${orderId}`, { error: err.message });
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        logger.order.error(`Network error querying CCAvenue API for Order ${orderId}`, { error: err.message });
        reject(err);
      });

      req.write(postData);
      req.end();
    } catch (err) {
      logger.order.error(`Unhandled error preparing CCAvenue API request for Order ${orderId}`, { error: err.message });
      reject(err);
    }
  });
};
