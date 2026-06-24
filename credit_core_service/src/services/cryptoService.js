const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// To simulate persistence of keys in the MVP, we can generate them on the fly
// or store them in memory. We'll store them in memory for simplicity, 
// generating a keypair when the service starts.
let privateKeyPem = '';
let publicKeyPem = '';

const initKeys = () => {
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    privateKeyPem = privateKey;
    publicKeyPem = publicKey;
    console.log('Cryptographic RSA Key Pair generated for digital signing.');
  } catch (error) {
    console.error('Error generating key pair:', error.message);
  }
};

// Initialize keys immediately
initKeys();

/**
 * Sign data string using the private key
 * @param {string} data 
 * @returns {string} signature in hex format
 */
const signEvent = (data) => {
  if (!privateKeyPem) {
    throw new Error('Private key not initialized');
  }
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem, 'hex');
};

/**
 * Verify data signature using the public key
 * @param {string} data 
 * @param {string} signature hex signature
 * @returns {boolean}
 */
const verifyEventSignature = (data, signature) => {
  if (!publicKeyPem) {
    throw new Error('Public key not initialized');
  }
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKeyPem, signature, 'hex');
};

/**
 * Get public key for external verification (e.g. Superintendencia audit tool)
 * @returns {string} PEM format public key
 */
const getPublicKey = () => {
  return publicKeyPem;
};

module.exports = {
  signEvent,
  verifyEventSignature,
  getPublicKey
};
