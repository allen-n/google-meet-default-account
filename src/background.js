var authUser;
const logging = false;
chrome.storage.sync.get({
    authuser: 0, // Default will be 0
}, function (result) {
    authUser = result.authuser;
});

/**
 * Apps that use the authuser=# in the URL to specify user
 */
const authApps = new Map([
    ["meet.google.com", ""],
    ["maps.google.com", ""],
    ["google.com", ""],
]);

/**
 * Apps that use the /u/# in the URL to specify user
 */
const uApps = new Map([
    ["mail.google.com", "/mail"],
    ["calendar.google.com", ""],
    ["translate.google.com", ""],
    ["drive.google.com", "/drive"],
    ["news.google.com", ""],
    ["duo.google.com", ""],
    ["photos.google.com", ""],
]);

/**
 * All apps the extension works with
 */
const allApps = new Map([...uApps, ...authApps])

/**
 * A helper function to return the google app name on full google
 * app url (x.google.com) 
 * 
 * @param {String} url the full url of the google web app
 * 
 * @return {String} the app name, empty string if no app name matches
 */
function url2AppName(url) {
    var appRegex = /[\w]{0,20}[\.]?google\.com/;
    var appName = url.match(appRegex);
    if (appName) {
        appName = appName[0]
    } else {
        appName = ""
    }
    return appName;
}

/**
 * A helper function to return the user # based on google
 * app url (x.google.com) regardless of authuser or /u/ user
 * numbering method 
 * 
 * @param {String} url the full url of the google web app
 * 
 * @return {Number} the authuser number
 */
function url2UserNum(url) {
    var appName = url2AppName(url);
    const uRegex = /(\/u\/\d){1}(\d)?/; // matches /u/##
    const authRegex = /(authuser=\d){1}(\d)?/; // matches authuser=##
    const userNumRegex = /\d\d?/;  //matches the # part of authuser=##
    var userNum = 0;
    var matches;

    // var returnUrl = "";

    if (authApps.has(String(appName))) {
        matches = url.match(authRegex);

    }
    if (uApps.has(String(appName))) {
        matches = url.match(uRegex);
    }

    if (matches) {
        userNum = Number(matches[0].match(userNumRegex)[0]);
    }
    return userNum;
}


/**
 * Handler for /u/# user specification app redirect
 * 
 * @param {String} url the full url
 * @param {Number} userNum the desired user #
 * @param {String} appName the app name (of the form app.google.com)
 * 
 * @return {String} the url that should be passed for the redirect
 */
function handleUApp(url, userNum, appName) {
    const uRegex = /(\/u\/\d){1}(\d)?/; // matches /u/##
    const userNumRegex = /\d\d?/;  //matches the # part of /u/##
    var currentUser = url.match(uRegex);
    var returnURL = url;
    if (currentUser) {
        // Already a u param in the url
        var currentUserNum = currentUser[0].match(userNumRegex);
        if (currentUserNum && currentUserNum == authUser) {
            returnURL = "";
        } else {
            returnURL = url.replace(uRegex, `/u/${userNum}`)
        }
    } else {
        // no u param, we need to add it
        if (userNum == 0) {
            returnURL = ""
        } else {
            let urlArray = returnURL.split("");
            if (urlArray[urlArray.length - 1] == "/") {
                urlArray.pop();
            }
            returnURL = urlArray.join("");
            returnURL = returnURL.replace(appName, appName + uApps.get(appName) + `/u/${userNum}`)
        }
    }
    return returnURL;
}

/**
 * Handler for authuser=# user specification app redirect
 * 
 * @param {String} url the full url
 * @param {Number} userNum the desired user #
 * @param {String} appName the app name (of the form app.google.com)
 * 
 * @return {String} the url that should be passed for the redirect
 */
function handleAuthApp(url, userNum, appName) {
    const uRegex = /(authuser=\d){1}(\d)?/; // matches authuser=##
    const userNumRegex = /\d\d?/;  //matches the # part of authuser=##
    var currentUser = url.match(uRegex);
    var returnURL = url;
    if (currentUser) {
        // Already a u param in the url
        var currentUserNum = currentUser[0].match(userNumRegex);
        if (currentUserNum && currentUserNum == authUser) {
            returnURL = "";
        } else {
            returnURL = url.replace(uRegex, `authuser=${userNum}`)
        }
    } else {
        // no u param, we need to add it
        if (userNum == 0) {
            returnURL = ""
        } else {
            let urlArray = returnURL.split("");
            if (urlArray[urlArray.length - 1] == "/") {
                urlArray.pop();
            }
            returnURL = urlArray.join("");
            returnURL += authApps.get(appName) + `?authuser=${userNum}`
        }
    }
    return returnURL;
}

// TODO fix this, make it user modifyable
var isUserLocked = false; // if user is locked, redirect and don't let authuser update 

/**
 * 
 * @param {String} badgeText the text to be put on the extension badge
 */
function updateBadgeText(badgeText) {
    chrome.browserAction.setBadgeText({ text: badgeText }); // We have 10+ unread items.
}

function lockAuthUserNum() {

    isUserLocked = true;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        let url = tabs[0].url;
        let appName = url2AppName(url);
        let userNum = 0;
        if (allApps.has(appName)) {
            userNum = url2UserNum(url);
        }
        updateBadgeText(String(userNum));

        chrome.storage.sync.set({
            authuser: userNum,
        }, function () {
            authUser = userNum;
        });
    });
}

function unlockAuthUserNum() {
    isUserLocked = false;
    updateBadgeText("");
}

chrome.browserAction.onClicked.addListener(
    function (tab) {
        if (isUserLocked) {
            unlockAuthUserNum();
        } else {
            lockAuthUserNum();
        }
    });



chrome.webRequest.onBeforeRequest.addListener(function (details) {
    // var appRegex = /[\w]{0,20}[\.]?google\.com/;
    var appName = url2AppName(details.url); // details.url.match(appRegex)[0];
    var returnUrl = "";
    // if (allApps.has(appName)) {
    //     console.log(`${appName} user number is ==> ${url2UserNum(details.url)}`)
    // }


    if (String(appName) == "mail.google.com") {
        if (details.method != "POST" && details.type != "xmlhttprequest") {
            returnUrl = handleUApp(details.url, authUser, appName)
            if (logging) { console.log(`Original URL: ${details.url} --> ${returnUrl}`) }
        }
    } else if (details.method == "GET" && details.type == "main_frame") {
        if (authApps.has(String(appName))) {
            returnUrl = handleAuthApp(details.url, authUser, appName);
            if (logging) { console.log(`Original URL: ${details.url} --> ${returnUrl}`) }
        }

        if (uApps.has(String(appName))) {
            returnUrl = handleUApp(details.url, authUser, appName)
            if (logging) { console.log(`Original URL: ${details.url} --> ${returnUrl}`) }
        }
    }

    if (isUserLocked && returnUrl != "" && returnUrl != details.url) {
        return {
            redirectUrl: returnUrl
        };
    }
}, {
    urls: ["*://\*.google.com/*"]
}, ["blocking"]);
