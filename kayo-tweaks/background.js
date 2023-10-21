chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        let rule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostSuffix: 'kayosports.com.au', schemes: ['https'] }
                })
            ],
            actions: [ new chrome.declarativeContent.ShowAction() ]
        };

        chrome.declarativeContent.onPageChanged.addRules([rule]);
    });
});

chrome.action.onClicked.addListener(async (tab) => {
    console.log("Page action clicked");

    // If we can see the url, we have permission to do stuff on this page
    if (tab.url) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.kayoTweaks.loadTime(),
            world: "MAIN"
        });
    }
});
