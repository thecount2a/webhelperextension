var globalX = 0;
var globalY = 0;

(function(file, node) {
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    node.insertBefore(s, node.firstChild);
})(chrome.extension.getURL('/disable-visibility-detection.js'), document.documentElement);

const getElementByXpath = function(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
};

const getElementsByXpath = function(path) {
    var results = [];
    var eval = document.evaluate(path, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    var elem = eval.iterateNext();
    while (elem)
    {
        results.push(elem);
        elem = eval.iterateNext();
    }
    return results;
};

const getElementXpathName = function(element) {
    switch (element.nodeType)
        {
            case Node.TEXT_NODE:
                return 'text()';
                break;
            case Node.ATTRIBUTE_NODE:
                return '@' + element.nodeName;
                break;
            case Node.PROCESSING_INSTRUCTION_NODE:
                return 'processing-instruction()';
                break;
            case Node.COMMENT_NODE:
                return 'comment()';
                break;
            case Node.ELEMENT_NODE:
                return element.nodeName;
                break;
            default:
                return '*';
                break;
        }
}

const getXPath = function (node) {
    var comp, comps = [];
    var parent = null;
    var xpath = '';
    var getPos = function(node)
    {
        var position = 1, curNode;
        if (node.nodeType == Node.ATTRIBUTE_NODE)
        {
            return null;
        }
        for (curNode = node.previousSibling; curNode; curNode = curNode.previousSibling)
        {
            if (curNode.nodeName == node.nodeName)
            {
                ++position;
            }
        }
        return position;
     }

    if (node instanceof Document)
    {
        return '/';
    }

    for (; node && !(node instanceof Document); node = node.nodeType == Node.ATTRIBUTE_NODE ? node.ownerElement : node.parentNode)
    {
        comp = comps[comps.length] = {};
        switch (node.nodeType)
        {
            case Node.TEXT_NODE:
                comp.name = 'text()';
                break;
            case Node.ATTRIBUTE_NODE:
                comp.name = '@' + node.nodeName;
                break;
            case Node.PROCESSING_INSTRUCTION_NODE:
                comp.name = 'processing-instruction()';
                break;
            case Node.COMMENT_NODE:
                comp.name = 'comment()';
                break;
            case Node.ELEMENT_NODE:
                comp.name = node.nodeName;
                break;
        }
        comp.position = getPos(node);
    }

    for (var i = comps.length - 1; i >= 0; i--)
    {
        comp = comps[i];
        xpath += '/' + comp.name;
        if (comp.position != null)
        {
            xpath += '[' + comp.position + ']';
        }
    }

    return xpath;
}

const getPathBetweenNodes = function(markerElement, targetElement) {
    var targetXpath = getXPath(targetElement);
    var markerXpath = getXPath(markerElement);
    if (markerXpath == targetXpath)
    {
        return ".";
    }
    var markerPieces = markerXpath.split('/');
    var targetPieces = targetXpath.split('/');
    var commonRoot = '';
    var i = 0;
    for (i = 0; i < markerPieces.length && i < targetPieces.length; i++)
    {
        if (markerPieces[i] == targetPieces[i])
        {
            commonRoot = commonRoot.concat(markerPieces[i]).concat('/');
        }
        else
        {
            break;
        }
    }
    // Cut off last slash
    commonRoot = commonRoot.slice(0, -1);
    var commonRootElement = getElementByXpath(commonRoot);
    if (commonRootElement)
    {
        if (i == markerPieces.length || i == targetPieces.length)
        {
            // This branch is if a marker is an actual parent or child of the target
            var pathBetween = '';
            for (var j = 0; j < (markerPieces.length - i); j++)
            {
                pathBetween = pathBetween.concat("../");
            }
            for (var j = i; j < targetPieces.length; j++)
            {
                pathBetween = pathBetween.concat(targetPieces[j]).concat("/");
            }
            // Return our resolved path, minus the trailing slash
            return pathBetween.slice(0, -1);
        }
        else
        {
            // This branch is if a marker is not an actual parent or child of the target which means we can step along 
            //    the siblings of a part of the DOM to keep the final path as relative as possible
            var commonRootMarkerChild = getElementByXpath(commonRoot + '/' + markerPieces[i]);
            var commonRootTargetChild = getElementByXpath(commonRoot + '/' + targetPieces[i]);
            if (commonRootMarkerChild && commonRootTargetChild)
            {
                var children = commonRootElement.childNodes;
                var found = false;
                var numFound = 0;
                var pathBetween = '';
                for (var j = 0; j < (markerPieces.length - i - 1); j++)
                {
                    pathBetween = pathBetween.concat("../");
                }
                // Scan forward
                for (var j = 0; j < children.length; j++)
                {
                    // If we come across the target but we haven't seen the marker yet, break, we will scan backwards instead
                    if (children[j] == commonRootTargetChild && !found)
                    {
                        break;
                    }
                    if (children[j] == commonRootMarkerChild && !found)
                    {
                        found = true;
                    }
                    else if (found && children[j].nodeType == commonRootTargetChild.nodeType 
                                   && children[j].nodeName == commonRootTargetChild.nodeName)
                    {
                        numFound += 1;
                    }
                    // If we come across the target and we have seen the marker, great, let's stop
                    if (children[j] == commonRootTargetChild)
                    {
                        pathBetween = pathBetween.concat("following-sibling::").concat(children[j].nodeName).concat("["+numFound.toString()+"]/");
                        break;
                    }
                }
                if (!found)
                {
                    // Scan backwards
                    for (var j = children.length - 1; j >= 0; j--)
                    {
                        // If we come across the target but we haven't seen the marker yet, break
                        if (children[j] == commonRootTargetChild && !found)
                        {
                            break;
                        }
                        if (children[j] == commonRootMarkerChild && !found)
                        {
                            found = true;
                        }
                        else if (found && children[j].nodeType == commonRootTargetChild.nodeType 
                                       && children[j].nodeName == commonRootTargetChild.nodeName)
                        {
                            numFound += 1;
                        }
                        // If we come across the target and we have seen the marker, great, let's stop
                        if (children[j] == commonRootTargetChild)
                        {
                            pathBetween = pathBetween.concat("preceding-sibling::").concat(children[j].nodeName).concat("["+numFound.toString()+"]/");
                            break;
                        }
                    }
                }
                if (found)
                {
                    for (var j = i+1; j < targetPieces.length; j++)
                    {
                        pathBetween = pathBetween.concat(targetPieces[j]).concat("/");
                    }
                    // Return our resolved path, minus the trailing slash
                    return pathBetween.slice(0, -1);
                }
                else
                {
                    return -1;
                }
            }
            else
            {
                return -2;
            }
        }
    }
    else
    {
        return -2;
    }
}

const quoteXpath = function(val) {
    let pieces = val.split('\'');
    if (pieces.length > 1)
    {
        let retval = 'concat(';
        for (let i = 0; i < pieces.length; i++)
        {
            if (pieces[i])
            {
                retval = retval + '\'' + pieces[i] + '\',';
                if (i != pieces.length - 1)
                {
                    retval = retval + '"\'",';
                }
            }
        }
        retval = retval.substring(0, retval.length - 1);
        retval = retval + ')';
        return retval;
    }
    else
    {
        return '\''+val+'\'';
    }
};

const getBounds = function(element) {
    var bou = null;
    if (element.nodeType == Node.TEXT_NODE)
    {
        var range = document.createRange();
        range.selectNodeContents(element);
        var rects = range.getClientRects();
        var minx = 0;
        var miny = 0;
        var maxx = 0;
        var maxy = 0;
        for (let i = 0; i < rects.length; i++)
        {
            if (i==0 || rects[i].x < minx)
            {
                minx = rects[i].x;
            }
            if (i==0 || rects[i].y < miny)
            {
                miny = rects[i].y;
            }
            if (i==0 || rects[i].x + rects[i].width > maxx)
            {
                maxx = rects[i].x + rects[i].width;
            }
            if (i==0 || rects[i].y + rects[i].height > maxy)
            {
                maxy = rects[i].y + rects[i].height;
            }
        }
        bou = {x:minx, y:miny, width:maxx-minx, height: maxy-miny};
    }
    else if (element.nodeType == Node.ELEMENT_NODE)
    {
        bou = element.getBoundingClientRect();
    }
    return bou;
};

const filterElementByNonzeroSize = function(ele) {
    let filtered = [];
    for (let i = 0; i < ele.length; i++)
    {
        let bou = getBounds(ele[i]);
        if (bou)
        {
            if (bou.width != 0 && bou.height != 0)
            {
                filtered.push({element:ele[i],bounds:bou});
            }
        }
    }
    return filtered;
};

const checkNodeAndAdd = function(paths, path, found, element, origElement) {
    if (found.includes(element))
    {
        return;
    }
    found.push(element);
    let resolvedElements = filterElementByNonzeroSize(getElementsByXpath(path));
    if (resolvedElements.length > 0)
    {
        let pathBetween = getPathBetweenNodes(element, origElement);
        if (pathBetween != -1 && pathBetween != -2)
        {
            let resolvedNodes = filterElementByNonzeroSize(getElementsByXpath(path + '/' + pathBetween));
            let elemBounds = getBounds(element);
            if (elemBounds.width != 0 && elemBounds.height != 0 && resolvedNodes.length > 0 && resolvedNodes[0].element == origElement)
            {
                paths.push({path:path + '/' + pathBetween, bounds:elemBounds});
            }
        }
    }
};

const walkDom = function(origElement, gatherDepth, element, seen, found, laststep) {
    let returnObj = {};
    returnObj.done = false;
    returnObj.paths = [];

    if (seen.includes(element))
    {
        returnObj.done = true;
        return returnObj;
    }
    seen.push(element);

    if (element.id)
    {
        let path ='//'+element.nodeName+'[@id=\''+element.id+'\']';
        checkNodeAndAdd(returnObj.paths, path, found, element, origElement);
    }
    if (element.nodeType == Node.TEXT_NODE && element.textContent.trim() && element.textContent.trim().split(/[\n\r]/g).length == 1)
    {
        let path ='//text()[normalize-space(.) = '+quoteXpath(element.textContent.trim())+']';
        checkNodeAndAdd(returnObj.paths, path, found, element, origElement);
    }
    if (element.nodeName == "INPUT" && element.type == "submit" && element.value)
    {
        let path ='//INPUT[@value = '+quoteXpath(element.value)+']';
        checkNodeAndAdd(returnObj.paths, path, found, element, origElement);
    }

    if (gatherDepth > 0)
    {
        // We know we need to go deeper into tree. Now assume we have hit a dead end unless we find otherwise
        returnObj.done = true;

        if (element.childNodes && element.childNodes.length > 0 && laststep != 'parent')
        {
            let scan = walkDom(origElement, gatherDepth - 1, element.childNodes[0], seen, found, 'child');
            returnObj.paths = returnObj.paths.concat(scan.paths);
            if (!scan.done)
            {
                returnObj.done = false;
            }
        }
        if (element.previousSibling && laststep != 'down')
        {
            let scan = walkDom(origElement, gatherDepth - 1, element.previousSibling, seen, found, 'up');
            returnObj.paths = returnObj.paths.concat(scan.paths);
            if (!scan.done)
            {
                returnObj.done = false;
            }
        }
        if (element.nextSibling && laststep != 'up')
        {
            let scan = walkDom(origElement, gatherDepth - 1, element.nextSibling, seen, found, 'down');
            returnObj.paths = returnObj.paths.concat(scan.paths);
            if (!scan.done)
            {
                returnObj.done = false;
            }
        }
        if (element.parentNode && laststep != 'child')
        {
            let scan = walkDom(origElement, gatherDepth - 1, element.parentNode, seen, found, 'parent');
            returnObj.paths = returnObj.paths.concat(scan.paths);
            if (!scan.done)
            {
                returnObj.done = false;
            }
        }
    }
    return returnObj;
};

const gatherXpaths = function(minNum, element) {
    let gatherDepth = 16;
    let gatheredPaths = [];
    let done = false;
    while (gatheredPaths.length < minNum && !done)
    {
        returnObj = walkDom(element, gatherDepth, element, [], [], '');
        gatheredPaths = returnObj.paths;
        done = returnObj.done;

        gatherDepth = gatherDepth * 2;
    }
    let elementBounds = getBounds(element);
    let elementCenterx = elementBounds.x + elementBounds.width/2;
    let elementCentery = elementBounds.y + elementBounds.height/2;

    gatheredPaths.sort((obj1, obj2) => {
        var centerx1 = obj1.bounds.x + obj1.bounds.width/2;
        var centery1 = obj1.bounds.y + obj1.bounds.height/2;
        var centerx2 = obj2.bounds.x + obj2.bounds.width/2;
        var centery2 = obj2.bounds.y + obj2.bounds.height/2;
        
        var dist1 = (centerx1 - elementCenterx)*(centerx1 - elementCenterx) + (centery1 - elementCentery)*(centery1 - elementCentery);
        var dist2 = (centerx2 - elementCenterx)*(centerx2 - elementCenterx) + (centery2 - elementCentery)*(centery2 - elementCentery);
        if (dist1 > dist2)
        {
            return 1;
        }
        if (dist2 > dist1)
        {
            return -1;
        }

        return 0;
    });
    let reducedPaths = [];
    for (var i = 0; i < gatheredPaths.length && i < minNum; i++)
    {
        reducedPaths.push(gatheredPaths[i].path);
    }
    return reducedPaths;
};

const findElement = function(xpaths, info = {}) {
    let elements = [];
    for (let i = 0; i < xpaths.length; i++)
    {
        var element = getElementByXpath(xpaths[i]);
        if (element)
        {
            let bounds = getBounds(element);
            if (bounds.width > 0 && bounds.height > 0)
            {
                elements.push(element);
            }
        }
    }
    if (elements.length > 0)
    {
        if (elements.length > 1)
        {
            let scores = new Array(elements.length).fill(0);
            for (let i = 0; i < elements.length; i++)
            {
                for (let j = 0; j < elements.length; j++)
                {
                    if (i != j && elements[i] == elements[j])
                    {
                        scores[i]++;
                    }
                }
            }
            let idx = -1;
            for (let i = 0; i < elements.length; i++)
            {
                if (idx == -1 || scores[i] > scores[idx])
                {
                    idx = i;
                }
            }
            info.score = Number(scores[idx]) / elements.length;
            
            return elements[idx];
        }
        else
        {
            info.score = 1.0;
            return elements[0];
        }
    }
    else
    {
        return [];
    }
};

let thisHost = null;

const getThisHost = async function() {
    while (true)
    {
        // Loop because maybe we are a non-top-level frame content script and need to wait for the top-level
        //  content script to establish the hostname for this tab.
        let reply = await sendMessageToBackground({command: 'whereami', host:window.location.hostname});
        if (reply.host)
        {
            thisHost = reply.host;
            console.log("Found host: " + thisHost);
            break;
        }
        await timeout(100);
    }
};
getThisHost();

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    if (request.command == "getBounds")
    {
        let info = {};
        let element = findElement(request.xpaths, info);
        if (!element)
        {
            sendResponse({result: "failure"});
        }
        else
        {
            let bounds = getBounds(element);
            sendResponse({result: "success", bounds: bounds, info: info});
        }
    }
    else if (request.command == "scrollIntoView")
    {
        let element = findElement(request.xpaths);
        if (!element)
        {
            sendResponse({result: "failure"});
        }
        else
        {
            element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
            sendResponse({result: "success"});
        }
    }
    else if (request.command == "click")
    {
        let element = findElement(request.xpaths);
        if (!element)
        {
            sendResponse({result: "failure"});
        }
        else
        {
            let bounds = getBounds(element);
            var fev = new FocusEvent('focus', {
                'view': window,
                'screenX': bounds.x + bounds.width/2,
                'screenY': bounds.y + bounds.height/2
            });
            element.dispatchEvent(fev);

            var ev = new MouseEvent('mousedown', {
                'button': 0,
                'view': window,
                'bubbles': true,
                'cancelable': true,
                'screenX': bounds.x + bounds.width/2,
                'screenY': bounds.y + bounds.height/2
            });

            element.dispatchEvent(ev);

            ev = new MouseEvent('mouseup', {
                'button': 0,
                'view': window,
                'bubbles': true,
                'cancelable': true,
                'screenX': bounds.x + bounds.width/2,
                'screenY': bounds.y + bounds.height/2
            });

            element.dispatchEvent(ev);

            ev = new MouseEvent('click', {
                'button': 0,
                'view': window,
                'bubbles': true,
                'cancelable': true,
                'screenX': bounds.x + bounds.width/2,
                'screenY': bounds.y + bounds.height/2
            });
            element.dispatchEvent(ev);
            sendResponse({result: "success"});
        }
    }
    else if (request.command == "enterkey")
    {
        let element = findElement(request.xpaths);
        if (!element)
        {
            sendResponse({result: "failure"});
        }
        else
        {
            let val = request.val;
            if (val.startsWith("===JAVASCRIPT==="))
            {
                try
                {
                    val = eval(val.substring(16));
                }
                catch(err)
                {
                    sendResponse({result: "failure"});
                }
            }
            if (element.options && element.options.length > 0)
            {
                let bestPartial = -1;
                for (let i = 0; i < element.options.length; i++)
                {
                    if (element.options[i].text.toLowerCase() == val.toLowerCase())
                    {
                        element.value = element.options[i].value;
                        bestPartial = -1;
                        break;
                    }
                    if (element.options[i].text.toLowerCase().search(val.toLowerCase()) > -1)
                    {
                        bestPartial = i;
                    }
                }
                if (bestPartial > -1)
                {
                    element.value = element.options[bestPartial].value;
                }
            }
            else
            {
                element.value = val;
            }
            element.dispatchEvent(new Event('input', {bubbles: true}));
            element.dispatchEvent(new Event('change', {bubbles: true}));

            sendResponse({result: "success"});
        }

    }
    else
    {
        sendResponse({result: "failure"});
    }
});


const listenForMagicKeyDown = async function(ev) {
    if (thisHost && ev.ctrlKey && ev.altKey && (ev.code =='KeyW'))
    {
        let element = document.elementFromPoint(globalX, globalY);
        if (!element)
        {
            alert("Can't find any element there");
        }
        else
        {
            let xpaths = gatherXpaths(20, element);

            let elementBounds = getBounds(element);
            var step = {start:{x:elementBounds.x, y:elementBounds.y}, sz:{x:elementBounds.width, y:elementBounds.height}, xpaths: xpaths.slice(0,9)};
            if (ev.code == 'KeyW')
            {
                var resp = prompt('What should be entered in this step? (enter blank for a click)');
                if (resp != null)
                {
                    if (resp)
                    {
                        step.command = 'enterkey';
                        step.val = resp;
                    }
                    else
                    {
                        step.command = 'click';
                    }
                }
            }
            if (step.command)
            {
                let reply = await sendMessageToBackground({command: 'addstep', host: thisHost, step:step});
                if (reply.success)
                {
                    let reply = await sendMessageToBackground({command: 'runlaststep', host: thisHost});
                    if (!reply.success)
                    {
                        console.log("Adding step was successful but running it was not");
                    }
                }
            }
        }
    }
    else if (ev.ctrlKey && ev.altKey && ev.code =='KeyZ')
    {
        console.log("Clearing steps");
        let reply = await sendMessageToBackground({command: 'clearsteps', host: thisHost});
        alert("Cleared steps");
    }
    else if (ev.ctrlKey && ev.altKey && ev.code =='KeyX')
    {
        console.log("Clearing last step");
        let reply = await sendMessageToBackground({command: 'clearlaststep', host: thisHost});
        alert("Cleared last step");
    }
};

const listenForMagicKeyDownWrapper = function(ev) {
    listenForMagicKeyDown(ev);
}

const listenForMouseMove = function(ev) {
    globalX = ev.clientX;
    globalY = ev.clientY;
};


document.addEventListener('DOMContentLoaded', function () {
    if (document.body)
    {
        document.body.addEventListener('keydown', listenForMagicKeyDownWrapper);
        document.body.addEventListener('mousemove', listenForMouseMove);
    }
});

