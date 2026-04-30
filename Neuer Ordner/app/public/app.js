const state = {
  settings: null,
  availability: {},
  schedule: null,
  selectedMonth: nextMonthValue()
};

const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function nextMonthValue() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 1);
  return date.toISOString().slice(0, 7);
}

function datesInMonth(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  const dates = [];
  while (date.getMonth() === monthIndex - 1) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return `${weekdays[date.getDay()]}, ${date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

function emptyDay() {
  return { status: "", from: "", to: "", note: "" };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Aktion fehlgeschlagen.");
  }
  return data;
}

async function loadState() {
  const data = await api(`/api/state?month=${state.selectedMonth}`);
  state.settings = data.settings;
  state.availability = data.availability;
  state.schedule = data.schedule;
  renderAll();
}

function renderAll() {
  $("#appTitle").textContent = state.settings.businessName;
  $("#monthInput").value = state.selectedMonth;
  renderEmployeeSelect();
  renderAvailability();
  renderPublished();
  renderSettings();
  renderPlanner();
}

function renderEmployeeSelect() {
  const select = $("#employeeSelect");
  const current = select.value;
  select.innerHTML = state.settings.employees
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  if (current && state.settings.employees.includes(current)) {
    select.value = current;
  }
}

function renderAvailability() {
  const employee = $("#employeeSelect").value || state.settings.employees[0];
  const employeeDays = state.availability[employee] || {};
  $("#availabilityGrid").innerHTML = datesInMonth(state.selectedMonth).map((date) => {
    const key = isoDate(date);
    const day = { ...emptyDay(), ...(employeeDays[key] || {}) };
    return `
      <article class="day-card" data-date="${key}">
        <div class="day-title">
          <span>${date.getDate()}.</span>
          <span class="weekday">${weekdays[date.getDay()]}</span>
        </div>
        <div class="status-row">
          <button data-status="yes" class="${day.status === "yes" ? "active" : ""}">Kann</button>
          <button data-status="no" class="${day.status === "no" ? "active" : ""}">Kann nicht</button>
        </div>
        <div class="time-row">
          <input type="time" data-field="from" value="${escapeHtml(day.from)}" title="Von">
          <input type="time" data-field="to" value="${escapeHtml(day.to)}" title="Bis">
        </div>
        <input type="text" data-field="note" value="${escapeHtml(day.note)}" placeholder="Notiz, z.B. nur frueh">
      </article>
    `;
  }).join("");
}

function collectAvailability() {
  const days = {};
  $$("#availabilityGrid .day-card").forEach((card) => {
    const active = card.querySelector(".status-row button.active");
    const day = {
      status: active ? active.dataset.status : "",
      from: card.querySelector('[data-field="from"]').value,
      to: card.querySelector('[data-field="to"]').value,
      note: card.querySelector('[data-field="note"]').value.trim()
    };
    if (day.status || day.from || day.to || day.note) {
      days[card.dataset.date] = day;
    }
  });
  return days;
}

function renderPublished() {
  const schedule = state.schedule;
  const container = $("#publishedSchedule");
  if (!schedule?.published) {
    $("#publishedState").textContent = "Fuer diesen Monat wurde noch kein Dienstplan veroeffentlicht.";
    container.innerHTML = "";
    return;
  }
  $("#publishedState").textContent = `Aktualisiert: ${new Date(schedule.updatedAt).toLocaleString("de-DE")}`;
  container.innerHTML = datesInMonth(state.selectedMonth).map((date) => {
    const key = isoDate(date);
    const assignments = schedule.days[key] || {};
    return `
      <article class="schedule-day">
        <div class="day-header"><span>${formatDate(key)}</span></div>
        <div class="position-grid">
          ${state.settings.positions.map((position) => `
            <div class="position-cell">
              <span class="position-name">${escapeHtml(position)}</span>
              <span class="assignment">${escapeHtml(assignments[position] || "-")}</span>
              ${assignments[`${position}__note`] ? `<span class="hint">${escapeHtml(assignments[`${position}__note`])}</span>` : ""}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderSettings() {
  $("#businessName").value = state.settings.businessName;
  $("#employeesText").value = state.settings.employees.join("\n");
  $("#positionsText").value = state.settings.positions.join("\n");
}

function renderPlanner() {
  const scheduleDays = state.schedule?.days || {};
  $("#planner").innerHTML = datesInMonth(state.selectedMonth).map((date) => {
    const key = isoDate(date);
    const daySchedule = scheduleDays[key] || {};
    return `
      <article class="planner-day" data-date="${key}">
        <div class="day-header">
          <span>${formatDate(key)}</span>
          <span>${availabilitySummary(key)}</span>
        </div>
        <div class="position-grid">
          ${state.settings.positions.map((position) => `
            <label class="position-cell">
              <span class="position-name">${escapeHtml(position)}</span>
              <select data-position="${escapeHtml(position)}">
                <option value="">Nicht besetzt</option>
                ${state.settings.employees.map((employee) => `
                  <option value="${escapeHtml(employee)}" ${daySchedule[position] === employee ? "selected" : ""}>
                    ${escapeHtml(employee)}${employeeHint(employee, key)}
                  </option>
                `).join("")}
              </select>
              <input type="text" data-note="${escapeHtml(position)}" value="${escapeHtml(daySchedule[`${position}__note`] || "")}" placeholder="Zeit/Notiz">
            </label>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function availabilitySummary(dateKey) {
  const yes = [];
  const no = [];
  for (const [employee, days] of Object.entries(state.availability)) {
    if (days[dateKey]?.status === "yes") yes.push(employee);
    if (days[dateKey]?.status === "no") no.push(employee);
  }
  const yesText = yes.length ? `Kann: ${yes.join(", ")}` : "Keine Zusagen";
  const noText = no.length ? ` | Kann nicht: ${no.join(", ")}` : "";
  return yesText + noText;
}

function employeeHint(employee, dateKey) {
  const day = state.availability[employee]?.[dateKey];
  if (!day) return "";
  if (day.status === "yes") {
    const time = day.from || day.to ? ` ${day.from || "?"}-${day.to || "?"}` : "";
    return ` (kann${time})`;
  }
  if (day.status === "no") return " (kann nicht)";
  return "";
}

function collectSchedule() {
  const days = {};
  $$("#planner .planner-day").forEach((dayEl) => {
    const dateKey = dayEl.dataset.date;
    const assignments = {};
    dayEl.querySelectorAll("select[data-position]").forEach((select) => {
      if (select.value) assignments[select.dataset.position] = select.value;
    });
    dayEl.querySelectorAll("input[data-note]").forEach((input) => {
      if (input.value.trim()) assignments[`${input.dataset.note}__note`] = input.value.trim();
    });
    days[dateKey] = assignments;
  });
  return days;
}

function setMonth(offset) {
  const [year, month] = state.selectedMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  state.selectedMonth = date.toISOString().slice(0, 7);
  loadState().catch(showError);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function showError(error) {
  showToast(error.message || String(error));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindEvents() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.tab}`).classList.add("active");
    });
  });

  $("#prevMonth").addEventListener("click", () => setMonth(-1));
  $("#nextMonth").addEventListener("click", () => setMonth(1));
  $("#monthInput").addEventListener("change", (event) => {
    state.selectedMonth = event.target.value;
    loadState().catch(showError);
  });

  $("#employeeSelect").addEventListener("change", renderAvailability);

  $("#availabilityGrid").addEventListener("click", (event) => {
    if (!event.target.matches("button[data-status]")) return;
    const row = event.target.closest(".status-row");
    row.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
    event.target.classList.add("active");
  });

  $("#saveAvailability").addEventListener("click", async () => {
    const newName = $("#newEmployee").value.trim();
    const employee = newName || $("#employeeSelect").value;
    await api("/api/availability", {
      method: "POST",
      body: JSON.stringify({ month: state.selectedMonth, employee, days: collectAvailability() })
    });
    $("#newEmployee").value = "";
    await loadState();
    $("#employeeSelect").value = employee;
    showToast("Verfuegbarkeit gespeichert.");
  });

  $("#saveDraft").addEventListener("click", () => saveSchedule(false));
  $("#publishSchedule").addEventListener("click", () => saveSchedule(true));

  $("#saveSettings").addEventListener("click", async () => {
    await api("/api/settings", {
      method: "POST",
      headers: { "x-admin-pin": $("#adminPin").value },
      body: JSON.stringify({
        businessName: $("#businessName").value,
        adminPin: $("#newPin").value,
        employees: $("#employeesText").value.split("\n"),
        positions: $("#positionsText").value.split("\n")
      })
    });
    $("#newPin").value = "";
    await loadState();
    showToast("Einstellungen gespeichert.");
  });

  $("#printSchedule").addEventListener("click", () => window.print());
}

async function saveSchedule(published) {
  await api("/api/schedule", {
    method: "POST",
    headers: { "x-admin-pin": $("#adminPin").value },
    body: JSON.stringify({ month: state.selectedMonth, published, days: collectSchedule() })
  });
  await loadState();
  showToast(published ? "Dienstplan veroeffentlicht." : "Entwurf gespeichert.");
}

bindEvents();
loadState().catch(showError);
