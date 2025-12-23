// ==UserScript==
// @name         Roblox Hidden Gem Roulette
// @namespace    http://tampermonkey.net/
// @version      71.0
// @description  DIG UP THOSE HIDDEN GEMS BOIIISS
// @author       gallantSirKnight
// @match        https://www.roblox.com/*
// @connect      games.roblox.com
// @connect      friends.roblox.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const MINER_THREADS = 12; // Scans the users
    const SCOUT_DELAY = 1000; // How often we find new groups of friends

    // Seed Range: 2011-2016 (Active "Classic" Era)
    const MIN_SEED_ID = 20000000;
    const MAX_SEED_ID = 200000000;

    // --- STYLES (Rabbit Hole Theme) ---
    GM_addStyle(`
        .roulette-btn-item { padding: 4px 0; cursor: pointer; list-style: none; }
        .roulette-btn-link {
            display: flex; align-items: center; padding: 8px 12px;
            color: #fff; font-weight: 600; text-decoration: none;
            border-radius: 10px; transition: background 0.2s;
        }
        .light-theme .roulette-btn-link { color: #393b3d; }
        .dark-theme .roulette-btn-link { color: #fff; }
        .roulette-btn-link:hover { background-color: rgba(150, 150, 150, 0.2); }
        .roulette-icon { font-size: 20px; margin-right: 12px; }

        #miner-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(8, 10, 20, 0.98); z-index: 99999;
            display: flex; justify-content: center; align-items: center;
            color: #e0e0e0; font-family: 'Courier New', monospace; flex-direction: column;
        }

        .miner-title {
            font-size: 32px; font-weight: bold; margin-bottom: 20px;
            color: #a0a0ff; text-shadow: 0 0 15px #5050ff;
            text-transform: uppercase; letter-spacing: 3px;
        }

        .miner-stat { font-size: 14px; color: #888; margin-bottom: 5px; }

        .console-box {
            width: 700px;
            height: 250px;
            background: #050510;
            border: 1px solid #444466;
            padding: 20px;
            overflow: hidden;
            font-size: 12px;
            color: #aaffaa;
            margin-top: 25px;
            text-align: left;
            box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
            border-radius: 4px;
        }

        .log-entry { margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9; }
        .log-lock { color: #ff5555; }
        .log-sys { color: #fff; font-weight: bold; }
        .log-scan { color: #aaaaff; }
        .log-scout { color: #ffff55; }

        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

        #cancel-mine {
            margin-top: 30px; padding: 12px 40px;
            background: transparent; color: #a0a0ff;
            border: 1px solid #a0a0ff; border-radius: 4px;
            cursor: pointer; font-family: 'Courier New', monospace;
            transition: all 0.2s;
        }
        #cancel-mine:hover { background: #a0a0ff; color: #000; box-shadow: 0 0 15px #a0a0ff; }
    `);

    // --- SIDEBAR UI ---
    function waitForSidebar() {
        const checkTimer = setInterval(() => {
            let sidebar = document.querySelector('.left-col-list ul') ||
                          document.querySelector('#navigation .rbx-left-col ul') ||
                          document.querySelector('.rbx-scrollbar ul');

            if (sidebar) {
                createButton(sidebar);
                clearInterval(checkTimer);
            }
        }, 1000);
    }

    function createButton(sidebarList) {
        if (document.getElementById('rbx-miner-btn')) return;
        const li = document.createElement('li');
        li.id = 'rbx-miner-btn';
        li.className = 'roulette-btn-item';
        li.innerHTML = `
            <a class="roulette-btn-link">
                <span class="roulette-icon">🐇</span>
                <span class="text-nav">Enter Rabbit Hole</span>
            </a>
        `;
        li.onclick = startMining;
        if (sidebarList.children.length > 0) sidebarList.insertBefore(li, sidebarList.children[1]);
        else sidebarList.appendChild(li);
    }

    // --- ENGINE ---
    let isMining = false;
    let totalChecked = 0;
    let startTime = 0;

    // QUEUE SYSTEM
    let userQueue = []; // Valid IDs waiting to be scanned
    let checkedGames = new Set(); // Prevent duplicates

    function startMining() {
        if (isMining) return;
        isMining = true;
        totalChecked = 0;
        startTime = Date.now();
        userQueue = [];
        checkedGames.clear();

        const overlay = document.createElement('div');
        overlay.id = 'miner-overlay';
        overlay.innerHTML = `
            <div class="miner-title"><span class="pulse">🐇</span> ENTER THE RABBIT HOLE</div>
            <div class="miner-stat">Mode: Social Graph Crawling</div>
            <div class="miner-stat" id="miner-speed">Velocity: 0 profiles/sec</div>
            <div class="miner-stat" id="miner-queue">Target Queue: 0</div>

            <div class="console-box" id="console-log">
                <div class="log-entry log-sys">Social Graph Engine Online.</div>
                <div class="log-entry log-sys">Spawning ${MINER_THREADS} Miner Threads...</div>
            </div>

            <button id="cancel-mine">EXIT RABBIT HOLE</button>
        `;
        document.body.appendChild(overlay);

        document.getElementById('cancel-mine').onclick = () => {
            isMining = false;
            overlay.remove();
        };

        // Start 1 Scout (Finds targets)
        scoutLoop();

        // Start Miners (Scans targets)
        for(let i=0; i < MINER_THREADS; i++) {
            setTimeout(() => minerLoop(i), i * 300);
        }

        setInterval(updateStats, 1000);
    }

    // --- SCOUT LOOP (Finds Valid Users) ---
    function scoutLoop() {
        if (!isMining) return;

        // If queue is full, chill for a bit
        if (userQueue.length > 500) {
            setTimeout(scoutLoop, 2000);
            return;
        }

        const seedId = Math.floor(Math.random() * (MAX_SEED_ID - MIN_SEED_ID)) + MIN_SEED_ID;
        const url = `https://friends.roblox.com/v1/users/${seedId}/friends`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const friends = data.data || [];

                        if (friends.length > 0) {
                            // Add all friends to the queue
                            friends.forEach(f => userQueue.push(f.id));
                            logToConsole(`Scout: Found ${friends.length} valid targets via Seed ${seedId}.`, "log-scout");
                        }
                    } catch (e) {}
                }
                // Scout keeps searching regardless of errors
                setTimeout(scoutLoop, SCOUT_DELAY);
            },
            onerror: () => setTimeout(scoutLoop, SCOUT_DELAY)
        });
    }

    // --- MINER LOOP (Scans Favorites) ---
    function minerLoop(threadId) {
        if (!isMining) return;

        // If queue empty, wait for Scout
        if (userQueue.length === 0) {
            setTimeout(() => minerLoop(threadId), 500);
            return;
        }

        // Pop a valid User ID
        const userId = userQueue.shift();

        const url = `https://games.roblox.com/v2/users/${userId}/favorite/games?accessFilter=All&limit=50&sortOrder=Desc`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const games = data.data || [];
                        processFavorites(games, threadId);
                    } catch (e) { retry(threadId); }
                }
                else if (response.status === 429) {
                    // Rate Limit: Pause thread slightly, put user back in queue
                    logToConsole(`Thread ${threadId} Cooling Down...`, "log-lock");
                    userQueue.push(userId); // Retry later
                    setTimeout(() => minerLoop(threadId), 5000);
                }
                else {
                    // 403 Private - Expected, just move on
                    retry(threadId);
                }
            },
            onerror: () => retry(threadId)
        });
    }

    function processFavorites(games, threadId) {
        totalChecked++; // Count the user profile

        if (!games || games.length === 0) {
            retry(threadId);
            return;
        }

        games.sort(() => Math.random() - 0.5);

        for (const game of games) {

            // DUPLICATE CHECK
            if (checkedGames.has(game.id)) continue;
            checkedGames.add(game.id);

            // FILTERS
            if (game.placeVisits > 15000) continue;
            if (game.placeVisits < 10) continue;

            const title = game.name.toLowerCase();
            if (title.includes("untitled") || title.includes("place number") || title.includes("baseplate")) {
                continue;
            }

            // SUCCESS
            validateAndLaunch(game, threadId);
            return;
        }

        retry(threadId);
    }

    function validateAndLaunch(game, threadId) {
        if (!isMining) return;

        const placeId = game.rootPlace.id;
        logToConsole(`Verifying candidate: "${game.name}"...`, "log-scan");

        const url = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}&secure=true`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const details = data[0];

                        if (details && details.reasonProhibited === "None") {
                            foundGem(game);
                        } else {
                            logToConsole(`Locked: "${game.name}"`, "log-lock");
                            retry(threadId);
                        }
                    } catch (e) { retry(threadId); }
                } else { retry(threadId); }
            },
            onerror: () => retry(threadId)
        });
    }

    function retry(threadId) {
        if (!isMining) return;
        // Small organic delay
        const jitter = Math.floor(Math.random() * 200) + 50;
        setTimeout(() => minerLoop(threadId), jitter);
    }

    function logToConsole(msg, className) {
        const consoleBox = document.getElementById('console-log');
        if (!consoleBox) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${className || ''}`;
        entry.innerText = msg;

        consoleBox.insertBefore(entry, consoleBox.firstChild);
        if (consoleBox.children.length > 20) {
            consoleBox.removeChild(consoleBox.lastChild);
        }
    }

    function foundGem(game) {
        isMining = false;

        const overlay = document.getElementById('miner-overlay');
        const placeId = game.rootPlace.id;
        const createdYear = new Date(game.created).getFullYear();
        const creator = game.creator ? game.creator.name : "Unknown";

        overlay.innerHTML = `
            <div class="miner-title" style="color:#55ff55; text-shadow: 0 0 20px #55ff55;">💎 GEM DISCOVERED</div>
            <div class="miner-stat" style="font-size:26px; font-weight:bold; color:#fff; margin-top:20px; text-align:center; padding:0 20px;">${game.name}</div>
            <div class="miner-stat" style="color:#aaa;">Year: ${createdYear} | Visits: ${game.placeVisits.toLocaleString()}</div>
            <div class="miner-stat" style="color:#aaa;">Creator: ${creator}</div>
            <div class="miner-stat" style="color:#55ff55; margin-top:20px; font-weight:bold;">● Verified Playable</div>
            <div class="miner-stat" style="margin-top:20px;">Launching...</div>
        `;

        const url = `https://www.roblox.com/games/${placeId}/`;
        setTimeout(() => { window.location.href = url; }, 1500);
    }

    function updateStats() {
        if (!isMining) return;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(totalChecked / elapsed);

        const speedEl = document.getElementById('miner-speed');
        if (speedEl) speedEl.innerText = `Velocity: ${speed} profiles/sec`;

        const queueEl = document.getElementById('miner-queue');
        if (queueEl) queueEl.innerText = `Target Queue: ${userQueue.length}`;

        const totalEl = document.getElementById('miner-total');
        if (totalEl) totalEl.innerText = `Scanned: ${totalChecked}`; // Restored total count display
    }

    waitForSidebar();

})();
