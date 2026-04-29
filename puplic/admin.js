(function (window, document) {
  const app = window.HodleApp;

  if (!app) {
    return;
  }

  app.initBaseUI();
  app.initAnimatedNumbers();
  app.initFillBars();

  const opsAlert = document.getElementById("opsAlert");
  const railStatus = document.getElementById("railStatus");
  const alerts = [
    { alert: "23 queued approvals", rail: "All wallets stable" },
    { alert: "19 queued approvals", rail: "Polygon rail monitored" },
    { alert: "27 queued approvals", rail: "BEP20 rail healthy" },
    { alert: "21 queued approvals", rail: "Fraud watch elevated" }
  ];

  if (!opsAlert || !railStatus) {
    return;
  }

  let alertIndex = 0;

  window.setInterval(function () {
    alertIndex = (alertIndex + 1) % alerts.length;
    opsAlert.textContent = alerts[alertIndex].alert;
    railStatus.textContent = alerts[alertIndex].rail;
  }, 3200);
})(window, document);
