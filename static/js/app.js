// =============================================
//  AgroSense — Interactive Frontend Logic
// =============================================

const CROP_EMOJIS = {
  "Rice": "🌾", "Wheat": "🌿", "Maize": "🌽",
  "Banana": "🍌", "Mango": "🥭", "Cotton": "🌱",
  "Coconut": "🥥", "Orange": "🍊", "Coffee": "☕",
  "Papaya": "🍈", "Pomegranate": "🍎"
};

const PARAM_RANGES = {
  nitrogen:     { min: 0,   max: 200, unit: "kg/ha" },
  phosphorous:  { min: 0,   max: 150, unit: "kg/ha" },
  potassium:    { min: 0,   max: 250, unit: "kg/ha" },
  temperature:  { min: -10, max: 50,  unit: "°C"    },
  humidity:     { min: 0,   max: 100, unit: "%"      },
  ph:           { min: 0,   max: 14,  unit: "pH"     },
  rainfall:     { min: 0,   max: 500, unit: "mm"     }
};

const SOIL_PRESETS = {
  rice: { nitrogen: 95, phosphorous: 45, potassium: 42, temperature: 26.2, humidity: 82.5, ph: 6.2, rainfall: 210.8 },
  wheat: { nitrogen: 115, phosphorous: 52, potassium: 38, temperature: 16.8, humidity: 52.4, ph: 6.8, rainfall: 72.5 },
  coffee: { nitrogen: 90, phosphorous: 22, potassium: 48, temperature: 21.5, humidity: 72.1, ph: 6.1, rainfall: 165.0 },
  coconut: { nitrogen: 22, phosphorous: 15, potassium: 45, temperature: 28.5, humidity: 80.2, ph: 5.7, rainfall: 180.4 }
};

// ---- DOM ready ----
document.addEventListener('DOMContentLoaded', () => {
  initGauges();
  initFormInputs();
  initCounter();
  initPredictBtn();
  initResetBtn();
  initPresets();
  renderHistory();
});

// ---- Animated number counters ----
function initCounter() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    let start = 0;
    const duration = 1800;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = Number.isInteger(target) ? Math.floor(start) + suffix : start.toFixed(1) + suffix;
    }, 16);
  });
}

// ---- Live gauge bars under inputs ----
function initGauges() {
  document.querySelectorAll('.form-control-custom').forEach(input => {
    const gauge = document.getElementById('gauge-' + input.id);
    if (!gauge) return;
    const range = PARAM_RANGES[input.id];
    if (!range) return;

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      if (isNaN(val)) { gauge.style.width = '0%'; return; }
      const pct = Math.min(100, Math.max(0, ((val - range.min) / (range.max - range.min)) * 100));
      gauge.style.width = pct + '%';
    });
  });
}

// ---- Input enter-key navigation ----
function initFormInputs() {
  const inputs = document.querySelectorAll('.form-control-custom');
  inputs.forEach((input, idx) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else document.getElementById('predictBtn').click();
      }
    });

    // Subtle glow effect on focus
    input.addEventListener('focus', () => {
      input.closest('.form-group-custom')?.classList.add('focused');
    });
    input.addEventListener('blur', () => {
      input.closest('.form-group-custom')?.classList.remove('focused');
    });
  });
}

// ---- Predict button ----
function initPredictBtn() {
  document.getElementById('predictBtn').addEventListener('click', handlePredict);
}

async function handlePredict() {
  const fields = ['nitrogen','phosphorous','potassium','temperature','humidity','ph','rainfall'];
  const data = {};
  let valid = true;

  // Validate all fields
  fields.forEach(field => {
    const el = document.getElementById(field);
    const val = el.value.trim();
    if (val === '' || isNaN(parseFloat(val))) {
      el.style.borderColor = '#f05e5e';
      el.style.boxShadow = '0 0 0 3px rgba(240,94,94,0.15)';
      valid = false;
    } else {
      el.style.borderColor = '';
      el.style.boxShadow = '';
      data[field] = val;
    }
  });

  if (!valid) {
    showToast('Missing Fields', 'Please fill in all agricultural parameters.', 'error');
    shakeCard();
    return;
  }

  const btn = document.getElementById('predictBtn');
  btn.classList.add('loading');

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      displayResult(result, data);
      saveToHistory(result.recommended_crop, result.confidence, data);
      showToast('Analysis Complete', `${result.recommended_crop} is recommended for your soil!`, 'success');
    } else {
      showToast('Error', result.error || 'Something went wrong.', 'error');
    }
  } catch (err) {
    showToast('Connection Error', 'Could not reach the prediction server.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

// ---- Display prediction result ----
function displayResult(result, inputData) {
  const panel = document.getElementById('resultPanel');
  const placeholder = document.getElementById('resultPlaceholder');
  const content = document.getElementById('resultContent');

  placeholder.style.display = 'none';
  content.style.display = 'block';

  const crop = result.recommended_crop;
  const emoji = CROP_EMOJIS[crop] || '🌱';
  const confidence = result.confidence;

  // Crop name + emoji
  document.getElementById('resultEmoji').textContent = emoji;
  document.getElementById('resultCropName').textContent = crop;
  document.getElementById('resultConfidenceVal').textContent = confidence.toFixed(1) + '%';

  // Confidence bar (animate after a tick)
  const fillBar = document.getElementById('confidenceFill');
  fillBar.style.width = '0%';
  setTimeout(() => { fillBar.style.width = confidence + '%'; }, 100);

  // Alternative crops
  const altContainer = document.getElementById('altCropsContainer');
  altContainer.innerHTML = '';
  result.all_scores.forEach((item, idx) => {
    if (idx === 0) return; // skip the best crop (already shown)
    const [name, score] = item;
    const em = CROP_EMOJIS[name] || '🌱';
    altContainer.innerHTML += `
      <div class="alt-crop-item">
        <span class="alt-crop-emoji">${em}</span>
        <span class="alt-crop-name">${name}</span>
        <div class="alt-crop-bar-wrap">
          <div class="alt-crop-bar" style="width: ${score}%"></div>
        </div>
        <span class="alt-crop-pct">${score.toFixed(1)}%</span>
      </div>`;
  });

  // Parameter summary chips
  const chipData = [
    { icon: '🧪', label: 'Nitrogen',    value: inputData.nitrogen     + ' kg/ha' },
    { icon: '🔵', label: 'Phosphorous', value: inputData.phosphorous  + ' kg/ha' },
    { icon: '🟡', label: 'Potassium',   value: inputData.potassium    + ' kg/ha' },
    { icon: '🌡️', label: 'Temperature', value: inputData.temperature  + ' °C'   },
    { icon: '💧', label: 'Humidity',    value: inputData.humidity     + ' %'     },
    { icon: '⚗️', label: 'pH Level',    value: inputData.ph           + ' pH'    },
    { icon: '🌧️', label: 'Rainfall',    value: inputData.rainfall     + ' mm'    },
  ];

  const grid = document.getElementById('paramSummaryGrid');
  grid.innerHTML = chipData.map(c => `
    <div class="param-chip">
      <span class="param-chip-icon">${c.icon}</span>
      <div>
        <span class="param-chip-label">${c.label}</span>
        <span class="param-chip-value">${c.value}</span>
      </div>
    </div>`).join('');

  // Reveal panel
  panel.classList.add('visible');
  content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---- Reset ----
function initResetBtn() {
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('cropForm').reset();
    document.querySelectorAll('.gauge-fill').forEach(g => g.style.width = '0%');
    document.querySelectorAll('.form-control-custom').forEach(el => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    });

    const panel = document.getElementById('resultPanel');
    panel.classList.remove('visible');
    setTimeout(() => {
      document.getElementById('resultPlaceholder').style.display = 'flex';
      document.getElementById('resultContent').style.display = 'none';
    }, 600);

    showToast('Reset', 'All fields have been cleared.', 'success');
  });
}

// ---- Shake animation on invalid submit ----
function shakeCard() {
  const card = document.querySelector('.form-card');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'shakeCard 0.4s ease';
}

// Inject shake keyframes
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shakeCard {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-8px); }
    40%      { transform: translateX(8px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }`;
document.head.appendChild(shakeStyle);

// ---- Toast Notification ----
function showToast(title, msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast-custom toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ---- Presets Handling ----
function initPresets() {
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      const values = SOIL_PRESETS[presetKey];
      if (!values) return;

      Object.entries(values).forEach(([fieldId, val]) => {
        const input = document.getElementById(fieldId);
        if (input) {
          input.value = val;
          // Trigger input event to update gauge bar width dynamically
          input.dispatchEvent(new Event('input'));
        }
      });

      showToast('Preset Loaded', `${btn.textContent.trim()} soil profile applied successfully.`, 'success');
    });
  });
}

// ---- Prediction History ----
function saveToHistory(crop, confidence, data) {
  let history = JSON.parse(localStorage.getItem('agrosense_history') || '[]');
  const entry = {
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    crop: crop,
    confidence: confidence,
    data: data
  };
  
  // Prevent duplicate consecutive entries of the exact same result
  if (history.length > 0 && history[0].crop === crop && Math.abs(history[0].confidence - confidence) < 0.01) {
    return;
  }

  history.unshift(entry);
  history = history.slice(0, 5); // Keep last 5 entries
  localStorage.setItem('agrosense_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('historyContainer');
  if (!container) return;
  const history = JSON.parse(localStorage.getItem('agrosense_history') || '[]');

  if (history.length === 0) {
    container.innerHTML = `
      <div class="text-muted text-center py-4" style="font-size: 0.8rem;">
        <i class="bi bi-info-circle d-block mb-2" style="font-size: 1.2rem; opacity: 0.5;"></i>
        No recent recommendation history found
      </div>`;
    return;
  }

  container.innerHTML = history.map(h => {
    const em = CROP_EMOJIS[h.crop] || '🌱';
    return `
      <div class="history-item d-flex align-items-center justify-content-between p-3 mb-2 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); font-size: 0.85rem;">
        <div class="d-flex align-items-center gap-2">
          <span style="font-size: 1.2rem;">${em}</span>
          <div>
            <strong style="color: var(--text-primary); font-family: 'Outfit', sans-serif;">${h.crop}</strong>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${h.timestamp}</div>
          </div>
        </div>
        <div class="text-end">
          <span style="color: var(--accent-green); font-weight: 700; font-family: 'Outfit', sans-serif;">${h.confidence.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }).join('');
}
