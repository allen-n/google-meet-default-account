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

chrome.webRequest.onBeforeRequest.addListener(function (details) {
    var appRegex = /[\w]{0,20}[\.]?google\.com/;
    var appName = details.url.match(appRegex)[0];
    var returnUrl = "";

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

    if (returnUrl != "" && returnUrl != details.url) {
        return {
            redirectUrl: returnUrl
        };
    }
}, {
    urls: ["*://\*.google.com/*"]
}, ["blocking"]);
