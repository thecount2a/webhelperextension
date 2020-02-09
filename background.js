
let requestState = {};
let requestCache = {};
chrome.webRequest.onBeforeRequest.addListener(function(details) {
    if (!requestState[details.tabId])
    {
        requestState[details.tabId] = {};
    }
    requestState[details.tabId][details.requestId] = "starting";
    requestCache[details.requestId] = details;
}, {urls: [ "<all_urls>" ]});

chrome.webRequest.onCompleted.addListener(function(details) {
    if (!requestState[details.tabId])
    {
        requestState[details.tabId] = {};
    }
    requestState[details.tabId][details.requestId] = "completed";
}, {urls: [ "<all_urls>" ]});

chrome.webRequest.onBeforeRedirect.addListener(function(details) {
    if (!requestState[details.tabId])
    {
        requestState[details.tabId] = {};
    }
    requestState[details.tabId][details.requestId] = "redirecting";
}, {urls: [ "<all_urls>" ]});

chrome.webRequest.onErrorOccurred.addListener(function(details) {
    if (!requestState[details.tabId])
    {
        requestState[details.tabId] = {};
    }
    requestState[details.tabId][details.requestId] = "error";
}, {urls: [ "<all_urls>" ]});

const browseAction = async function(tabId, allFlag = false, numSteps = -1, pauseMs = 1000, tries = 30) {
    let thisTarget = await getDebuggerTarget(tabId);
    let connected = false;
    //let res = await sendDebuggerCommand(thisTarget, "Page.AddScriptToEvaluateOnNewDocument", {
    //    source: "Object.defineProperty(window, 'hidden', { get: () => false });"
    //});

    let waiting = 0;
    let thisHost = hostCache[tabId];
    if (!thisHost)
    {
        console.log("Cannot find which host is loaded in this tab");
        return false;
    }
    playing[tabId] = true;
    let stepsRun = 0;
    let inprogress = 0;
    while (waiting < tries && (numSteps == -1 || stepsRun < numSteps))
    {
        if (allFlag && currentStep[tabId] == 0 && waiting == 0)
        {
            // Wait before moving to new site, in case download is still going
            if (playAllList[tabId].indexOf(thisHost) != 0)
            {
                await timeout(pauseMs*5);
                if (!playing[tabId])
                {
                    break;
                }
            }
            let goUrl = "https://"+thisHost+"/";
            console.log("Browsing to "+goUrl);
            let beginTime = null;
            if (lastLoadCache[tabId])
            {
                beginTime = lastLoadCache[tabId];
            }
            chrome.tabs.update(tabId, {
                url: goUrl
            });
            // Wait for new page to load
            for (let i = 0; i < 15; i++)
            {
                await timeout(1000);
                if (!playing[tabId])
                {
                    break;
                }
                if (beginTime != lastLoadCache[tabId])
                {
                    beginTime = lastLoadCache[tabId];
                    break;
                }
            }

            // Wait for page to get moving
            for (let i = 0; i < 5; i++)
            {
                if (beginTime != lastLoadCache[tabId])
                {
                    console.log("Saw new page load again, resetting timer");
                    i = 0;
                    beginTime = lastLoadCache[tabId];
                }
                await timeout(1000);
                if (!playing[tabId])
                {
                    break;
                }
            }
            if (!playing[tabId])
            {
                break;
            }
        }
        if (!connected)
        {
            await connectDebugger(thisTarget, '1.3');
            connected = true;
        }
        if (pauseMs)
        {
            await timeout(pauseMs);
        }
        else if (waiting > 0)
        {
            await timeout(1000);
        }
        if (!playing[tabId])
        {
            break;
        }
        
        let stepresult = await getData('steps_'+thisHost);
        if (currentStep[tabId] > stepresult.length-1)
        {
            if (allFlag)
            {
                currentStep[tabId] = 0;
                let thisInd = playAllList[tabId].indexOf(thisHost);
                if (thisInd >= playAllList[tabId].length - 1 || thisInd == -1)
                {
                    break;
                }
                thisHost = playAllList[tabId][thisInd+1];
                hostCache[tabId] = thisHost;
                continue;
            }
            else
            {
                break;
            }
        }

        let step = stepresult[currentStep[tabId]];
        
        let frames = await getAllFrames(tabId);
        let frameId = 0;
        let result = null;

        inprogress = 0;
        if (requestState[tabId])
        {
            for (var rid in requestState[tabId])
            {
                if (requestState[tabId][rid] == "starting")
                {
                    inprogress++;
                }
            }
        }
        if (inprogress <= 0)
        {
            for (var i = 0; i < frames.length; i++)
            {
                frameId = frames[i].frameId;
                try
                {
                    result = await sendMessage(tabId, frameId, {command: "getBounds", xpaths: step.xpaths});
                    if (result && result.bounds && result.bounds.width > 0 && result.bounds.height > 0)
                    {
                        break;
                    }
                }
                catch (err)
                {
                    console.log(err);
                }
            }

            if (result && result.bounds && result.bounds.width > 0 && result.bounds.height > 0)
            {
                if (pauseMs)
                {
                    await timeout(pauseMs);
                }
                if (!playing[tabId])
                {
                    break;
                }
                waiting = 0;
                if (step.command == "click")
                {
                    try
                    {
                        let reply = await sendMessage(tabId, frameId, {command:"scrollIntoView", xpaths: step.xpaths});
                        if (reply.result != "success")
                        {
                            console.log("Step "+(currentStep[tabId]+1).toString()+" scrollIntoView failed");
                        }
                    }
                    catch (err)
                    {
                        console.log("Failed to send message to tab/frame that we found match on ");
                        console.log(err);
                    }
                    // Get bounds again since scrolling may have made it go out of view
                    try
                    {
                        result = await sendMessage(tabId, frameId, {command: "getBounds", xpaths: step.xpaths});
                    }
                    catch (err)
                    {
                        console.log(err);
                    }
                    // Wait half a second
                    await timeout(500);
                    if (!playing[tabId])
                    {
                        break;
                    }
                    // Mouse over
                    console.log("moving mouse to "+(result.bounds.x+result.bounds.width/2).toString()+" "+(result.bounds.y+result.bounds.height/2).toString());
                    try
                    {
                        let response = await sendDebuggerCommand(thisTarget, "Input.dispatchMouseEvent", {
                            type: 'mouseMoved',
                            x: result.bounds.x+result.bounds.width/2,
                            y: result.bounds.y+result.bounds.height/2,
                            modifiers: 0,
                        });
                    }
                    catch (err)
                    {
                        console.log("Failed to send debugger commands to mouse over");
                        console.log(err);
                        //break;
                    }

                    // Wait half a second
                    await timeout(500);
                    if (!playing[tabId])
                    {
                        break;
                    }
                    console.log("Clicking");

                    // Send click down and up
                    try
                    {
                        let response = await sendDebuggerCommand(thisTarget, "Input.dispatchMouseEvent", {
                            type: 'mousePressed',
                            button: 'left',
                            x: result.bounds.x+result.bounds.width/2,
                            y: result.bounds.y+result.bounds.height/2,
                            modifiers: 0,
                            clickCount: 1
                        });
                        // Wait 1/20 of a second
                        await timeout(50);

                        response = await sendDebuggerCommand(thisTarget, "Input.dispatchMouseEvent", {
                            type: 'mouseReleased',
                            button: 'left',
                            x: result.bounds.x+result.bounds.width/2,
                            y: result.bounds.y+result.bounds.height/2,
                            modifiers: 0,
                            clickCount: 1
                        });

                        currentStep[tabId]++;
                        stepsRun++;
                    }
                    catch (err)
                    {
                        console.log("Failed to send debugger commands");
                        console.log(err);
                        //break;
                    }
                }
                else
                {
                    try
                    {
                        let reply = await sendMessage(tabId, frameId, step);
                        if (reply.result != "success")
                        {
                            console.log("Step "+(currentStep[tabId]+1).toString()+" failed");
                            break;
                        }
                        else
                        {
                            currentStep[tabId]++;
                            stepsRun++;
                        }
                    }
                    catch (err)
                    {
                        console.log("Failed to send message to tab/frame that we found match on ");
                        console.log(err);
                        //break;
                    }
                }
            }
            else
            {
                waiting++;
            }
        }
        else
        {
            waiting++;
        }
    }
    if (waiting >= tries)
    {
        if (inprogress > 0)
        {
            alert("Network requests are still pending and therefore Webhelper timed out");
            for (var rid in requestState[tabId])
            {
                if (requestState[tabId][rid] == "starting")
                {
                    console.log(requestCache[rid]);
                }
            }
        }
        console.log("Waited too long and did not find element");
        await disconnectDebugger(thisTarget);
        return false;
    }
    if (!playing[tabId])
    {
        console.log("Play has been interrupted by user");
    }

    await disconnectDebugger(thisTarget);

    return true;
};

let currentStep = {};
let hostCache = {};
let lastLoadCache = {};
let playing = {};
let playAll = {};
let playAllList = {};

let playAction = async function(allFlag, num = -1) {
  let tabs = await getTabs({currentWindow: true, active: true});
  console.log("Play action for tab " + tabs[0].id.toString());
  let thisHost = hostCache[tabs[0].id];
  if (!thisHost)
  {
    alert("Error! Could not find any domain for this tab!");
  }
  else
  {
    let stepresult = await getData('steps_'+thisHost);
    if (!stepresult)
    {
      alert("Error, found the following host for this tab but no steps defined: " + thisHost);
      return;
    }
    await browseAction(tabs[0].id, allFlag, num);
  }
};

const loadAll = async function(tabId) {
    let alldata = await getData(null);
    playAllList[tabId] = [];
    for (let k in alldata)
    {
        let sp = k.split('_');
        if (sp[0] == "steps" && sp.length > 1)
        {
            playAllList[tabId].push(sp[1]);
        }
    }
    console.log("setting tab " +tabId.toString()+" to "+playAllList[tabId][0]);
    hostCache[tabId] = playAllList[tabId][0];
    currentStep[tabId] = 0;
};

const onMessageFunc = async function(msg, sender, sendResponse) {
    if (msg.command == "addstep")
    {
        let win = await getCurrentWindow();
        let imageData = await captureVisibleTab(win.id, {format: 'png', quality: 100});
        let imgObject = await loadImage(imageData);

        var tnCanvas = document.createElement('canvas');
        var tnCanvasContext = tnCanvas.getContext('2d');
        var scale = 1;
        tnCanvas.width = msg.step.sz.x/scale;
        tnCanvas.height = msg.step.sz.y/scale;

        var bufferCanvas = document.createElement('canvas');
        var bufferContext = bufferCanvas.getContext('2d');
        bufferCanvas.width = imgObject.width;
        bufferCanvas.height = imgObject.height;
        bufferContext.drawImage(imgObject, 0, 0, imgObject.width, imgObject.height);

        tnCanvasContext.drawImage(bufferCanvas, msg.step.start.x, msg.step.start.y, msg.step.sz.x, msg.step.sz.y, 0, 0, msg.step.sz.x/scale, msg.step.sz.y/scale);
        msg.step.sz.x = msg.step.sz.x/scale;
        msg.step.sz.y = msg.step.sz.y/scale;

        var step = msg.step;
        step.image = tnCanvas.toDataURL();
        console.log(step.image);
        
        let steps = await getData('steps_'+msg.host);
        if (!steps)
        {
            steps = [];
        }
        console.log(currentStep[sender.tab.id]);
        steps.splice(currentStep[sender.tab.id], 0, msg.step);
        console.log(steps);
        await setData('steps_'+msg.host, steps);
        sendResponse({success: true});
    }
    else if (msg.command == "clearsteps")
    {
        await setData('steps_'+msg.host, []);
        console.log("Cleared steps");
        sendResponse({success: true});
    }
    else if (msg.command == "clearlaststep")
    {
        let result = await getData('steps_'+msg.host);
        let val = (result && result.length > 0) ? result.slice(0, -1) : [];
        await setData('steps_'+msg.host, val);
        console.log("Cleared last step");
        sendResponse({success: true});
    }
    else if (msg.command == "runlaststep")
    {
        try
        {
          let success_or_failure = await browseAction(sender.tab.id, false, 1, 0, 1);
          sendResponse({success: success_or_failure});
        }
        catch (err)
        {
          console.log("failed to run last step");
          sendResponse({success: false});
          throw err;
        }
    }
    else if (msg.command == "getsteps")
    {
        let tabs = await getTabs({currentWindow: true, active: true});
        let result = await getData('steps_'+hostCache[tabs[0].id]);
        sendResponse({success: true, steps: result, currentStep: currentStep[tabs[0].id]});
    }
    else if (msg.command == "selectstep")
    {
        let tabs = await getTabs({currentWindow: true, active: true});
        currentStep[tabs[0].id] = msg.stepNum;
        sendResponse({success: true});
    }
    else if (msg.command == "deletestep")
    {
        try
        {
            let tabs = await getTabs({currentWindow: true, active: true});
            let result = await getData('steps_'+hostCache[tabs[0].id]);
            result.splice(msg.stepNum, 1);
            await setData('steps_'+hostCache[tabs[0].id], result);
            if (currentStep[tabs[0].id] > result.length)
            {
                currentStep[tabs[0].id] = result.length;
            }
            sendResponse({success: true});
        }
        catch(err)
        {
            sendResponse({success: false});
        }
    }
    else if (msg.command == "whereami")
    {
        if (!hostCache[sender.tab.id] && sender.frameId == 0)
        {
            hostCache[sender.tab.id] = msg.host;
            currentStep[sender.tab.id] = 0;
        }
        lastLoadCache[sender.tab.id] = new Date();

        sendResponse({host:hostCache[sender.tab.id]});
    }
    else if (msg.command == "exportimportwindow")
    {
        chrome.tabs.create({url: chrome.extension.getURL('exportimport.html')}, (tab) => {
        })
    }
    else if (msg.command == "importdata")
    {
        let dat = JSON.parse(msg.contents);
        await clearData();
        for (let k in dat)
        {
            await setData(k, dat[k]);
        }
        alert("Successfully imported file");
    }
    else if (msg.command == "exportdata")
    {
        let alldata = await getData(null);
        let blob = new Blob([JSON.stringify(alldata)], {type: "text/plain"});
        let url = URL.createObjectURL(blob);
        let today = new Date();
        chrome.downloads.download({
          url: url,
          conflictAction: "overwrite",
          filename: 'export-'+today.getFullYear().toString()+'-'+(today.getMonth()+1).toString()+'-'+today.getDate().toString()+'.json'
        });
    }
    else if (msg.command == "stop")
    {
        let tabs = await getTabs({currentWindow: true, active: true});
        playing[tabs[0].id] = false;
    }
    else if (msg.command == "play")
    {
        playAction(false);
    }
    else if (msg.command == "playone")
    {
        playAction(false, 1);
    }
    else if (msg.command == "playall")
    {
        let tabs = await getTabs({currentWindow: true, active: true});
        if (!playAll[tabs[0].id])
        {
            playAll[tabs[0].id] = true;
            await loadAll(tabs[0].id);
        }
        playAction(true);
    }
};
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    onMessageFunc(msg, sender, sendResponse);
    // Return true means hold the message channel open until we send a response
    return true;
});
