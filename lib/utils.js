const crypto = require('crypto');

async function fetch(...args) {
  const fetch_ = (await import('node-fetch')).default;
  return await fetch_(...args);
}
function signMessage(message, privatekey) {
  const sign = crypto.createSign('SHA256');
  sign.update(message);
  return sign.sign(privatekey, 'base64');
}
function verifySignature(name, message, signature, certificate) {
  if(!certificate)
    return false;
  const verify = crypto.createVerify('SHA256');
  verify.update(message);
  return verify.verify(certificate, signature, 'base64');
}
function extractMessageWithTimestamp(messageWithTimestamp) {
  const lastSpaceIndex = messageWithTimestamp.lastIndexOf(' ');
  const message = messageWithTimestamp.substring(0, lastSpaceIndex);
  const timestampString = messageWithTimestamp.substring(lastSpaceIndex + 1);
  const timestamp = new Date(parseInt(timestampString, 10));
  return { message, timestamp };
}
function isTimestampValid(timestamp) {
  const currentTime = new Date();
  const timeDifference = Math.abs(currentTime.getTime() - timestamp.getTime()) / 1000;
  return timeDifference <= 5;
}

module.exports = {
  fetch,
  signMessage,
  verifySignature,
  extractMessageWithTimestamp,
  isTimestampValid
};

