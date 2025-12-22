Skip to content
 
Search Gists
Search...
All gists
Back to GitHub
@gallantSirKnight
gallantSirKnight/twitch-ticker.user.js
Created 5 minutes ago
Code
Revisions
1
Clone this repository at &lt;script src=&quot;https://gist.github.com/gallantSirKnight/ab96f3a61a1e3182b9e597210da6351a.js&quot;&gt;&lt;/script&gt;
<script src="https://gist.github.com/gallantSirKnight/ab96f3a61a1e3182b9e597210da6351a.js"></script>
'News ticker' for Twitch.tv listing trending streams
twitch-ticker.user.js
// ==UserScript==
// @name         Twitch Trending Ticker
// @namespace    https://github.com/gallantSirKnight
// @version      1.0
// @description  Adds a scrolling news ticker of trending streams to the top of Twitch.
// @author       gallantSirKnight
// @match        https://www.twitch.tv/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-body
// @connect      gql.twitch.tv
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const TICKER_HEIGHT = '32px';
    const REFRESH_RATE = 300000; // 5 minutes
    const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Mobile Client ID

    // ADJUST SPEED HERE: '120s' = 2 minutes to scroll across. Increase number to go slower.
    const SCROLL_SPEED = '120s';

    // --- CSS STYLES ---
    const cssStyles = `
        /* Adjust Twitch Layout */
        .top-nav__container, nav.top-nav { top: ${TICKER_HEIGHT} !important; position: fixed !important; }
        .tw-root--theme-dark, .tw-root--theme-light, body { margin-top: ${TICKER_HEIGHT} !important; position: relative; }
        /* Ticker Bar */
        #tm-ticker {
            position: fixed; top: 0; left: 0; width: 100%; height: ${TICKER_HEIGHT};
            background: #0e0e10; color: #efeff1; z-index: 999999;
            display: flex; align-items: center; border-bottom: 1px solid #333;
            font-family: sans-serif; font-size: 13px; white-space: nowrap;
        }
        #tm-label {
            background: #e91916; color: #fff; padding: 0 15px; height: 100%;
            display: flex; align-items: center; font-weight: 800; text-transform: uppercase;
            z-index: 10;
        }
        .tm-wrap { flex-grow: 1; overflow: hidden; position: relative; }
        .tm-move {
            display: inline-block; white-space: nowrap; padding-left: 100%;
            animation: tm-scroll ${SCROLL_SPEED} linear infinite;
        }
        .tm-move:hover { animation-play-state: paused; }
        @keyframes tm-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .tm-item { display: inline-block; padding: 0 20px; border-right: 1px solid #333; color: #ccc; }
        .tm-item a { text-decoration: none; color: inherit; }
        .tm-item strong { color: #bf94ff; }
        .tm-viewers { color: #ff5555; font-weight: bold; }
    `;

    GM_addStyle(cssStyles);

    // --- UI SETUP ---
    function createUI() {
        if (document.getElementById('tm-ticker')) return;
        const div = document.createElement('div');
        div.id = 'tm-ticker';
        div.innerHTML = `
            <div id="tm-label">Live</div>
            <div class="tm-wrap">
                <div class="tm-move" id="tm-content">Loading streams...</div>
            </div>
        `;
        document.body.prepend(div);
    }

    // --- API LOGIC ---
    function fetchStreams() {
        const query = `
        query GetTop {
            streams(first: 20, options: {sort: VIEWER_COUNT}) {
                edges {
                    node {
                        title
                        viewersCount
                        broadcaster { login displayName }
                        game { displayName }
                    }
                }
            }
        }`;

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://gql.twitch.tv/gql",
            headers: {
                "Client-ID": CLIENT_ID,
                "Content-Type": "application/json"
            },
            data: JSON.stringify({ query: query }),
            onload: function(res) {
                try {
                    const json = JSON.parse(res.responseText);
                    if (json.data && json.data.streams) {
                        render(json.data.streams.edges);
                    } else {
                        console.log("Ticker Error:", json);
                        document.getElementById('tm-content').innerText = "API Error";
                    }
                } catch(e) {
                    document.getElementById('tm-content').innerText = "Parse Error";
                }
            }
        });
    }

    function render(edges) {
        let html = '';
        edges.forEach(edge => {
            const n = edge.node;
            if(!n) return;
            const v = n.viewersCount > 999 ? (n.viewersCount/1000).toFixed(1)+'k' : n.viewersCount;
            const game = n.game ? n.game.displayName : 'Variety';

            html += `
                <div class="tm-item">
                    <a href="/${n.broadcaster.login}">
                        <span class="tm-viewers">● ${v}</span>
                        <strong>${n.broadcaster.displayName}</strong>
                        [${game}]
                        ${n.title}
                    </a>
                </div>
            `;
        });
        document.getElementById('tm-content').innerHTML = html;
    }

    // --- START ---
    createUI();
    fetchStreams();
    setInterval(fetchStreams, REFRESH_RATE);

})();
@gallantSirKnight
Comment
 
Leave a comment
 
Footer
© 2025 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Community
Docs
Contact
Manage cookies
Do not share my personal information
