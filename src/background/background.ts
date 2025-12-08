import {
  initializeState,
  handleInstalled,
  handleStorageChange,
  handleAlarm,
  handleHistoryStateUpdated,
  EXPIRY_ALARM_NAME
} from './backgroundLogic';

initializeState();

chrome.runtime.onInstalled.addListener(handleInstalled);

chrome.runtime.onStartup.addListener(() => {
  initializeState();
});

chrome.alarms.onAlarm.addListener(handleAlarm);

chrome.storage.onChanged.addListener(handleStorageChange);

chrome.webNavigation.onHistoryStateUpdated.addListener(handleHistoryStateUpdated);
