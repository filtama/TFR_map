document.addEventListener("DOMContentLoaded", () => {
  // Mapa pro ukládání instancí grafů (pro klikací popupy)
  const chartInstances = new Map();
  // Sledování otevřeného popup okna a země (pro klikací popupy)
  let currentOpenPopup = null;
  let currentCountryName = null;
  let currentLayer = null;
  // Proměnná pro sledování plovoucího grafu při najetí myší
  let hoverChartTooltip = null;
  let hoverChartInstance = null; // Instance pro plovoucí graf
  // Přidáno pro řešení problému s opakovaným vytvářením grafu
  let isCreatingHoverChart = false;
  let lastHoveredCountry = null;

  // Omezení zobrazení mapy
  const map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    maxBounds: [
      [-65, -180],
      [83, 180],
    ],
    maxBoundsViscosity: 1.0,
    worldCopyJump: false,
    continuousWorld: false,
    noWrap: true,
    dragging: true,
    touchZoom: false,
    doubleClickZoom: false,
    scrollWheelZoom: true,
    boxZoom: false,
    keyboard: false,
    tap: false,
    zoomControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    noWrap: true,
    bounds: [
      [-65, -180],
      [83, 180],
    ],
  }).addTo(map);

  function closeCurrentPopup() {
    if (currentOpenPopup && currentLayer) {
      currentLayer.closePopup();
      currentOpenPopup = null;
      currentCountryName = null;
      currentLayer = null;
    }
  }

  map.on("click", function (e) {
    closeCurrentPopup();
  });

  // Vylepšená funkce pro odstranění tooltip elementu
  function removeHoverTooltip() {
    // Nejprve zničíme instanci grafu, pokud existuje
    if (hoverChartInstance) {
      hoverChartInstance.destroy();
      hoverChartInstance = null;
    }

    // Poté odstraníme tooltip element
    if (hoverChartTooltip) {
      hoverChartTooltip.remove();
      hoverChartTooltip = null;
    }

    // Pro jistotu odstraníme všechny zbývající hover-chart-tooltip elementy
    document
      .querySelectorAll(".hover-chart-tooltip")
      .forEach((el) => el.remove());

    // Resetujeme flag pro vytváření grafu
    isCreatingHoverChart = false;
    lastHoveredCountry = null;
  }

  // Kompletně přepsaná funkce pro vytvoření hover grafu
  function createHoverChart(e, countryName, birthData) {
    // NOVÁ PODMÍNKA: Pokud je otevřený jakýkoliv popup, nezobrazujeme hover graf
    if (currentOpenPopup) {
      return;
    }

    // Zabránění opakovanému vytváření grafu pro stejnou zemi
    if (isCreatingHoverChart || lastHoveredCountry === countryName) {
      return;
    }

    // Nastavení flagů
    isCreatingHoverChart = true;
    lastHoveredCountry = countryName;

    // Nejprve odstraníme předchozí tooltip a graf
    removeHoverTooltip();

    // Pokud neexistují data, vrátíme se
    if (!birthData || Object.keys(birthData).length === 0) {
      isCreatingHoverChart = false;
      return;
    }

    // Vytvoříme nový tooltip element
    const tooltipEl = document.createElement("div");
    tooltipEl.className = "hover-chart-tooltip";
    tooltipEl.dataset.country = countryName;

    const PADDING_VERTICAL = 8;
    const TITLE_AREA_HEIGHT = 20;
    const CHART_HEIGHT = 150;
    const TOOLTIP_WIDTH = 300;

    const totalTooltipHeight =
      TITLE_AREA_HEIGHT + CHART_HEIGHT + PADDING_VERTICAL * 2;

    // Nastavení pozice a stylu tooltip elementu
    Object.assign(tooltipEl.style, {
      position: "absolute",
      left: `${e.originalEvent.pageX + 15}px`,
      top: `${e.originalEvent.pageY + 15}px`,
      padding: `${PADDING_VERTICAL}px`,
      background: "rgba(255, 255, 255, 0.95)",
      border: "1px solid #bbb",
      borderRadius: "4px",
      boxShadow: "0 1px 5px rgba(0,0,0,0.15)",
      zIndex: "1001",
      width: `${TOOLTIP_WIDTH}px`,
      height: `${totalTooltipHeight}px`,
      overflow: "hidden",
      pointerEvents: "none",
    });

    // Zajistíme, aby tooltip nebyl mimo okno (jednoduchá kontrola)
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (parseFloat(tooltipEl.style.left) + TOOLTIP_WIDTH > windowWidth) {
      tooltipEl.style.left = `${e.originalEvent.pageX - TOOLTIP_WIDTH - 10}px`;
    }

    if (parseFloat(tooltipEl.style.top) + totalTooltipHeight > windowHeight) {
      tooltipEl.style.top = `${
        e.originalEvent.pageY - totalTooltipHeight - 10
      }px`;
    }

    // Vytvoření nadpisu
    const title = document.createElement("h5");
    const years = Object.keys(birthData)
      .map(Number)
      .sort((a, b) => a - b);
    const titleRange =
      years.length > 0 ? `${years[0]}-${years[years.length - 1]}` : "N/A";
    title.innerHTML = `${countryName}: TFR ${titleRange}`;

    Object.assign(title.style, {
      margin: `0 0 ${PADDING_VERTICAL / 2}px 0`,
      fontSize: "13px",
      textAlign: "center",
      fontWeight: "bold",
      height: `${TITLE_AREA_HEIGHT - PADDING_VERTICAL / 2}px`,
      lineHeight: `${TITLE_AREA_HEIGHT - PADDING_VERTICAL / 2}px`,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    tooltipEl.appendChild(title);

    // Vytvoříme kontejner pro canvas grafu
    const chartContainer = document.createElement("div");
    chartContainer.style.width = "100%";
    chartContainer.style.height = `${CHART_HEIGHT}px`;
    tooltipEl.appendChild(chartContainer);

    const chartCanvas = document.createElement("canvas");
    chartContainer.appendChild(chartCanvas);

    // Přidáme tooltip do dokumentu
    document.body.appendChild(tooltipEl);

    // Uložíme referenci na tooltip element
    hoverChartTooltip = tooltipEl;

    // Získáme data pro graf
    const rates = years.map((year) => birthData[year]);

    // Ochrana proti prázdným datům
    if (rates.length === 0) {
      tooltipEl.innerHTML = `<p style="text-align:center">Pro ${countryName} nejsou dostupná žádná data.</p>`;
      isCreatingHoverChart = false;
      return;
    }

    // Vypočítáme minima a maxima pro osu y s malým odsazením
    const minValue = Math.min(...rates) * 0.95;
    const maxValue = Math.max(...rates) * 1.05;

    // Vytvoříme instanci grafu
    hoverChartInstance = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: years.map(String),
        datasets: [
          {
            label: "TFR",
            data: rates,
            backgroundColor: "rgba(75, 192, 192, 0.3)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: rates.length > 30 ? 0 : 2,
            pointHoverRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // Vypnutí animace pro rychlejší vykreslení
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            callbacks: {
              label: function (context) {
                return `Rok ${context.label}: ${context.parsed.y.toFixed(2)}`;
              },
            },
            bodyFont: { size: 10 },
            titleFont: { size: 10 },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: minValue,
            max: maxValue,
            ticks: {
              callback: function (value) {
                return value.toFixed(1);
              },
              font: { size: 9 },
            },
          },
          x: {
            ticks: {
              font: { size: 9 },
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              maxTicksLimit: rates.length > 40 ? 6 : rates.length > 20 ? 8 : 12,
            },
          },
        },
      },
    });

    // Odložíme reset flagu vytváření grafu o malý okamžik, aby se zabránilo novým překryvným voláním
    setTimeout(() => {
      isCreatingHoverChart = false;
    }, 50);
  }

  // Funkce pro vytvoření inline grafu v popupu
  function createInlineChart(container, countryName, birthData) {
    // Odstraníme existující kontejner grafu, pokud existuje
    let chartContainer = container.querySelector(".inline-chart-container");
    if (chartContainer) {
      chartContainer.remove();
    }

    // Vytvoříme nový kontejner grafu
    chartContainer = document.createElement("div");
    chartContainer.className = "inline-chart-container";
    chartContainer.style.width = "100%";
    chartContainer.style.height = "200px";
    chartContainer.style.marginTop = "10px";
    container.appendChild(chartContainer);

    // Vytvoříme canvas pro graf
    const chartCanvas = document.createElement("canvas");
    chartContainer.appendChild(chartCanvas);

    // Získáme data pro graf
    const years = Object.keys(birthData)
      .map(Number)
      .sort((a, b) => a - b);
    const rates = years.map((year) => birthData[year]);

    // Pokud máme instanci grafu pro tuto zemi, zničíme ji
    if (chartInstances.has(countryName)) {
      chartInstances.get(countryName).destroy();
      chartInstances.delete(countryName);
    }

    // Vypočítáme minima a maxima pro osu y s malým odsazením
    const minValue = Math.min(...rates) * 0.95;
    const maxValue = Math.max(...rates) * 1.05;

    // Vytvoříme instanci grafu
    const chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: years.map(String),
        datasets: [
          {
            label: "TFR",
            data: rates,
            backgroundColor: "rgba(75, 192, 192, 0.3)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: rates.length > 30 ? 0 : 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            callbacks: {
              label: function (context) {
                return `TFR: ${context.parsed.y.toFixed(2)}`;
              },
            },
          },
          title: {
            display: true,
            text: `Vývoj TFR: ${countryName} (${years[0]}-${
              years[years.length - 1]
            })`,
            font: {
              size: 14,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: minValue,
            max: maxValue,
            title: {
              display: true,
              text: "TFR (dětí na ženu)",
            },
            ticks: {
              callback: function (value) {
                return value.toFixed(1);
              },
            },
          },
          x: {
            title: {
              display: true,
              text: "Rok",
            },
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              minRotation: 0,
              maxTicksLimit:
                rates.length > 40 ? 10 : rates.length > 20 ? 15 : 20,
            },
          },
        },
      },
    });

    // Uložíme instanci grafu pro budoucí použití
    chartInstances.set(countryName, chartInstance);
  }

  function filterGeoJSON(data) {
    const filteredData = JSON.parse(JSON.stringify(data));
    filteredData.features = filteredData.features.filter((feature) => {
      const name = feature.properties.ADMIN || feature.properties.name || "";
      return name.toLowerCase() !== "antarctica";
    });
    return filteredData;
  }

  // Pomocná funkce pro vygenerování dat (předpokládáme, že tato funkce je definovaná jinde v kódu)
  function generateBirthRateData(countryName) {
    // Simulace generování dat (pouze ukázka - nahraďte vaší skutečnou implementací)
    const result = {};
    const startYear = 2000;
    const endYear = 2024;
    const baseRate = Math.random() * 2 + 1; // Základní míra mezi 1-3

    for (let year = startYear; year <= endYear; year++) {
      // Vytvořte nějaký vzorec pro simulaci vývoje porodnosti (klesající trend)
      const yearFactor = (year - startYear) / (endYear - startYear);
      const randomVariation = (Math.random() - 0.5) * 0.2;

      // Speciální data pro některé země pro lepší demo
      if (
        countryName === "Česká republika" ||
        countryName === "Czech Republic"
      ) {
        // České TFR s výrazným propadem v 90. letech a mírným nárůstem v 2000s
        const czYearFactor = (year - startYear) / (endYear - startYear);
        if (year < 1990) {
          result[year] = 2.0 - czYearFactor * 0.5 + randomVariation * 0.3;
        } else if (year < 2000) {
          result[year] = 1.8 - (year - 1990) * 0.06 + randomVariation * 0.1;
        } else if (year < 2010) {
          result[year] = 1.15 + (year - 2000) * 0.04 + randomVariation * 0.1;
        } else {
          result[year] = 1.5 + (year - 2010) * 0.01 + randomVariation * 0.1;
        }
        continue;
      }

      result[year] = Math.max(
        0.8,
        baseRate * (1 - yearFactor * 0.7) + randomVariation
      );
    }

    return result;
  }

  fetch("../data/countries.geojson")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.warn(
        "Chyba při načítání geojson z URL, zkusím relativní cestu:",
        error
      );
      return fetch("countries.geojson");
    })
    .then((data) => {
      const filteredData = filterGeoJSON(data);

      const geoJsonLayer = L.geoJSON(filteredData, {
        style: function (feature) {
          const countryName =
            feature.properties.ADMIN ||
            feature.properties.name ||
            "Neznámá země";
          const birthData = generateBirthRateData(countryName);
          const currentYear = Math.max(...Object.keys(birthData).map(Number)); // Získat nejnovější rok z dat
          const currentRate = birthData[currentYear] || 0; // Použít TFR z nejnovějšího roku

          function getColor(rate) {
            return rate > 4.0
              ? "#800026"
              : rate > 3.0
              ? "#BD0026"
              : rate > 2.5
              ? "#E31A1C"
              : rate > 2.0
              ? "#FC4E2A"
              : rate > 1.8
              ? "#FD8D3C"
              : rate > 1.5
              ? "#FEB24C"
              : rate > 1.2
              ? "#FED976"
              : "#FFFFCC";
          }
          // Změněný styl hranic - tmavší barva a větší tloušťka pro lepší viditelnost
          return {
            fillColor: getColor(currentRate),
            weight: 1.5, // Zvýšení tloušťky z 1 na 1.5
            opacity: 1,
            color: "#666", // Změna barvy z bílé na tmavší šedou
            fillOpacity: 0.7,
            // Přidání dashArray pro přerušované hranice - volitelné
            // dashArray: '3',
          };
        },
        onEachFeature: function (feature, layer) {
          const countryName =
            feature.properties.ADMIN ||
            feature.properties.name ||
            "Neznámá země";

          // Připravíme si data jednou, abychom je nemuseli generovat opakovaně
          let countryBirthData = null;
          try {
            countryBirthData = generateBirthRateData(countryName);
          } catch (error) {
            console.error(
              `Error generating birth data for ${countryName}:`,
              error
            );
            countryBirthData = { 2024: 0 }; // Fallback data
          }

          // --- Klikací Popup s grafem (stávající funkcionalita) ---
          const yearsForPopup = Object.keys(countryBirthData)
            .map(Number)
            .sort((a, b) => a - b);
          const latestYearForPopup =
            yearsForPopup.length > 0
              ? yearsForPopup[yearsForPopup.length - 1]
              : "N/A";
          const firstYearForPopup =
            yearsForPopup.length > 0 ? yearsForPopup[0] : "N/A";

          let trendText = "N/A";
          if (
            yearsForPopup.length >= 2 &&
            countryBirthData[latestYearForPopup] !== undefined &&
            countryBirthData[firstYearForPopup] !== undefined &&
            countryBirthData[firstYearForPopup] !== 0
          ) {
            const change =
              ((countryBirthData[latestYearForPopup] -
                countryBirthData[firstYearForPopup]) /
                countryBirthData[firstYearForPopup]) *
              100;
            const trendIcon = change > 0.1 ? "↗️" : change < -0.1 ? "↘️" : "➡️";
            trendText = `${trendIcon} ${change.toFixed(
              1
            )}% (${firstYearForPopup}-${latestYearForPopup})`;
          } else if (yearsForPopup.length === 1) {
            trendText = "➡️ Data pro jeden rok";
          }

          let popupContent = document.createElement("div");
          popupContent.className = "country-popup";
          let info = document.createElement("div");
          info.innerHTML = `
              <h3>${countryName}</h3>
              <p><strong>TFR ${latestYearForPopup}:</strong> ${
            countryBirthData[latestYearForPopup] !== undefined
              ? countryBirthData[latestYearForPopup].toFixed(2)
              : "N/A"
          } dětí/ženu</p>
              <p><strong>Trend:</strong> ${trendText}</p>
          `;
          popupContent.appendChild(info);

          let popup = L.popup({
            maxWidth: 400,
            minWidth: 300,
            autoClose: false,
            closeOnClick: false,
            closeButton: true,
          }).setContent(popupContent);
          layer.bindPopup(popup);

          layer.on("click", function (e) {
            L.DomEvent.stopPropagation(e);
            if (currentOpenPopup && currentCountryName !== countryName) {
              closeCurrentPopup();
            }
            if (currentCountryName === countryName && currentOpenPopup) return;

            currentOpenPopup = popup;
            currentCountryName = countryName;
            currentLayer = this;
            this.openPopup();
            createInlineChart(popupContent, countryName, countryBirthData);
          });

          layer.on("popupopen", function (e) {
            // Při otevření popup odstraníme všechny hover tooltips
            removeHoverTooltip();

            if (!chartInstances.has(countryName)) {
              // Znovu vytvořit graf pokud byl zničen nebo neexistuje
              const existingChartContainer = popupContent.querySelector(
                ".inline-chart-container"
              );
              if (existingChartContainer) existingChartContainer.remove(); // Odstranit starý kontejner, pokud existuje
              createInlineChart(popupContent, countryName, countryBirthData);
            }
          });

          layer.on("popupclose", function (e) {
            if (currentCountryName === countryName) {
              // Zničení instance grafu při zavření popupu, aby se uvolnily zdroje
              // a graf se vždy překreslil s čerstvými (potenciálně aktualizovanými) daty
              if (chartInstances.has(countryName)) {
                chartInstances.get(countryName).destroy();
                chartInstances.delete(countryName);
              }
              const chartContainer = this.getPopup()
                .getContent()
                .querySelector(".inline-chart-container");
              if (chartContainer) {
                chartContainer.remove();
              }

              currentOpenPopup = null;
              currentCountryName = null;
              currentLayer = null;
            }
          });

          // --- Hover graf (nová funkcionalita) ---
          // Použijeme debounce pro mouseover událost
          let hoverTimeout;
          layer.on("mouseover", function (e) {
            // Zrušení předchozího čekajícího timeoutu
            clearTimeout(hoverTimeout);

            // Nastavení stylu pro zvýraznění země - zvýrazňujeme silnější hranicí
            this.setStyle({
              weight: 3, // Zvýšení tloušťky na 3 při hover
              color: "#222", // Téměř černá barva pro hranice při hover
              fillOpacity: 0.85,
            });

            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              this.bringToFront();
            }

            // UPRAVENO: Zobrazit hover graf pouze pokud není otevřený ŽÁDNÝ popup
            if (!currentOpenPopup) {
              // Použijeme timeout pro vytvoření grafu, abychom zabránili příliš častému volání
              hoverTimeout = setTimeout(() => {
                createHoverChart(e, countryName, countryBirthData);
              }, 50);
            }
          });

          // HLAVNÍ ÚPRAVA: mouseout událost nyní okamžitě odstraní hover tooltip
          layer.on("mouseout", function (e) {
            // Zrušení čekajícího timeoutu při mouseout
            clearTimeout(hoverTimeout);
            geoJsonLayer.resetStyle(this);

            // NOVÉ: Okamžitě odstraníme hover tooltip při opuštění země
            removeHoverTooltip();
          });

          // Přidáme posluchač událostí pro pohyb myši nad vrstvou
          layer.on("mousemove", function (e) {
            // Pokud již máme tooltip a NENÍ otevřený popup, aktualizujeme pouze jeho pozici
            if (
              hoverChartTooltip &&
              lastHoveredCountry === countryName &&
              !currentOpenPopup
            ) {
              const TOOLTIP_WIDTH = parseInt(hoverChartTooltip.style.width);
              const TOOLTIP_HEIGHT = parseInt(hoverChartTooltip.style.height);

              // Výpočet nové pozice
              let newLeft = e.originalEvent.pageX + 15;
              let newTop = e.originalEvent.pageY + 15;

              // Kontrola hranic okna
              if (newLeft + TOOLTIP_WIDTH > window.innerWidth) {
                newLeft = e.originalEvent.pageX - TOOLTIP_WIDTH - 10;
              }

              if (newTop + TOOLTIP_HEIGHT > window.innerHeight) {
                newTop = e.originalEvent.pageY - TOOLTIP_HEIGHT - 10;
              }

              // Aktualizace pozice tooltipů
              hoverChartTooltip.style.left = `${newLeft}px`;
              hoverChartTooltip.style.top = `${newTop}px`;
            }
          });
        },
      }).addTo(map);

      geoJsonLayer.on("click", function (e) {
        if (!e.layer && currentOpenPopup) {
          closeCurrentPopup();
        }
      });
    })
    .catch((error) => {
      console.error("Chyba při načítání GeoJSON dat:", error);
      const mapDiv = document.getElementById("map");
      mapDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: red; font-weight: bold;">Nepodařilo se načíst mapová data.</p>
          <p>Chyba: ${error.message}</p>
          <button onclick="location.reload()">Zkusit znovu</button>
        </div>`;
    });
});
