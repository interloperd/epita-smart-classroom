/* EPITA Smart Classroom — météo du campus du Kremlin-Bicêtre (Open-Meteo, sans clé, sans géolocalisation).
 * Position fixe : EPITA, 14-16 rue Voltaire, 94270 Le Kremlin-Bicêtre. Aucune donnée personnelle n'est utilisée.
 * Sert de contexte d'audit (rapport) et donne un conseil de prise de vue selon la lumière extérieure.
 */
'use strict';
(() => {
  const LAT = 48.8156, LON = 2.3634, PLACE = 'Le Kremlin-Bicêtre';
  const URL_API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,cloud_cover&timezone=Europe%2FParis';
  const CACHE_KEY = 'esc.weather', TTL = 15 * 60 * 1000;
  const WMO = {
    0: ['Ciel dégagé', '☀️'], 1: ['Plutôt dégagé', '🌤'], 2: ['Partiellement nuageux', '⛅'], 3: ['Couvert', '☁️'],
    45: ['Brouillard', '🌫'], 48: ['Brouillard givrant', '🌫'], 51: ['Bruine légère', '🌦'], 53: ['Bruine', '🌦'], 55: ['Bruine dense', '🌧'],
    56: ['Bruine verglaçante', '🌧'], 57: ['Bruine verglaçante', '🌧'], 61: ['Pluie faible', '🌧'], 63: ['Pluie', '🌧'], 65: ['Forte pluie', '🌧'],
    66: ['Pluie verglaçante', '🌧'], 67: ['Pluie verglaçante', '🌧'], 71: ['Neige faible', '🌨'], 73: ['Neige', '🌨'], 75: ['Forte neige', '❄️'],
    77: ['Grains de neige', '🌨'], 80: ['Averses', '🌦'], 81: ['Averses', '🌧'], 82: ['Fortes averses', '⛈'], 85: ['Averses de neige', '🌨'],
    86: ['Fortes averses de neige', '❄️'], 95: ['Orage', '⛈'], 96: ['Orage avec grêle', '⛈'], 99: ['Orage avec grêle', '⛈'],
  };

  /** Point de rosée (formule de Magnus) : calcul local à partir de la température et de l'humidité. */
  function dewPoint(t, rh) { const a = 17.62, b = 243.12, g = Math.log(rh / 100) + (a * t) / (b + t); return (b * g) / (a - g); }
  /** Confort intérieur attendu, conseils de prise de vue selon la lumière extérieure. */
  function advice(w) {
    const out = [];
    if (!w.is_day) out.push('Il fait nuit : allumez tous les éclairages avant la prise de vue.');
    else if (w.cloud_cover >= 75 || w.weather_code >= 45) out.push('Ciel couvert ou pluie : la lumière naturelle est faible, allumez les plafonniers.');
    else if (w.weather_code <= 1) out.push('Grand soleil : risque de contre-jour, placez-vous dos aux fenêtres ou baissez les stores.');
    else out.push('Lumière naturelle correcte : complétez avec l\'éclairage si la salle est profonde.');
    if (w.temperature_2m >= 26) out.push('Chaleur extérieure : vérifiez la ventilation de la salle (confort des élèves).');
    if (w.temperature_2m <= 8) out.push('Froid extérieur : vérifiez le chauffage et la fermeture des fenêtres.');
    if (w.relative_humidity_2m >= 85) out.push('Humidité élevée : buée possible sur les vitres, essuyez l\'objectif.');
    return out;
  }

  function render(w, fromCache) {
    const [label, icon] = WMO[w.weather_code] || ['Conditions inconnues', '🌡'];
    const dp = dewPoint(w.temperature_2m, w.relative_humidity_2m);
    const chip = document.getElementById('weatherChip');
    if (chip) { chip.hidden = false; chip.textContent = `${icon} ${Math.round(w.temperature_2m)} °C · ${PLACE}`; chip.title = `${label} · ressenti ${Math.round(w.apparent_temperature)} °C`; }
    const card = document.getElementById('weatherCard');
    if (card) {
      card.hidden = false;
      const tips = advice(w);
      card.innerHTML = `<h3 class="card-title">Météo du campus <span class="muted small">· ${PLACE} · Open-Meteo</span></h3>
        <div class="wx">
          <div class="wx-main"><span class="wx-ico">${icon}</span><b>${w.temperature_2m.toFixed(1)} °C</b><span>${label}</span></div>
          <dl class="wx-grid">
            <dt>Ressenti</dt><dd>${w.apparent_temperature.toFixed(1)} °C</dd>
            <dt>Humidité</dt><dd>${Math.round(w.relative_humidity_2m)} %</dd>
            <dt>Point de rosée</dt><dd>${dp.toFixed(1)} °C <span class="muted small">(calculé)</span></dd>
            <dt>Vent</dt><dd>${Math.round(w.wind_speed_10m)} km/h</dd>
            <dt>Nébulosité</dt><dd>${Math.round(w.cloud_cover)} %</dd>
            <dt>Moment</dt><dd>${w.is_day ? 'Jour' : 'Nuit'}</dd>
          </dl>
        </div>
        <ul class="wx-tips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
        <p class="muted small">Relevé de ${new Date(w.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${fromCache ? ' (cache 15 min)' : ''} · position fixe du campus, aucune géolocalisation.</p>`;
    }
    const E = window.__ESC__;
    if (E) E.state.weather = { place: PLACE, temp: w.temperature_2m, feels: w.apparent_temperature, rh: w.relative_humidity_2m, dew: Math.round(dp * 10) / 10, wind: w.wind_speed_10m, clouds: w.cloud_cover, day: !!w.is_day, label, icon, time: w.time, tips: advice(w) };
  }

  async function load() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.at < TTL) return render(c.w, true);
    } catch { /* */ }
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(URL_API, { signal: ctl.signal }); clearTimeout(tm);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json(); const w = j.current;
      if (!w || typeof w.temperature_2m !== 'number') throw new Error('réponse inattendue');
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), w })); } catch { /* */ }
      render(w, false);
    } catch (e) {
      const card = document.getElementById('weatherCard');
      if (card) { card.hidden = false; card.innerHTML = `<h3 class="card-title">Météo du campus</h3><p class="muted small">Météo indisponible pour le moment (${e.message || e}). L'audit n'en dépend pas.</p>`; }
    }
  }
  const start = () => { load(); setInterval(load, TTL); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
