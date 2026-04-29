(function (window, document) {
  function getStoredTheme() {
    try {
      return window.localStorage.getItem("hodle-theme");
    } catch (error) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      window.localStorage.setItem("hodle-theme", theme);
    } catch (error) {
      return;
    }
  }

  function initBaseUI(options) {
    const settings = options || {};
    const body = document.body;
    const topbar = document.querySelector(".topbar");
    const menuToggle = document.getElementById("menuToggle");
    const siteNav = document.getElementById("siteNav");
    const themeToggle = document.getElementById("themeToggle");
    const loginTrigger = settings.loginTriggerId ? document.getElementById(settings.loginTriggerId) : null;
    const loginPanel = settings.loginPanelId ? document.getElementById(settings.loginPanelId) : null;
    const loginContainer = settings.loginContainerId ? document.getElementById(settings.loginContainerId) : null;
    const collapsedClass = settings.collapsedClass || "login-collapsed";
    const closeMenuLinkSelector = settings.closeMenuLinkSelector || ".site-nav a";
    const defaultTheme = getStoredTheme() || "dark";

    if (body) {
      body.dataset.theme = defaultTheme;
    }

    if (themeToggle) {
      themeToggle.textContent = defaultTheme === "dark" ? "Light Mode" : "Dark Mode";
    }

    function setMenuState(isOpen) {
      if (!body || !topbar || !menuToggle) {
        return;
      }

      topbar.classList.toggle("menu-open", isOpen);
      body.classList.toggle("menu-lock", isOpen && window.innerWidth <= 980);
      menuToggle.setAttribute("aria-expanded", String(isOpen));

      if (siteNav) {
        siteNav.setAttribute("aria-hidden", String(window.innerWidth <= 980 && !isOpen));
      }
    }

    function closeMenu() {
      setMenuState(false);
    }

    function openLoginPanel() {
      if (!loginPanel || !loginContainer) {
        return;
      }

      loginPanel.hidden = false;
      loginContainer.classList.remove(collapsedClass);

      if (loginTrigger) {
        loginTrigger.setAttribute("aria-expanded", "true");
      }

      loginPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setMenuState(false);

    if (menuToggle && topbar) {
      menuToggle.addEventListener("click", function () {
        setMenuState(!topbar.classList.contains("menu-open"));
      });

      document.addEventListener("click", function (event) {
        if (!topbar.contains(event.target)) {
          closeMenu();
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeMenu();
        }
      });

      window.addEventListener("resize", function () {
        if (window.innerWidth > 980) {
          closeMenu();
        }
      });

      document.querySelectorAll(closeMenuLinkSelector).forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });
    }

    if (loginTrigger) {
      loginTrigger.addEventListener("click", function () {
        openLoginPanel();
        closeMenu();
      });
    }

    if (themeToggle && body) {
      themeToggle.addEventListener("click", function () {
        const nextTheme = body.dataset.theme === "dark" ? "light" : "dark";
        body.dataset.theme = nextTheme;
        setStoredTheme(nextTheme);
        themeToggle.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
      });
    }

    return {
      closeMenu: closeMenu,
      openLoginPanel: openLoginPanel,
      setMenuState: setMenuState
    };
  }

  function inferValueFormat(element, currencyIds) {
    const text = element.textContent.trim();

    if (text.includes("%")) {
      return "percent";
    }

    if (text.includes("$") || currencyIds.has(element.id)) {
      return "currency";
    }

    return "number";
  }

  function formatAnimatedValue(format, value) {
    if (format === "percent") {
      return Math.round(value) + "%";
    }

    if (format === "currency") {
      return "$" + value.toLocaleString(undefined, {
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2
      });
    }

    return value.toLocaleString(undefined, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2
    });
  }

  function animateNumber(element, currencyIds) {
    const targetValue = Number(element.dataset.target);

    if (!Number.isFinite(targetValue)) {
      return;
    }

    const format = inferValueFormat(element, currencyIds);
    const start = window.performance.now();
    const duration = 1400;

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatAnimatedValue(format, targetValue * eased);

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      }
    }

    window.requestAnimationFrame(frame);
  }

  function initAnimatedNumbers(options) {
    const settings = options || {};
    const selector = settings.selector || "[data-target]";
    const currencyIds = new Set(settings.currencyIds || []);

    document.querySelectorAll(selector).forEach(function (element) {
      animateNumber(element, currencyIds);
    });
  }

  function initFillBars(selector) {
    const bars = document.querySelectorAll(selector || ".fill");

    window.requestAnimationFrame(function () {
      bars.forEach(function (bar) {
        const fillAmount = bar.style.getPropertyValue("--fill").trim();
        bar.style.width = fillAmount || "0%";
      });
    });
  }

  window.HodleApp = {
    initAnimatedNumbers: initAnimatedNumbers,
    initBaseUI: initBaseUI,
    initFillBars: initFillBars
  };
})(window, document);
