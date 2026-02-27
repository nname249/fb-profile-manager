import { chromium } from "playwright-core";
import { app } from "electron";
import { join } from "path";
import fs from "fs";
import db from "../database/db.js";

// Keep track of active contexts to allow cookie extraction from open browsers
const activeContexts = new Map();

// Helper to get executable path
const getExecutablePath = () => {
    // Playwright usually installs to %USERPROFILE%\AppData\Local\ms-playwright
    const playwrightDir = join(process.env.LOCALAPPDATA, 'ms-playwright');
    if (fs.existsSync(playwrightDir)) {
        const chromiumDirs = fs.readdirSync(playwrightDir).filter(d => d.startsWith('chromium-'));
        if (chromiumDirs.length > 0) {
            // Sort to get the latest version
            chromiumDirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            // Notice: Added 'chrome-win64' to the path based on actual environment check
            const path = join(playwrightDir, chromiumDirs[0], 'chrome-win64', 'chrome.exe');
            if (fs.existsSync(path)) return path;
        }
    }
    return null;
};

export async function launchAccount(account, proxy) {
    const profileSetting = db.get("SELECT value FROM settings WHERE key = 'profile_path'");
    const baseProfilePath = profileSetting.value;

    if (!fs.existsSync(baseProfilePath)) {
        fs.mkdirSync(baseProfilePath, { recursive: true });
    }

    const userDataDir = join(baseProfilePath, account.uid || `profile_${account.id}`);
    const executablePath = getExecutablePath();

    const args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--start-maximized",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--disable-notifications",
    ];

    const launchOptions = {
        headless: false,
        executablePath,
        args,
        viewport: null,
        ignoreDefaultArgs: ["--enable-automation"]
    };

    if (proxy) {
        launchOptions.proxy = {
            server: `${proxy.type}://${proxy.host}:${proxy.port}`,
        };
        if (proxy.username && proxy.password) {
            launchOptions.proxy.username = proxy.username;
            launchOptions.proxy.password = proxy.password;
        }
    }

    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        ...launchOptions,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        locale: "vi-VN",
        timezoneId: "Asia/Ho_Chi_Minh",
    });

    // Store for later use (e.g. cookie extraction)
    activeContexts.set(account.id, browserContext);
    browserContext.on('close', () => activeContexts.delete(account.id));

    const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();

    // Stealth scripts
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    await page.goto("https://www.facebook.com", { waitUntil: 'domcontentloaded' });

    return browserContext;
}

/**
 * Formats cookies array to a standard cookie string
 */
function formatCookies(cookies) {
    // Only get cookies for facebook.com
    return cookies
        .filter(c => c.domain.includes('facebook.com'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
}

export async function getCookies(account, proxy) {
    // 1. If the browser is already open, use the existing context
    if (activeContexts.has(account.id)) {
        const context = activeContexts.get(account.id);
        try {
            const cookies = await context.cookies();
            if (cookies.length === 0) throw new Error("Không tìm thấy cookies. Vui lòng đăng nhập Facebook.");

            // Get status from current pages if possible, or visit once
            const pages = context.pages();
            const page = pages.length > 0 ? pages[0] : await context.newPage();
            const url = page.url();

            let status = "Unknown";
            if (url.includes("checkpoint")) status = "Checkpoint";
            else if (url.includes("login") || url.includes("facebook.com/confirm")) status = "Die/Logout";
            else if (url.includes("facebook.com")) status = "Live";

            return {
                cookies: formatCookies(cookies),
                status: status
            };
        } catch (err) {
            console.error("Lỗi lấy Cookies từ context đang mở:", err);
        }
    }

    // 2. If not open (or fallback), launch headlessly, capture and close
    const profileSetting = db.get("SELECT value FROM settings WHERE key = 'profile_path'");
    const baseProfilePath = profileSetting.value;

    const userDataDir = join(baseProfilePath, account.uid || `profile_${account.id}`);
    const executablePath = getExecutablePath();

    const launchOptions = {
        headless: true,
        executablePath,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ],
    };

    if (proxy) {
        launchOptions.proxy = {
            server: `${proxy.type}://${proxy.host}:${proxy.port}`,
        };
        if (proxy.username && proxy.password) {
            launchOptions.proxy.username = proxy.username;
            launchOptions.proxy.password = proxy.password;
        }
    }

    const browserContext = await chromium.launchPersistentContext(userDataDir, launchOptions).catch(err => {
        if (err.message.includes('used by another browser')) {
            throw new Error("Profile đang được mở bởi chương trình khác. Hãy đóng nó trước khi lấy Cookies.");
        }
        throw err;
    });

    try {
        const cookies = await browserContext.cookies();
        const page = await browserContext.newPage();

        // Check status by visiting FB
        await page.goto("https://www.facebook.com", { waitUntil: 'domcontentloaded', timeout: 15000 });
        const url = page.url();

        let status = "Unknown";

        // Improved detection logic
        if (url.includes("checkpoint") || url.includes("multi_step_checkpoint")) {
            status = "Checkpoint";
        } else if (url.includes("disabled") || url.includes("banned") || url.includes("confirm_identity")) {
            status = "Die/Banned";
        } else if (url.includes("login") || url.includes("confirmemail") || url.includes("hacker")) {
            status = "Die/Logout";
        } else if (url.includes("facebook.com")) {
            // Check for specific markers in a few seconds just in case of redirects
            try {
                const title = await page.title();
                if (title.includes("Facebook") || title.includes("Feed")) {
                    status = "Live";
                } else {
                    status = "Check Again";
                }
            } catch (e) {
                status = "Live";
            }
        }

        return {
            cookies: formatCookies(cookies),
            status: status
        };
    } finally {
        await browserContext.close();
    }
}

/**
 * Check account status without returning full cookies
 */
export async function checkStatus(account, proxy) {
    const res = await getCookies(account, proxy);
    return res.status;
}
