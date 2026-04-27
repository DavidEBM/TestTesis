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
  "medic-ai",
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

const widgetCatalog = {
  overview: {
    label: "Resumen del paciente",
    description: "Ficha principal con signos y estado actual.",
    shortcutDescription: "Ir al resumen general del paciente seleccionado.",
  },
  "medic-ai": {
    label: "IA medica",
    description: "Analisis de riesgo y recomendaciones asistidas.",
    shortcutDescription: "Ir al widget de IA medica.",
  },
  alerts: {
    label: "Alertas clinicas",
    description: "Eventos de riesgo y prioridades del paciente.",
    shortcutDescription: "Ir al widget de alertas clinicas.",
  },
  agenda: {
    label: "Agenda del paciente",
    description: "Consulta, monitoreo y laboratorio programados.",
    shortcutDescription: "Ir al widget de agenda del paciente.",
  },
  status: {
    label: "Estado del tablero",
    description: "Resumen operacional del dashboard.",
    shortcutDescription: "Ir al estado general del tablero.",
  },
  form: {
    label: "Registrar paciente",
    description: "Formulario de captura e importacion clinica.",
    shortcutDescription: "Ir al formulario de registro de pacientes.",
  },
  patients: {
    label: "Pacientes sincronizados",
    description: "Listado completo y seleccion del paciente.",
    shortcutDescription: "Ir al listado de pacientes.",
  },
  labs: {
    label: "Laboratorios y signos",
    description: "Valores cuantitativos relevantes del paciente.",
    shortcutDescription: "Ir al widget de laboratorios y signos.",
  },
  critical: {
    label: "Seguimiento prioritario",
    description: "Pacientes con mayor riesgo relativo.",
    shortcutDescription: "Ir al widget de pacientes prioritarios.",
  },
  location: {
    label: "Ubicacion del paciente",
    description: "Area, cama y contexto geografico-clinico.",
    shortcutDescription: "Ir al widget de ubicacion del paciente.",
  },
  notes: {
    label: "Notas del paciente",
    description: "Registro medico y observaciones del turno.",
    shortcutDescription: "Ir al widget de notas clinicas.",
  },
};

const defaultQuickAccess = [
  { id: "qa-overview", type: "widget", target: "overview", label: "Resumen del paciente" },
  { id: "qa-ai", type: "widget", target: "medic-ai", label: "IA medica" },
  { id: "qa-patients", type: "widget", target: "patients", label: "Pacientes activos" },
  { id: "qa-labs", type: "widget", target: "labs", label: "Laboratorios" },
  { id: "qa-notes", type: "widget", target: "notes", label: "Notas del turno" },
  { id: "qa-visual", type: "action", target: "visual-settings", label: "Configuracion visual" },
];

const regionProfiles = {
  Barcelona: {
    label: "Barcelona",
    altitude: 12,
    careFocus: "clima costero y riesgo respiratorio bajo por altitud",
    accessPressure: 0.98,
    oxygenAdjustment: 0,
    climate: "costero humedo",
    temperatureC: 27,
    airQuality: "moderada",
    airQualityIndex: 58,
    humidity: 78,
    respiratoryStress: 1.01,
    recommendationFocus: "vigilar hidratacion, humedad elevada y cambios rapidos en disnea",
  },
  "Pasto-Narino": {
    label: "Pasto-Narino",
    altitude: 2527,
    careFocus: "altitud alta con mayor sensibilidad a desaturacion",
    accessPressure: 1.12,
    oxygenAdjustment: 3,
    climate: "frio andino",
    temperatureC: 13,
    airQuality: "buena",
    airQualityIndex: 34,
    humidity: 72,
    respiratoryStress: 1.14,
    recommendationFocus: "corregir interpretacion de saturacion por altura y vigilar fatiga respiratoria",
  },
  Cali: {
    label: "Cali",
    altitude: 1018,
    careFocus: "entorno urbano intermedio con respuesta respiratoria variable",
    accessPressure: 1.04,
    oxygenAdjustment: 1,
    climate: "calido tropical",
    temperatureC: 29,
    airQuality: "sensible",
    airQualityIndex: 76,
    humidity: 68,
    respiratoryStress: 1.08,
    recommendationFocus: "vigilar calor, irritantes urbanos y variacion glicemica por estres termico",
  },
  Medellin: {
    label: "Medellin",
    altitude: 1495,
    careFocus: "altitud media y vigilancia cardiovascular frecuente",
    accessPressure: 1.07,
    oxygenAdjustment: 1.5,
    climate: "templado humedo",
    temperatureC: 22,
    airQuality: "moderada a sensible",
    airQualityIndex: 69,
    humidity: 74,
    respiratoryStress: 1.09,
    recommendationFocus: "vigilar sintomas respiratorios y carga cardiovascular por altitud media",
  },
  Ipiales: {
    label: "Ipiales",
    altitude: 2890,
    careFocus: "altitud extrema y necesidad de seguimiento estrecho",
    accessPressure: 1.15,
    oxygenAdjustment: 3.5,
    climate: "frio de alta montana",
    temperatureC: 11,
    airQuality: "buena",
    airQualityIndex: 29,
    humidity: 70,
    respiratoryStress: 1.18,
    recommendationFocus: "priorizar oxigenacion, tolerancia al esfuerzo y umbral bajo para reevaluacion",
  },
};

const fallbackTrainingProfile = {
  ready: false,
  datasetPatients: 230,
  baseLocation: "Barcelona",
  locationCounts: { Barcelona: 230 },
  meanAge: 66,
  meanOxygen: 94,
  meanRespRate: 18,
  meanPackHistory: 22,
  heartFailureRate: 0.32,
  smokingExposureRate: 0.63,
  goldHighRate: 0.37,
};

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
  trainingProfile: { ...fallbackTrainingProfile },
  workspaceAction: null,
  hiddenWidgetKeys: [],
  quickAccessItems: [...defaultQuickAccess],
  uiMode: "idle",
  placementTarget: null,
  removeTargetKey: null,
  quickAccessPickerMode: "add",
  placementCommitPending: false,
  resizeSession: null,
};

const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");
const leftToggle = document.getElementById("leftToggle");
const rightToggle = document.getElementById("rightToggle");
const topbar = document.querySelector(".topbar");
const quickAccessList = document.getElementById("quickAccessList");
const addQuickAccessButton = document.getElementById("addQuickAccessButton");
const removeQuickAccessButton = document.getElementById("removeQuickAccessButton");
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
const doctorPanelTraining = document.getElementById("doctorPanelTraining");
const statusBanner = document.getElementById("statusBanner");
const dashboardGrid = document.getElementById("dashboardGrid");
const layoutGuide = document.getElementById("layoutGuide");
const contextMenu = document.getElementById("contextMenu");
const widgetPicker = document.getElementById("widgetPicker");
const widgetPickerGrid = document.getElementById("widgetPickerGrid");
const closeWidgetPickerButton = document.getElementById("closeWidgetPickerButton");
const quickAccessPicker = document.getElementById("quickAccessPicker");
const quickAccessPickerGrid = document.getElementById("quickAccessPickerGrid");
const closeQuickAccessPickerButton = document.getElementById("closeQuickAccessPickerButton");
const devNotice = document.getElementById("devNotice");
const devNoticeText = document.getElementById("devNoticeText");
const closeDevNoticeButton = document.getElementById("closeDevNoticeButton");
const layoutControls = document.getElementById("layoutControls");
const cancelLayoutButton = document.getElementById("cancelLayoutButton");
const saveLayoutButton = document.getElementById("saveLayoutButton");
const patientOverview = document.getElementById("patientOverview");
const medicAiWidget = document.getElementById("medicAiWidget");
const aiTrainingBadge = document.getElementById("aiTrainingBadge");
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
const workspacePanel = document.getElementById("workspacePanel");
const workspaceTitle = document.getElementById("workspaceTitle");
const workspaceBody = document.getElementById("workspaceBody");
const closeWorkspaceButton = document.getElementById("closeWorkspaceButton");
const widgetPlacementOverlay = document.getElementById("widgetPlacementOverlay");
const widgetPlacementGhost = document.getElementById("widgetPlacementGhost");
const widgetPlacementTarget = document.getElementById("widgetPlacementTarget");
const widgetPlacementShifts = document.createElement("div");
widgetPlacementShifts.className = "widget-placement-shifts";
widgetPlacementOverlay.appendChild(widgetPlacementShifts);

const widgetElements = [...dashboardGrid.querySelectorAll("[data-widget-key]")];
const resizeObserver = new ResizeObserver((entries) => {
  if (!state.layoutEditMode) return;

  entries.forEach((entry) => {
    const widget = entry.target;
    const key = widget.dataset.widgetKey;
    state.draftWidgetSizes[key] = clampWidgetSize(widget, {
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    });
  });
});

function getWidgetElementByKey(key) {
  return widgetElements.find((widget) => widget.dataset.widgetKey === key) || null;
}

function isWidgetVisible(key) {
  return !state.hiddenWidgetKeys.includes(key);
}

function getVisibleWidgetKeys() {
  return state.layoutOrder.filter((key) => isWidgetVisible(key) && widgetCatalog[key]);
}

function getAddableWidgetKeys() {
  return defaultWidgetOrder.filter((key) => state.hiddenWidgetKeys.includes(key));
}

function normalizeQuickAccessItems(items) {
  return (items || [])
    .filter((item) => item && item.type && item.target)
    .map((item, index) => ({
      id: item.id || `qa-${item.type}-${item.target}-${index}`.replaceAll(/[^a-z0-9-]/gi, "-"),
      type: item.type,
      target: item.target,
      label:
        item.label ||
        (item.type === "widget" ? widgetCatalog[item.target]?.label || item.target : item.target),
    }));
}

function setStatus(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.dataset.state = type;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function normalizeRegionName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "Barcelona";
  if (raw.includes("pasto")) return "Pasto-Narino";
  if (raw.includes("medell")) return "Medellin";
  if (raw.includes("cali")) return "Cali";
  if (raw.includes("ipiales")) return "Ipiales";
  if (raw.includes("barcelona")) return "Barcelona";
  return "Barcelona";
}

function normalizeOxygenValue(value) {
  const numeric = Number(value || 0);
  if (!numeric) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : numeric;
}

function normalizeBooleanText(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (["si", "sí", "yes", "true", "1"].includes(text)) return "Si";
  if (["no", "non", "false", "0"].includes(text)) return "No";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeSmokingStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (["4", "alta carga", "heavy"].includes(raw)) return "Alta carga";
  if (["3", "activo", "current", "fumador"].includes(raw)) return "Activo";
  if (["2", "exfumador", "former"].includes(raw)) return "Exfumador";
  if (["1", "nunca", "never"].includes(raw)) return "Nunca";
  return String(value).trim();
}

function getStatusClass(status = "Estable") {
  const normalized = status.toLowerCase();

  if (normalized === "critico") return "critical";
  if (normalized === "riesgo") return "warning";
  return "stable";
}

function getRiskScore(patient) {
  let score = 0;
  const oxygen = normalizeOxygenValue(patient.oxygenSaturation);

  if (patient.status === "Critico") score += 5;
  else if (patient.status === "Riesgo") score += 3;

  if (oxygen && oxygen < 92) score += 4;
  if (patient.glucose >= 200) score += 2;
  if (patient.pulse >= 100) score += 1;
  if (patient.bloodPressureSystolic >= 150) score += 1;
  if (patient.respiratoryRate >= 24) score += 2;
  if (Number(patient.copdGold) >= 3) score += 2;
  if (patient.heartFailureHistory === "Si") score += 2;

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
    oxygenSaturation: normalizeOxygenValue(data.oxygenSaturation),
    respiratoryRate: Number(data.respiratoryRate || 0),
    bmi: Number(data.bmi || 0),
    copdGold: Number(data.copdGold || 0),
    smokingStatus: normalizeSmokingStatus(data.smokingStatus),
    heartFailureHistory: normalizeBooleanText(data.heartFailureHistory),
    locationCity: regionProfiles[normalizeRegionName(data.locationCity)]?.label || "Barcelona",
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

function applyWidgetVisibility() {
  widgetElements.forEach((widget) => {
    const key = widget.dataset.widgetKey;
    const visible = isWidgetVisible(key);
    widget.hidden = !visible;
    widget.style.display = visible ? "" : "none";
  });
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", state.theme === "dark");
  themeToggleButton.textContent = state.theme === "dark" ? "Modo claro" : "Modo oscuro";
}

function syncTopbarOffset() {
  const measuredHeight = Math.ceil(topbar?.getBoundingClientRect().height || 104);
  document.documentElement.style.setProperty("--topbar-offset", `${measuredHeight + 14}px`);
}

function getWidgetMinimums(widget) {
  if (widget.classList.contains("widget-wide")) return { width: 640, height: 280 };
  if (widget.classList.contains("widget-form")) return { width: 480, height: 420 };
  if (widget.classList.contains("widget-list")) return { width: 560, height: 320 };
  if (widget.classList.contains("widget-ai")) return { width: 460, height: 340 };
  return { width: 340, height: 280 };
}

function clampWidgetSize(widget, size) {
  const min = getWidgetMinimums(widget);
  return {
    width: Math.max(min.width, Number(size?.width || min.width)),
    height: Math.max(min.height, Number(size?.height || min.height)),
  };
}

function applyWidgetSizes(sizes) {
  widgetElements.forEach((widget) => {
    const key = widget.dataset.widgetKey;
    const size = sizes[key];

    if (size?.width || size?.height) {
      const clamped = clampWidgetSize(widget, size);
      widget.style.setProperty("--widget-width", `${clamped.width}px`);
      widget.style.setProperty("--widget-height", `${clamped.height}px`);
    } else {
      widget.style.removeProperty("--widget-width");
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
  layoutGuide?.setAttribute("aria-hidden", active ? "false" : "true");

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
    const hiddenWidgetKeys = Array.isArray(layoutData?.hiddenWidgetKeys) ? layoutData.hiddenWidgetKeys : [];
    const quickAccessItems = Array.isArray(layoutData?.quickAccessItems) && layoutData.quickAccessItems.length
      ? normalizeQuickAccessItems(layoutData.quickAccessItems)
      : [...defaultQuickAccess];
    const theme = layoutData?.theme || localStorage.getItem("foxcat-theme") || "light";

    if (Array.isArray(widgetOrder) && widgetOrder.length) {
      state.layoutOrder = [...widgetOrder];
      state.persistedLayoutOrder = [...widgetOrder];
      state.widgetSizes = { ...widgetSizes };
      state.persistedWidgetSizes = { ...widgetSizes };
      state.hiddenWidgetKeys = [...hiddenWidgetKeys];
      state.quickAccessItems = [...quickAccessItems];
      applyWidgetOrder(widgetOrder);
      applyWidgetSizes(widgetSizes);
      applyWidgetVisibility();
    } else {
      state.layoutOrder = [...defaultWidgetOrder];
      state.persistedLayoutOrder = [...defaultWidgetOrder];
      state.hiddenWidgetKeys = [];
      state.quickAccessItems = normalizeQuickAccessItems(defaultQuickAccess);
      applyWidgetOrder(defaultWidgetOrder);
      applyWidgetSizes({});
      applyWidgetVisibility();
    }

    applyTheme(theme);
    renderQuickAccessList();
    return;
  } catch (error) {
    setStatus(`No se pudo cargar el layout del usuario: ${error.message}`, "error");
  }

  state.layoutOrder = [...defaultWidgetOrder];
  state.persistedLayoutOrder = [...defaultWidgetOrder];
  state.widgetSizes = {};
  state.persistedWidgetSizes = {};
  state.hiddenWidgetKeys = [];
  state.quickAccessItems = normalizeQuickAccessItems(defaultQuickAccess);
  applyWidgetOrder(defaultWidgetOrder);
  applyWidgetVisibility();
  applyTheme(localStorage.getItem("foxcat-theme") || "light");
  renderQuickAccessList();
}

async function saveUserLayout() {
  if (!auth.currentUser) return;

  await setDoc(doc(db, "userLayouts", auth.currentUser.uid), {
    widgetOrder: state.layoutOrder,
    widgetSizes: state.widgetSizes,
    hiddenWidgetKeys: state.hiddenWidgetKeys,
    quickAccessItems: state.quickAccessItems,
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
    oxygenSaturation: normalizeOxygenValue(raw.oxygenSaturation),
    respiratoryRate: Number(raw.respiratoryRate || 0),
    bmi: Number(raw.bmi || 0),
    copdGold: Number(raw.copdGold || 0),
    smokingStatus: normalizeSmokingStatus(raw.smokingStatus),
    heartFailureHistory: normalizeBooleanText(raw.heartFailureHistory),
    locationCity: regionProfiles[normalizeRegionName(raw.locationCity)]?.label || "Barcelona",
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
      Ciudad: patient.locationCity,
      Area: patient.ward,
      Habitacion: patient.room,
      Presion: `${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic}`,
      Pulso: patient.pulse,
      Glucosa: patient.glucose,
      SaturacionO2: patient.oxygenSaturation,
      FrecuenciaRespiratoria: patient.respiratoryRate,
      Hemoglobina: patient.hemoglobin,
      Creatinina: patient.creatinine,
      BMI: patient.bmi,
      COPD_GOLD: patient.copdGold,
      Tabaquismo: patient.smokingStatus,
      FallaCardiaca: patient.heartFailureHistory,
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
    Ciudad: patient.locationCity,
    Area: patient.ward,
    Habitacion: patient.room,
    PresionSistolica: patient.bloodPressureSystolic,
    PresionDiastolica: patient.bloodPressureDiastolic,
    Pulso: patient.pulse,
    Glucosa: patient.glucose,
    SaturacionO2: patient.oxygenSaturation,
    FrecuenciaRespiratoria: patient.respiratoryRate,
    Hemoglobina: patient.hemoglobin,
    Creatinina: patient.creatinine,
    BMI: patient.bmi,
    COPD_GOLD: patient.copdGold,
    Tabaquismo: patient.smokingStatus,
    FallaCardiaca: patient.heartFailureHistory,
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
  const oxygen = normalizeOxygenValue(patient.oxygenSaturation);

  if (patient.status === "Critico") {
    alerts.push({ tone: "critical", text: "Estado critico. Priorizar valoracion inmediata." });
  }
  if (oxygen && oxygen < 92) {
    alerts.push({ tone: "critical", text: `Saturacion de O2 comprometida: ${oxygen}%.` });
  }
  if (patient.glucose >= 200) {
    alerts.push({ tone: "warning", text: `Glucosa elevada: ${patient.glucose} mg/dL.` });
  }
  if (patient.pulse >= 100) {
    alerts.push({ tone: "warning", text: `Pulso acelerado: ${patient.pulse} bpm.` });
  }
  if (patient.respiratoryRate >= 24) {
    alerts.push({ tone: "warning", text: `Frecuencia respiratoria alta: ${patient.respiratoryRate} rpm.` });
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
  const riskPatients = state.patients.filter((item) => getRiskScore(item) >= 5).length;
  const trainingReady = state.trainingProfile.ready
    ? `IA calibrada con ${state.trainingProfile.datasetPatients} registros base en ${state.trainingProfile.baseLocation}.`
    : "IA usando perfil base mientras carga dataset local.";

  return [
    `${state.patients.length} pacientes cargados en el tablero.`,
    `${riskPatients} pacientes con prioridad alta.`,
    patient ? `Paciente enfocado: ${patient.name} (${patient.status}).` : "Aun no se ha seleccionado un paciente.",
    trainingReady,
    state.layoutEditMode
      ? "Modo edicion activo. Arrastra widgets y confirma con el boton verde."
      : "Clic derecho dentro del dashboard para abrir configuracion.",
  ];
}

function buildLabs(patient) {
  if (!patient) {
    return [
      { label: "Glucosa", value: "Sin dato" },
      { label: "Saturacion O2", value: "Sin dato" },
      { label: "Creatinina", value: "Sin dato" },
      { label: "Pulso", value: "Sin dato" },
    ];
  }

  return [
    { label: "Glucosa", value: patient.glucose ? `${patient.glucose} mg/dL` : "No registrada" },
    { label: "Saturacion O2", value: patient.oxygenSaturation ? `${patient.oxygenSaturation}%` : "No registrada" },
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
      if (variant === "alerts") return `<div class="alert-card tone-${item.tone}">${escapeHtml(item.text)}</div>`;
      if (variant === "labs") {
        return `<div class="info-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`;
      }
      return `<div class="info-row"><span>${escapeHtml(item)}</span></div>`;
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
  const oxygen = patient.oxygenSaturation ? `${patient.oxygenSaturation}%` : "--";

  patientOverview.innerHTML = `
    <div class="overview-layout">
      <div class="patient-hero">
        <img src="${photo}" alt="Foto de ${escapeHtml(patient.name)}" class="patient-hero-photo">
        <div>
          <span class="eyebrow">Paciente seleccionado</span>
          <h3>${escapeHtml(patient.name)}</h3>
          <p>${escapeHtml(patient.condition)}</p>
          <div class="soft-pill-row">
            <span class="soft-pill">ID ${escapeHtml(patient.documentId)}</span>
            <span class="soft-pill">Edad ${escapeHtml(patient.age)}</span>
            <span class="soft-pill">${escapeHtml(patient.locationCity)}</span>
            <span class="soft-pill status-${patient.statusClass}">${escapeHtml(patient.status)}</span>
          </div>
        </div>
      </div>
      <div class="overview-vitals">
        <div class="vital-card"><span>Presion</span><strong>${patient.bloodPressureSystolic || "--"} / ${patient.bloodPressureDiastolic || "--"}</strong></div>
        <div class="vital-card"><span>Pulso</span><strong>${patient.pulse || "--"} bpm</strong></div>
        <div class="vital-card"><span>Saturacion O2</span><strong>${oxygen}</strong></div>
        <div class="vital-card"><span>Ubicacion</span><strong>${escapeHtml(patient.ward)} / ${escapeHtml(patient.room)}</strong></div>
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

  const region = regionProfiles[normalizeRegionName(patient.locationCity)];
  locationWidget.innerHTML = `
    <div class="location-block">
      <div class="location-marker"></div>
      <div>
        <strong>${escapeHtml(patient.ward)}</strong>
        <p>Habitacion / cama: ${escapeHtml(patient.room)}</p>
        <p>Ciudad clinica: ${escapeHtml(region?.label || patient.locationCity)} · Altitud ${region?.altitude || 12} m sobre el nvl del mar</p>
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
          <img src="${photo}" alt="Foto de ${escapeHtml(patient.name)}" class="patient-card-photo">
          <div class="patient-card-copy">
            <strong>${escapeHtml(patient.name)}</strong>
            <span>${escapeHtml(patient.condition)}</span>
            <small>${escapeHtml(patient.locationCity)} · ${escapeHtml(patient.ward)} - ${escapeHtml(patient.room)}</small>
          </div>
          <div class="patient-card-actions">
            <span class="soft-pill status-${patient.statusClass}">${escapeHtml(patient.status)}</span>
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

function getPopulationSummary() {
  const training = state.trainingProfile;
  return [
    `Base local: ${training.datasetPatients} casos de referencia`,
    `Origen principal: ${training.baseLocation}`,
    `Edad promedio referencia: ${training.meanAge.toFixed(0)} anos`,
    `Saturacion base: ${training.meanOxygen.toFixed(0)}%`,
  ];
}

function computeClinicalAssessment(patient) {
  if (!patient) return null;

  const training = state.trainingProfile;
  const region = regionProfiles[normalizeRegionName(patient.locationCity)];
  const oxygen = normalizeOxygenValue(patient.oxygenSaturation);
  const expectedOxygen = Math.max(88, training.meanOxygen - (region?.oxygenAdjustment || 0));
  let shortScore = 8;
  let weekScore = 10;
  let longScore = 12;
  const triggers = [];
  const recommendations = [];

  if (patient.status === "Critico") {
    shortScore += 28;
    weekScore += 18;
    longScore += 10;
    triggers.push("Estado clinico actual marcado como critico.");
  } else if (patient.status === "Riesgo") {
    shortScore += 18;
    weekScore += 12;
    longScore += 7;
    triggers.push("Paciente ya clasificado en riesgo por el tablero.");
  }

  if (oxygen) {
    if (oxygen < expectedOxygen - 4) {
      shortScore += 34;
      weekScore += 20;
      longScore += 8;
      triggers.push(`Saturacion ${oxygen}% por debajo del perfil esperado para ${region.label}.`);
    } else if (oxygen < expectedOxygen - 2) {
      shortScore += 18;
      weekScore += 12;
      longScore += 6;
      triggers.push(`Saturacion ${oxygen}% con margen estrecho respecto a referencia regional.`);
    }
  }

  if (patient.respiratoryRate >= 28) {
    shortScore += 24;
    weekScore += 15;
    longScore += 6;
    triggers.push(`Frecuencia respiratoria muy alta: ${patient.respiratoryRate} rpm.`);
  } else if (patient.respiratoryRate >= 24) {
    shortScore += 14;
    weekScore += 10;
    longScore += 5;
    triggers.push(`Frecuencia respiratoria elevada: ${patient.respiratoryRate} rpm.`);
  }

  if (patient.pulse >= 120) {
    shortScore += 16;
    weekScore += 10;
    longScore += 4;
    triggers.push(`Pulso muy elevado: ${patient.pulse} bpm.`);
  } else if (patient.pulse >= 100) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
  }

  if (patient.bloodPressureSystolic >= 180 || patient.bloodPressureDiastolic >= 110) {
    shortScore += 16;
    weekScore += 10;
    longScore += 4;
    triggers.push("Presion arterial severamente elevada.");
  } else if (patient.bloodPressureSystolic >= 150 || patient.bloodPressureDiastolic >= 95) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
  }

  if (patient.glucose >= 300) {
    shortScore += 14;
    weekScore += 8;
    longScore += 4;
    triggers.push(`Glucosa muy alta: ${patient.glucose} mg/dL.`);
  } else if (patient.glucose >= 200) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
  }

  if (patient.creatinine >= 2) {
    shortScore += 13;
    weekScore += 8;
    longScore += 5;
    triggers.push(`Creatinina elevada: ${patient.creatinine} mg/dL.`);
  } else if (patient.creatinine >= 1.3) {
    shortScore += 7;
    weekScore += 5;
    longScore += 3;
  }

  if (patient.hemoglobin && patient.hemoglobin < 8) {
    shortScore += 14;
    weekScore += 7;
    longScore += 4;
    triggers.push(`Hemoglobina baja: ${patient.hemoglobin} g/dL.`);
  } else if (patient.hemoglobin && patient.hemoglobin < 10) {
    shortScore += 8;
    weekScore += 5;
    longScore += 3;
  }

  if (patient.age >= 80) {
    shortScore += 10;
    weekScore += 8;
    longScore += 6;
  } else if (patient.age >= training.meanAge) {
    shortScore += 5;
    weekScore += 4;
    longScore += 4;
  }

  if (patient.copdGold >= 4) {
    shortScore += 16;
    weekScore += 12;
    longScore += 10;
    triggers.push(`COPD GOLD ${patient.copdGold}: reserva pulmonar reducida.`);
  } else if (patient.copdGold >= 3) {
    shortScore += 11;
    weekScore += 9;
    longScore += 8;
  } else if (patient.copdGold === 2) {
    shortScore += 6;
    weekScore += 5;
    longScore += 5;
  }

  if (patient.heartFailureHistory === "Si") {
    shortScore += 14;
    weekScore += 10;
    longScore += 8;
    triggers.push("Antecedente de falla cardiaca.");
  }

  if (patient.smokingStatus === "Alta carga") {
    shortScore += 8;
    weekScore += 8;
    longScore += 10;
  } else if (patient.smokingStatus === "Activo") {
    shortScore += 6;
    weekScore += 6;
    longScore += 8;
  } else if (patient.smokingStatus === "Exfumador") {
    shortScore += 3;
    weekScore += 4;
    longScore += 5;
  }

  if (patient.bmi && patient.bmi < 18.5) {
    shortScore += 6;
    weekScore += 5;
    longScore += 5;
    triggers.push("IMC bajo, posible fragilidad nutricional.");
  } else if (patient.bmi && patient.bmi > 35) {
    shortScore += 4;
    weekScore += 4;
    longScore += 4;
  }

  if (region.airQualityIndex >= 85) {
    shortScore += 12;
    weekScore += 10;
    longScore += 7;
    triggers.push(`Calidad del aire exigente en ${region.label}: AQI ${region.airQualityIndex}.`);
  } else if (region.airQualityIndex >= 65) {
    shortScore += 7;
    weekScore += 6;
    longScore += 4;
    triggers.push(`Calidad del aire intermedia en ${region.label}: AQI ${region.airQualityIndex}.`);
  }

  if (region.temperatureC >= 28) {
    shortScore += 5;
    weekScore += 4;
    longScore += 2;
    triggers.push(`Temperatura ambiental alta: ${region.temperatureC}C.`);
  } else if (region.temperatureC <= 12) {
    shortScore += 6;
    weekScore += 5;
    longScore += 3;
    triggers.push(`Temperatura ambiental baja: ${region.temperatureC}C.`);
  }

  if (region.humidity >= 75) {
    shortScore += 3;
    weekScore += 3;
    longScore += 2;
  }

  shortScore *= region.respiratoryStress || 1;
  weekScore *= region.respiratoryStress || 1;
  longScore *= region.respiratoryStress || 1;
  shortScore *= region.accessPressure;
  weekScore *= region.accessPressure;
  longScore *= region.accessPressure;

  const shortRisk = Math.min(98, Math.round(shortScore));
  const weekRisk = Math.min(98, Math.round((shortScore * 0.45) + weekScore));
  const longRisk = Math.min(98, Math.round((weekScore * 0.52) + longScore));

  if (shortRisk >= 70) recommendations.push("Agendar control medico prioritario en menos de 24 horas.");
  else if (shortRisk >= 45) recommendations.push("Programar seguimiento clinico dentro de 48 a 72 horas.");
  else recommendations.push("Mantener seguimiento ordinario con reevaluacion segun agenda.");

  if (oxygen && oxygen < expectedOxygen - 2) recommendations.push("Verificar signos respiratorios y considerar soporte de oxigeno segun criterio medico.");
  if (patient.glucose >= 200) recommendations.push("Revisar plan metabolico y confirmar adherencia terapeutica.");
  if (patient.heartFailureHistory === "Si") recommendations.push("Correlacionar con balance hidrico y sintomas cardiovasculares.");
  if (patient.locationCity) recommendations.push(`Ajustar interpretacion al contexto de ${region.label}: ${region.careFocus}.`);
  recommendations.push(`Contexto ambiental: ${region.climate}, ${region.temperatureC}C, AQI ${region.airQualityIndex}, humedad ${region.humidity}%.`);
  recommendations.push(region.recommendationFocus);

  const confidenceInputs = [
    patient.oxygenSaturation,
    patient.respiratoryRate,
    patient.pulse,
    patient.glucose,
    patient.creatinine,
    patient.copdGold,
    patient.locationCity,
  ];
  const confidence = Math.round((confidenceInputs.filter(Boolean).length / confidenceInputs.length) * 100);

  return {
    region,
    shortRisk,
    weekRisk,
    longRisk,
    confidence,
    expectedOxygen,
    environmentalSummary: `${region.label}: ${region.climate}, ${region.temperatureC}C, AQI ${region.airQualityIndex}, humedad ${region.humidity}%`,
    summary:
      shortRisk >= 70
        ? "Alta probabilidad de descompensacion temprana. Conviene actuar hoy."
        : shortRisk >= 45
          ? "Riesgo intermedio. Se recomienda vigilancia estrecha y ajustes preventivos."
          : "Riesgo contenido por ahora. Mantener seguimiento y confirmar tendencia.",
    triggers: triggers.length ? triggers : ["Sin detonantes criticos mayores en los datos actuales."],
    recommendations,
  };
}

function riskTone(value) {
  if (value >= 70) return "Riesgo alto";
  if (value >= 45) return "Riesgo medio";
  return "Riesgo bajo";
}

function renderMedicAi(patient) {
  if (!patient) {
    medicAiWidget.innerHTML = `
      <div class="empty-state">
        La IA medica se activa cuando seleccionas un paciente. Tomara los datos clinicos actuales y los comparara con el perfil base cargado desde la carpeta test.
      </div>
    `;
    return;
  }

  const assessment = computeClinicalAssessment(patient);
  const trainingLines = getPopulationSummary();

  medicAiWidget.innerHTML = `
    <div class="ai-hero">
      <div class="ai-summary">
        <strong>${escapeHtml(assessment.summary)}</strong>
        <p>
          Analisis personalizado para ${escapeHtml(patient.name)} en ${escapeHtml(assessment.region.label)}.
          Se compara contra la base local y se ajusta por altitud, carga respiratoria y comorbilidades.
        </p>
      </div>

      <div class="risk-grid">
        <div class="risk-card">
          <span>24 a 72 horas</span>
          <strong>${assessment.shortRisk}% · ${riskTone(assessment.shortRisk)}</strong>
          <div class="risk-meter"><span style="width:${assessment.shortRisk}%"></span></div>
        </div>
        <div class="risk-card">
          <span>1 semana</span>
          <strong>${assessment.weekRisk}% · ${riskTone(assessment.weekRisk)}</strong>
          <div class="risk-meter"><span style="width:${assessment.weekRisk}%"></span></div>
        </div>
        <div class="risk-card">
          <span>1+ mes</span>
          <strong>${assessment.longRisk}% · ${riskTone(assessment.longRisk)}</strong>
          <div class="risk-meter"><span style="width:${assessment.longRisk}%"></span></div>
        </div>
      </div>

      <div class="ai-details-grid">
        <div class="ai-detail-card">
          <strong>Detonantes clinicos</strong>
          <ul class="ai-detail-list">
            ${assessment.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
        <div class="ai-detail-card">
          <strong>Recomendaciones para el medico</strong>
          <ul class="ai-detail-list">
            ${assessment.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="ai-detail-card">
        <strong>Base de calibracion</strong>
        <div class="ai-inline">
          ${trainingLines.map((line) => `<span class="soft-pill">${escapeHtml(line)}</span>`).join("")}
          <span class="soft-pill">Confianza ${assessment.confidence}%</span>
          <span class="soft-pill">O2 esperada aprox. ${Math.round(assessment.expectedOxygen)}%</span>
        </div>
        <p class="ai-detail">${escapeHtml(assessment.environmentalSummary)}</p>
        <p class="ai-disclaimer">
          Esta ayuda es orientativa y explicable. No sustituye juicio clinico, triage presencial ni protocolos institucionales.
        </p>
      </div>

      <div class="ai-actions">
        <button type="button" class="ai-primary" data-ai-action="schedule">Agendar cita</button>
        <button type="button" class="ai-secondary" data-ai-action="alert-patient">Mandar alerta al paciente</button>
        <select id="aiActionSelect" class="ai-select">
          <option value="">Menu de acciones utiles</option>
          <option value="care-plan">Plan sugerido</option>
          <option value="remote-monitoring">Monitoreo remoto</option>
          <option value="quick-history">Historial rapido</option>
          <option value="calendar-view">Calendario</option>
          <option value="shift-notes">Notas del turno</option>
        </select>
        <button type="button" class="ai-secondary" data-ai-action="run-selected">Abrir opcion elegida</button>
      </div>
    </div>
  `;
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
  userRole.textContent = "Perfil autenticado con foto, preferencias visuales y panel IA clinico.";
  doctorPanelName.textContent = `Medico: ${name}`;
  requestAnimationFrame(syncTopbarOffset);
}

function renderQuickAccessList() {
  if (!quickAccessList) return;

  if (!state.quickAccessItems.length) {
    quickAccessList.innerHTML = `<li><div class="empty-state">No hay accesos rapidos. Usa el boton + para agregar uno.</div></li>`;
    return;
  }

  quickAccessList.innerHTML = state.quickAccessItems
    .map(
      (item) => `
        <li>
          <button type="button" data-quick-access-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
        </li>
      `
    )
    .join("");
}

function renderWidgetPicker() {
  const addableKeys = getAddableWidgetKeys();
  widgetPickerGrid.innerHTML = addableKeys.length
    ? addableKeys
        .map((key) => {
          const item = widgetCatalog[key];
          return `
            <button type="button" class="picker-button" data-widget-pick="${key}">
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.description)}</small>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">Todos los widgets disponibles ya estan visibles en el dashboard.</div>`;
}

function renderQuickAccessPicker() {
  const titleNode = quickAccessPicker.querySelector("h3");
  const descriptionNode = quickAccessPicker.querySelector(".floating-description");

  if (state.quickAccessPickerMode === "remove") {
    if (titleNode) titleNode.textContent = "Eliminar acceso rapido";
    if (descriptionNode) {
      descriptionNode.textContent = "Selecciona el acceso rapido que quieres quitar del panel izquierdo.";
    }

    quickAccessPickerGrid.innerHTML = state.quickAccessItems.length
      ? state.quickAccessItems
          .map(
            (item) => `
              <button type="button" class="picker-button" data-quick-remove-id="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.label)}</strong>
                <small>Quitar este acceso rapido del panel lateral izquierdo.</small>
              </button>
            `
          )
          .join("")
      : `<div class="empty-state">No hay accesos rapidos para eliminar.</div>`;
    return;
  }

  if (titleNode) titleNode.textContent = "Agregar acceso rapido";
  if (descriptionNode) {
    descriptionNode.textContent = "Elige un atajo. Al pulsarlo desde el panel izquierdo, te llevara al widget o vista relacionada.";
  }

  const existingTargets = new Set(state.quickAccessItems.map((item) => `${item.type}:${item.target}`));
  const candidates = [
    ...defaultWidgetOrder
      .filter((key) => !existingTargets.has(`widget:${key}`))
      .map((key) => ({
        type: "widget",
        target: key,
        label: widgetCatalog[key].label,
        description: widgetCatalog[key].shortcutDescription,
      })),
    ...[
      { type: "action", target: "remote-monitoring", label: "Monitoreo remoto", description: "Abrir la vista remota de seguimiento." },
      { type: "action", target: "visual-settings", label: "Configuracion visual", description: "Ir al centro de configuracion visual." },
      { type: "action", target: "support-center", label: "Soporte", description: "Ir al panel de ayuda y soporte." },
    ].filter((item) => !existingTargets.has(`action:${item.target}`)),
  ];

  quickAccessPickerGrid.innerHTML = candidates.length
    ? candidates
        .map(
          (item) => `
            <button type="button" class="picker-button" data-quick-pick-type="${item.type}" data-quick-pick-target="${item.target}">
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.description)}</small>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state">No hay mas accesos rapidos disponibles para agregar.</div>`;
}

function showWidgetPicker() {
  renderWidgetPicker();
  widgetPicker.hidden = false;
}

function hideWidgetPicker() {
  widgetPicker.hidden = true;
}

function showQuickAccessPicker() {
  state.quickAccessPickerMode = "add";
  renderQuickAccessPicker();
  quickAccessPicker.hidden = false;
}

function showQuickAccessRemovalPicker() {
  state.quickAccessPickerMode = "remove";
  renderQuickAccessPicker();
  quickAccessPicker.hidden = false;
}

function hideQuickAccessPicker() {
  quickAccessPicker.hidden = true;
}

function closeModalOnBackdropClick(event, modal, onClose) {
  if (event.target !== modal) return;
  onClose();
}

function showDevNotice(optionLabel) {
  devNoticeText.textContent = `${optionLabel}: opcion en desarrollo, favor esperar futuras actualizaciones.`;
  devNotice.hidden = false;
}

function hideDevNotice() {
  devNotice.hidden = true;
}

function getPlacementSizeForWidget(key) {
  const widget = getWidgetElementByKey(key);
  if (!widget) return { width: 360, height: 280 };
  return clampWidgetSize(widget, state.widgetSizes[key] || {});
}

function clearPlacementShiftPreview() {
  widgetPlacementShifts.innerHTML = "";
}

function clearWidgetPreviewTransforms() {
  widgetElements.forEach((widget) => {
    widget.style.removeProperty("--widget-preview-x");
    widget.style.removeProperty("--widget-preview-y");
    widget.classList.remove("preview-shift");
    widget.classList.remove("preview-remove");
    widget.dataset.resizeCursor = "";
  });
}

function getVisibleWidgetElements() {
  return getVisibleWidgetKeys()
    .map((key) => getWidgetElementByKey(key))
    .filter(Boolean);
}

function getCurrentVisibleSlotRects() {
  return getVisibleWidgetElements()
    .map((widget) => widget.getBoundingClientRect())
    .filter(Boolean);
}

function buildPlacementSlots(addWidgetKey) {
  const slotRects = getCurrentVisibleSlotRects();

  const dashboardRect = dashboardGrid.getBoundingClientRect();
  const addSize = addWidgetKey ? getPlacementSizeForWidget(addWidgetKey) : { width: 360, height: 280 };
  const contentLeft = dashboardRect.left + 14;
  const contentRight = dashboardRect.right - 14;
  const gap = 18;

  if (!slotRects.length) {
    slotRects.push({
      left: contentLeft,
      top: dashboardRect.top + 14,
      width: Math.min(addSize.width, Math.max(220, dashboardRect.width - 28)),
      height: addSize.height,
    });
    return slotRects;
  }

  const lastRect = slotRects[slotRects.length - 1];
  const projectedWidth = Math.min(addSize.width, Math.max(220, dashboardRect.width - 28));
  const nextLeft = lastRect.left + lastRect.width + gap;
  const staysOnRow = nextLeft + projectedWidth <= contentRight;

  slotRects.push({
    left: staysOnRow ? nextLeft : contentLeft,
    top: staysOnRow ? lastRect.top : lastRect.top + lastRect.height + gap,
    width: projectedWidth,
    height: addSize.height,
  });

  return slotRects;
}

function getExpandedRect(rect, padding = 84) {
  return {
    left: rect.left - padding,
    right: rect.left + rect.width + padding,
    top: rect.top - padding,
    bottom: rect.top + rect.height + padding,
  };
}

function getDistanceToRect(clientX, clientY, rect) {
  const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
  const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function clampPlacementRect(rect, widgetSize, dashboardRect) {
  const width = Math.min(widgetSize.width, Math.max(220, dashboardRect.width - 28));
  const left = Math.min(Math.max(rect.left, dashboardRect.left + 14), dashboardRect.right - width - 14);
  return {
    left,
    top: Math.max(rect.top, dashboardRect.top + 14),
    width,
    height: widgetSize.height,
  };
}

function buildInsertionCandidates(widgetKey) {
  const dashboardRect = dashboardGrid.getBoundingClientRect();
  const widgetSize = getPlacementSizeForWidget(widgetKey);
  const visibleElements = getVisibleWidgetElements();
  const candidates = [];

  if (!visibleElements.length) {
    candidates.push({
      left: dashboardRect.left + 14,
      top: dashboardRect.top + 14,
      width: Math.min(widgetSize.width, Math.max(220, dashboardRect.width - 28)),
      height: widgetSize.height,
      insertBeforeKey: null,
    });
    return candidates;
  }

  visibleElements.forEach((widget) => {
    const rect = widget.getBoundingClientRect();
    candidates.push(
      clampPlacementRect(
        {
          left: rect.left,
          top: rect.top,
        },
        widgetSize,
        dashboardRect
      )
    );
    candidates[candidates.length - 1].insertBeforeKey = widget.dataset.widgetKey;
  });

  const lastRect = visibleElements[visibleElements.length - 1].getBoundingClientRect();
  const gap = 18;
  const endLeft = lastRect.left + lastRect.width + gap;
  const endWidth = Math.min(widgetSize.width, Math.max(220, dashboardRect.width - 28));
  const staysOnRow = endLeft + endWidth <= dashboardRect.right - 14;
  candidates.push({
    left: staysOnRow ? endLeft : dashboardRect.left + 14,
    top: staysOnRow ? lastRect.top : lastRect.top + lastRect.height + gap,
    width: endWidth,
    height: widgetSize.height,
    insertBeforeKey: null,
  });

  return candidates;
}

function renderPlacementShiftPreview(target, widgetKey, mode = "add") {
  clearPlacementShiftPreview();
  clearWidgetPreviewTransforms();
  if (!target || !widgetKey) return;

  if (mode === "remove") {
    getWidgetElementByKey(widgetKey)?.classList.add("preview-remove");
    return;
  }
}

function updatePlacementVisuals(target, key, mode = "add") {
  if (!target || !key) {
    widgetPlacementOverlay.hidden = true;
    state.placementTarget = null;
    clearPlacementShiftPreview();
    clearWidgetPreviewTransforms();
    return;
  }

  const dashboardRect = dashboardGrid.getBoundingClientRect();
  const width = Math.max(180, Math.round(target.width));
  const height = Math.max(120, Math.round(target.height));
  const left = target.left - dashboardRect.left;
  const top = target.top - dashboardRect.top;

  widgetPlacementOverlay.hidden = false;
  widgetPlacementOverlay.classList.toggle("delete-mode", mode === "remove");
  widgetPlacementGhost.style.opacity = mode === "remove" ? "0" : "";
  widgetPlacementGhost.style.left = `${left}px`;
  widgetPlacementGhost.style.top = `${top}px`;
  widgetPlacementGhost.style.width = `${width}px`;
  widgetPlacementGhost.style.height = `${height}px`;
  widgetPlacementGhost.textContent = widgetCatalog[key]?.label || "";
  widgetPlacementTarget.style.left = `${left}px`;
  widgetPlacementTarget.style.top = `${top}px`;
  widgetPlacementTarget.style.width = `${width}px`;
  widgetPlacementTarget.style.height = `${height}px`;
  renderPlacementShiftPreview(target, key, mode);

  state.placementTarget = { ...target, key };
}

function getInsertionTargetFromPoint(clientX, clientY, widgetKey) {
  const dashboardRect = dashboardGrid.getBoundingClientRect();
  const inside =
    clientX >= dashboardRect.left &&
    clientX <= dashboardRect.right &&
    clientY >= dashboardRect.top &&
    clientY <= dashboardRect.bottom;

  if (!inside) return null;

  const candidates = buildInsertionCandidates(widgetKey);
  const nearest = candidates
    .map((candidate) => {
      const expandedRect = getExpandedRect(candidate);
      return {
        candidate,
        insideExpanded:
          clientX >= expandedRect.left &&
          clientX <= expandedRect.right &&
          clientY >= expandedRect.top &&
          clientY <= expandedRect.bottom,
        distance: getDistanceToRect(clientX, clientY, candidate),
      };
    })
    .filter((entry) => entry.insideExpanded || entry.distance < 140)
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest?.candidate || null;
}

function getDeleteTargetFromPoint(clientX, clientY) {
  const hovered = document.elementFromPoint(clientX, clientY)?.closest?.("[data-widget-key]");
  if (!hovered || hovered.hidden) return null;
  const key = hovered.dataset.widgetKey;
  if (!isWidgetVisible(key)) return null;
  const rect = hovered.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    removeKey: key,
  };
}

function cancelWidgetInteraction(message = "Operacion cancelada.") {
  state.uiMode = "idle";
  state.removeTargetKey = null;
  state.placementTarget = null;
  state.placementCommitPending = false;
  widgetPlacementOverlay.hidden = true;
  widgetPlacementOverlay.classList.remove("delete-mode");
  clearPlacementShiftPreview();
  clearWidgetPreviewTransforms();
  if (message) setStatus(message, "info");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getResizeDirectionForPointer(widget, clientX, clientY) {
  if (!state.layoutEditMode || state.activeResizeWidgetKey !== widget.dataset.widgetKey) return "";

  const rect = widget.getBoundingClientRect();
  const edge = 30;
  const nearLeft = clientX >= rect.left && clientX <= rect.left + edge;
  const nearRight = clientX <= rect.right && clientX >= rect.right - edge;
  const nearTop = clientY >= rect.top && clientY <= rect.top + edge;
  const nearBottom = clientY <= rect.bottom && clientY >= rect.bottom - edge;

  const vertical = nearTop ? "n" : nearBottom ? "s" : "";
  const horizontal = nearLeft ? "w" : nearRight ? "e" : "";
  return `${vertical}${horizontal}`;
}

function getResizeCursorToken(direction) {
  if (!direction) return "";
  if (direction === "n" || direction === "s") return "ns";
  if (direction === "e" || direction === "w") return "ew";
  if (direction === "nw" || direction === "se") return "nwse";
  return "nesw";
}

function beginWidgetResize(widget, direction, event) {
  const key = widget.dataset.widgetKey;
  const startRect = widget.getBoundingClientRect();
  const startSize = clampWidgetSize(widget, state.draftWidgetSizes[key] || state.widgetSizes[key] || {
    width: Math.round(startRect.width),
    height: Math.round(startRect.height),
  });

  state.resizeSession = {
    key,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: startSize.width,
    startHeight: startSize.height,
  };
}

function handleWidgetResizeMove(event) {
  if (!state.resizeSession) return;

  const widget = getWidgetElementByKey(state.resizeSession.key);
  if (!widget) return;

  const { direction, startX, startY, startWidth, startHeight, key } = state.resizeSession;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  let width = startWidth;
  let height = startHeight;

  if (direction.includes("e")) width = startWidth + deltaX;
  if (direction.includes("w")) width = startWidth - deltaX;
  if (direction.includes("s")) height = startHeight + deltaY;
  if (direction.includes("n")) height = startHeight - deltaY;

  const clamped = clampWidgetSize(widget, { width, height });
  state.draftWidgetSizes[key] = clamped;
  widget.style.setProperty("--widget-width", `${clamped.width}px`);
  widget.style.setProperty("--widget-height", `${clamped.height}px`);
}

function stopWidgetResize() {
  state.resizeSession = null;
}

function getDefaultInsertBeforeKey(widgetKey) {
  const widgetIndex = defaultWidgetOrder.indexOf(widgetKey);
  if (widgetIndex === -1) return null;

  for (let index = widgetIndex + 1; index < defaultWidgetOrder.length; index += 1) {
    const candidateKey = defaultWidgetOrder[index];
    if (isWidgetVisible(candidateKey)) return candidateKey;
  }

  return null;
}

function highlightWidget(widgetKey) {
  const widget = getWidgetElementByKey(widgetKey);
  if (!widget) return;

  widget.classList.remove("widget-focus-flash");
  void widget.offsetWidth;
  widget.classList.add("widget-focus-flash");
  widget.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    widget.classList.remove("widget-focus-flash");
  }, 1800);
}

async function addWidgetInstantly(widgetKey) {
  hideWidgetPicker();
  if (!widgetCatalog[widgetKey]) return;

  state.hiddenWidgetKeys = state.hiddenWidgetKeys.filter((key) => key !== widgetKey);
  const nextOrder = state.layoutOrder.filter((key) => key !== widgetKey);
  const insertBeforeKey = getDefaultInsertBeforeKey(widgetKey);

  if (insertBeforeKey) {
    const insertIndex = nextOrder.indexOf(insertBeforeKey);
    nextOrder.splice(insertIndex, 0, widgetKey);
  } else {
    nextOrder.push(widgetKey);
  }

  state.layoutOrder = nextOrder;
  state.persistedLayoutOrder = [...state.layoutOrder];
  applyWidgetOrder(state.layoutOrder);
  applyWidgetVisibility();
  renderQuickAccessPicker();
  renderDashboard();
  await saveUserLayout();
  requestAnimationFrame(() => {
    highlightWidget(widgetKey);
  });
  setStatus(`Widget ${widgetCatalog[widgetKey].label} agregado correctamente y resaltado en el tablero.`, "success");
}

function startRemoveWidgetFlow() {
  state.uiMode = "remove-widget";
  state.removeTargetKey = null;
  state.placementTarget = null;
  widgetPlacementGhost.textContent = "";
  setStatus("Mueve el cursor sobre el widget a eliminar. Clic izquierdo confirma la eliminacion. Clic derecho cancela.", "info");
}

async function finalizeWidgetRemoval() {
  if (!state.placementTarget?.key) return;
  const removeKey = state.placementTarget.key;
  if (getVisibleWidgetKeys().length <= 1) {
    setStatus("Debe permanecer al menos un widget visible en el dashboard.", "error");
    return;
  }
  state.hiddenWidgetKeys = [...new Set([...state.hiddenWidgetKeys, removeKey])];
  state.quickAccessItems = state.quickAccessItems.filter((item) => !(item.type === "widget" && item.target === removeKey));
  if (state.selectedPatientId && removeKey === "notes") {
    notesTarget.textContent = "Sin paciente";
  }
  applyWidgetVisibility();
  renderQuickAccessList();
  renderDashboard();
  cancelWidgetInteraction("");
  await saveUserLayout();
  setStatus(`Widget ${widgetCatalog[removeKey].label} ocultado correctamente.`, "success");
}

function handleWidgetInteractionMove(event) {
  if (state.uiMode === "remove-widget") {
    const target = getDeleteTargetFromPoint(event.clientX, event.clientY);
    updatePlacementVisuals(
      target
        ? { left: target.left, top: target.top, width: target.width, height: target.height, insertBeforeKey: null }
        : null,
      target?.removeKey || "",
      "remove"
    );
    if (target) {
      state.placementTarget = { key: target.removeKey };
    }
  }
}

function renderWorkspace(title, content) {
  workspaceTitle.textContent = title;
  workspaceBody.innerHTML = content;
  workspacePanel.hidden = false;
  requestAnimationFrame(() => {
    workspacePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function closeWorkspace() {
  workspacePanel.hidden = true;
  workspaceTitle.textContent = "Vista auxiliar";
  workspaceBody.innerHTML = "";
  state.workspaceAction = null;
}

function scrollToWidgetKey(widgetKey) {
  const widget = getWidgetElementByKey(widgetKey);
  if (!widget || !isWidgetVisible(widgetKey)) {
    setStatus("Ese widget no esta visible ahora mismo. Puedes volver a agregarlo desde clic derecho.", "error");
    return;
  }

  widget.scrollIntoView({ behavior: "smooth", block: "center" });
}

function triggerQuickAccess(item) {
  if (!item) return;
  if (item.type === "widget") {
    scrollToWidgetKey(item.target);
    return;
  }
  renderWorkspaceAction(item.target);
  setStatus(`Se abrio ${item.label}.`, "success");
}

function summarizeDay() {
  const patient = getSelectedPatient();
  const riskHigh = state.patients.filter((item) => getRiskScore(item) >= 5).length;
  return `
    <div class="workspace-grid">
      <article class="workspace-card">
        <strong>Pacientes activos</strong>
        <p>${state.patients.length} registros sincronizados.</p>
      </article>
      <article class="workspace-card">
        <strong>Prioridad alta</strong>
        <p>${riskHigh} pacientes requieren seguimiento prioritario.</p>
      </article>
      <article class="workspace-card">
        <strong>Foco actual</strong>
        <p>${patient ? escapeHtml(patient.name) : "Sin paciente seleccionado"}.</p>
      </article>
      <article class="workspace-card">
        <strong>Motor clinico</strong>
        <p>${state.trainingProfile.ready ? "Calibrado con dataset local." : "Usando perfil base de respaldo."}</p>
      </article>
    </div>
  `;
}

function buildCalendarMarkup() {
  const scheduled = state.patients
    .filter((patient) => patient.appointmentTime || patient.monitoringTime || patient.labTime)
    .sort((a, b) => (a.appointmentTime || "99:99").localeCompare(b.appointmentTime || "99:99"));

  if (!scheduled.length) {
    return `<article class="workspace-card"><strong>Calendario</strong><p>No hay eventos cargados todavia.</p></article>`;
  }

  return scheduled
    .map(
      (patient) => `
        <article class="workspace-card">
          <strong>${escapeHtml(patient.name)}</strong>
          <p>Consulta: ${escapeHtml(patient.appointmentTime || "Sin hora")}</p>
          <p>Monitoreo: ${escapeHtml(patient.monitoringTime || "Sin hora")}</p>
          <p>Laboratorio: ${escapeHtml(patient.labTime || "Sin hora")}</p>
          <p>${escapeHtml(patient.locationCity)} · ${escapeHtml(patient.ward)}</p>
        </article>
      `
    )
    .join("");
}

function buildLabsOverviewMarkup() {
  const prioritized = [...state.patients]
    .filter((patient) => patient.glucose || patient.creatinine || patient.oxygenSaturation || patient.respiratoryRate)
    .sort((a, b) => getRiskScore(b) - getRiskScore(a))
    .slice(0, 6);

  if (!prioritized.length) {
    return `<article class="workspace-card"><strong>Laboratorios</strong><p>No hay datos clinicos suficientes todavia.</p></article>`;
  }

  return prioritized
    .map(
      (patient) => `
        <article class="workspace-card">
          <strong>${escapeHtml(patient.name)}</strong>
          <p>Glucosa: ${patient.glucose || "Sin dato"} mg/dL</p>
          <p>Creatinina: ${patient.creatinine || "Sin dato"} mg/dL</p>
          <p>Saturacion O2: ${patient.oxygenSaturation || "Sin dato"}%</p>
          <p>FR: ${patient.respiratoryRate || "Sin dato"} rpm</p>
        </article>
      `
    )
    .join("");
}

function renderWorkspaceAction(action) {
  state.workspaceAction = action;
  const patient = getSelectedPatient();

  if (action === "mark-shift") {
    renderWorkspace(
      "Marcar turno",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Registrar inicio de turno</strong>
            <p>Guarda una marca local para el medico autenticado y deja trazabilidad del momento de ingreso.</p>
            <button type="button" class="ghost-button" data-workspace-action="register-shift">Registrar ahora</button>
          </article>
          <article class="workspace-card">
            <strong>Paciente prioritario</strong>
            <p>${patient ? escapeHtml(patient.name) : "No hay paciente seleccionado"}.</p>
            <button type="button" class="ghost-button" data-workspace-action="select-critical">Ir al mas critico</button>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "daily-summary") {
    renderWorkspace("Resumen del dia", summarizeDay());
    return;
  }

  if (action === "quick-history") {
    renderWorkspace(
      "Historial rapido",
      patient
        ? `
          <div class="workspace-grid">
            <article class="workspace-card">
              <strong>${escapeHtml(patient.name)}</strong>
              <p>Condicion base: ${escapeHtml(patient.condition)}</p>
              <p>Estado: ${escapeHtml(patient.status)}</p>
              <p>Signos: ${patient.bloodPressureSystolic || "--"}/${patient.bloodPressureDiastolic || "--"} · ${patient.pulse || "--"} bpm · ${patient.oxygenSaturation || "--"}% O2</p>
            </article>
            <article class="workspace-card">
              <strong>Notas clinicas</strong>
              <p>${escapeHtml(patient.notes || "Sin notas registradas.")}</p>
              <button type="button" class="ghost-button" data-panel-target="shift-notes">Abrir notas</button>
            </article>
          </div>
        `
        : `<article class="workspace-card"><strong>Historial rapido</strong><p>Selecciona un paciente para ver su resumen clinico.</p></article>`
    );
    return;
  }

  if (action === "surgery-assist") {
    renderWorkspace(
      "Asistencia quirurgica",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Checklist previo</strong>
            <ul>
              <li>Confirmar identidad del paciente.</li>
              <li>Validar presion, pulso y saturacion recientes.</li>
              <li>Verificar antecedentes respiratorios y cardiacos.</li>
            </ul>
          </article>
          <article class="workspace-card">
            <strong>Apoyo IA</strong>
            <p>Usa el widget medico para revisar ventanas de riesgo antes de remitir a procedimiento.</p>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "calendar-view") {
    renderWorkspace("Calendario", `<div class="workspace-grid">${buildCalendarMarkup()}</div>`);
    return;
  }

  if (action === "active-patients") {
    renderWorkspace("Pacientes activos", summarizeDay());
    document.querySelector('[data-widget-key="patients"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (action === "remote-monitoring") {
    renderWorkspace(
      "Monitoreo remoto",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Pacientes sugeridos</strong>
            <p>${state.patients.filter((item) => getRiskScore(item) >= 4).length} pacientes califican para vigilancia estrecha.</p>
          </article>
          <article class="workspace-card">
            <strong>Regla operativa</strong>
            <p>Prioriza saturacion de O2, frecuencia respiratoria, glucosa y alertas a 72 horas.</p>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "labs-overview") {
    renderWorkspace("Laboratorios", `<div class="workspace-grid">${buildLabsOverviewMarkup()}</div>`);
    document.querySelector('[data-widget-key="labs"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (action === "shift-notes") {
    renderWorkspace(
      "Notas del turno",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Paciente actual</strong>
            <p>${patient ? escapeHtml(patient.name) : "Sin paciente seleccionado"}.</p>
            <button type="button" class="ghost-button" data-workspace-action="focus-notes">Abrir widget de notas</button>
          </article>
          <article class="workspace-card">
            <strong>Sugerencia</strong>
            <p>Documenta hallazgos respiratorios, cambios de tratamiento y hora de reevaluacion.</p>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "visual-settings") {
    renderWorkspace(
      "Configuracion visual",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Tema</strong>
            <p>Alterna entre modo claro y oscuro manteniendo el estilo pastel.</p>
            <button type="button" class="ghost-button" data-workspace-action="toggle-theme">Cambiar tema</button>
          </article>
          <article class="workspace-card">
            <strong>Layout</strong>
            <p>Activa la edicion para mover widgets con guias de margen visibles.</p>
            <button type="button" class="ghost-button" data-workspace-action="enable-layout">Editar layout</button>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "support-center") {
    renderWorkspace(
      "Soporte",
      `
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>Estado del sistema</strong>
            <p>Autenticacion Firebase, persistencia local y motor IA listos para uso clinico guiado.</p>
          </article>
          <article class="workspace-card">
            <strong>Recomendacion</strong>
            <p>Si una opcion no responde, revisa el banner superior y la conexion con Firestore.</p>
          </article>
        </div>
      `
    );
    return;
  }

  if (action === "care-plan") {
    const assessment = patient ? computeClinicalAssessment(patient) : null;
    renderWorkspace(
      "Plan sugerido",
      patient && assessment
        ? `
          <div class="workspace-grid">
            <article class="workspace-card">
              <strong>Plan para ${escapeHtml(patient.name)}</strong>
              <ul>
                ${assessment.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
            <article class="workspace-card">
              <strong>Ventanas de riesgo</strong>
              <p>72h: ${assessment.shortRisk}% · 1 semana: ${assessment.weekRisk}% · 1+ mes: ${assessment.longRisk}%.</p>
            </article>
          </div>
        `
        : `<article class="workspace-card"><strong>Plan sugerido</strong><p>Selecciona un paciente para generar un plan orientativo.</p></article>`
    );
  }
}

function renderDashboard() {
  const patient = getSelectedPatient();

  applyWidgetVisibility();
  renderQuickAccessList();
  renderPatientOverview(patient);
  renderMedicAi(patient);
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

  const riskCount = state.patients.filter((item) => getRiskScore(item) >= 5).length;
  doctorPanelPatients.textContent = `Pacientes registrados: ${state.patients.length}`;
  doctorPanelRisk.textContent = `Pacientes en riesgo: ${riskCount}`;
  doctorPanelTraining.textContent = state.trainingProfile.ready
    ? `Motor IA: calibrado con ${state.trainingProfile.datasetPatients} casos locales`
    : "Motor IA: usando perfil base mientras carga dataset";
}

async function loadClinicalTrainingProfile() {
  if (!window.XLSX) {
    aiTrainingBadge.textContent = "Sin libreria XLSX";
    return;
  }

  try {
    const [xlsxResponse, csvResponse] = await Promise.all([
      fetch("../test/230PatientsCOPD.xlsx"),
      fetch("../test/conteo_locations.csv"),
    ]);

    if (!xlsxResponse.ok) throw new Error("No se pudo abrir 230PatientsCOPD.xlsx");
    const workbookBuffer = await xlsxResponse.arrayBuffer();
    const workbook = window.XLSX.read(workbookBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const cleanedRows = rows.map((row) => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[String(key).trim()] = value;
      });
      return normalized;
    });

    const ageValues = cleanedRows.map((row) => Number(row.Age || 0)).filter(Boolean);
    const oxygenValues = cleanedRows
      .map((row) => normalizeOxygenValue(row["Oxygen Saturation"]))
      .filter(Boolean);
    const respValues = cleanedRows.map((row) => Number(row["Respiratory Rate"] || 0)).filter(Boolean);
    const packHistoryValues = cleanedRows.map((row) => Number(row["Pack History"] || 0)).filter((value) => value >= 0);
    const heartFailureValues = cleanedRows.filter(
      (row) => normalizeBooleanText(row["History of Heart Failure"]) === "Si"
    ).length;
    const smokingExposure = cleanedRows.filter((row) =>
      ["Activo", "Alta carga"].includes(normalizeSmokingStatus(row["status of smoking"]))
    ).length;
    const goldHigh = cleanedRows.filter((row) => Number(row["COPD GOLD"] || 0) >= 3).length;

    let locationCounts = { Barcelona: cleanedRows.length };
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      const lines = csvText.trim().split(/\r?\n/).slice(1);
      locationCounts = {};
      lines.forEach((line) => {
        const [location, count] = line.split(",");
        if (location) locationCounts[location.trim()] = Number(count || 0);
      });
    }

    state.trainingProfile = {
      ready: true,
      datasetPatients: cleanedRows.length,
      baseLocation: Object.keys(locationCounts)[0] || "Barcelona",
      locationCounts,
      meanAge: ageValues.reduce((sum, item) => sum + item, 0) / (ageValues.length || 1),
      meanOxygen: oxygenValues.reduce((sum, item) => sum + item, 0) / (oxygenValues.length || 1),
      meanRespRate: respValues.reduce((sum, item) => sum + item, 0) / (respValues.length || 1),
      meanPackHistory: packHistoryValues.reduce((sum, item) => sum + item, 0) / (packHistoryValues.length || 1),
      heartFailureRate: heartFailureValues / (cleanedRows.length || 1),
      smokingExposureRate: smokingExposure / (cleanedRows.length || 1),
      goldHighRate: goldHigh / (cleanedRows.length || 1),
    };

    aiTrainingBadge.textContent = `IA calibrada con ${state.trainingProfile.datasetPatients} registros`;
    doctorPanelTraining.textContent = `Motor IA: calibrado con ${state.trainingProfile.datasetPatients} casos locales`;
    renderDashboard();
  } catch (error) {
    state.trainingProfile = { ...fallbackTrainingProfile };
    aiTrainingBadge.textContent = "Usando perfil base";
    doctorPanelTraining.textContent = "Motor IA: perfil base cargado";
    setStatus(`No se completo la calibracion local: ${error.message}`, "error");
  }
}

function openMainMenuAction(action) {
  mainMenu.style.display = "none";
  renderWorkspaceAction(action);
}

async function createPatientAlert() {
  const patient = getSelectedPatient();
  if (!patient) {
    setStatus("Selecciona un paciente antes de generar la alerta.", "error");
    return;
  }

  const assessment = computeClinicalAssessment(patient);
  const alertText = `[Alerta IA] ${new Date().toLocaleString("es-CO")}: Riesgo 72h ${assessment.shortRisk}%, 1 semana ${assessment.weekRisk}%, 1+ mes ${assessment.longRisk}%. ${assessment.summary}`;

  try {
    await updateDoc(doc(db, "patients", patient.id), {
      notes: `${patient.notes ? `${patient.notes}\n\n` : ""}${alertText}`,
      lastAlertAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setStatus("Se agrego una alerta automatizada en las notas del paciente.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
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
  if (event.target === widgetPicker) hideWidgetPicker();
  if (event.target === quickAccessPicker) hideQuickAccessPicker();
  if (event.target === devNotice) hideDevNotice();
});

document.addEventListener("mousemove", (event) => {
  if (state.resizeSession) {
    handleWidgetResizeMove(event);
    return;
  }

  if (state.uiMode === "remove-widget") {
    handleWidgetInteractionMove(event);
  }
});

document.addEventListener("mouseup", () => {
  stopWidgetResize();
});

document.addEventListener("click", async (event) => {
  if (state.uiMode === "remove-widget") {
    if (!state.placementTarget?.key || state.placementCommitPending) return;
    const targetRect = widgetPlacementTarget.getBoundingClientRect();
    const insideTarget =
      event.clientX >= targetRect.left &&
      event.clientX <= targetRect.right &&
      event.clientY >= targetRect.top &&
      event.clientY <= targetRect.bottom;

    if (!insideTarget) return;
    event.preventDefault();
    state.placementCommitPending = true;
    await wait(220);
    if (state.uiMode !== "remove-widget" || !state.placementTarget?.key) {
      state.placementCommitPending = false;
      return;
    }
    await finalizeWidgetRemoval();
    state.placementCommitPending = false;
  }
});

document.addEventListener("contextmenu", (event) => {
  if (state.uiMode === "remove-widget") {
    event.preventDefault();
    cancelWidgetInteraction("Operacion cancelada. Puedes volver a intentarlo cuando quieras.");
    return;
  }
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
    document.querySelector('[data-widget-key="notes"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (action === "edit-layout") {
    state.persistedLayoutOrder = [...state.layoutOrder];
    state.draftLayoutOrder = [...state.layoutOrder];
    state.persistedWidgetSizes = { ...state.widgetSizes };
    state.draftWidgetSizes = { ...state.widgetSizes };
    setLayoutEditMode(true);
    setStatus("Modo de edicion activo. Arrastra widgets y confirma con el boton verde.", "info");
    return;
  }

  if (action === "add-widget") {
    showWidgetPicker();
    setStatus("Selecciona el widget que quieres agregar.", "info");
    return;
  }

  if (action === "remove-widget") {
    startRemoveWidgetFlow();
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

  widget.addEventListener("mousemove", (event) => {
    const direction = getResizeDirectionForPointer(widget, event.clientX, event.clientY);
    widget.dataset.resizeCursor = getResizeCursorToken(direction);
  });

  widget.addEventListener("mouseleave", () => {
    if (!state.resizeSession) {
      widget.dataset.resizeCursor = "";
    }
  });

  widget.addEventListener("mousedown", (event) => {
    if (!state.layoutEditMode || event.button !== 0) return;
    const direction = getResizeDirectionForPointer(widget, event.clientX, event.clientY);
    if (!direction) return;
    event.preventDefault();
    beginWidgetResize(widget, direction, event);
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
        oxygenSaturation: formData.get("oxygenSaturation"),
        respiratoryRate: formData.get("respiratoryRate"),
        hemoglobin: formData.get("hemoglobin"),
        creatinine: formData.get("creatinine"),
        bmi: formData.get("bmi"),
        copdGold: formData.get("copdGold"),
        smokingStatus: formData.get("smokingStatus"),
        heartFailureHistory: formData.get("heartFailureHistory"),
        locationCity: formData.get("locationCity"),
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
closeWorkspaceButton.addEventListener("click", closeWorkspace);

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

if (closeWidgetPickerButton) {
  closeWidgetPickerButton.addEventListener("click", hideWidgetPicker);
}

if (closeQuickAccessPickerButton) {
  closeQuickAccessPickerButton.addEventListener("click", hideQuickAccessPicker);
}

if (quickAccessPicker) {
  quickAccessPicker.addEventListener("click", (event) => {
    closeModalOnBackdropClick(event, quickAccessPicker, hideQuickAccessPicker);
  });
}

if (closeDevNoticeButton) {
  closeDevNoticeButton.addEventListener("click", hideDevNotice);
}

if (addQuickAccessButton) {
  addQuickAccessButton.addEventListener("click", showQuickAccessPicker);
}

if (removeQuickAccessButton) {
  removeQuickAccessButton.addEventListener("click", showQuickAccessRemovalPicker);
}

if (widgetPickerGrid) {
  widgetPickerGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-widget-pick]");
    if (!button) return;
    await addWidgetInstantly(button.dataset.widgetPick);
  });
}

if (quickAccessPickerGrid) {
  quickAccessPickerGrid.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-quick-remove-id]");
    if (removeButton) {
      const removed = state.quickAccessItems.find((item) => item.id === removeButton.dataset.quickRemoveId);
      state.quickAccessItems = state.quickAccessItems.filter((item) => item.id !== removeButton.dataset.quickRemoveId);
      hideQuickAccessPicker();
      renderQuickAccessList();
      await saveUserLayout();
      setStatus(`Acceso rapido ${removed?.label || "seleccionado"} eliminado correctamente.`, "success");
      return;
    }

    const button = event.target.closest("[data-quick-pick-target]");
    if (!button) return;

    const type = button.dataset.quickPickType;
    const target = button.dataset.quickPickTarget;
    const label =
      type === "widget"
        ? widgetCatalog[target]?.label || target
        : button.querySelector("strong")?.textContent || target;

    state.quickAccessItems.push({
      id: `qa-${type}-${target}`.replaceAll(/[^a-z0-9-]/gi, "-"),
      type,
      target,
      label,
    });
    hideQuickAccessPicker();
    renderQuickAccessList();
    await saveUserLayout();
    setStatus(`Acceso rapido ${label} agregado correctamente.`, "success");
  });
}

mainMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-action]");
  if (!button) return;
  openMainMenuAction(button.dataset.pageAction);
});

leftPanel.addEventListener("click", (event) => {
  const quickAccessButton = event.target.closest("[data-quick-access-id]");
  if (quickAccessButton) {
    const item = state.quickAccessItems.find((entry) => entry.id === quickAccessButton.dataset.quickAccessId);
    triggerQuickAccess(item);
    return;
  }

  const button = event.target.closest("[data-panel-target]");
  if (!button) return;
  renderWorkspaceAction(button.dataset.panelTarget);
});

rightPanel.addEventListener("click", (event) => {
  const devButton = event.target.closest("[data-dev-option]");
  if (!devButton) return;
  showDevNotice(devButton.dataset.devOption);
});

workspaceBody.addEventListener("click", (event) => {
  const panelButton = event.target.closest("[data-panel-target]");
  const actionButton = event.target.closest("[data-workspace-action]");

  if (panelButton) {
    renderWorkspaceAction(panelButton.dataset.panelTarget);
    return;
  }

  if (!actionButton) return;

  if (actionButton.dataset.workspaceAction === "register-shift") {
    const records = JSON.parse(localStorage.getItem("foxcat-shifts") || "[]");
    records.push({
      at: new Date().toISOString(),
      doctor: auth.currentUser?.email || auth.currentUser?.displayName || "Medico",
    });
    localStorage.setItem("foxcat-shifts", JSON.stringify(records));
    setStatus("Turno registrado localmente.", "success");
    return;
  }

  if (actionButton.dataset.workspaceAction === "select-critical") {
    const mostCritical = [...state.patients].sort((a, b) => getRiskScore(b) - getRiskScore(a))[0];
    if (mostCritical) {
      state.selectedPatientId = mostCritical.id;
      renderDashboard();
      setStatus(`Se enfoco el paciente con mayor riesgo: ${mostCritical.name}.`, "success");
    }
    return;
  }

  if (actionButton.dataset.workspaceAction === "focus-notes") {
    document.querySelector('[data-widget-key="notes"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (actionButton.dataset.workspaceAction === "toggle-theme") {
    themeToggleButton.click();
    return;
  }

  if (actionButton.dataset.workspaceAction === "enable-layout") {
    state.persistedLayoutOrder = [...state.layoutOrder];
    state.draftLayoutOrder = [...state.layoutOrder];
    state.persistedWidgetSizes = { ...state.widgetSizes };
    state.draftWidgetSizes = { ...state.widgetSizes };
    setLayoutEditMode(true);
    setStatus("Modo de edicion activado desde configuracion visual.", "info");
  }
});

medicAiWidget.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-ai-action]");
  if (!actionButton) return;

  if (actionButton.dataset.aiAction === "schedule") {
    renderWorkspaceAction("calendar-view");
    setStatus("Revisando agenda disponible para el paciente actual.", "success");
    return;
  }

  if (actionButton.dataset.aiAction === "alert-patient") {
    await createPatientAlert();
    return;
  }

  if (actionButton.dataset.aiAction === "run-selected") {
    const select = medicAiWidget.querySelector("#aiActionSelect");
    if (!select?.value) {
      setStatus("Selecciona primero una opcion del menu de la IA.", "error");
      return;
    }
    renderWorkspaceAction(select.value);
    setStatus(`Se abrio la opcion ${select.options[select.selectedIndex].text}.`, "success");
    select.value = "";
  }
});

medicAiWidget.addEventListener("change", (event) => {
  const select = event.target.closest("#aiActionSelect");
  if (!select || !select.value) return;
  setStatus(`Opcion seleccionada: ${select.options[select.selectedIndex].text}. Usa el boton para abrirla.`, "info");
});

async function bootDashboard() {
  syncTopbarOffset();
  applyWidgetOrder(defaultWidgetOrder);
  applyWidgetSizes({});
  widgetElements.forEach((widget) => resizeObserver.observe(widget));

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    setStatus(`Firebase no termino de inicializar: ${error.message}`, "error");
  }

  loadClinicalTrainingProfile();

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

window.addEventListener("resize", syncTopbarOffset);

bootDashboard();
