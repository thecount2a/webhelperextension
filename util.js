const getData = function(sKey) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get(sKey, function(items) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        if (sKey)
        {
            resolve(items[sKey]);
        }
        else
        {
            resolve(items);
        }
      }
    });
  });
};

const setData = function(sKey, data) {
  return new Promise(function(resolve, reject) {
    let obj = {};
    obj[sKey] = data;
    chrome.storage.local.set(obj, function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
};

const clearData = function() {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.clear(function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
};

const loadImage = (imageUrl) => {
  return new Promise((resolve) => {
    let image     = new Image();
    image.onload  = () => {
      resolve(image);
    };
    image.src = imageUrl;
  });
};

const captureVisibleTab = (winid, opt) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(winid, opt, function(result) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(result);
      }
    });
  });
};

const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const sendMessage = (tabId, frameId, msg) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, {frameId: frameId}, function(result) {
      if (chrome.runtime.lastError) {
        //console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(result);
      }
    });
  });
};

const getCurrentWindow = () => {
  return new Promise((resolve, reject) => {
    chrome.windows.getCurrent(null, async function(win) {
      resolve(win);
    });
  });
};

const getTabs = (params) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(params, function(tabs) {
      resolve(tabs);
    });
  });
};

const getAllFrames = (tabId) => {
  return new Promise((resolve, reject) => {
    chrome.webNavigation.getAllFrames({tabId: tabId}, function(result) {
      resolve(result);
    });
  });
};

const scaleImage = (imgObject, factor) => {
    var bufferCanvas = document.createElement('canvas');
    var bufferContext = bufferCanvas.getContext('2d');
    bufferCanvas.width = imgObject.width / factor;
    bufferCanvas.height = imgObject.height / factor;
    bufferContext.drawImage(imgObject, 0, 0, imgObject.width, imgObject.height, 0, 0, imgObject.width / factor, imgObject.height / factor);
   
    return bufferCanvas.toDataURL();
};


const getDebuggerTarget = (tabId) => {
  return new Promise((resolve, reject) => {
    chrome.debugger.getTargets(function(arr) {
        for (let t in arr)
        {
            if (arr[t].type=="page" && arr[t].tabId == tabId)
            {
                resolve(arr[t]);
            }
        }
        reject("could not find debugger target");
    });
  });
};

const connectDebugger = (target, ver) => {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({targetId:target.id}, ver, function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
};

const disconnectDebugger = (target) => {
  return new Promise((resolve, reject) => {
    chrome.debugger.detach({targetId:target.id}, function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
};

const sendDebuggerCommand = (target, method, params) => {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({targetId:target.id}, method, params, function(result) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(result);
      }
    });
  });
};

const sendMessageToBackground = (msg) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(null, msg, null, function(result) {
      if (chrome.runtime.lastError) {
        //console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(result);
      }
    });
  });
};

