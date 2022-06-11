const { writeFile } = require("fs")

const IP_REGEX = /\b(?:(?:2(?:[0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9])\.){3}(?:(?:2([0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9]))\b/;
const isCorrectIp = (__ip) => IP_REGEX.test(__ip);

const persistToEnv = (newEnv, successCallback, errorCallback) => {
  writeFile("./.env.json", JSON.stringify(newEnv), (err) => {
    if (err) {
      errorCallback();
    } else {
      successCallback();
    }
  })
};

module.exports = {
  IP_REGEX,
  isCorrectIp,
  persistToEnv
}