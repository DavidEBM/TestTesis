import {
  addDoc,
  auth,
  browserLocalPersistence,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setPersistence,
  signOut,
  updateDoc,
  updateProfile,
} from "../firebase/firebase-config.js";

const defaultWidgetOrder = [
  "overview",
  "alerts",
  "agenda",
  "status",
  "form",
  "patients",
  "labs",
  "critical",
  "location",
  "notes",
];

const state = {
  patients: [],
  selectedPatientId: null,
  layoutOrder: [...defaultWidgetOrder],
  draftLayoutOrder: null,
  persistedLayoutOrder: [...defaultWidgetOrder],
  widgetSizes: {},
  draftWidgetSizes: {},
  persistedWidgetSizes: {},
  layoutEditMode: false,
  draggedWidgetKey: null,
  activeResizeWidgetKey: null,
  theme: "light",
};

const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");
const leftToggle = document.getElementById("leftToggle");
const rightToggle = document.getElementById("rightToggle");
const mainMenu = document.getElementById("mainMenu");
const userMenu = document.getElementById("userMenu");
const logoutButton = document.getElementById("logoutButton");
const themeToggleButton = document.getElementById("themeToggleButton");
const doctorPhotoInput = document.getElementById("doctorPhotoInput");
const doctorPhoto = document.getElementById("doctorPhoto");
const doctorMenuPhoto = document.getElementById("doctorMenuPhoto");
const doctorChipName = document.getElementById("doctorChipName");
const doctorChipRole = document.getElementById("doctorChipRole");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userRole = document.getElementById("userRole");
const doctorPanelName = document.getElementById("doctorPanelName");
const doctorPanelPatients = document.getElementById("doctorPanelPatients");
const doctorPanelRisk = document.getElementById("doctorPanelRisk");
const statusBanner = document.getElementById("statusBanner");
const dashboardGrid = document.getElementById("dashboardGrid");
const contextMenu = document.getElementById("contextMenu");
const layoutControls = document.getElementById("layoutControls");
const cancelLayoutButton = document.getElementById("cancelLayoutButton");
const saveLayoutButton = document.getElementById("saveLayoutButton");
const patientOverview = document.getElementById("patientOverview");
const alertsWidget = document.getElementById("alertsWidget");
const agendaWidget = document.getElementById("agendaWidget");
const statusWidget = document.getElementById("statusWidget");
const labsWidget = document.getElementById("labsWidget");
const criticalWidget = document.getElementById("criticalWidget");
const locationWidget = document.getElementById("locationWidget");
const patientsList = document.getElementById("patientsList");
const patientsCounter = document.getElementById("patientsCounter");
const patientForm = document.getElementById("patientForm");
const savePatientButton = document.getElementById("savePatientButton");
const importPatientsInput = document.getElementById("importPatientsInput");
const exportSelectedButton = document.getElementById("exportSelectedButton");
const exportAllButton = document.getElementById("exportAllButton");
const patientNotesInput = document.getElementById("patientNotesInput");
const saveNotesButton = document.getElementById("saveNotesButton");
const notesTarget = document.getElementById("notesTarget");

const widgetElements = [...dashboardGrid.querySelectorAll("[data-widget-key]")];
const resizeObserver = new ResizeObserver((entries) => {
  if (!state.layoutEditMode) return;

  entries.forEach((entry) => {
    const widget = entry.target;
    const key = widget.dataset.widgetKey;
    state.draftWidgetSizes[key] = {
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    };
  });
});

function setStatus(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.dataset.state = type;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.readAsDataURL(file);
  });
}

function createAvatarDataUri(label, colorA = "#f2c8d7", colorB = "#c4d7f2") {
  const safeLabel = (label || "?").slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="30" fill="url(#g)" />
      <text x="50%" y="55%" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" fill="#4f6078">${safeLabel}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\n\s+/g, "").trim())}`;
}

function getStatusClass(status = "Estable") {
  const normalized = status.toLowerCase();

  if (normalized === "critico") {
    return "critical";
  }

  if (normalized === "riesgo") {
    return "warning";
  }

  return "stable";
}

function getRiskScore(patient) {
  let score = 0;

  if (patient.status === "Critico") score += 4;
  else if (patient.status === "Riesgo") score += 2;

  if (patient.glucose >= 200) score += 2;
  if (patient.pulse >= 100) score += 1;
  if (patient.bloodPressureSystolic >= 150) score += 1;

  return score;
}

function normalizePatient(patientDoc) {
  const data = patientDoc.data();

  return {
    id: patientDoc.id,
    name: data.name || "Paciente sin nombre",
    documentId: data.documentId || "Sin documento",
    age: Number(data.age || 0),
    condition: data.condition || "Sin condicion",
    status: data.status || "Estable",
    notes: data.notes || "",
    photoUrl: data.photoUrl || "",
    ward: data.ward || "Area general",
    room: data.room || "Pendiente",
    appointmentTime: data.appointmentTime || "",
    monitoringTime: data.monitoringTime || "",
    labTime: data.labTime || "",
    bloodPressureSystolic: Number(data.bloodPressureSystolic || 0),
    bloodPressureDiastolic: Number(data.bloodPressureDiastolic || 0),
    pulse: Number(data.pulse || 0),
    glucose: Number(data.glucose || 0),
    hemoglobin: Number(data.hemoglobin || 0),
    creatinine: Number(data.creatinine || 0),
    createdBy: data.createdBy || "",
    statusClass: getStatusClass(data.status || "Estable"),
  };
}

function getSelectedPatient() {
  return state.patients.find((patient) => patient.id === state.selectedPatientId) || null;
}

function reorderList(list, draggedKey, targetKey) {
  const next = [...list];
  const draggedIndex = next.indexOf(draggedKey);
  const targetIndex = next.indexOf(targetKey);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return next;
  }

  next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedKey);
  return next;
}

function applyWidgetOrder(order) {
  widgetElements.forEach((widget) => {
    const key = widget.dataset.widgetKey;
    const index = order.indexOf(key);
    widget.style.order = index === -1 ? String(defaultWidgetOrder.length + 1) : String(index + 1);
  });
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", state.theme === "dark");
  themeToggleButton.textContent = state.theme === "dark" ? "Modo claro" : "Modo oscuro";
}

function applyWidgetSizes(sizes) {
  widgetElements.forEach((widget) => {
    const key = widget.dataset.widgetKey;
    const size = sizes[key];

    if (size?.width) {
      widget.style.setProperty("--widget-width", `${size.width}px`);
    } else {
      widget.style.removeProperty("--widget-width");
    }

    if (size?.height) {
      widget.style.setProperty("--widget-height", `${size.height}px`);
    } else {
      widget.style.removeProperty("--widget-height");
    }
  });
}

function showContextMenu(x, y) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add("visible");
  contextMenu.setAttribute("aria-hidden", "false");
}

function hideContextMenu() {
  contextMenu.classList.remove("visible");
  contextMenu.setAttribute("aria-hidden", "true");
}

function setLayoutEditMode(active) {
  state.layoutEditMode = active;
  if (!active) {
    state.activeResizeWidgetKey = null;
  }
  dashboardGrid.classList.toggle("layout-edit-mode", active);
  layoutControls.hidden = !active;

  widgetElements.forEach((widget) => {
    widget.setAttribute("draggable", active ? "true" : "false");
    widget.classList.toggle("movable", active);
    widget.classList.toggle("resize-target", active && widget.dataset.widgetKey === state.activeResizeWidgetKey);
  });
}

async function loadUserLayout(userId) {
  try {
    const layoutSnapshot = await getDoc(doc(db, "userLayouts", userId));
    const layoutData = layoutSnapshot.exists() ? layoutSnapshot.data() : null;
    const widgetOrder = layoutData?.widgetOrder || null;
    const widgetSizes = layoutData?.widgetSizes || {};
    const theme = layoutData?.theme || localStorage.getItem("foxcat-theme") || "light";

    if (Array.isArray(widgetOrder) && widgetOrder.length) {
      state.layoutOrder = [...widgetOrder];
      state.persistedLayoutOrder = [...widgetOrder];
      state.widgetSizes = { ...widgetSizes };
      state.persistedWidgetSizes = { ...widgetSizes };
      applyWidgetOrder(widgetOrder);
      applyWidgetSizes(widgetSizes);
    } else {
      state.layoutOrder = [...defaultWidgetOrder];
      state.persistedLayoutOrder = [...defaultWidgetOrder];
      applyWidgetOrder(defaultWidgetOrder);
    }

    applyTheme(theme);
    return;
  } catch (error) {
    setStatus(`No se pudo cargar el layout del usuario: ${error.message}`, "error");
  }

  state.layoutOrder = [...defaultWidgetOrder];
  state.persistedLayoutOrder = [...defaultWidgetOrder];
  state.widgetSizes = {};
  state.persistedWidgetSizes = {};
  applyWidgetOrder(defaultWidgetOrder);
  applyTheme(localStorage.getItem("foxcat-theme") || "light");
}

async function saveUserLayout() {
  if (!auth.currentUser) return;

  await setDoc(doc(db, "userLayouts", auth.currentUser.uid), {
    widgetOrder: state.layoutOrder,
    widgetSizes: state.widgetSizes,
    theme: state.theme,
    updatedAt: serverTimestamp(),
  });
}

function sanitizePatientPayload(raw) {
  return {
    name: String(raw.name || "").trim(),
    documentId: String(raw.documentId || "").trim(),
    age: Number(raw.age || 0),
    condition: String(raw.condition || "").trim(),
    status: String(raw.status || "Estable").trim() || "Estable",
    photoUrl: String(raw.photoUrl || "").trim(),
    bloodPressureSystolic: Number(raw.bloodPressureSystolic || 0),
    bloodPressureDiastolic: Number(raw.bloodPressureDiastolic || 0),
    pulse: Number(raw.pulse || 0),
    glucose: Number(raw.glucose || 0),
    hemoglobin: Number(raw.hemoglobin || 0),
    creatinine: Number(raw.creatinine || 0),
    ward: String(raw.ward || "").trim(),
    room: String(raw.room || "").trim(),
    appointmentTime: String(raw.appointmentTime || "").trim(),
    monitoringTime: String(raw.monitoringTime || "").trim(),
    labTime: String(raw.labTime || "").trim(),
    notes: String(raw.notes || "").trim(),
  };
}

function downloadWorkbook(workbook, filename) {
  if (!window.XLSX) {
    setStatus("La libreria de Excel no se cargo correctamente.", "error");
    return;
  }

  window.XLSX.writeFile(workbook, filename);
}

function exportSelectedPatient() {
  const patient = getSelectedPatient();

  if (!patient) {
    setStatus("Selecciona un paciente para exportar su historia clinica.", "error");
    return;
  }

  const workbook = window.XLSX.utils.book_new();
  const rows = [
    {
      Nombre: patient.name,
      Documento: patient.documentId,
      Edad: patient.age,
      Condicion: patient.condition,
      Estado: patient.status,
      Area: patient.ward,
      Habitacion: patient.room,
      Presion: `${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic}`,
      Pulso: patient.pulse,
      Glucosa: patient.glucose,
      Hemoglobina: patient.hemoglobin,
      Creatinina: patient.creatinine,
      Consulta: patient.appointmentTime,
      Monitoreo: patient.monitoringTime,
      Laboratorio: patient.labTime,
      Notas: patient.notes,
      Foto: patient.photoUrl,
    },
  ];

  const sheet = window.XLSX.utils.json_to_sheet(rows);
  window.XLSX.utils.book_append_sheet(workbook, sheet, "HistoriaClinica");
  downloadWorkbook(workbook, `paciente-${patient.documentId || patient.id}.xlsx`);
}

function exportAllPatients() {
  if (!state.patients.length) {
    setStatus("No hay pacientes para exportar.", "error");
    return;
  }

  const workbook = window.XLSX.utils.book_new();
  const rows = state.patients.map((patient) => ({
    Nombre: patient.name,
    Documento: patient.documentId,
    Edad: patient.age,
    Condicion: patient.condition,
    Estado: patient.status,
    Area: patient.ward,
    Habitacion: patient.room,
    PresionSistolica: patient.bloodPressureSystolic,
    PresionDiastolica: patient.bloodPressureDiastolic,
    Pulso: patient.pulse,
    Glucosa: patient.glucose,
    Hemoglobina: patient.hemoglobin,
    Creatinina: patient.creatinine,
    Consulta: patient.appointmentTime,
    Monitoreo: patient.monitoringTime,
    Laboratorio: patient.labTime,
    Notas: patient.notes,
    Foto: patient.photoUrl,
  }));

  const sheet = window.XLSX.utils.json_to_sheet(rows);
  window.XLSX.utils.book_append_sheet(workbook, sheet, "Pacientes");
  downloadWorkbook(workbook, "pacientes-foxcat.xlsx");
}

function parseSqlPatients(sqlText) {
  const inserts = [...sqlText.matchAll(/insert\s+into\s+patients\s*\(([^)]+)\)\s*values\s*(.+?);/gis)];
  const patients = [];

  inserts.forEach((insertMatch) => {
    const columns = insertMatch[1].split(",").map((item) => item.trim().replace(/[`"'[\]]/g, ""));
    const valuesGroup = insertMatch[2];
    const tuples = valuesGroup.match(/\(([^()]*)\)/g) || [];

    tuples.forEach((tuple) => {
      const values = tuple
        .slice(1, -1)
        .split(/,(?=(?:[^']*'[^']*')*[^']*$)/)
        .map((value) => value.trim().replace(/^'|'$/g, ""));
      const row = {};

      columns.forEach((column, index) => {
        row[column] = values[index] ?? "";
      });

      patients.push(sanitizePatientPayload(row));
    });
  });

  return patients.filter((patient) => patient.name && patient.documentId);
}

async function importPatientsFromFile(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    let importedPatients = [];
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".sql")) {
      const sqlText = await file.text();
      importedPatients = parseSqlPatients(sqlText);
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      importedPatients = rows.map(sanitizePatientPayload).filter((patient) => patient.name && patient.documentId);
    }

    if (!importedPatients.length) {
      setStatus("No se encontraron pacientes validos para importar.", "error");
      return;
    }

    for (const patient of importedPatients) {
      await addDoc(collection(db, "patients"), {
        ...patient,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || "",
      });
    }

    setStatus(`Se importaron ${importedPatients.length} pacientes correctamente.`, "success");
  } catch (error) {
    setStatus(`No se pudo importar el archivo: ${error.message}`, "error");
  } finally {
    importPatientsInput.value = "";
  }
}

function buildAlerts(patient) {
  if (!patient) {
    return [{ tone: "soft", text: "Selecciona un paciente para calcular alertas." }];
  }

  const alerts = [];

  if (patient.status === "Critico") {
    alerts.push({ tone: "critical", text: "Estado critico. Priorizar valoracion inmediata." });
  }
  if (patient.glucose >= 200) {
    alerts.push({ tone: "warning", text: `Glucosa elevada: ${patient.glucose} mg/dL.` });
  }
  if (patient.pulse >= 100) {
    alerts.push({ tone: "warning", text: `Pulso acelerado: ${patient.pulse} bpm.` });
  }
  if (patient.bloodPressureSystolic >= 150 || patient.bloodPressureDiastolic >= 95) {
    alerts.push({
      tone: "warning",
      text: `Presion alta: ${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic}.`,
    });
  }
  if (!alerts.length) {
    alerts.push({ tone: "success", text: "Paciente estable. No hay alertas mayores activas." });
  }

  return alerts;
}

function buildAgenda(patient) {
  if (!patient) return ["Sin agenda porque no hay un paciente seleccionado."];

  const agenda = [];
  if (patient.appointmentTime) agenda.push(`${patient.appointmentTime} - Consulta de seguimiento.`);
  if (patient.monitoringTime) agenda.push(`${patient.monitoringTime} - Monitoreo de signos vitales.`);
  if (patient.labTime) agenda.push(`${patient.labTime} - Toma o revision de laboratorio.`);
  if (!agenda.length) agenda.push("No hay horarios cargados para este paciente.");
  return agenda;
}

function buildStatusLines(patient) {
  const riskPatients = state.patients.filter((item) => getRiskScore(item) >= 3).length;

  return [
    `${state.patients.length} pacientes cargados en el tablero.`,
    `${riskPatients} pacientes con prioridad alta.`,
    patient ? `Paciente enfocado: ${patient.name} (${patient.status}).` : "Aun no se ha seleccionado un paciente.",
    state.layoutEditMode
      ? "Modo edicion activo. Arrastra widgets y confirma con el boton verde."
      : "Clic derecho dentro del dashboard para abrir configuracion.",
  ];
}

function buildLabs(patient) {
  if (!patient) {
    return [
      { label: "Glucosa", value: "Sin dato" },
      { label: "Hemoglobina", value: "Sin dato" },
      { label: "Creatinina", value: "Sin dato" },
      { label: "Pulso", value: "Sin dato" },
    ];
  }

  return [
    { label: "Glucosa", value: patient.glucose ? `${patient.glucose} mg/dL` : "No registrada" },
    { label: "Hemoglobina", value: patient.hemoglobin ? `${patient.hemoglobin} g/dL` : "No registrada" },
    { label: "Creatinina", value: patient.creatinine ? `${patient.creatinine} mg/dL` : "No registrada" },
    { label: "Pulso", value: patient.pulse ? `${patient.pulse} bpm` : "No registrado" },
  ];
}

function renderStackList(container, items, variant = "plain") {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No hay datos disponibles.</div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      if (variant === "alerts") return `<div class="alert-card tone-${item.tone}">${item.text}</div>`;
      if (variant === "labs") {
        return `<div class="info-row"><span>${item.label}</span><strong>${item.value}</strong></div>`;
      }
      return `<div class="info-row"><span>${item}</span></div>`;
    })
    .join("");
}

function renderPatientOverview(patient) {
  if (!patient) {
    patientOverview.innerHTML = `
      <div class="overview-empty">
        <h3>No hay paciente seleccionado</h3>
        <p>Registra o selecciona un paciente desde la lista para activar todo el dashboard.</p>
      </div>
    `;
    return;
  }

  const photo = patient.photoUrl || createAvatarDataUri(patient.name, "#f8d8e4", "#d6e7ff");

  patientOverview.innerHTML = `
    <div class="overview-layout">
      <div class="patient-hero">
        <img src="${photo}" alt="Foto de ${patient.name}" class="patient-hero-photo">
        <div>
          <span class="eyebrow">Paciente seleccionado</span>
          <h3>${patient.name}</h3>
          <p>${patient.condition}</p>
          <div class="soft-pill-row">
            <span class="soft-pill">ID ${patient.documentId}</span>
            <span class="soft-pill">Edad ${patient.age}</span>
            <span class="soft-pill status-${patient.statusClass}">${patient.status}</span>
          </div>
        </div>
      </div>
      <div class="overview-vitals">
        <div class="vital-card"><span>Presion</span><strong>${patient.bloodPressureSystolic || "--"} / ${patient.bloodPressureDiastolic || "--"}</strong></div>
        <div class="vital-card"><span>Pulso</span><strong>${patient.pulse || "--"} bpm</strong></div>
        <div class="vital-card"><span>Glucosa</span><strong>${patient.glucose || "--"} mg/dL</strong></div>
        <div class="vital-card"><span>Ubicacion</span><strong>${patient.ward} / ${patient.room}</strong></div>
      </div>
    </div>
  `;
}

function renderCriticalPatients() {
  const criticalPatients = [...state.patients]
    .sort((a, b) => getRiskScore(b) - getRiskScore(a))
    .slice(0, 4)
    .map((patient) => `${patient.name} - ${patient.status} - Riesgo ${getRiskScore(patient)}`);

  renderStackList(criticalWidget, criticalPatients);
}

function renderLocation(patient) {
  if (!patient) {
    locationWidget.innerHTML = `<div class="empty-state">Sin ubicacion disponible.</div>`;
    return;
  }

  locationWidget.innerHTML = `
    <div class="location-block">
      <div class="location-marker"></div>
      <div>
        <strong>${patient.ward}</strong>
        <p>Habitacion / cama: ${patient.room}</p>
      </div>
    </div>
  `;
}

function renderPatients() {
  if (!state.patients.length) {
    patientsList.innerHTML = `<div class="empty-state">Todavia no hay pacientes registrados.</div>`;
    patientsCounter.textContent = "0 pacientes";
    return;
  }

  patientsCounter.textContent = `${state.patients.length} pacientes`;
  patientsList.innerHTML = state.patients
    .map((patient) => {
      const isSelected = patient.id === state.selectedPatientId;
      const photo = patient.photoUrl || createAvatarDataUri(patient.name, "#fde2eb", "#dae8ff");

      return `
        <article class="patient-card ${isSelected ? "selected" : ""}" data-patient-id="${patient.id}">
          <img src="${photo}" alt="Foto de ${patient.name}" class="patient-card-photo">
          <div class="patient-card-copy">
            <strong>${patient.name}</strong>
            <span>${patient.condition}</span>
            <small>${patient.ward} - ${patient.room}</small>
          </div>
          <div class="patient-card-actions">
            <span class="soft-pill status-${patient.statusClass}">${patient.status}</span>
            <button type="button" class="ghost-button" data-select="${patient.id}">Ver</button>
            <button type="button" class="ghost-button danger" data-delete="${patient.id}">Eliminar</button>
          </div>
        </article>
      `;
    })
    .join("");

  patientsList.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedPatientId = button.dataset.select;
      renderDashboard();
    });
  });

  patientsList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      button.disabled = true;
      setStatus("Eliminando paciente...", "info");

      try {
        await deleteDoc(doc(db, "patients", button.dataset.delete));
        if (state.selectedPatientId === button.dataset.delete) state.selectedPatientId = null;
        setStatus("Paciente eliminado correctamente.", "success");
      } catch (error) {
        button.disabled = false;
        setStatus(error.message, "error");
      }
    });
  });

  patientsList.querySelectorAll("[data-patient-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedPatientId = card.dataset.patientId;
      renderDashboard();
    });
  });
}

function renderDashboard() {
  const patient = getSelectedPatient();

  renderPatientOverview(patient);
  renderPatients();
  renderStackList(alertsWidget, buildAlerts(patient), "alerts");
  renderStackList(agendaWidget, buildAgenda(patient));
  renderStackList(statusWidget, buildStatusLines(patient));
  renderStackList(labsWidget, buildLabs(patient), "labs");
  renderCriticalPatients();
  renderLocation(patient);

  notesTarget.textContent = patient ? patient.name : "Sin paciente";
  patientNotesInput.value = patient ? patient.notes : "";
  patientNotesInput.disabled = !patient;
  saveNotesButton.disabled = !patient;

  doctorPanelPatients.textContent = `Pacientes registrados: ${state.patients.length}`;
  doctorPanelRisk.textContent = `Pacientes en riesgo: ${state.patients.filter((item) => getRiskScore(item) >= 3).length}`;
}

function renderDoctor(user) {
  const name = user.displayName || "Medico sin nombre";
  const photo = user.photoURL || createAvatarDataUri(name, "#f9d6dd", "#dce9ff");

  doctorPhoto.src = photo;
  doctorMenuPhoto.src = photo;
  doctorChipName.textContent = name;
  doctorChipRole.textContent = user.email || "Sesion segura con Firebase";
  userName.textContent = name;
  userEmail.textContent = user.email || "Sin correo";
  userRole.textContent = "Perfil autenticado con foto y preferencias de layout.";
  doctorPanelName.textContent = `Medico: ${name}`;
}

window.toggleMainMenu = function toggleMainMenu() {
  mainMenu.style.display = mainMenu.style.display === "block" ? "none" : "block";
};

window.toggleUserMenu = function toggleUserMenu() {
  userMenu.classList.toggle("visible");
};

leftToggle.addEventListener("click", () => {
  const isOpen = leftPanel.style.left === "0px";
  leftPanel.style.left = isOpen ? "-280px" : "0px";
  leftToggle.style.left = isOpen ? "0px" : "280px";
});

rightToggle.addEventListener("click", () => {
  const isOpen = rightPanel.style.right === "0px";
  rightPanel.style.right = isOpen ? "-280px" : "0px";
  rightToggle.style.right = isOpen ? "0px" : "280px";
});

document.addEventListener("click", (event) => {
  const clickedUserMenu = event.target.closest(".doctor-chip") || event.target.closest(".user-menu");
  const clickedContextMenu = event.target.closest(".context-menu");
  const clickedMainMenu = event.target.closest(".main-menu") || event.target.closest(".menu-icon");

  if (!clickedUserMenu) userMenu.classList.remove("visible");
  if (!clickedContextMenu) hideContextMenu();
  if (!clickedMainMenu) mainMenu.style.display = "none";
});

dashboardGrid.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY);
});

contextMenu.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  hideContextMenu();

  if (action === "select-first") {
    if (state.patients.length) {
      state.selectedPatientId = state.patients[0].id;
      renderDashboard();
      setStatus("Se selecciono el primer paciente disponible.", "success");
    }
    return;
  }

  if (action === "focus-notes") {
    document.querySelector('[data-widget-key="notes"]').scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (action === "edit-layout") {
    state.persistedLayoutOrder = [...state.layoutOrder];
    state.draftLayoutOrder = [...state.layoutOrder];
    state.persistedWidgetSizes = { ...state.widgetSizes };
    state.draftWidgetSizes = { ...state.widgetSizes };
    setLayoutEditMode(true);
    setStatus("Modo de edicion activo. Arrastra widgets y confirma con el boton verde.", "info");
  }
});

widgetElements.forEach((widget) => {
  widget.addEventListener("dblclick", () => {
    if (!state.layoutEditMode) return;

    const key = widget.dataset.widgetKey;
    state.activeResizeWidgetKey = state.activeResizeWidgetKey === key ? null : key;

    widgetElements.forEach((item) => {
      item.classList.toggle("resize-target", item.dataset.widgetKey === state.activeResizeWidgetKey);
    });

    if (state.activeResizeWidgetKey) {
      setStatus("Redimensionado activo en este widget. Arrastra la esquina inferior derecha.", "info");
    } else {
      setStatus("Redimensionado desactivado para el widget seleccionado.", "success");
    }
  });

  widget.addEventListener("dragstart", (event) => {
    if (!state.layoutEditMode) {
      event.preventDefault();
      return;
    }

    state.draggedWidgetKey = widget.dataset.widgetKey;
    widget.classList.add("dragging");
  });

  widget.addEventListener("dragend", () => {
    widget.classList.remove("dragging");
    state.draggedWidgetKey = null;
  });

  widget.addEventListener("dragover", (event) => {
    if (!state.layoutEditMode || !state.draggedWidgetKey) return;

    event.preventDefault();
    const targetKey = widget.dataset.widgetKey;
    state.draftLayoutOrder = reorderList(
      state.draftLayoutOrder || state.layoutOrder,
      state.draggedWidgetKey,
      targetKey
    );
    applyWidgetOrder(state.draftLayoutOrder);
  });
});

cancelLayoutButton.addEventListener("click", () => {
  state.layoutOrder = [...state.persistedLayoutOrder];
  state.draftLayoutOrder = null;
  state.widgetSizes = { ...state.persistedWidgetSizes };
  state.draftWidgetSizes = {};
  state.activeResizeWidgetKey = null;
  applyWidgetOrder(state.layoutOrder);
  applyWidgetSizes(state.widgetSizes);
  setLayoutEditMode(false);
  setStatus("Se deshicieron los cambios del layout.", "success");
});

saveLayoutButton.addEventListener("click", async () => {
  try {
    state.layoutOrder = [...(state.draftLayoutOrder || state.layoutOrder)];
    state.persistedLayoutOrder = [...state.layoutOrder];
    state.widgetSizes = { ...(state.draftWidgetSizes || state.widgetSizes) };
    state.persistedWidgetSizes = { ...state.widgetSizes };
    state.draftLayoutOrder = null;
    state.draftWidgetSizes = {};
    state.activeResizeWidgetKey = null;
    applyWidgetOrder(state.layoutOrder);
    applyWidgetSizes(state.widgetSizes);
    await saveUserLayout();
    setLayoutEditMode(false);
    setStatus("Layout guardado correctamente para este medico.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

async function savePatient(event) {
  event.preventDefault();

  const formData = new FormData(patientForm);
  const requiredFields = ["name", "documentId", "age", "condition", "status"];
  const missingField = requiredFields.find((field) => !String(formData.get(field) || "").trim());

  if (missingField) {
    setStatus("Completa todos los campos obligatorios del paciente.", "error");
    return;
  }

  savePatientButton.disabled = true;
  savePatientButton.textContent = "Guardando...";

  try {
    const patientPhotoFile = formData.get("photoFile");
    const patientPhotoUrl =
      patientPhotoFile instanceof File && patientPhotoFile.size > 0
        ? await readFileAsDataUrl(patientPhotoFile)
        : "";

    await addDoc(collection(db, "patients"), {
      ...sanitizePatientPayload({
        name: formData.get("name"),
        documentId: formData.get("documentId"),
        age: formData.get("age"),
        condition: formData.get("condition"),
        status: formData.get("status"),
        photoUrl: patientPhotoUrl,
        bloodPressureSystolic: formData.get("bloodPressureSystolic"),
        bloodPressureDiastolic: formData.get("bloodPressureDiastolic"),
        pulse: formData.get("pulse"),
        glucose: formData.get("glucose"),
        hemoglobin: formData.get("hemoglobin"),
        creatinine: formData.get("creatinine"),
        ward: formData.get("ward"),
        room: formData.get("room"),
        appointmentTime: formData.get("appointmentTime"),
        monitoringTime: formData.get("monitoringTime"),
        labTime: formData.get("labTime"),
        notes: formData.get("notes"),
      }),
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || "",
    });

    patientForm.reset();
    setStatus("Paciente guardado en Firebase con sus datos clinicos.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    savePatientButton.disabled = false;
    savePatientButton.textContent = "Guardar paciente";
  }
}

async function savePatientNotes() {
  const patient = getSelectedPatient();
  if (!patient) {
    setStatus("Selecciona un paciente antes de guardar notas.", "error");
    return;
  }

  saveNotesButton.disabled = true;
  saveNotesButton.textContent = "Guardando...";

  try {
    await updateDoc(doc(db, "patients", patient.id), {
      notes: patientNotesInput.value.trim(),
      updatedAt: serverTimestamp(),
    });
    setStatus("Notas del paciente actualizadas.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    saveNotesButton.disabled = false;
    saveNotesButton.textContent = "Guardar nota del paciente";
  }
}

patientForm.addEventListener("submit", savePatient);
saveNotesButton.addEventListener("click", savePatientNotes);
if (importPatientsInput) {
  importPatientsInput.addEventListener("change", importPatientsFromFile);
}

if (exportSelectedButton) {
  exportSelectedButton.addEventListener("click", exportSelectedPatient);
}

if (exportAllButton) {
  exportAllButton.addEventListener("click", exportAllPatients);
}

if (doctorPhotoInput) {
  doctorPhotoInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file || !auth.currentUser) return;

    try {
      const photoDataUrl = await readFileAsDataUrl(file);
      await updateProfile(auth.currentUser, {
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Medico Foxcat",
        photoURL: photoDataUrl,
      });
      renderDoctor(auth.currentUser);
      setStatus("Foto del medico actualizada correctamente.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      doctorPhotoInput.value = "";
    }
  });
}

if (themeToggleButton) {
  themeToggleButton.addEventListener("click", async () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    localStorage.setItem("foxcat-theme", state.theme);

    try {
      await saveUserLayout();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function bootDashboard() {
  applyWidgetOrder(defaultWidgetOrder);
  widgetElements.forEach((widget) => resizeObserver.observe(widget));

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    setStatus(`Firebase no termino de inicializar: ${error.message}`, "error");
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../login.html";
      return;
    }

    renderDoctor(user);
    await loadUserLayout(user.uid);

    const patientsQuery = query(collection(db, "patients"), orderBy("createdAt", "desc"));

    onSnapshot(
      patientsQuery,
      (snapshot) => {
        state.patients = snapshot.docs.map(normalizePatient);
        if (!state.selectedPatientId || !state.patients.some((patient) => patient.id === state.selectedPatientId)) {
          state.selectedPatientId = state.patients[0]?.id || null;
        }

        renderDashboard();
        setStatus("Dashboard sincronizado con Firestore y listo para interactuar.", "success");
      },
      (error) => {
        setStatus(error.message, "error");
      }
    );
  });
}

bootDashboard();
