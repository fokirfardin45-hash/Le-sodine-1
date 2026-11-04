(() => {
  const timestamps = new Map();
  const formatter = new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Rome'
  });

  function rememberOrders(payload) {
    const rows = Array.isArray(payload) ? payload : payload && typeof payload === 'object' ? [payload] : [];
    for (const order of rows) {
      if (order && order.id && order.created_at) timestamps.set(String(order.id), order.created_at);
    }
    updateCards();
  }

  function updateCards() {
    document.querySelectorAll('article.order').forEach((card) => {
      const heading = card.querySelector('.order-head b');
      if (!heading) return;
      const match = heading.textContent.match(/#([\w-]+)/);
      if (!match) return;
      const prefix = match[1];
      const pair = [...timestamps.entries()].find(([id]) => id === prefix || id.startsWith(prefix));
      if (!pair) return;
      let dateLine = card.querySelector('.order-date');
      if (!dateLine) {
        dateLine = document.createElement('p');
        dateLine.className = 'order-date muted small';
        heading.closest('.order-head').insertAdjacentElement('afterend', dateLine);
      }
      const date = new Date(pair[1]);
      if (!Number.isNaN(date.getTime())) dateLine.textContent = `Ordine ricevuto: ${formatter.format(date)}`;
    });
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (requestUrl && new URL(requestUrl, location.href).pathname.includes('/rest/v1/orders')) {
        response.clone().json().then(rememberOrders).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  new MutationObserver(updateCards).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', updateCards);
})();
