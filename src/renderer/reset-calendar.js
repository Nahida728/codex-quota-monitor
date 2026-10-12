(function () {
  const DAY = 86400000;
  function localDay(seconds) {
    const date = new Date(seconds * 1000);
    return Number.isFinite(seconds) && seconds > 0 && Number.isFinite(date.getTime())
      ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY : null;
  }
  function dayKey(serial) { return new Date(serial * DAY).toISOString().slice(0, 10); }
  function buildCalendar(events, year = null, nowSeconds = Date.now() / 1000) {
    const today = localDay(nowSeconds);
    const start = year ? Date.UTC(year, 0, 1) / DAY : today - 364;
    const end = year ? Date.UTC(year + 1, 0, 1) / DAY - 1 : today;
    const first = start - (new Date(start * DAY).getUTCDay() + 6) % 7;
    const last = end + (6 - (new Date(end * DAY).getUTCDay() + 6) % 7);
    const byDay = new Map();
    const years = new Set([new Date(today * DAY).getUTCFullYear()]);
    for (const event of events) {
      const day = localDay(event.at);
      if (day === null || day > today) continue;
      years.add(new Date(day * DAY).getUTCFullYear());
      const key = dayKey(day);
      const bucket = byDay.get(key) || { count: 0, events: [] };
      bucket.count += Number.isFinite(event.count) && event.count > 0 ? Math.floor(event.count) : 1;
      bucket.events.push(event);
      byDay.set(key, bucket);
    }
    const days = [];
    for (let day = first; day <= last; day++) {
      const key = dayKey(day), bucket = byDay.get(key);
      days.push({ key, serial: day, count: bucket?.count || 0, events: bucket?.events || [],
        outside: day < start || day > end, future: day > today,
        level: bucket ? Math.min(4, Math.floor(Math.log2(bucket.count)) + 1) : 0 });
    }
    return { days, columns: days.length / 7, years: [...years].sort((a, b) => b - a), byDay };
  }
  const api = { buildCalendar, localDay, dayKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ResetCalendar = api;
})();
