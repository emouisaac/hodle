(function (window, document) {
  const app = window.HodleApp;

  if (!app) {
    return;
  }

  app.initBaseUI({
    loginTriggerId: "loginNavTrigger",
    loginPanelId: "loginPanel",
    loginContainerId: "authGrid",
    collapsedClass: "login-collapsed"
  });
  app.initAnimatedNumbers({ currencyIds: ["heroYield", "feedReward"] });
  app.initFillBars();

  const cryptoTickerTrack = document.getElementById("cryptoTickerTrack");
  const orbitCoinNodes = Array.from(document.querySelectorAll(".orbital .coin"));
  const countdown = document.getElementById("countdown");
  const feedReward = document.getElementById("feedReward");
  const feedRate = document.getElementById("feedRate");
  const marketFeedUrl = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h";
  const tickerRefreshIntervalMs = 90000;
  const tickerRetryDelayMs = 5000;
  const tickerRequestTimeoutMs = 4500;
  const liveRewards = [
    { reward: "$2,487", rate: "1.84% avg" },
    { reward: "$2,514", rate: "1.88% avg" },
    { reward: "$2,532", rate: "1.92% avg" },
    { reward: "$2,498", rate: "1.79% avg" }
  ];

  let hasRenderedTicker = false;
  let isTickerLoading = false;
  let retryTimerId = 0;
  let rewardIndex = 0;

  function formatTickerPrice(price) {
    if (price >= 1000) {
      return "$" + price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    if (price >= 1) {
      return "$" + price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (price >= 0.01) {
      return "$" + price.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      });
    }

    return "$" + price.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  }

  function formatTickerChange(change24h) {
    const rounded = change24h.toFixed(2);
    return (change24h >= 0 ? "+" : "") + rounded + "%";
  }

  function createTickerItem(coin) {
    const item = document.createElement("span");
    const rank = document.createElement("span");
    const symbol = document.createElement("span");
    const price = document.createElement("span");
    const change = document.createElement("span");
    const changeClass = coin.change24h >= 0 ? "up" : "down";

    item.className = "ticker-item";
    rank.className = "ticker-rank";
    symbol.className = "ticker-symbol";
    price.className = "ticker-price";
    change.className = "ticker-change " + changeClass;

    rank.textContent = "#" + coin.rank;
    symbol.textContent = coin.symbol;
    price.textContent = formatTickerPrice(coin.price);
    change.textContent = formatTickerChange(coin.change24h) + " 24H";

    item.append(rank, symbol, price, change);
    return item;
  }

  function createTickerSet(coins, isHidden) {
    const set = document.createElement("div");
    set.className = "ticker-set";

    if (isHidden) {
      set.setAttribute("aria-hidden", "true");
    }

    coins.forEach(function (coin) {
      set.appendChild(createTickerItem(coin));
    });

    return set;
  }

  function selectOrbitCoins(coins) {
    const excludedSymbols = new Set(["USDT", "USDC", "USDS", "DAI", "FDUSD", "TUSD"]);
    return coins.filter(function (coin) {
      return !excludedSymbols.has(coin.symbol);
    }).slice(0, orbitCoinNodes.length);
  }

  function renderOrbitCoins(coins) {
    if (!orbitCoinNodes.length) {
      return;
    }

    const featuredCoins = selectOrbitCoins(coins);

    orbitCoinNodes.forEach(function (node, index) {
      const coin = featuredCoins[index];
      const logoNode = node.querySelector(".coin-logo");

      node.classList.remove("coin-up", "coin-down", "coin-flat");

      if (!coin) {
        node.removeAttribute("title");

        if (logoNode) {
          logoNode.removeAttribute("src");
          logoNode.hidden = true;
        }

        return;
      }

      node.classList.add(coin.change24h >= 0 ? "coin-up" : "coin-down");
      node.title = coin.name + " | " + formatTickerPrice(coin.price) + " | " + formatTickerChange(coin.change24h) + " 24H";

      if (logoNode) {
        if (coin.image) {
          logoNode.src = coin.image;
          logoNode.alt = coin.name + " logo";
          logoNode.hidden = false;
        } else {
          logoNode.removeAttribute("src");
          logoNode.hidden = true;
        }
      }
    });
  }

  function renderTickerMessage(message) {
    if (!cryptoTickerTrack) {
      return;
    }

    const item = document.createElement("span");
    item.className = "ticker-item";
    item.textContent = message;
    cryptoTickerTrack.replaceChildren(item);
    cryptoTickerTrack.style.animation = "none";
  }

  function normalizeTickerEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .slice(0, 20)
      .map(function (entry, index) {
        const rank = Number.isFinite(entry.rank) ? entry.rank : entry.market_cap_rank;
        const price = Number.isFinite(entry.price) ? entry.price : entry.current_price;
        const change24h = Number.isFinite(entry.change24h) ? entry.change24h : entry.price_change_percentage_24h;

        return {
          rank: Number.isFinite(rank) ? rank : index + 1,
          symbol: String(entry.symbol || "").toUpperCase(),
          name: String(entry.name || "Unknown"),
          price: Number.isFinite(price) ? price : null,
          change24h: Number.isFinite(change24h) ? change24h : null,
          image: typeof entry.image === "string" ? entry.image : null
        };
      })
      .filter(function (entry) {
        return entry.symbol && Number.isFinite(entry.price) && Number.isFinite(entry.change24h);
      });
  }

  function restartTickerAnimation(durationSeconds) {
    cryptoTickerTrack.style.setProperty("--ticker-duration", durationSeconds + "s");
    cryptoTickerTrack.style.animation = "none";
    void cryptoTickerTrack.offsetWidth;
    cryptoTickerTrack.style.animation = "";
  }

  function renderCryptoTicker(coins) {
    if (!cryptoTickerTrack || !coins.length) {
      return;
    }

    cryptoTickerTrack.replaceChildren(
      createTickerSet(coins, false),
      createTickerSet(coins, true)
    );
    renderOrbitCoins(coins);
    restartTickerAnimation(Math.max(28, coins.length * 2.5));
    hasRenderedTicker = true;
  }

  async function fetchTickerEntries(url) {
    const controller = new window.AbortController();
    const timeoutId = window.setTimeout(function () {
      controller.abort();
    }, tickerRequestTimeoutMs);

    try {
      const response = await window.fetch(url, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Ticker request failed");
      }

      const payload = await response.json();
      const entries = Array.isArray(payload) ? payload : payload.data;
      const normalizedEntries = normalizeTickerEntries(entries);

      if (!normalizedEntries.length) {
        throw new Error("Ticker payload missing live values");
      }

      return normalizedEntries;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function scheduleTickerRetry() {
    if (retryTimerId) {
      window.clearTimeout(retryTimerId);
    }

    retryTimerId = window.setTimeout(function () {
      retryTimerId = 0;
      loadCryptoTicker();
    }, tickerRetryDelayMs);
  }

  async function loadCryptoTicker() {
    if (!cryptoTickerTrack || isTickerLoading) {
      return;
    }

    isTickerLoading = true;

    const sources = [];

    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      sources.push(new URL("/api/crypto-ticker", window.location.href).toString());
    }

    sources.push(marketFeedUrl);

    try {
      const liveEntries = await Promise.any(
        sources.map(function (source) {
          return fetchTickerEntries(source);
        })
      );

      if (retryTimerId) {
        window.clearTimeout(retryTimerId);
        retryTimerId = 0;
      }

      renderCryptoTicker(liveEntries);
    } catch (error) {
      if (!hasRenderedTicker) {
        renderTickerMessage("Loading live crypto prices...");
      }

      scheduleTickerRetry();
    } finally {
      isTickerLoading = false;
    }
  }

  function startCountdown() {
    if (!countdown) {
      return;
    }

    let remaining = 23 * 3600 + 59 * 60 + 59;

    function tick() {
      const hrs = String(Math.floor(remaining / 3600)).padStart(2, "0");
      const mins = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
      const secs = String(remaining % 60).padStart(2, "0");

      countdown.textContent = hrs + ":" + mins + ":" + secs;
      remaining = remaining > 0 ? remaining - 1 : 24 * 3600 - 1;
    }

    tick();
    window.setInterval(tick, 1000);
  }

  function startRewardRotation() {
    if (!feedReward || !feedRate) {
      return;
    }

    window.setInterval(function () {
      rewardIndex = (rewardIndex + 1) % liveRewards.length;
      feedReward.textContent = liveRewards[rewardIndex].reward;
      feedRate.textContent = liveRewards[rewardIndex].rate;
    }, 3200);
  }

  renderTickerMessage("Loading live crypto prices...");
  loadCryptoTicker();
  window.setInterval(loadCryptoTicker, tickerRefreshIntervalMs);
  startCountdown();
  startRewardRotation();
})(window, document);
