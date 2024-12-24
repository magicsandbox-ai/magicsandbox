/* global chrome */

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log(JSON.stringify(info, null, 2));
});
