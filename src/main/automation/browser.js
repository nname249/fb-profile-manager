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
        "--disk-cache-size=1",
        "--media-cache-size=1",
        "--disable-features=CalculateNativeWinOcclusion,InterestFeedContentSuggestions",
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
            // Detection logic based on UID
            const cUser = cookies.find(c => c.name === 'c_user');
            let status = "Die/Logout";

            if (cUser && cUser.value && cUser.value !== "0") {
                status = "Live";
            } else {
                const content = await page.content();
                if (content.includes("ACCOUNT_ID") && !content.includes("checkpoint")) {
                    const match = content.match(/\"ACCOUNT_ID\":\"(\d+)\"/);
                    if (match && match[1] && match[1] !== "0") status = "Live";
                }

                // Fallback keywords if not Live
                if (status !== "Live") {
                    const url = page.url();
                    if (url.includes("checkpoint")) status = "Checkpoint";
                    else if (url.includes("confirm_identity")) status = "Checkpoint";
                }
            }

            return {
                cookies: formatCookies(cookies),
                status: status
            };
        } catch (err) {
            console.error("Lỗi lấy Cookies từ context đang mở:", err);
            throw new Error("Không thể lấy Cookies từ trình duyệt đang mở. Vui lòng kiểm tra lại tab Facebook.");
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
            "--disable-setuid-sandbox",
            "--disk-cache-size=1",
            "--media-cache-size=1"
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
        if (err.message.includes('used by another browser') || err.message.includes('Access is denied')) {
            throw new Error("Profile đang được sử dụng hoặc bị khóa. Hãy đóng các trình duyệt đang mở của tài khoản này.");
        }
        throw err;
    });

    try {
        const cookies = await browserContext.cookies();
        const page = await browserContext.newPage();

        // Check status by visiting FB
        await page.goto("https://www.facebook.com", { waitUntil: 'domcontentloaded', timeout: 15000 });
        const url = page.url();
        let status = "Die/Logout";

        // Strategy 1: Check c_user cookie
        const cUser = cookies.find(c => c.name === 'c_user');
        if (cUser && cUser.value && cUser.value !== "0") {
            status = "Live";
        } else {
            // Strategy 2: Check ACCOUNT_ID in page source
            const content = await page.content();
            const match = content.match(/\"ACCOUNT_ID\":\"(\d+)\"/);
            if (match && match[1] && match[1] !== "0") {
                status = "Live";
            } else if (url.includes("checkpoint") || url.includes("multi_step_checkpoint") || url.includes("confirm_identity")) {
                status = "Checkpoint";
            } else if (url.includes("disabled") || url.includes("banned")) {
                status = "Die/Banned";
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
 * Extracts the internal FB UID (c_user or ACCOUNT_ID) from the page source or cookies
 */
export async function getInternalUID(account, proxy) {
    // Check if browser is open
    if (activeContexts.has(account.id)) {
        const context = activeContexts.get(account.id);
        const cookies = await context.cookies();
        const cUser = cookies.find(c => c.name === 'c_user');
        if (cUser) return cUser.value;

        // If open but no c_user, try to grab from page source if a page is open
        const pages = context.pages();
        if (pages.length > 0) {
            const content = await pages[0].content();
            const match = content.match(/\"ACCOUNT_ID\":\"(\d+)\"/);
            if (match && match[1]) return match[1];
        }

        throw new Error("Không tìm thấy UID. Vui lòng đăng nhập Facebook trên trình duyệt đang mở.");
    }

    // Otherwise launch headlessly and check
    const profileSetting = db.get("SELECT value FROM settings WHERE key = 'profile_path'");
    const baseProfilePath = profileSetting.value;
    const userDataDir = join(baseProfilePath, account.uid || `profile_${account.id}`);
    const executablePath = getExecutablePath();

    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        executablePath,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disk-cache-size=1",
            "--media-cache-size=1"
        ]
    }).catch(err => {
        if (err.message.includes('used by another browser') || err.message.includes('Access is denied')) {
            throw new Error("Vui lòng đóng trình duyệt của tài khoản này trước khi thực hiện.");
        }
        throw err;
    });

    try {
        const page = await browserContext.newPage();
        await page.goto("https://www.facebook.com", { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Strategy 1: Cookies (Fastest)
        const cookies = await browserContext.cookies();
        const cUser = cookies.find(c => c.name === 'c_user');
        if (cUser) return cUser.value;

        // Strategy 2: Page Source (Fallback)
        const content = await page.content();
        const match = content.match(/\"ACCOUNT_ID\":\"(\d+)\"/);
        if (match && match[1]) return match[1];

        return "Not found";
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
