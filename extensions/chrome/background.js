/* global chrome */

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log(info);
});
