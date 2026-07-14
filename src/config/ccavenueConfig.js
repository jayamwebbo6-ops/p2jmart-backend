require('dotenv').config();

module.exports = {
  merchantId: process.env.CCAVENUE_MERCHANT_ID || '',
  accessCode: process.env.CCAVENUE_ACCESS_CODE || '',
  workingKey: process.env.CCAVENUE_WORKING_KEY || '',
  redirectUrl: `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/payments/response`,
  cancelUrl: `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/payments/response`,
  paymentUrl: process.env.NODE_ENV === 'production'
    ? 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
    : 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction',
  apiUrl: process.env.NODE_ENV === 'production'
    ? 'https://secure.ccavenue.com/apis/servlet/DoWebTrans'
    : 'https://apitest.ccavenue.com/apis/servlet/DoWebTrans'
};
