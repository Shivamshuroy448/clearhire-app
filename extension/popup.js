// ClearHire Extension Popup Script

document.addEventListener("DOMContentLoaded", () => {
    const userIdInput = document.getElementById("user-id");
    const apiBaseInput = document.getElementById("api-base");
    const saveBtn = document.getElementById("save-config-btn");
    const openLinkedInBtn = document.getElementById("open-linkedin-btn");
    const openAppBtn = document.getElementById("open-app-btn");
    const statusText = document.getElementById("status-text");

    // Load saved settings
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["clearhire_user_id", "clearhire_api_base"], (data) => {
            if (data.clearhire_user_id) {
                userIdInput.value = data.clearhire_user_id;
            }
            if (data.clearhire_api_base) {
                apiBaseInput.value = data.clearhire_api_base;
            }
        });
    }

    saveBtn.addEventListener("click", () => {
        const userId = userIdInput.value.trim();
        const apiBase = apiBaseInput.value.trim() || "https://clearhire-app.vercel.app";

        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                clearhire_user_id: userId,
                clearhire_api_base: apiBase
            }, () => {
                statusText.style.color = "#059669";
                statusText.innerText = "Settings saved!";
                setTimeout(() => { statusText.innerText = ""; }, 2500);
            });
        }
    });

    openLinkedInBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "https://www.linkedin.com/jobs/tracker/" });
    });

    openAppBtn.addEventListener("click", () => {
        const url = apiBaseInput.value.trim() || "https://clearhire-app.vercel.app";
        chrome.tabs.create({ url: url });
    });
});
