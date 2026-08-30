/**
 * FARM TRACKER - Core Application Logic & Planting Engine
 */

// --- Global Application State ---
const State = {
  crops: [],
  plans: [],
  logs: [],
  historyLogs: [],
  settings: {
    springFrost: '2026-05-15',
    fallFrost: '2026-10-15',
    gasUrl: 'https://script.google.com/macros/s/AKfycbyLKecCYPovUPM_n_eVksbdfvhJoUBCCTMOTuB0R_RpRX96R-PragQHUC2Q-h94lFz8eg/exec',
    theme: 'dark',
    beds: ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Bed 5', 'Bed 6', 'Bed 7', 'Bed 8', 'Greenhouse 1', 'Greenhouse 2', 'Row A', 'Row B', 'Row C']
  },
  currentView: 'tasks',
  timelineViewMode: 'cards',
  filters: {
    catalogQuery: '',
    catalogCategory: 'all',
    timelineCategory: 'all',
    timelineSort: 'start_date',
    historyQuery: '',
    historyType: 'all',
    historyYear: 'all',
    historyCategory: 'all',
    historyBed: '',
    historyDateFrom: '',
    historyDateTo: ''
  }
};

// --- Storage & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  loadStoredData();
  applyTheme(State.settings.theme);
  bindEvents();
  renderAllViews();
  setupServiceWorker();
}

function loadStoredData() {
  // Load Settings
  const savedSettings = localStorage.getItem('ft_settings');
  if (savedSettings) {
    State.settings = { ...State.settings, ...JSON.parse(savedSettings) };
  }

  // Load Crops (Combine catalog.js + custom stored crops)
  const baseCatalog = window.FARM_CATALOG || [];
  const customCrops = JSON.parse(localStorage.getItem('ft_custom_crops') || '[]');
  State.crops = [...baseCatalog, ...customCrops];

  // Load Plans
  const savedPlans = localStorage.getItem('ft_plans');
  if (savedPlans) {
    State.plans = JSON.parse(savedPlans);
  } else {
    // Generate starter sample plans if empty
    generateSamplePlans();
  }

  // Load User Logs
  const savedLogs = localStorage.getItem('ft_logs');
  if (savedLogs) {
    State.logs = JSON.parse(savedLogs);
  }

  // Load Historical Logs from history.js
  if (window.FARM_HISTORY && window.FARM_HISTORY.lifecycle_logs) {
    State.historyLogs = window.FARM_HISTORY.lifecycle_logs;
  }
}

function saveLocal() {
  localStorage.setItem('ft_settings', JSON.stringify(State.settings));
  localStorage.setItem('ft_plans', JSON.stringify(State.plans));
  localStorage.setItem('ft_logs', JSON.stringify(State.logs));
  localStorage.setItem('ft_custom_crops', JSON.stringify(State.crops.filter(c => c.is_custom)));
}

// Generate intelligent default plans for the current year
function generateSamplePlans() {
  const popularCrops = ['Tomatoes', 'Peppers', 'Broccoli', 'Kale', 'Lettuce', 'Carrots', 'Cucumbers', 'Beans', 'Garlic', 'Onions'];
  const samples = [];

  popularCrops.forEach((cat, idx) => {
    const crop = State.crops.find(c => c.category.toLowerCase() === cat.toLowerCase());
    if (crop) {
      const dates = calculateCropDates(crop, State.settings.springFrost, State.settings.fallFrost);
      samples.push({
        id: 'plan_' + Date.now() + '_' + idx,
        crop_id: crop.id,
        category: crop.category,
        vegetable: crop.vegetable,
        variety: crop.variety || '',
        name: crop.name,
        icon: crop.icon || '🌱',
        sow_type: crop.sow_method === 'direct' ? 'direct' : 'indoor',
        indoor_sow_date: dates.indoorSowDate,
        plant_date: dates.plantDate,
        harvest_start: dates.harvestStartDate,
        harvest_end: dates.harvestEndDate,
        row_bed: State.settings.beds[idx % State.settings.beds.length],
        target_quantity: 24,
        status: 'planned'
      });
    }
  });

  State.plans = samples;
  saveLocal();
}

// --- Planting Calculation Engine ---
function calculateCropDates(crop, springFrostStr, fallFrostStr) {
  const springFrost = new Date(springFrostStr + 'T12:00:00');
  const dtm = Number(crop.dtm) || 60;
  
  let indoorSowDate = null;
  let plantDate = null;
  let harvestStartDate = null;
  let harvestEndDate = null;

  if (crop.sow_method === 'indoor' || (crop.sow_method === 'both' && crop.indoor_weeks)) {
    const indoorLeadDays = (crop.indoor_weeks || 6) * 7;
    indoorSowDate = addDays(springFrost, -indoorLeadDays);

    const transplantOffsetDays = (crop.transplant_weeks || 0) * 7;
    plantDate = addDays(springFrost, transplantOffsetDays);
  } else if (crop.sow_method === 'direct' || crop.sow_method === 'both') {
    const directOffsetDays = (crop.direct_sow_weeks || 0) * 7;
    plantDate = addDays(springFrost, directOffsetDays);
    indoorSowDate = null;
  } else {
    // Perennial / other
    plantDate = addDays(springFrost, -14);
  }

  if (plantDate) {
    harvestStartDate = addDays(plantDate, dtm);
    harvestEndDate = addDays(harvestStartDate, 21); // 3 weeks harvest window
  }

  return {
    indoorSowDate: formatDate(indoorSowDate),
    plantDate: formatDate(plantDate),
    harvestStartDate: formatDate(harvestStartDate),
    harvestEndDate: formatDate(harvestEndDate)
  };
}

function addDays(date, days) {
  if (!date) return null;
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  if (!str) return null;
  return new Date(str + 'T12:00:00');
}

// --- View Navigation ---
function switchView(viewId) {
  State.currentView = viewId;
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .mob-nav-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });

  const activeSection = document.getElementById(`view-${viewId}`);
  if (activeSection) activeSection.classList.add('active');

  // Trigger view specific renders
  if (viewId === 'tasks') renderTasksView();
  else if (viewId === 'timeline') renderTimelineView();
  else if (viewId === 'catalog') renderCatalogView();
  else if (viewId === 'beds') renderBedsView();
  else if (viewId === 'history') renderHistoryView();
  else if (viewId === 'settings') renderSettingsView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAllViews() {
  updateDashboardStats();
  renderTasksView();
  renderTimelineView();
  renderCatalogView();
  renderBedsView();
  renderHistoryView();
  renderSettingsView();
}

// --- Dashboard & Tasks View ---
function updateDashboardStats() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const next7Days = addDays(today, 7);

  let dueCount = 0;
  let activeInGround = 0;
  let harvestedCount = 0;

  State.plans.forEach(plan => {
    if (plan.status === 'in_ground') activeInGround++;
    if (plan.status === 'harvested') harvestedCount++;

    // Check if sow or plant is due this week
    if (plan.indoor_sow_date) {
      const d = parseDate(plan.indoor_sow_date);
      if (d && d >= today && d <= next7Days && plan.status === 'planned') dueCount++;
    }
    if (plan.plant_date) {
      const d = parseDate(plan.plant_date);
      if (d && d >= today && d <= next7Days && (plan.status === 'planned' || plan.status === 'sowed')) dueCount++;
    }
    if (plan.harvest_start) {
      const d = parseDate(plan.harvest_start);
      if (d && d >= today && d <= next7Days && plan.status === 'in_ground') dueCount++;
    }
  });

  const statDue = document.getElementById('stat-due-tasks');
  const statActive = document.getElementById('stat-active-crops');
  const statTotalPlans = document.getElementById('stat-total-plans');
  const statHarvested = document.getElementById('stat-harvests');

  if (statDue) statDue.textContent = dueCount;
  if (statActive) statActive.textContent = activeInGround;
  if (statTotalPlans) statTotalPlans.textContent = State.plans.length;
  if (statHarvested) statHarvested.textContent = State.logs.filter(l => l.lifecycle_type === 'harvest').length;
}

function renderTasksView() {
  updateDashboardStats();
  const container = document.getElementById('tasks-container');
  if (!container) return;

  if (State.plans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌱</div>
        <div class="empty-state-title">No Active Planting Plans</div>
        <p>Browse the Crop Catalog and add crops to your seasonal plan.</p>
        <button class="btn btn-primary" style="margin-top: 14px;" onclick="switchView('catalog')">Open Crop Catalog</button>
      </div>
    `;
    return;
  }

  // Sort plans by next relevant date
  const sortedPlans = [...State.plans].sort((a, b) => {
    const dateA = a.status === 'in_ground' ? a.harvest_start : (a.status === 'sowed' ? a.plant_date : (a.indoor_sow_date || a.plant_date));
    const dateB = b.status === 'in_ground' ? b.harvest_start : (b.status === 'sowed' ? b.plant_date : (b.indoor_sow_date || b.plant_date));
    return (dateA || '').localeCompare(dateB || '');
  });

  container.innerHTML = sortedPlans.map(plan => {
    let actionType = 'sow';
    let actionLabel = 'Sow Seeds';
    let targetDate = plan.indoor_sow_date || plan.plant_date;
    let badgeClass = 'badge-sow';

    if (plan.status === 'sowed') {
      actionType = 'plant';
      actionLabel = 'Plant Out';
      targetDate = plan.plant_date;
      badgeClass = 'badge-plant';
    } else if (plan.status === 'in_ground') {
      actionType = 'harvest';
      actionLabel = 'Log Harvest';
      targetDate = plan.harvest_start;
      badgeClass = 'badge-harvest';
    }

    return `
      <div class="task-card task-${actionType}">
        <div class="task-header">
          <div>
            <div class="task-crop-title">${plan.icon || '🌱'} ${plan.name}</div>
            <div class="task-variety">${plan.variety ? 'Variety: ' + plan.variety : plan.category}</div>
          </div>
          <span class="badge ${badgeClass}">${plan.status.toUpperCase()}</span>
        </div>
        
        <div class="task-details">
          <span class="task-detail-item">📅 Target: <strong>${targetDate || 'Flexible'}</strong></span>
          <span class="task-detail-item">📍 Bed: <strong>${plan.row_bed || 'Unassigned'}</strong></span>
          <span class="task-detail-item">🎯 Qty: <strong>${plan.target_quantity || 1}</strong></span>
        </div>

        <div class="task-actions">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="openQuickLogModal('${plan.id}', '${actionType}')">
            ✓ ${actionLabel}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editPlan('${plan.id}')">
            ✏️
          </button>
          <button class="btn btn-secondary btn-sm" onclick="deletePlan('${plan.id}')">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Timeline / Gantt View ---
function renderTimelineView() {
  renderTimelineCards();
  const container = document.getElementById('timeline-chart-body');
  if (!container) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date(State.settings.springFrost).getFullYear() || 2026;

  const filteredPlans = getSortedTimelinePlans();

  if (filteredPlans.length === 0) {
    container.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 24px;">No plans matching filter.</td></tr>`;
    return;
  }

  container.innerHTML = filteredPlans.map(plan => {
    // Calculate percentage offset for bars across the 12 months (365 days)
    const dayOfYear = (dateStr) => {
      if (!dateStr) return null;
      const d = parseDate(dateStr);
      if (!d) return null;
      const start = new Date(currentYear, 0, 1);
      return Math.max(0, Math.min(365, (d - start) / (1000 * 60 * 60 * 24)));
    };

    const indoorStart = dayOfYear(plan.indoor_sow_date);
    const plantStart = dayOfYear(plan.plant_date);
    const harvestStart = dayOfYear(plan.harvest_start);
    const harvestEnd = dayOfYear(plan.harvest_end) || (harvestStart ? harvestStart + 21 : null);

    let barsHtml = '';

    // Indoor bar
    if (indoorStart !== null && plantStart !== null && plantStart > indoorStart) {
      const left = (indoorStart / 365) * 100;
      const width = ((plantStart - indoorStart) / 365) * 100;
      barsHtml += `<div class="timeline-bar bar-indoor" style="left: ${left}%; width: ${Math.max(width, 2)}%" title="Indoor Sowing: ${plan.indoor_sow_date}">Indoor</div>`;
    }

    // In-ground growth bar
    if (plantStart !== null && harvestStart !== null && harvestStart > plantStart) {
      const left = (plantStart / 365) * 100;
      const width = ((harvestStart - plantStart) / 365) * 100;
      barsHtml += `<div class="timeline-bar bar-ground" style="left: ${left}%; width: ${Math.max(width, 2)}%" title="In Ground: ${plan.plant_date}">Growing</div>`;
    }

    // Harvest bar
    if (harvestStart !== null) {
      const end = harvestEnd || (harvestStart + 21);
      const left = (harvestStart / 365) * 100;
      const width = ((end - harvestStart) / 365) * 100;
      barsHtml += `<div class="timeline-bar bar-harvest" style="left: ${left}%; width: ${Math.max(width, 2)}%" title="Harvest: ${plan.harvest_start}">Harvest</div>`;
    }

    return `
      <tr>
        <td class="timeline-crop-label">
          <strong>${plan.icon || '🌱'} ${plan.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted)">Bed: ${plan.row_bed || 'None'}</div>
        </td>
        <td colspan="12">
          <div class="timeline-bar-wrapper">
            ${barsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- Crop Catalog View ---
function renderCatalogView() {
  const container = document.getElementById('catalog-grid');
  const catSelect = document.getElementById('catalog-category-filter');
  if (!container) return;

  // Populate category options if empty
  if (catSelect && catSelect.options.length <= 1) {
    const categories = Array.from(new Set(State.crops.map(c => c.category))).sort();
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
  }

  // Filter crops
  const q = State.filters.catalogQuery.toLowerCase();
  const catFilter = State.filters.catalogCategory;

  const filtered = State.crops.filter(crop => {
    const matchQuery = !q || crop.name.toLowerCase().includes(q) || crop.category.toLowerCase().includes(q) || (crop.variety && crop.variety.toLowerCase().includes(q));
    const matchCat = catFilter === 'all' || crop.category === catFilter;
    return matchQuery && matchCat;
  });

  const countBadge = document.getElementById('catalog-results-count');
  if (countBadge) countBadge.textContent = `${filtered.length} varieties`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No crops found</div><p>Try searching for a different vegetable or variety.</p></div>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map(crop => `
    <div class="catalog-card">
      <div>
        <div class="catalog-header">
          <div class="catalog-icon">${crop.icon || '🌱'}</div>
          <div>
            <div class="catalog-title">${crop.vegetable}</div>
            <div class="catalog-category">${crop.category} ${crop.variety ? '• ' + crop.variety : ''}</div>
          </div>
        </div>
        
        <div class="catalog-specs" style="margin-top: 12px;">
          <div class="spec-item">
            <span class="spec-label">Sow Method</span>
            <span class="spec-val">${crop.sow_method === 'indoor' ? 'Indoor Start' : (crop.sow_method === 'direct' ? 'Direct Sow' : 'Indoor/Direct')}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Days to Maturity</span>
            <span class="spec-val">${crop.dtm || 60} days</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Spacing</span>
            <span class="spec-val">${crop.spacing_in || 12}" in-row</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Frost Tolerance</span>
            <span class="spec-val">${crop.frost_hardy ? 'Frost Hardy' : 'Tender'}</span>
          </div>
        </div>
      </div>

      <div style="display:flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="openAddPlanModal('${crop.id}')">
          ➕ Plan Sowing
        </button>
      </div>
    </div>
  `).join('');
}

// --- Beds & Field View ---
function renderBedsView() {
  const container = document.getElementById('beds-container');
  if (!container) return;

  container.innerHTML = State.settings.beds.map(bedName => {
    const bedPlans = State.plans.filter(p => p.row_bed === bedName);

    return `
      <div class="bed-card">
        <div class="bed-card-header">
          <div class="bed-title">📍 ${bedName}</div>
          <span class="badge ${bedPlans.length > 0 ? 'badge-plant' : 'badge-secondary'}">
            ${bedPlans.length} Plantings
          </span>
        </div>

        <div class="bed-plantings-list">
          ${bedPlans.length === 0 ? '<div style="color:var(--text-muted); font-size:0.85rem; padding: 6px 0;">No active plantings assigned.</div>' : ''}
          ${bedPlans.map(p => `
            <div class="bed-planting-item">
              <div>
                <strong>${p.icon || '🌱'} ${p.name}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted)">Status: ${p.status} • Target: ${p.target_quantity}</div>
              </div>
              <button class="btn btn-secondary btn-sm" style="padding:4px 8px; min-height:28px" onclick="openQuickLogModal('${p.id}', 'harvest')">
                Harvest
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// --- Historical Logs & Analytics ---
function renderHistoryView() {
  const container = document.getElementById('history-table-body');
  if (!container) return;

  const allLogs = [...State.logs, ...State.historyLogs];

  // Populate Advanced Filter Dropdowns if empty
  const advCat = document.getElementById('adv-category-filter');
  if (advCat && advCat.options.length <= 1) {
    const cats = Array.from(new Set(allLogs.map(l => l.category).filter(Boolean))).sort();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      advCat.appendChild(opt);
    });
  }

  const advYear = document.getElementById('adv-year-filter');
  if (advYear && advYear.options.length <= 1) {
    const years = Array.from(new Set(allLogs.map(l => (l.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
    // Ensure 2026, 2025, 2024 are present
    ['2026', '2025', '2024'].forEach(y => { if (!years.includes(y)) years.unshift(y); });
    years.sort().reverse().forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      advYear.appendChild(opt);
    });
  }

  const q = (State.filters.historyQuery || '').toLowerCase();
  const typeFilter = State.filters.historyType || 'all';
  const yearFilter = State.filters.historyYear || 'all';
  const catFilter = State.filters.historyCategory || 'all';
  const bedFilter = (State.filters.historyBed || '').toLowerCase();
  const dateFrom = State.filters.historyDateFrom;
  const dateTo = State.filters.historyDateTo;

  const filtered = allLogs.filter(log => {
    const logDate = log.date || '';
    const logYear = logDate.slice(0, 4);

    const matchQuery = !q || (log.vegetable && log.vegetable.toLowerCase().includes(q)) || 
                             (log.variety && log.variety.toLowerCase().includes(q)) || 
                             (log.category && log.category.toLowerCase().includes(q)) ||
                             (log.row_id && log.row_id.toLowerCase().includes(q)) ||
                             (log.notes && log.notes.toLowerCase().includes(q));

    const matchType = typeFilter === 'all' || log.lifecycle_type === typeFilter;
    const matchYear = yearFilter === 'all' || logYear === yearFilter;
    const matchCat = catFilter === 'all' || (log.category && log.category.toLowerCase() === catFilter.toLowerCase());
    const matchBed = !bedFilter || (log.row_id && log.row_id.toLowerCase().includes(bedFilter));
    const matchFrom = !dateFrom || (logDate >= dateFrom);
    const matchTo = !dateTo || (logDate <= dateTo);

    return matchQuery && matchType && matchYear && matchCat && matchBed && matchFrom && matchTo;
  });

  const countBadge = document.getElementById('history-count-badge');
  if (countBadge) countBadge.textContent = `${filtered.length} records found`;

  // Render Mobile Cards (<768px)
  const mobileContainer = document.getElementById('history-cards-container');
  if (mobileContainer) {
    if (filtered.length === 0) {
      mobileContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No matching records</div><p>Try adjusting your search or filter pills.</p></div>`;
    } else {
      mobileContainer.innerHTML = filtered.slice(0, 100).map(l => {
        const badgeClass = l.lifecycle_type === 'sow' ? 'badge-sow' : (l.lifecycle_type === 'plant' ? 'badge-plant' : 'badge-harvest');
        const icon = l.lifecycle_type === 'sow' ? '🌱' : (l.lifecycle_type === 'plant' ? '🌿' : '🧺');
        return `
          <div class="history-card">
            <div class="history-card-top">
              <span class="badge ${badgeClass}">${icon} ${(l.lifecycle_type || 'log').toUpperCase()}</span>
              <span class="history-card-date">📅 ${l.date || 'N/A'}</span>
            </div>
            <div class="history-card-main">
              ${l.vegetable || ''} ${l.variety ? '<span style="color:var(--text-muted); font-weight:normal">(' + l.variety + ')</span>' : ''}
            </div>
            <div class="history-card-tags">
              <span class="history-card-tag">📂 ${l.category || 'General'}</span>
              <span class="history-card-tag">📍 Bed: ${l.row_id || '—'}</span>
              <span class="history-card-tag">🎯 Qty: ${l.quantity || 0}</span>
              ${l.weight ? `<span class="history-card-tag">⚖️ ${l.weight} lbs</span>` : ''}
            </div>
            ${l.notes ? `<div class="history-card-notes">📝 ${l.notes}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // Render Desktop Table (>=768px)
  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px;">No records found matching filters.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map(l => {
    const badgeClass = l.lifecycle_type === 'sow' ? 'badge-sow' : (l.lifecycle_type === 'plant' ? 'badge-plant' : 'badge-harvest');
    return `
      <tr>
        <td><strong>${l.date || 'N/A'}</strong></td>
        <td><span class="badge ${badgeClass}">${(l.lifecycle_type || 'log').toUpperCase()}</span></td>
        <td><strong>${l.vegetable || ''}</strong> <span style="color:var(--text-muted)">${l.variety ? '(' + l.variety + ')' : ''}</span></td>
        <td>${l.category || ''}</td>
        <td>${l.row_id || '—'}</td>
        <td>${l.quantity || 0}</td>
        <td>${l.notes || '—'}</td>
      </tr>
    `;
  }).join('');
}


// --- Settings & Google Sheets View ---
function renderSettingsView() {
  const springInput = document.getElementById('setting-spring-frost');
  const fallInput = document.getElementById('setting-fall-frost');
  const gasInput = document.getElementById('setting-gas-url');
  const bedsInput = document.getElementById('setting-beds-list');

  if (springInput) springInput.value = State.settings.springFrost;
  if (fallInput) fallInput.value = State.settings.fallFrost;
  if (gasInput) gasInput.value = State.settings.gasUrl || '';
  if (bedsInput) bedsInput.value = State.settings.beds.join(', ');
}

function saveSettingsFromForm() {
  const springVal = document.getElementById('setting-spring-frost').value;
  const fallVal = document.getElementById('setting-fall-frost').value;
  const gasVal = document.getElementById('setting-gas-url').value.trim();
  const bedsVal = document.getElementById('setting-beds-list').value;

  State.settings.springFrost = springVal || '2026-05-15';
  State.settings.fallFrost = fallVal || '2026-10-15';
  State.settings.gasUrl = gasVal;
  State.settings.beds = bedsVal.split(',').map(b => b.trim()).filter(Boolean);

  saveLocal();
  showToast('Settings saved successfully!', 'success');
  renderAllViews();
}

// --- Google Sheets Sync ---
async function syncWithGoogleSheets() {
  const url = State.settings.gasUrl;
  if (!url) {
    showToast('Please enter your Google Apps Script Web App URL first in Settings.', 'error');
    switchView('settings');
    return;
  }

  showToast('Syncing with Google Sheets...', 'success');

  try {
    const payload = {
      action: 'syncBulk',
      logs: State.logs,
      plans: State.plans
    };

    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // standard for GAS web apps
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    showToast('Data synced to Google Sheets!', 'success');
  } catch (err) {
    console.error('GAS Sync Error:', err);
    showToast('Sync failed: ' + err.message, 'error');
  }
}

// --- Export / Import ---
function exportDataJson() {
  const exportBlob = new Blob([JSON.stringify({
    settings: State.settings,
    plans: State.plans,
    logs: State.logs,
    custom_crops: State.crops.filter(c => c.is_custom)
  }, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(exportBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `farm_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup JSON downloaded!', 'success');
}

function importDataJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.settings) State.settings = { ...State.settings, ...data.settings };
      if (data.plans) State.plans = data.plans;
      if (data.logs) State.logs = data.logs;
      saveLocal();
      renderAllViews();
      showToast('Data imported successfully!', 'success');
    } catch (err) {
      showToast('Error importing file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// --- Quick Log Modal ---
function openQuickLogModal(planId, defaultType) {
  const plan = State.plans.find(p => p.id === planId);
  if (!plan) return;

  document.getElementById('log-plan-id').value = plan.id;
  document.getElementById('log-crop-title').textContent = `${plan.icon || '🌱'} ${plan.name}`;
  document.getElementById('log-type').value = defaultType || 'sow';
  document.getElementById('log-date').value = formatDate(new Date());
  document.getElementById('log-qty').value = plan.target_quantity || 1;
  document.getElementById('log-bed').value = plan.row_bed || '';
  document.getElementById('log-notes').value = '';

  document.getElementById('quick-log-modal').classList.add('active');
}

function submitQuickLog() {
  const planId = document.getElementById('log-plan-id').value;
  const plan = State.plans.find(p => p.id === planId);
  const type = document.getElementById('log-type').value;
  const date = document.getElementById('log-date').value;
  const qty = Number(document.getElementById('log-qty').value) || 0;
  const weight = Number(document.getElementById('log-weight').value) || 0;
  const bed = document.getElementById('log-bed').value;
  const notes = document.getElementById('log-notes').value;

  const newLog = {
    id: 'log_' + Date.now(),
    date: date,
    lifecycle_type: type,
    category: plan ? plan.category : '',
    vegetable: plan ? plan.vegetable : '',
    variety: plan ? plan.variety : '',
    row_id: bed,
    quantity: qty,
    weight: weight,
    notes: notes,
    plant_id: plan ? plan.crop_id : ''
  };

  State.logs.unshift(newLog);

  // Update plan status
  if (plan) {
    if (type === 'sow') plan.status = 'sowed';
    else if (type === 'plant') plan.status = 'in_ground';
    else if (type === 'harvest') plan.status = 'harvested';
  }

  saveLocal();
  closeModals();
  showToast(`Logged ${type.toUpperCase()} for ${plan ? plan.name : 'Crop'}!`, 'success');
  renderAllViews();
}

// --- Add / Edit Plan Modal ---
function openAddPlanModal(cropId) {
  const crop = State.crops.find(c => String(c.id) === String(cropId));
  if (!crop) return;

  const dates = calculateCropDates(crop, State.settings.springFrost, State.settings.fallFrost);

  document.getElementById('plan-modal-crop-id').value = crop.id;
  document.getElementById('plan-modal-title').textContent = `Plan Sowing: ${crop.name}`;
  document.getElementById('plan-modal-type').value = crop.sow_method === 'direct' ? 'direct' : 'indoor';
  document.getElementById('plan-modal-indoor-date').value = dates.indoorSowDate || '';
  document.getElementById('plan-modal-plant-date').value = dates.plantDate || '';
  document.getElementById('plan-modal-harvest-date').value = dates.harvestStartDate || '';
  document.getElementById('plan-modal-qty').value = 24;
  
  // Populate bed selector
  const bedSelect = document.getElementById('plan-modal-bed');
  bedSelect.innerHTML = State.settings.beds.map(b => `<option value="${b}">${b}</option>`).join('');

  document.getElementById('add-plan-modal').classList.add('active');
}

function submitAddPlan() {
  const cropId = document.getElementById('plan-modal-crop-id').value;
  const crop = State.crops.find(c => String(c.id) === String(cropId));
  if (!crop) return;

  const newPlan = {
    id: 'plan_' + Date.now(),
    crop_id: crop.id,
    category: crop.category,
    vegetable: crop.vegetable,
    variety: crop.variety || '',
    name: crop.name,
    icon: crop.icon || '🌱',
    sow_type: document.getElementById('plan-modal-type').value,
    indoor_sow_date: document.getElementById('plan-modal-indoor-date').value,
    plant_date: document.getElementById('plan-modal-plant-date').value,
    harvest_start: document.getElementById('plan-modal-harvest-date').value,
    harvest_end: formatDate(addDays(parseDate(document.getElementById('plan-modal-harvest-date').value), 21)),
    row_bed: document.getElementById('plan-modal-bed').value,
    target_quantity: Number(document.getElementById('plan-modal-qty').value) || 24,
    status: 'planned'
  };

  State.plans.push(newPlan);
  saveLocal();
  closeModals();
  showToast(`Added ${crop.name} to Planting Schedule!`, 'success');
  renderAllViews();
  switchView('tasks');
}

function deletePlan(planId) {
  if (confirm('Are you sure you want to remove this planting plan?')) {
    State.plans = State.plans.filter(p => p.id !== planId);
    saveLocal();
    showToast('Plan removed', 'success');
    renderAllViews();
  }
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
}

// --- Theme Management ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  State.settings.theme = theme;
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const newTheme = State.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  saveLocal();
}

// --- Toast Messages ---
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// --- Event Binding ---
function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-btn, .mob-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Theme Toggle
  
  // Timeline Sort
  const tlSort = document.getElementById('timeline-sort-select');
  if (tlSort) {
    tlSort.addEventListener('change', (e) => {
      State.filters.timelineSort = e.target.value;
      renderTimelineView();
    });
  }

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Catalog search & filter
  const catSearch = document.getElementById('catalog-search-input');
  if (catSearch) {
    catSearch.addEventListener('input', (e) => {
      State.filters.catalogQuery = e.target.value;
      renderCatalogView();
    });
  }

  const catFilter = document.getElementById('catalog-category-filter');
  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      State.filters.catalogCategory = e.target.value;
      renderCatalogView();
    });
  }

  // History search & filter
  const histSearch = document.getElementById('history-search-input');
  if (histSearch) {
    histSearch.addEventListener('input', (e) => {
      State.filters.historyQuery = e.target.value;
      renderHistoryView();
    });
  }

  const histFilter = document.getElementById('history-type-filter');
  if (histFilter) {
    histFilter.addEventListener('change', (e) => {
      State.filters.historyType = e.target.value;
      renderHistoryView();
    });
  }
}

// --- PWA Service Worker ---
function setupServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  }
}


// --- Add Crop Modal Handlers ---
function openAddCropModal() {
  // Populate datalist with existing categories
  const datalist = document.getElementById('category-datalist');
  if (datalist) {
    const categories = Array.from(new Set(State.crops.map(c => c.category))).sort();
    datalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
  }

  // Reset fields
  document.getElementById('crop-modal-category').value = '';
  document.getElementById('crop-modal-vegetable').value = '';
  document.getElementById('crop-modal-variety').value = '';
  document.getElementById('crop-modal-icon').value = '🌱';
  document.getElementById('crop-modal-sow-method').value = 'indoor';
  document.getElementById('crop-modal-dtm').value = '65';
  document.getElementById('crop-modal-indoor-weeks').value = '6';
  document.getElementById('crop-modal-transplant-weeks').value = '2';
  document.getElementById('crop-modal-spacing').value = '12';
  document.getElementById('crop-modal-frost-hardy').value = 'tender';
  updateCropModalOffsets();

  document.getElementById('add-crop-modal').classList.add('active');
}

function updateCropModalOffsets() {
  const method = document.getElementById('crop-modal-sow-method').value;
  const groupIndoor = document.getElementById('group-indoor-weeks');
  const groupTransplant = document.getElementById('group-transplant-weeks');

  if (method === 'direct') {
    if (groupIndoor) groupIndoor.style.display = 'none';
    if (groupTransplant) {
      groupTransplant.querySelector('.form-label').textContent = 'Weeks Direct Sow (Relative to Frost)';
    }
  } else {
    if (groupIndoor) groupIndoor.style.display = 'flex';
    if (groupTransplant) {
      groupTransplant.querySelector('.form-label').textContent = 'Weeks to Plant (After Frost)';
    }
  }
}

function submitAddCrop() {
  const veg = document.getElementById('crop-modal-vegetable').value.trim();
  if (!veg) {
    showToast('Please enter a vegetable name.', 'error');
    return;
  }

  const cat = document.getElementById('crop-modal-category').value.trim() || veg;
  const varName = document.getElementById('crop-modal-variety').value.trim();
  const icon = document.getElementById('crop-modal-icon').value.trim() || '🌱';
  const sowMethod = document.getElementById('crop-modal-sow-method').value;
  const dtm = Number(document.getElementById('crop-modal-dtm').value) || 60;
  const indoorWeeks = Number(document.getElementById('crop-modal-indoor-weeks').value) || 6;
  const transplantWeeks = Number(document.getElementById('crop-modal-transplant-weeks').value) || 0;
  const spacing = Number(document.getElementById('crop-modal-spacing').value) || 12;
  const isFrostHardy = document.getElementById('crop-modal-frost-hardy').value === 'hardy';

  const newCrop = {
    id: 'custom_' + Date.now(),
    category: cat,
    vegetable: veg,
    variety: varName,
    pos_description: varName || veg,
    name: varName ? `${cat} - ${veg} (${varName})` : `${cat} - ${veg}`,
    short_name: varName ? `${veg} (${varName})` : veg,
    sow_method: sowMethod,
    indoor_weeks: sowMethod === 'direct' ? null : indoorWeeks,
    transplant_weeks: sowMethod === 'direct' ? null : transplantWeeks,
    direct_sow_weeks: sowMethod === 'direct' ? transplantWeeks : null,
    dtm: dtm,
    spacing_in: spacing,
    row_spacing_in: spacing * 1.5,
    frost_hardy: isFrostHardy,
    icon: icon,
    is_custom: true
  };

  State.crops.unshift(newCrop);
  saveLocal();
  closeModals();
  showToast(`Added ${newCrop.name} to catalog!`, 'success');
  renderCatalogView();
}


// --- Timeline View Switcher & Mobile Milestone Cards ---
function setTimelineViewMode(mode) {
  State.timelineViewMode = mode;
  const btnCards = document.getElementById('btn-timeline-cards');
  const btnGantt = document.getElementById('btn-timeline-gantt');
  const containerCards = document.getElementById('timeline-cards-container');
  const containerGantt = document.getElementById('timeline-gantt-container');

  if (btnCards) btnCards.classList.toggle('active', mode === 'cards');
  if (btnGantt) btnGantt.classList.toggle('active', mode === 'gantt');

  if (containerCards) containerCards.style.display = mode === 'cards' ? 'flex' : 'none';
  if (containerGantt) containerGantt.style.display = mode === 'gantt' ? 'block' : 'none';

  renderTimelineView();
}

function renderTimelineCards() {
  const container = document.getElementById('timeline-cards-container');
  if (!container) return;
  const sortedPlans = getSortedTimelinePlans();
  if (sortedPlans.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-title">No planting plans yet</div></div>`;
    return;
  }

  container.innerHTML = sortedPlans.map(plan => {
    const indoorText = plan.indoor_sow_date || 'N/A (Direct)';
    const plantText = plan.plant_date || 'Flexible';
    const harvestText = plan.harvest_start ? `${plan.harvest_start} ➔ ${plan.harvest_end || ''}` : 'Est. +60d';

    return `
      <div class="schedule-card">
        <div class="schedule-card-header">
          <div>
            <div class="schedule-crop-title">${plan.icon || '🌱'} ${plan.name}</div>
            <div class="schedule-variety-sub">
              ${plan.variety ? 'Variety: ' + plan.variety + ' • ' : ''}Bed: <strong>${plan.row_bed || 'Unassigned'}</strong>
            </div>
          </div>
          <span class="badge ${plan.status === 'in_ground' ? 'badge-plant' : (plan.status === 'harvested' ? 'badge-harvest' : 'badge-indoor')}">
            ${plan.status.toUpperCase()}
          </span>
        </div>

        <div class="mini-progress-track">
          <div class="progress-phase-indoor" title="Indoor Seed Phase"></div>
          <div class="progress-phase-ground" title="In-Ground Growth"></div>
          <div class="progress-phase-harvest" title="Harvest Window"></div>
        </div>

        <div class="milestone-stepper">
          <div class="milestone-node">
            <span class="milestone-label indoor">🟣 1. Indoor Sow</span>
            <span class="milestone-date">${indoorText}</span>
          </div>
          <div class="milestone-node">
            <span class="milestone-label plant">🌱 2. In-Ground</span>
            <span class="milestone-date">${plantText}</span>
          </div>
          <div class="milestone-node">
            <span class="milestone-label harvest">🧺 3. Harvest</span>
            <span class="milestone-date">${harvestText}</span>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2px;">
          <button class="btn btn-primary btn-sm" onclick="openQuickLogModal('${plan.id}', '${plan.status === 'sowed' ? 'plant' : (plan.status === 'in_ground' ? 'harvest' : 'sow')}')">
            ✓ Log Action
          </button>
        </div>
      </div>
    `;
  }).join('');
}


function getSortedTimelinePlans() {
  let plans = [...State.plans];

  // Category filter
  if (State.filters.timelineCategory && State.filters.timelineCategory !== 'all') {
    plans = plans.filter(p => p.category.toLowerCase() === State.filters.timelineCategory.toLowerCase());
  }

  // Sort
  const sortBy = State.filters.timelineSort || 'start_date';
  plans.sort((a, b) => {
    if (sortBy === 'start_date') {
      const dateA = a.indoor_sow_date || a.plant_date || '9999-12-31';
      const dateB = b.indoor_sow_date || b.plant_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    } else if (sortBy === 'harvest_date') {
      const dateA = a.harvest_start || '9999-12-31';
      const dateB = b.harvest_start || '9999-12-31';
      return dateA.localeCompare(dateB);
    } else if (sortBy === 'crop_name') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (sortBy === 'bed') {
      return (a.row_bed || 'zzz').localeCompare(b.row_bed || 'zzz');
    }
    return 0;
  });

  return plans;
}


// --- History Quick Filters & Advanced Panel Handlers ---
function setHistoryYearFilter(year) {
  State.filters.historyYear = year;
  const advYear = document.getElementById('adv-year-filter');
  if (advYear) advYear.value = year;

  // Update pills active class
  document.querySelectorAll('#history-year-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.year === year);
  });

  renderHistoryView();
}

function setHistoryTypeFilter(type) {
  State.filters.historyType = type;

  // Update pills active class
  document.querySelectorAll('#history-type-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  renderHistoryView();
}

function toggleAdvancedHistoryFilter() {
  const panel = document.getElementById('history-advanced-panel');
  const btn = document.getElementById('btn-toggle-advanced-filter');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('active', isOpen);
}

function applyAdvancedHistoryFilter() {
  const catVal = document.getElementById('adv-category-filter').value;
  const yearVal = document.getElementById('adv-year-filter').value;
  const bedVal = document.getElementById('adv-bed-filter').value.trim();
  const fromVal = document.getElementById('adv-date-from').value;
  const toVal = document.getElementById('adv-date-to').value;

  State.filters.historyCategory = catVal;
  State.filters.historyYear = yearVal;
  State.filters.historyBed = bedVal;
  State.filters.historyDateFrom = fromVal;
  State.filters.historyDateTo = toVal;

  // Sync year pills
  document.querySelectorAll('#history-year-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.year === yearVal);
  });

  renderHistoryView();
}

function resetHistoryFilters() {
  State.filters.historyQuery = '';
  State.filters.historyType = 'all';
  State.filters.historyYear = 'all';
  State.filters.historyCategory = 'all';
  State.filters.historyBed = '';
  State.filters.historyDateFrom = '';
  State.filters.historyDateTo = '';

  const searchInput = document.getElementById('history-search-input');
  if (searchInput) searchInput.value = '';
  const advCat = document.getElementById('adv-category-filter');
  if (advCat) advCat.value = 'all';
  const advYear = document.getElementById('adv-year-filter');
  if (advYear) advYear.value = 'all';
  const advBed = document.getElementById('adv-bed-filter');
  if (advBed) advBed.value = '';
  const advFrom = document.getElementById('adv-date-from');
  if (advFrom) advFrom.value = '';
  const advTo = document.getElementById('adv-date-to');
  if (advTo) advTo.value = '';

  setHistoryYearFilter('all');
  setHistoryTypeFilter('all');
}
