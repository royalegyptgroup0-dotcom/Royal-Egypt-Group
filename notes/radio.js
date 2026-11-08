(() => {
  "use strict";

  const root = document.getElementById("ceo-radio");
  if (!root) return;

  const hosts = [
    "https://de1.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://de2.api.radio-browser.info"
  ];

  const form = root.querySelector("#radio-form");
  const search = root.querySelector("#radio-search");
  const country = root.querySelector("#radio-country");
  const results = root.querySelector("#radio-results");
  const status = root.querySelector("#radio-status");
  const audio = root.querySelector("#radio-audio");
  const nowName = root.querySelector("#radio-now-name");
  const nowCountry = root.querySelector("#radio-now-country");
  const presets = [...root.querySelectorAll("[data-radio-tag]")];

  let activeTag = "";
  let requestId = 0;

  function element(tag, className, value) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined && value !== null) item.textContent = String(value);
    return item;
  }

  function announce(message) {
    status.textContent = message;
  }

  function buildQuery() {
    const params = new URLSearchParams({
      hidebroken: "true",
      limit: "24",
      order: "clickcount",
      reverse: "true",
      is_https: "true",
      hls: "0"
    });

    if (search.value.trim()) params.set("name", search.value.trim().slice(0, 100));
    if (country.value) params.set("country", country.value);
    if (activeTag) params.set("tag", activeTag);

    return params.toString();
  }

  function isPlayableStation(station) {
    return station &&
      typeof station.url_resolved === "string" &&
      station.url_resolved.startsWith("https://") &&
      Number(station.hls) !== 1;
  }

  async function loadStations() {
    const currentRequest = ++requestId;
    results.replaceChildren(element("div", "radio-empty", "بنبحث عن محطات مناسبة…"));
    root.setAttribute("aria-busy", "true");
    announce("جارٍ الاتصال بدليل المحطات المفتوح.");

    const path = "/json/stations/search?" + buildQuery();

    for (const host of hosts) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 9000);

      try {
        const response = await fetch(host + path, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) throw new Error("Radio directory HTTP " + response.status);

        const data = await response.json();
        if (currentRequest !== requestId) return;

        const stations = (Array.isArray(data) ? data : []).filter(isPlayableStation);
        renderStations(stations);
        return;
      } catch (error) {
        // Try the next public Radio Browser API host.
      } finally {
        window.clearTimeout(timeout);
      }
    }

    if (currentRequest !== requestId) return;

    results.replaceChildren(element("div", "radio-empty", "تعذر الوصول إلى دليل الراديو حاليًا. جرّب مرة أخرى لاحقًا."));
    announce("الاتصال غير متاح الآن. لم يتم تشغيل أي بث تلقائيًا.");
    root.setAttribute("aria-busy", "false");
  }

  function renderStations(stations) {
    results.replaceChildren();

    if (!stations.length) {
      results.append(element("div", "radio-empty", "لا توجد محطات صوتية آمنة ومتوافقة بهذا الاختيار. جرّب تصنيفًا آخر."));
      announce("لم نعثر على محطات HTTPS متوافقة مع مشغل المتصفح بهذا الاختيار.");
      root.setAttribute("aria-busy", "false");
      return;
    }

    stations.forEach((station) => {
      const card = element("article", "radio-station");
      const name = element("strong", "", station.name || "محطة إذاعية");
      const metadata = element(
        "div",
        "radio-meta",
        [station.country, station.language, station.codec, station.bitrate ? station.bitrate + " kbps" : ""]
          .filter(Boolean)
          .join(" · ")
      );

      card.append(name, metadata);

      const actions = element("div", "radio-station-actions");
      const play = element("button", "radio-play", "استمع");
      play.type = "button";

      play.addEventListener("click", async () => {
        audio.pause();
        audio.src = station.url_resolved;
        audio.load();
        nowName.textContent = station.name || "محطة إذاعية";
        nowCountry.textContent = station.country || "بث مباشر";
        announce("جارٍ تشغيل المحطة…");

        try {
          await audio.play();
          announce("يعمل البث الآن.");
        } catch (error) {
          announce("لم يبدأ البث. قد تكون المحطة متوقفة أو غير متاحة في منطقتك.");
        }
      });

      actions.append(play);

      if (typeof station.homepage === "string" && station.homepage.startsWith("https://")) {
        const homepage = element("a", "radio-home", "موقع المحطة");
        homepage.href = station.homepage;
        homepage.target = "_blank";
        homepage.rel = "noopener noreferrer";
        actions.append(homepage);
      }

      card.append(actions);
      results.append(card);
    });

    announce("تم العثور على " + stations.length + " محطة صوتية متوافقة ببث HTTPS. اختر استمع لبدء التشغيل.");
    root.setAttribute("aria-busy", "false");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadStations();
  });

  presets.forEach((button) => {
    button.addEventListener("click", () => {
      activeTag = button.dataset.radioTag || "";
      presets.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      loadStations();
    });
  });

  audio.addEventListener("error", () => announce("تعذر تشغيل هذا البث. جرّب محطة أخرى؛ روابط البث قد تتغير أو تتوقف."));
  audio.addEventListener("playing", () => announce("البث يعمل الآن."));
  audio.addEventListener("pause", () => {
    if (audio.src) announce("تم إيقاف البث مؤقتًا.");
  });
})();
