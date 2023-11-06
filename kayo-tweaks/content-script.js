window.kayoTweaks = {
    STORAGE_KEY_PREFIX: "x-current-time",
    INTERVAL: 10000, // milliseconds
    intervalId: null,

    video: () => {
        return document.querySelector("video[src*=kayo]");
    },

    chromecastMedia: () => {
        if (typeof(cast) === "undefined") {
            return;
        }
        const session = cast.framework.CastContext.getInstance().getCurrentSession();
        if (!session) {
            return;
        }
        const state = session.getSessionState();
        if (state === "SESSION_STARTED" || state === "SESSION_RESUMED") {
            return session.getMediaSession()
        }
    },

    storageKey: () => {
        return kayoTweaks.STORAGE_KEY_PREFIX + "_" + document.location.href;
    },

    getTime: () => {
        if (kayoTweaks.video()) {
            return kayoTweaks.video().currentTime;
        } else if (media = kayoTweaks.chromecastMedia()) {
            return media.getEstimatedTime()
        }
    },

    setTime: (time) => {
        if (kayoTweaks.video()) {
            kayoTweaks.video().currentTime = time;
        } else if (media = kayoTweaks.chromecastMedia()) {
            let request = new chrome.cast.media.SeekRequest();
            request.currentTime = time;
            media.seek(request, null, console.error);
        }
    },

    saveTime: () => {
        const time = kayoTweaks.getTime();
        // Ignore early times so we don't override the time on a page reload
        if (time && time > 120) {
            localStorage.setItem(kayoTweaks.storageKey(), time);
        }
    },

    loadTime: () => {
        time = localStorage.getItem(kayoTweaks.storageKey());
        if (time && time > 120) {
            kayoTweaks.setTime(time);
        }
    },

    saveTimePeriodically: () => {
        kayoTweaks.intervalId = setInterval(kayoTweaks.saveTime, kayoTweaks.INTERVAL);
    },

    toggleFullscreen: () => {
        if (kayoTweaks.video()) {
            const button = document.querySelector("button[title*=Fullscreen]");
            if (button) {
                button.click();
            }
        }
    },

    changeSpeed: () => {
        if (kayoTweaks.video()) {
            const button = document.querySelector("button[title*='playback rate']");
            if (button) {
                button.click();
            }
        }
    },

    keyUp: event => {
        if (event.key === "f") {
            kayoTweaks.toggleFullscreen();
        } else if (event.key === "," || event.key === ".") {
            kayoTweaks.changeSpeed();
        }
    }
};

// Attempt to load the saved video playback time on page load.
// Unfortunately, this doesn't work for local playback because the video element
// doesn't exist yet. And it doesn't work for chromecast because the session
// hasn't started.
// Instead load the time by clicking the chrome extension icon.
kayoTweaks.loadTime();

// Start tracking where the playback is up to.
kayoTweaks.saveTimePeriodically();

document.addEventListener("keyup", kayoTweaks.keyUp);
