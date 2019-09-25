const gateways = [
    { domain: 'ipfs.io', writable: false },
    { domain: 'cloudflare-ipfs.com', writable: false },
    { domain: 'ipfs.infura.io', writable: false },
    { domain: 'gateway.pinata.cloud', writable: false },
    { domain: 'ipfs.eternum.io', writable: true },
    { domain: 'hardbin.com', writable: true },
    { domain: 'siderus.io', writable: true },
];

const writableGateways = gateways.filter(gw => gw.writable).sort(() => .5 - Math.random());

function renderPage(article) {
    return `<!DOCTYPE html>
<html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/ipfs/QmcjLy7wEQbLJ4agdit9nvtq5exc7hQszEYwXX9ZzP7ff9/typesettings-1.7-min.css">
        <title>${article.title}</title>
        <style>
            footer { text-align: center; border-top: 1px solid #e1e1e1; }
            img { max-width: 100% }
        </style>
    </head>
    <body>
        <article class="typesettings golden">
            <section>
                <header><h1>${article.title}</h1></header>
                <p>${article.excerpt}</p>
                <p><address><a href="${article.url}">${article.byline || article.siteName || '&#9875;'}</a></address></p>
            </section>
            <section>${article.content}</section>
        </article>
        <footer class="typesettings"><small><a href="https://2read.net/">2read.net</a></small></footer>
    </body>
</html>`;
}

async function ipfsPUT(hash, body, filename) {
    for (let gateway of writableGateways) {
        let response = await fetch(`https://${gateway.domain}/ipfs/${hash}/${filename}`, {
            method: 'PUT',
            body: body,
            headers: { 'Content-Type': 'text/html' },
        });
        if (!response || !response.ok) {
            console.error(`Unexpected response from ${gateway.domain}`, response);
            continue;
        }
        let headersHash = response.headers.get('ipfs-hash');
        if (!headersHash) {
            console.error(`Empty hash from ${gateway.domain}`, response);
            continue;
        }
        return headersHash;
    }
    throw console.error('No writable gateway found');
}

async function pinLocally(hash) {
    // TODO: handle non-standard port configuration or use window.ipfs
    let req = new XMLHttpRequest();
    req.open('GET', `http://localhost:5001/api/v0/pin/add?arg=${hash}`);
    req.send();
}

function handleClick(tab) {
    chrome.tabs.executeScript(tab.id, { file: 'Readability.js' }, function () {
        chrome.tabs.executeScript(tab.id, { file: 'action.js' });
    });
}

async function handleMessage(article) {
    // hash of empty folder
    let hash = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn';
    hash = await ipfsPUT(hash, renderPage(article), 'index.html');
    for (let img in article.images) {
        let response = await fetch(article.images[img]);
        if (!response || !response.ok) {
            console.error('Unexpected response', response);
            continue;
        }
        hash = await ipfsPUT(hash, await response.blob(), img);
    }
    let url = `https://${gateways[0].domain}/ipfs/${hash}/`;
    chrome.tabs.create({ url: url });
    chrome.bookmarks.create({ title: article.title, url: url });
    pinLocally(hash);
    gateways.forEach(gateway => fetch(`https://${gateway.domain}/ipfs/${hash}/`));
}

browser.pageAction.onClicked.addListener(handleClick);

function checkForValidUrl(tabId, changeInfo, tab) {
    if(typeof tab != "undefined" && typeof tab != "null" ) {
            // ... show the page action.
            browser.pageAction.show(tabId);
    }
};

// Listen for any changes to the URL of any tab.
// Since Chrome does'nt support hide_match or show_match
browser.tabs.onUpdated.addListener(checkForValidUrl);
chrome.runtime.onMessage.addListener(handleMessage);
