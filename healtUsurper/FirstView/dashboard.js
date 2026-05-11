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
import { loadTrainingManifest, summarizeActiveModel } from "../ai/model-loader.js";

const DEFAULT_ALTITUDE_METERS = 12;

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
  Bogota: {
    label: "Bogota",
    altitude: 2640,
    careFocus: "altitud alta con reserva respiratoria exigida y mayor carga cardiovascular",
    accessPressure: 1.13,
    oxygenAdjustment: 3.2,
    climate: "frio urbano de altura",
    temperatureC: 14,
    airQuality: "variable urbana",
    airQualityIndex: 82,
    humidity: 69,
    respiratoryStress: 1.16,
    recommendationFocus: "vigilar desaturacion, disnea de esfuerzo y descompensacion cardiopulmonar en altura",
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
  meanAltitude: 12,
  heartFailureRate: 0.32,
  smokingExposureRate: 0.63,
  goldHighRate: 0.37,
  respiratoryFailureRate: 0.29,
  cardiacFailureRate: 0.24,
  dangerousSymptomRate: 0.31,
  highPackHistoryRate: 0.28,
  locationElevations: { Barcelona: 12, Cali: 1018, Medellin: 1495, Pasto: 2527, Bogota: 2640, Ipiales: 2890 },
  specializedOutcomes: {},
  sourceFiles: ["230PatientsCOPD.xlsx", "COPD_Patients_Database.xlsx", "Locations_Elevation.csv"],
  calibrationMode: "Perfil base local de respaldo",
  sampleRows: [
    "Edad 67 | O2 93% | FR 20 | GOLD 2 | Tabaquismo exfumador",
    "Edad 71 | O2 90% | FR 24 | GOLD 3 | Falla cardiaca Si",
    "Edad 63 | O2 95% | FR 18 | GOLD 1 | Tabaquismo nunca",
  ],
  selectedModelName: "Perfil base local sin manifest",
  selectedModelPrecision: 82,
  triagePrecision: 82,
  hospitalizationPrecision: 82,
  minimumPrecisionTarget: 90,
  retrainedWithAdjustments: false,
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
  trainingManifest: null,
  workspaceAction: null,
  hiddenWidgetKeys: [],
  quickAccessItems: [...defaultQuickAccess],
  uiMode: "idle",
  placementTarget: null,
  removeTargetKey: null,
  quickAccessPickerMode: "add",
  placementCommitPending: false,
  resizeSession: null,
  aiDebugOpen: false,
  aiDebugMinimized: false,
  aiDebugPosition: { x: null, y: null },
  aiDebugDrag: null,
  aiDebugSize: { width: 560, height: 640 },
  aiDebugResizeSession: null,
};

const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");
const leftToggle = document.getElementById("leftToggle");
const rightToggle = document.getElementById("rightToggle");
const topbar = document.querySelector(".topbar");
const quickAccessList = document.getElementById("quickAccessList");
const addQuickAccessButton = document.getElementById("addQuickAccessButton");
const removeQuickAccessButton = document.getElementById("removeQuickAccessButton");
const mainMenuButton = document.getElementById("mainMenuButton");
const mainMenu = document.getElementById("mainMenu");
const doctorMenuButton = document.getElementById("doctorMenuButton");
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
const aiDebugToggleButton = document.getElementById("aiDebugToggleButton");
const aiDebugWindow = document.getElementById("aiDebugWindow");
const aiDebugHeader = document.getElementById("aiDebugHeader");
const aiDebugBody = document.getElementById("aiDebugBody");
const aiDebugResizeHandles = document.querySelectorAll("[data-ai-debug-resize]");
const minimizeAiDebugButton = document.getElementById("minimizeAiDebugButton");
const closeAiDebugButton = document.getElementById("closeAiDebugButton");
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
  if (raw.includes("bogot")) return "Bogota";
  if (raw.includes("pasto")) return "Pasto-Narino";
  if (raw.includes("medell")) return "Medellin";
  if (raw.includes("cali")) return "Cali";
  if (raw.includes("ipiales")) return "Ipiales";
  if (raw.includes("barcelona")) return "Barcelona";
  return "Barcelona";
}

function normalizeLocationRiskLevel(value) {
  const match = String(value || "").match(/risk\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function parseNumericOrKeyword(value, fallback = 0) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return Number(fallback || 0);
  if (raw === "higher" || raw === "high") return 108;
  if (raw === "normal") return 82;
  if (raw === "lower" || raw === "low") return 58;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : Number(fallback || 0);
}

function mapBloodPressureCategory(value) {
  const raw = String(value || "").trim().toLowerCase().replaceAll(" ", "");
  if (raw === "crisis") return { systolic: 185, diastolic: 118 };
  if (raw === "stage2") return { systolic: 168, diastolic: 102 };
  if (raw === "higher") return { systolic: 156, diastolic: 96 };
  if (raw === "stage1") return { systolic: 146, diastolic: 92 };
  if (raw === "elevate") return { systolic: 132, diastolic: 86 };
  return { systolic: 120, diastolic: 78 };
}

function getLocationElevationMeters(locationCity) {
  const normalized = normalizeRegionName(locationCity);
  const manifestElevations = state.trainingProfile?.locationElevations || {};
  const manifestKey = Object.keys(manifestElevations).find(
    (key) => normalizeRegionName(key) === normalized
  );
  if (manifestKey) return Number(manifestElevations[manifestKey] || 0) || DEFAULT_ALTITUDE_METERS;

  const region = regionProfiles[normalized];
  return Number(region?.altitude || DEFAULT_ALTITUDE_METERS);
}

function getRegionProfile(locationCity) {
  const normalized = normalizeRegionName(locationCity);
  const baseRegion = regionProfiles[normalized] || regionProfiles.Barcelona;
  const altitude = getLocationElevationMeters(locationCity);
  const altitudeDelta = altitude - Number(baseRegion.altitude || DEFAULT_ALTITUDE_METERS);
  return {
    ...baseRegion,
    altitude,
    oxygenAdjustment: Math.max(0, Number(baseRegion.oxygenAdjustment || 0) + Math.max(0, altitudeDelta / 1200)),
  };
}

function getRawField(raw, ...keys) {
  for (const key of keys) {
    if (raw?.[key] !== undefined && raw?.[key] !== null && String(raw[key]).trim() !== "") {
      return raw[key];
    }
  }
  return "";
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
  const elevation = Number(patient.locationElevationM || getLocationElevationMeters(patient.locationCity));

  if (patient.status === "Critico") score += 5;
  else if (patient.status === "Riesgo") score += 3;

  if (oxygen && oxygen < 92) score += 4;
  if (patient.glucose >= 200) score += 2;
  if (patient.pulse >= 100) score += 1;
  if (patient.bloodPressureSystolic >= 150) score += 1;
  if (patient.respiratoryRate >= 24) score += 2;
  if (Number(patient.copdGold) >= 3) score += 2;
  if (patient.heartFailureHistory === "Si") score += 2;
  if (Number(patient.packHistory || 0) >= 40) score += 2;
  if (elevation >= 2400 && patient.smokingStatus !== "Nunca") score += 2;
  else if (elevation >= 1400 && ["Activo", "Alta carga"].includes(patient.smokingStatus)) score += 1;

  return score;
}

function normalizePatient(patientDoc) {
  const data = patientDoc.data();
  const normalizedCity = regionProfiles[normalizeRegionName(data.locationCity)]?.label || "Barcelona";
  const derivedElevation = Number(data.locationElevationM || data.locationElevationMeters || 0) || getLocationElevationMeters(normalizedCity);
  const derivedRiskLevel = Number(data.locationRiskLevel || 0) || normalizeLocationRiskLevel(data.locationCity);

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
    packHistory: Number(data.packHistory || 0),
    copdGold: Number(data.copdGold || 0),
    smokingStatus: normalizeSmokingStatus(data.smokingStatus),
    heartFailureHistory: normalizeBooleanText(data.heartFailureHistory),
    locationCity: normalizedCity,
    locationElevationM: derivedElevation,
    locationRiskLevel: derivedRiskLevel,
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

function getTopbarScrollOffset(extra = 18) {
  const measuredHeight = Math.ceil(topbar?.getBoundingClientRect().height || 104);
  return measuredHeight + extra;
}

function scrollElementIntoViewport(element, options = {}) {
  if (!element) return;

  const { align = "start", extraOffset = 18, behavior = "smooth" } = options;
  const rect = element.getBoundingClientRect();
  const currentY = window.scrollY || window.pageYOffset || 0;
  const offset = getTopbarScrollOffset(extraOffset);
  let targetTop = rect.top + currentY - offset;

  if (align === "center") {
    targetTop = rect.top + currentY - offset - Math.max(0, (window.innerHeight - rect.height) / 2.4);
  }

  window.scrollTo({
    top: Math.max(0, Math.round(targetTop)),
    behavior,
  });
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
  const rawLocation = getRawField(raw, "locationCity", "Ciudad", "Location");
  const normalizedCity = regionProfiles[normalizeRegionName(rawLocation)]?.label || "Barcelona";
  const bloodPressureCategory = getRawField(raw, "Blood pressure");
  const derivedPressure = mapBloodPressureCategory(bloodPressureCategory);
  const oxygenSaturation = normalizeOxygenValue(getRawField(raw, "oxygenSaturation", "SaturacionO2", "Oxygen Saturation"));
  const respiratoryRate = Number(getRawField(raw, "respiratoryRate", "FrecuenciaRespiratoria", "Respiratory Rate") || 0);
  const pulse = parseNumericOrKeyword(getRawField(raw, "pulse", "Pulso", "Heart Rate"), 0);
  const copdGold = Number(getRawField(raw, "copdGold", "COPD GOLD") || 0);
  const heartFailureHistory = normalizeBooleanText(
    getRawField(raw, "heartFailureHistory", "FallaCardiaca", "History of Heart Failure")
  );
  const packHistory = Number(getRawField(raw, "packHistory", "Pack History") || 0);
  const derivedStatus =
    String(getRawField(raw, "status", "Estado") || "").trim() ||
    (oxygenSaturation < 89 || respiratoryRate >= 30 || copdGold >= 4
      ? "Critico"
      : oxygenSaturation < 93 || respiratoryRate >= 24 || heartFailureHistory === "Si"
        ? "Riesgo"
        : "Estable");

  return {
    name: String(getRawField(raw, "name", "Nombre") || `Paciente EPOC ${getRawField(raw, "ID Number", "ID Number\n", "documentId", "Documento") || "sin-id"}`).trim(),
    documentId: String(getRawField(raw, "documentId", "Documento", "ID Number", "ID Number\n") || "").trim(),
    age: Number(getRawField(raw, "age", "Edad", "Age") || 0),
    condition: String(getRawField(raw, "condition", "Condicion", "Condition") || "EPOC").trim(),
    status: derivedStatus,
    photoUrl: String(getRawField(raw, "photoUrl", "Foto") || "").trim(),
    bloodPressureSystolic: Number(getRawField(raw, "bloodPressureSystolic") || derivedPressure.systolic || 0),
    bloodPressureDiastolic: Number(getRawField(raw, "bloodPressureDiastolic") || derivedPressure.diastolic || 0),
    pulse,
    glucose: Number(getRawField(raw, "glucose", "Glucosa") || 0),
    hemoglobin: Number(getRawField(raw, "hemoglobin", "Hemoglobina") || 0),
    creatinine: Number(getRawField(raw, "creatinine", "Creatinina") || 0),
    oxygenSaturation,
    respiratoryRate,
    bmi: Number(getRawField(raw, "bmi", "BMI, kg/m2") || 0),
    packHistory,
    copdGold,
    smokingStatus: normalizeSmokingStatus(getRawField(raw, "smokingStatus", "status of smoking", "Tabaquismo")),
    heartFailureHistory,
    locationCity: normalizedCity,
    locationElevationM: Number(getRawField(raw, "locationElevationM", "locationElevationMeters") || 0) || getLocationElevationMeters(normalizedCity),
    locationRiskLevel: Number(getRawField(raw, "locationRiskLevel") || 0) || normalizeLocationRiskLevel(rawLocation),
    ward: String(getRawField(raw, "ward", "Area", "working place") || "").trim(),
    room: String(getRawField(raw, "room", "Habitacion") || "").trim(),
    appointmentTime: String(getRawField(raw, "appointmentTime") || "").trim(),
    monitoringTime: String(getRawField(raw, "monitoringTime") || "").trim(),
    labTime: String(getRawField(raw, "labTime") || "").trim(),
    notes: String(getRawField(raw, "notes", "Notas") || "").trim(),
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
      PackYears: patient.packHistory,
      Hemoglobina: patient.hemoglobin,
      Creatinina: patient.creatinine,
      BMI: patient.bmi,
      COPD_GOLD: patient.copdGold,
      Tabaquismo: patient.smokingStatus,
      FallaCardiaca: patient.heartFailureHistory,
      Altitud_msnm: patient.locationElevationM,
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
    PackYears: patient.packHistory,
    Hemoglobina: patient.hemoglobin,
    Creatinina: patient.creatinine,
    BMI: patient.bmi,
    COPD_GOLD: patient.copdGold,
    Tabaquismo: patient.smokingStatus,
    FallaCardiaca: patient.heartFailureHistory,
    Altitud_msnm: patient.locationElevationM,
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
  const assessment = computeClinicalAssessment(patient);

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
  if (assessment?.outcomeRisks?.respiratory >= 70) {
    alerts.push({ tone: "critical", text: `Riesgo respiratorio alto: ${assessment.outcomeRisks.respiratory}%.` });
  }
  if (assessment?.outcomeRisks?.cardiac >= 70) {
    alerts.push({ tone: "warning", text: `Riesgo cardiaco relevante: ${assessment.outcomeRisks.cardiac}%.` });
  }
  if (assessment?.outcomeRisks?.dangerousSymptom >= 70) {
    alerts.push({ tone: "warning", text: `Riesgo de nuevo sintoma peligroso: ${assessment.outcomeRisks.dangerousSymptom}%.` });
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

  const region = getRegionProfile(patient.locationCity);
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
        setStatus(formatAppError(error, "eliminacion del paciente"), "error");
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
    `Modelo entrenado: ${training.selectedModelName || "Perfil base"}`,
    `Base local: ${training.datasetPatients} casos de referencia`,
    `Origen principal: ${training.baseLocation}`,
    `Edad promedio referencia: ${training.meanAge.toFixed(0)} anos`,
    `Saturacion base: ${training.meanOxygen.toFixed(0)}%`,
    `Altitud media de referencia: ${Math.round(Number(training.meanAltitude || DEFAULT_ALTITUDE_METERS))} m`,
  ];
}

function getTechnicalPrecision(assessment) {
  if (!assessment) return 0;

  const datasetFactor = Math.min(1, state.trainingProfile.datasetPatients / 230);
  const coverageFactor = assessment.confidence / 100;
  return Math.round((coverageFactor * 0.7 + datasetFactor * 0.3) * 100);
}

function formatDebugTimestamp(value) {
  if (!value) return "sin fecha";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildAiDebugData(patient) {
  const training = state.trainingProfile;
  const manifest = state.trainingManifest || {};
  const activeModel = manifest.activeModel || {};
  const candidateModels = Array.isArray(manifest.candidateModels) ? [...manifest.candidateModels] : [];
  const rankedCandidates = candidateModels
    .sort((a, b) => Number(b.combinedPrecision || 0) - Number(a.combinedPrecision || 0))
    .slice(0, 5);
  const riskMathValidation = manifest.riskMathValidation || null;
  const assessment = patient ? computeClinicalAssessment(patient) : null;
  const region = patient ? getRegionProfile(patient.locationCity) : null;
  const precision = getTechnicalPrecision(assessment);
  const modelPrecision = Number(activeModel.combinedPrecision || training.selectedModelPrecision || 0);
  const coverageFields = [
    { label: "Documento", value: patient?.documentId },
    { label: "Edad", value: patient?.age },
    { label: "Saturacion O2", value: patient?.oxygenSaturation },
    { label: "Frecuencia respiratoria", value: patient?.respiratoryRate },
    { label: "Pulso", value: patient?.pulse },
    { label: "Glucosa", value: patient?.glucose },
    { label: "Creatinina", value: patient?.creatinine },
    { label: "COPD GOLD", value: patient?.copdGold },
    { label: "Pack-years", value: patient?.packHistory },
    { label: "Ciudad clinica", value: patient?.locationCity },
    { label: "Altitud", value: patient?.locationElevationM },
    { label: "Antecedente cardiaco", value: patient?.heartFailureHistory },
    { label: "Estado clinico", value: patient?.status },
    { label: "Tabaquismo", value: patient?.smokingStatus },
    { label: "Hemoglobina", value: patient?.hemoglobin },
    { label: "IMC", value: patient?.bmi },
  ];
  const foundCoverageCount = coverageFields.filter(({ value }) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0;
    return String(value).trim() !== "";
  }).length;
  const availableCoverageLabels = coverageFields
    .filter(({ value }) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "number") return Number.isFinite(value) && value !== 0;
      return String(value).trim() !== "";
    })
    .map(({ label }) => label);
  const missingCoverageLabels = coverageFields
    .filter(({ value }) => {
      if (value === null || value === undefined) return true;
      if (typeof value === "number") return !Number.isFinite(value) || value === 0;
      return String(value).trim() === "";
    })
    .map(({ label }) => label);
  const totalCoverageCount = coverageFields.length;
  const locationSummary = Object.entries(training.locationCounts || {})
    .slice(0, 4)
    .map(([location, count]) => `${location}: ${count}`)
    .join(" | ");
  const triagePrecision = Number(activeModel.triage?.precision_weighted || training.triagePrecision || 0);
  const hospitalizationPrecision = Number(activeModel.hospitalization?.precision_weighted || training.hospitalizationPrecision || 0);
  const generatedAtLabel = formatDebugTimestamp(manifest.generatedAt);
  const manifestFreshnessMinutes = manifest.generatedAt
    ? Math.max(0, Math.round((Date.now() - new Date(manifest.generatedAt).getTime()) / 60000))
    : null;
  const validationSummary = manifest.riskMathValidation?.summary || "Sin bloque de validacion heuristica en el manifiesto actual.";
  const patientSignalLines = patient
    ? [
        `Documento: ${patient.documentId || "sin dato"}`,
        `Estado actual: ${patient.status || "sin dato"}`,
        `Ciudad: ${region?.label || patient.locationCity || training.baseLocation}`,
        `Servicio / cama: ${patient.ward || "sin dato"} / ${patient.room || "sin dato"}`,
        `Condicion principal: ${patient.condition || "sin dato"}`,
      ]
    : ["Selecciona un paciente para ver la senal clinica completa del turno."];

  return {
    assessment,
    precision,
    modelPrecision,
    modelTarget: Number(training.minimumPrecisionTarget || 90),
    modelStatus: modelPrecision >= Number(training.minimumPrecisionTarget || 90) ? "Cumple minimo" : "Debajo del minimo",
    foundCoverageCount,
    totalCoverageCount,
    availableCoverageLabels,
    missingCoverageLabels,
    modelName: training.selectedModelName || (training.ready
      ? "Foxcat Explainable Heuristic v1 - calibracion local COPD"
      : "Foxcat Explainable Heuristic v1 - perfil base de respaldo"),
    generatedAt: manifest.generatedAt || "",
    generatedAtLabel,
    manifestFreshnessMinutes,
    selectedMetric: manifest.selectedMetric || "combined_precision_weighted",
    modelAdjusted: Boolean(activeModel.adjusted),
    modelArtifacts: activeModel.artifacts || {},
    modelArtifactsCount: Object.values(activeModel.artifacts || {}).filter(Boolean).length,
    triageMetrics: activeModel.triage || {},
    hospitalizationMetrics: activeModel.hospitalization || {},
    triagePrecision,
    hospitalizationPrecision,
    combinedAucRoc: Number(activeModel.combinedAucRoc || 0),
    candidateCount: candidateModels.length,
    rankedCandidates,
    riskMathValidation,
    validationSummary,
    calibrationMode: training.calibrationMode || (training.ready ? "Calibracion estadistica local" : "Perfil base local"),
    trainingReady: Boolean(training.ready),
    retrainedWithAdjustments: Boolean(training.retrainedWithAdjustments),
    trainingSummary: training.ready
      ? `Training.py cargo ${training.datasetPatients} registros desde ${training.sourceFiles?.join(" + ") || "dataset local"} para recalcular medias, tasas y distribucion por ciudad. Modelo activo: ${training.selectedModelName || "sin nombre"} con precision combinada ${training.selectedModelPrecision || precision}%.`
      : "No hubo entrenamiento en tiempo real. El motor usa un perfil base de respaldo con medias predefinidas.",
    sourceFiles: training.sourceFiles?.join(", ") || "Dataset local",
    sampleRows: training.sampleRows?.length ? training.sampleRows : fallbackTrainingProfile.sampleRows,
    locationSummary: locationSummary || "Barcelona: 230",
    datasetPatients: Number(training.datasetPatients || 0),
    baseLocation: training.baseLocation || "Barcelona",
    meanAge: Number(training.meanAge || 0),
    meanOxygen: Number(training.meanOxygen || 0),
    meanRespRate: Number(training.meanRespRate || 0),
    meanAltitude: Number(training.meanAltitude || DEFAULT_ALTITUDE_METERS),
    heartFailureRate: Math.round(Number(training.heartFailureRate || 0) * 100),
    smokingExposureRate: Math.round(Number(training.smokingExposureRate || 0) * 100),
    goldHighRate: Math.round(Number(training.goldHighRate || 0) * 100),
    respiratoryFailureRate: Math.round(Number(training.respiratoryFailureRate || 0) * 100),
    cardiacFailureRate: Math.round(Number(training.cardiacFailureRate || 0) * 100),
    dangerousSymptomRate: Math.round(Number(training.dangerousSymptomRate || 0) * 100),
    patientSignalLines,
    activeVariables: [
      `Edad actual: ${patient?.age || "sin dato"}`,
      `Saturacion O2: ${patient?.oxygenSaturation || "sin dato"}%`,
      `Frecuencia respiratoria: ${patient?.respiratoryRate || "sin dato"} rpm`,
      `Pulso: ${patient?.pulse || "sin dato"} bpm`,
      `Pack-years: ${patient?.packHistory || "sin dato"}`,
      `Glucosa: ${patient?.glucose || "sin dato"} mg/dL`,
      `Creatinina: ${patient?.creatinine || "sin dato"} mg/dL`,
      `COPD GOLD: ${patient?.copdGold || "sin dato"}`,
      `Tabaquismo: ${patient?.smokingStatus || "sin dato"}`,
      `Falla cardiaca: ${patient?.heartFailureHistory || "sin dato"}`,
      `Region activa: ${region?.label || training.baseLocation}`,
      `AQI regional: ${region?.airQualityIndex || "sin dato"}`,
      `Altitud regional: ${region?.altitude || "sin dato"} m`,
    ],
    mathLines: assessment
      ? [
          `O2 esperada = max(88, ${training.meanOxygen.toFixed(1)} - ajusteRegional ${region?.oxygenAdjustment || 0}) = ${Math.round(assessment.expectedOxygen)}%`,
          `Riesgo 72h = base + estado + oxigenacion + FR + pulso + glucosa + creatinina + COPD + tabaquismo + falla cardiaca + altitud`,
          `Confianza de entrada = variables presentes / variables evaluadas = ${assessment.confidence}%`,
          `Cobertura del paciente = ${foundCoverageCount}/${totalCoverageCount} datos relevantes detectados en la ultima revision`,
          `Precision tecnica estimada = 0.7 * confianza + 0.3 * coberturaDataset = ${precision}%`,
          `Subriesgos: respiratorio ${assessment.outcomeRisks?.respiratory || 0}% | cardiaco ${assessment.outcomeRisks?.cardiac || 0}% | sintoma peligroso ${assessment.outcomeRisks?.dangerousSymptom || 0}%`,
          `Modelo ganador = ${training.selectedModelName || "sin nombre"} con ${modelPrecision}% sobre minimo ${Number(training.minimumPrecisionTarget || 90)}%`,
        ]
      : [
          "Selecciona un paciente para ver la matematica aplicada por el motor heuristico.",
        ],
    processLog: assessment
      ? [
          "1. Leer paciente seleccionado desde Firestore sincronizado.",
          `2. Normalizar ciudad y cargar perfil regional de ${region?.label || training.baseLocation}.`,
          `3. Ajustar por altitud ${region?.altitude || DEFAULT_ALTITUDE_METERS} m y carga tabaquica ${patient.packHistory || 0} pack-years.`,
          `4. Comparar saturacion observada (${patient.oxygenSaturation || "sin dato"}%) con saturacion esperada (${Math.round(assessment.expectedOxygen)}%).`,
          `5. Calcular subriesgos respiratorio, cardiaco y de sintoma peligroso antes de consolidar ventanas temporales.`,
          `6. Generar recomendaciones explicables con ${assessment.triggers.length} detonantes activos.`,
        ]
      : [
          "1. Esperando paciente activo.",
          "2. El panel mostrara trazas y variables cuando haya un caso seleccionado.",
        ],
    triggerLines: assessment?.triggers?.length ? assessment.triggers : ["Sin detonantes visibles hasta seleccionar un paciente."],
    recommendationLines: assessment?.recommendations?.length ? assessment.recommendations : ["Sin recomendaciones visibles hasta seleccionar un paciente."],
  };
}

function renderAiDebugWindow() {
  if (!aiDebugWindow || !aiDebugBody) return;

  aiDebugWindow.hidden = !state.aiDebugOpen;
  aiDebugWindow.classList.toggle("minimized", state.aiDebugMinimized);
  if (minimizeAiDebugButton) {
    minimizeAiDebugButton.textContent = state.aiDebugMinimized ? "+" : "-";
  }

  if (!state.aiDebugOpen) return;

  const patient = getSelectedPatient();
  const debugData = buildAiDebugData(patient);
  const rankedCandidateItems = debugData.rankedCandidates.length
    ? debugData.rankedCandidates
        .map(
          (candidate, index) => `
            <li>
              #${index + 1} ${escapeHtml(candidate.name)} - Precision ${Number(candidate.combinedPrecision || 0)}% - AUC ${Number(candidate.combinedAucRoc || 0)}%${candidate.adjusted ? " - reentrenado" : ""}
            </li>
          `
        )
        .join("")
    : `<li>No hay ranking de candidatos disponible.</li>`;
  const riskValidationLines = debugData.riskMathValidation
    ? [
        `AUC-ROC heuristico vs hospitalizacion: ${Math.round(Number(debugData.riskMathValidation.hospitalization_alignment?.auc_roc || 0) * 100)}%`,
        `Sensibilidad heuristica: ${Math.round(Number(debugData.riskMathValidation.hospitalization_alignment?.sensitivity || 0) * 100)}%`,
        `Especificidad heuristica: ${Math.round(Number(debugData.riskMathValidation.hospitalization_alignment?.specificity || 0) * 100)}%`,
        `Spearman O2 vs riesgo: ${Number(debugData.riskMathValidation.monotonic_checks?.oxygen_vs_risk_spearman || 0).toFixed(3)}`,
        `Spearman FR vs riesgo: ${Number(debugData.riskMathValidation.monotonic_checks?.respiratory_rate_vs_risk_spearman || 0).toFixed(3)}`,
        `Cobertura de recomendaciones: ${Math.round(Number(debugData.riskMathValidation.recommendation_checks?.recommendation_coverage || 0) * 100)}%`,
        `Cobertura de detonantes: ${Math.round(Number(debugData.riskMathValidation.recommendation_checks?.trigger_coverage || 0) * 100)}%`,
      ]
    : ["Sin bloque de validacion heuristica en el manifiesto actual."];
  aiDebugBody.innerHTML = `
    <section class="ai-debug-section">
      <strong>Motor activo</strong>
      <div class="ai-debug-grid">
        <div class="ai-debug-metric">
          <span>Modelo entrenado</span>
          <strong>${escapeHtml(debugData.modelName)}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>IA entrenada</span>
          <strong>${debugData.trainingReady ? "Si, manifest cargado" : "Perfil base de respaldo"}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Porcentaje de precision</span>
          <strong>${debugData.modelPrecision}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Estado frente al minimo</span>
          <strong>${escapeHtml(debugData.modelStatus)} (${debugData.modelTarget}% minimo)</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Modo de calibracion</span>
          <strong>${escapeHtml(debugData.calibrationMode)}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Precision tecnica estimada</span>
          <strong>${debugData.precision}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Paciente analizado</span>
          <strong>${escapeHtml(patient?.name || "Sin paciente seleccionado")}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Manifest generado</span>
          <strong>${escapeHtml(debugData.generatedAtLabel)}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Metrica de seleccion</span>
          <strong>${escapeHtml(debugData.selectedMetric)}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Ultimos datos disponibles</span>
          <strong>${debugData.foundCoverageCount}/${debugData.totalCoverageCount} datos encontrados</strong>
        </div>
      </div>
      <p class="ai-debug-note">El modelo mostrado corresponde al mejor entrenamiento exportado por Training.py, con objetivo minimo de ${debugData.modelTarget}%. La precision tecnica estimada sigue siendo una metrica operativa por paciente basada en cobertura de variables, senal del caso y dataset local.</p>
    </section>

    <section class="ai-debug-section">
      <strong>Paciente y cobertura</strong>
      <div class="ai-debug-grid">
        <div class="ai-debug-metric">
          <span>Encontrados</span>
          <strong>${debugData.foundCoverageCount}/${debugData.totalCoverageCount}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Faltantes</span>
          <strong>${debugData.missingCoverageLabels.length}/${debugData.totalCoverageCount}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Documento</span>
          <strong>${escapeHtml(patient?.documentId || "sin dato")}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Contexto regional</span>
          <strong>${escapeHtml(debugData.baseLocation)} base - ${escapeHtml(patient?.locationCity || debugData.baseLocation)}</strong>
        </div>
      </div>
      <p class="ai-debug-note">Campos detectados: ${escapeHtml(debugData.availableCoverageLabels.join(", ") || "Ninguno")}.</p>
      <p class="ai-debug-note">Campos faltantes en la ultima revision: ${escapeHtml(debugData.missingCoverageLabels.join(", ") || "Ninguno")}.</p>
      <ul class="ai-debug-list">
        ${debugData.patientSignalLines.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>

    <section class="ai-debug-section">
      <strong>Metricas del modelo ganador</strong>
      <div class="ai-debug-grid">
        <div class="ai-debug-metric">
          <span>AUC-ROC combinado</span>
          <strong>${debugData.combinedAucRoc}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Triage</span>
          <strong>Prec ${debugData.triageMetrics.precision_weighted || 0}% - Sens ${debugData.triageMetrics.sensitivity || 0}% - Esp ${debugData.triageMetrics.specificity || 0}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Hospitalizacion</span>
          <strong>Prec ${debugData.hospitalizationMetrics.precision_weighted || 0}% - Sens ${debugData.hospitalizationMetrics.sensitivity || 0}% - Esp ${debugData.hospitalizationMetrics.specificity || 0}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Artefactos</span>
          <strong>${escapeHtml(debugData.modelArtifacts.triageModel || "sin archivo")} | ${escapeHtml(debugData.modelArtifacts.hospitalizationModel || "sin archivo")}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Modelos evaluados</span>
          <strong>${debugData.candidateCount}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Reentrenamiento</span>
          <strong>${debugData.retrainedWithAdjustments ? "Se aplicaron ajustes" : "Sin ajustes extra"}</strong>
        </div>
      </div>
      <p class="ai-debug-note">Precision triage final: ${debugData.triagePrecision}%. Precision hospitalizacion final: ${debugData.hospitalizationPrecision}%. Artefactos utiles detectados: ${debugData.modelArtifactsCount}.</p>
    </section>

    <section class="ai-debug-section">
      <strong>Entrenamiento y dataset</strong>
      <p>${escapeHtml(debugData.trainingSummary)}</p>
      <div class="ai-debug-grid">
        <div class="ai-debug-metric">
          <span>Pacientes del dataset</span>
          <strong>${debugData.datasetPatients}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Ubicacion base</span>
          <strong>${escapeHtml(debugData.baseLocation)}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Edad media</span>
          <strong>${debugData.meanAge.toFixed(1)} anos</strong>
        </div>
        <div class="ai-debug-metric">
          <span>O2 media</span>
          <strong>${debugData.meanOxygen.toFixed(1)}%</strong>
        </div>
        <div class="ai-debug-metric">
          <span>FR media</span>
          <strong>${debugData.meanRespRate.toFixed(1)} rpm</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Falla cardiaca / tabaquismo / GOLD alto</span>
          <strong>${debugData.heartFailureRate}% / ${debugData.smokingExposureRate}% / ${debugData.goldHighRate}%</strong>
        </div>
      </div>
      <div class="ai-debug-log">${escapeHtml(debugData.processLog.join("\n"))}</div>
      <p class="ai-debug-note">Fuentes activas: ${escapeHtml(debugData.sourceFiles)}. Distribucion resumida: ${escapeHtml(debugData.locationSummary)}.</p>
    </section>

    <section class="ai-debug-section">
      <strong>Ranking de candidatos entrenados</strong>
      <ul class="ai-debug-list">
        ${rankedCandidateItems}
      </ul>
    </section>

    <section class="ai-debug-section">
      <strong>Datos de prueba visibles</strong>
      <ul class="ai-debug-list">
        ${debugData.sampleRows.slice(0, 3).map((row) => `<li>${escapeHtml(row)}</li>`).join("")}
      </ul>
    </section>

    <section class="ai-debug-section">
      <strong>Variables importantes</strong>
      <ul class="ai-debug-list">
        ${debugData.activeVariables.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>

    <section class="ai-debug-section">
      <strong>Detonantes y recomendaciones del caso</strong>
      <div class="ai-debug-grid">
        <div class="ai-debug-metric">
          <span>Detonantes activos</span>
          <strong>${debugData.triggerLines.length}</strong>
        </div>
        <div class="ai-debug-metric">
          <span>Recomendaciones visibles</span>
          <strong>${debugData.recommendationLines.length}</strong>
        </div>
      </div>
      <ul class="ai-debug-list">
        ${debugData.triggerLines.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <ul class="ai-debug-list">
        ${debugData.recommendationLines.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>

    <section class="ai-debug-section">
      <strong>Matematica usada</strong>
      <div class="ai-debug-code">${escapeHtml(debugData.mathLines.join("\n"))}</div>
      ${
        debugData.assessment
          ? `<p class="ai-debug-note">Ventanas calculadas: 72h ${debugData.assessment.shortRisk}% | 1 semana ${debugData.assessment.weekRisk}% | 1+ mes ${debugData.assessment.longRisk}%.</p>`
          : `<p class="ai-debug-note">La ventana de riesgos aparecera aqui cuando exista un paciente activo.</p>`
      }
    </section>

    <section class="ai-debug-section">
      <strong>Validacion de matematica heuristica</strong>
      <div class="ai-debug-code">${escapeHtml(riskValidationLines.join("\n"))}</div>
      <p class="ai-debug-note">${escapeHtml(debugData.validationSummary)}</p>
      <ul class="ai-debug-list">
        ${(debugData.riskMathValidation?.rule_checks || ["Sin reglas documentadas."])
          .map((rule) => `<li>${escapeHtml(rule)}</li>`)
          .join("")}
      </ul>
    </section>
  `;
  requestAnimationFrame(applyAiDebugWindowGeometry);
}

function clampAiDebugSize(size = {}) {
  const minWidth = Math.min(380, Math.max(320, window.innerWidth - 24));
  const maxWidth = Math.max(minWidth, window.innerWidth - 24);
  const minHeight = 260;
  const availableHeight = window.innerHeight - getTopbarScrollOffset(12) - 12;
  const maxHeight = Math.max(minHeight, availableHeight);

  return {
    width: Math.min(Math.max(size.width || 560, minWidth), maxWidth),
    height: Math.min(Math.max(size.height || 640, minHeight), maxHeight),
  };
}

function applyAiDebugWindowGeometry() {
  if (!aiDebugWindow) return;

  const clampedSize = clampAiDebugSize(state.aiDebugSize);
  state.aiDebugSize = clampedSize;
  aiDebugWindow.style.width = `${clampedSize.width}px`;
  aiDebugWindow.style.height = state.aiDebugMinimized ? "auto" : `${clampedSize.height}px`;
}

function clampAiDebugWindowPosition() {
  if (!aiDebugWindow || state.aiDebugPosition.x === null || state.aiDebugPosition.y === null) return;

  applyAiDebugWindowGeometry();
  const width = aiDebugWindow.offsetWidth || state.aiDebugSize.width;
  const height = aiDebugWindow.offsetHeight || (state.aiDebugMinimized ? 90 : state.aiDebugSize.height);
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(getTopbarScrollOffset(4), window.innerHeight - height - 12);
  state.aiDebugPosition.x = Math.min(Math.max(12, state.aiDebugPosition.x), maxX);
  state.aiDebugPosition.y = Math.min(Math.max(getTopbarScrollOffset(4), state.aiDebugPosition.y), maxY);
  aiDebugWindow.style.left = `${state.aiDebugPosition.x}px`;
  aiDebugWindow.style.top = `${state.aiDebugPosition.y}px`;
  aiDebugWindow.style.right = "auto";
}

function openAiDebugWindow() {
  state.aiDebugOpen = true;
  state.aiDebugMinimized = false;
  renderAiDebugWindow();

  if (state.aiDebugPosition.x === null || state.aiDebugPosition.y === null) {
    const preferredWidth = clampAiDebugSize(state.aiDebugSize).width;
    state.aiDebugPosition = {
      x: Math.max(12, window.innerWidth - preferredWidth - 28),
      y: getTopbarScrollOffset(12),
    };
  }

  requestAnimationFrame(clampAiDebugWindowPosition);
}

function closeAiDebugWindow() {
  state.aiDebugOpen = false;
  state.aiDebugDrag = null;
  state.aiDebugResizeSession = null;
  renderAiDebugWindow();
}

function toggleAiDebugMinimize() {
  if (!state.aiDebugOpen) {
    openAiDebugWindow();
    return;
  }

  state.aiDebugMinimized = !state.aiDebugMinimized;
  renderAiDebugWindow();
  requestAnimationFrame(clampAiDebugWindowPosition);
}

function beginAiDebugDrag(event) {
  if (!state.aiDebugOpen || !aiDebugWindow || state.aiDebugMinimized) return;
  const rect = aiDebugWindow.getBoundingClientRect();
  state.aiDebugDrag = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  aiDebugWindow.style.right = "auto";
}

function handleAiDebugDrag(event) {
  if (!state.aiDebugDrag) return;
  state.aiDebugPosition = {
    x: event.clientX - state.aiDebugDrag.offsetX,
    y: event.clientY - state.aiDebugDrag.offsetY,
  };
  clampAiDebugWindowPosition();
}

function stopAiDebugDrag() {
  state.aiDebugDrag = null;
}

function beginAiDebugResize(direction, event) {
  if (!state.aiDebugOpen || !aiDebugWindow || state.aiDebugMinimized) return;

  const rect = aiDebugWindow.getBoundingClientRect();
  state.aiDebugResizeSession = {
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: rect.width,
    startHeight: rect.height,
    startLeft: rect.left,
    startTop: rect.top,
  };
  state.aiDebugDrag = null;
}

function handleAiDebugResize(event) {
  if (!state.aiDebugResizeSession) return;

  const { direction, startX, startY, startWidth, startHeight, startLeft, startTop } = state.aiDebugResizeSession;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  let width = startWidth;
  let height = startHeight;
  let left = startLeft;
  let top = startTop;

  if (direction.includes("e")) {
    width = startWidth + deltaX;
  }
  if (direction.includes("s")) {
    height = startHeight + deltaY;
  }
  if (direction.includes("w")) {
    width = startWidth - deltaX;
    left = startLeft + deltaX;
  }
  if (direction.includes("n")) {
    height = startHeight - deltaY;
    top = startTop + deltaY;
  }

  const clamped = clampAiDebugSize({ width, height });
  if (direction.includes("w")) {
    left = startLeft + (startWidth - clamped.width);
  }
  if (direction.includes("n")) {
    top = startTop + (startHeight - clamped.height);
  }

  state.aiDebugSize = clamped;
  state.aiDebugPosition = { x: left, y: top };
  clampAiDebugWindowPosition();
}

function stopAiDebugResize() {
  state.aiDebugResizeSession = null;
}

function formatAppError(error, context = "operacion") {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "Error no identificado.");

  if (code.includes("permission-denied") || message.includes("Missing or insufficient permissions")) {
    return `Firebase rechazo la ${context} por permisos insuficientes. Verifica que el usuario haya iniciado sesion y que las reglas de Firestore desplegadas permitan esa accion.`;
  }

  if (code.includes("unauthorized-domain")) {
    return "Firebase Auth rechazo el dominio actual. Agrega este dominio a Authorized domains en Authentication.";
  }

  if (code.includes("operation-not-allowed")) {
    return "Firebase Auth no tiene habilitado Email/Password para este proyecto.";
  }

  if (code.includes("requires-recent-login")) {
    return "Firebase requiere una autenticacion reciente para completar esta accion.";
  }

  return message;
}


function computeClinicalAssessment(patient) {
  if (!patient) return null;

  const training = state.trainingProfile;
  const region = getRegionProfile(patient.locationCity);
  const oxygen = normalizeOxygenValue(patient.oxygenSaturation);
  const expectedOxygen = Math.max(86, training.meanOxygen - (region?.oxygenAdjustment || 0));
  const elevation = Number(patient.locationElevationM || region.altitude || DEFAULT_ALTITUDE_METERS);
  const packHistory = Number(patient.packHistory || 0);
  const smokingIntensity =
    patient.smokingStatus === "Alta carga" ? 1
    : patient.smokingStatus === "Activo" ? 0.8
    : patient.smokingStatus === "Exfumador" ? 0.45
    : 0.1;
  let shortScore = 10;
  let weekScore = 14;
  let longScore = 18;
  let chronicLoad = 8;
  let respiratoryOutcome = 18;
  let cardiacOutcome = 16;
  let symptomOutcome = 14;
  const triggers = [];
  const recommendations = [];
  const keyFindings = [];

  if (patient.status === "Critico") {
    shortScore += 28;
    weekScore += 18;
    longScore += 10;
    respiratoryOutcome += 14;
    cardiacOutcome += 12;
    symptomOutcome += 10;
    triggers.push("Estado clinico actual marcado como critico.");
  } else if (patient.status === "Riesgo") {
    shortScore += 18;
    weekScore += 12;
    longScore += 7;
    respiratoryOutcome += 8;
    cardiacOutcome += 6;
    symptomOutcome += 7;
    triggers.push("Paciente ya clasificado en riesgo por el tablero.");
  }

  if (oxygen) {
    if (oxygen < expectedOxygen - 4) {
      shortScore += 34;
      weekScore += 20;
      longScore += 8;
      respiratoryOutcome += 28;
      cardiacOutcome += 10;
      triggers.push(`Saturacion ${oxygen}% por debajo del perfil esperado para ${region.label}.`);
      keyFindings.push(`Desaturacion marcada: ${oxygen}% frente a expectativa ${Math.round(expectedOxygen)}%.`);
    } else if (oxygen < expectedOxygen - 2) {
      shortScore += 18;
      weekScore += 12;
      longScore += 6;
      respiratoryOutcome += 16;
      cardiacOutcome += 6;
      triggers.push(`Saturacion ${oxygen}% con margen estrecho respecto a referencia regional.`);
      keyFindings.push(`Oxigenacion en vigilancia: ${oxygen}% con penalizacion por altitud.`);
    }
  }

  if (patient.respiratoryRate >= 28) {
    shortScore += 24;
    weekScore += 15;
    longScore += 6;
    respiratoryOutcome += 22;
    symptomOutcome += 10;
    triggers.push(`Frecuencia respiratoria muy alta: ${patient.respiratoryRate} rpm.`);
    keyFindings.push(`Taquipnea importante: ${patient.respiratoryRate} respiraciones por minuto.`);
  } else if (patient.respiratoryRate >= 24) {
    shortScore += 14;
    weekScore += 10;
    longScore += 5;
    respiratoryOutcome += 14;
    symptomOutcome += 7;
    triggers.push(`Frecuencia respiratoria elevada: ${patient.respiratoryRate} rpm.`);
  }

  if (patient.pulse >= 120) {
    shortScore += 16;
    weekScore += 10;
    longScore += 4;
    chronicLoad += 3;
    cardiacOutcome += 18;
    symptomOutcome += 4;
    triggers.push(`Pulso muy elevado: ${patient.pulse} bpm.`);
    keyFindings.push(`Pulso muy alto: ${patient.pulse} bpm con carga cardiaca adicional.`);
  } else if (patient.pulse >= 100) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
    chronicLoad += 2;
    cardiacOutcome += 10;
  }

  if (patient.bloodPressureSystolic >= 180 || patient.bloodPressureDiastolic >= 110) {
    shortScore += 16;
    weekScore += 10;
    longScore += 4;
    chronicLoad += 5;
    cardiacOutcome += 20;
    triggers.push("Presion arterial severamente elevada.");
    keyFindings.push(`Presion severa: ${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic}.`);
  } else if (patient.bloodPressureSystolic >= 150 || patient.bloodPressureDiastolic >= 95) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
    chronicLoad += 3;
    cardiacOutcome += 10;
  }

  if (patient.glucose >= 300) {
    shortScore += 14;
    weekScore += 8;
    longScore += 4;
    chronicLoad += 5;
    cardiacOutcome += 7;
    symptomOutcome += 8;
    triggers.push(`Glucosa muy alta: ${patient.glucose} mg/dL.`);
    keyFindings.push(`Glucosa muy elevada: ${patient.glucose} mg/dL.`);
  } else if (patient.glucose >= 200) {
    shortScore += 9;
    weekScore += 6;
    longScore += 3;
    chronicLoad += 3;
    cardiacOutcome += 4;
    symptomOutcome += 5;
  }

  if (patient.creatinine >= 2) {
    shortScore += 13;
    weekScore += 8;
    longScore += 5;
    chronicLoad += 6;
    cardiacOutcome += 10;
    triggers.push(`Creatinina elevada: ${patient.creatinine} mg/dL.`);
  } else if (patient.creatinine >= 1.3) {
    shortScore += 7;
    weekScore += 5;
    longScore += 3;
    chronicLoad += 4;
    cardiacOutcome += 5;
  }

  if (patient.hemoglobin && patient.hemoglobin < 8) {
    shortScore += 14;
    weekScore += 7;
    longScore += 4;
    chronicLoad += 4;
    symptomOutcome += 12;
    cardiacOutcome += 5;
    triggers.push(`Hemoglobina baja: ${patient.hemoglobin} g/dL.`);
  } else if (patient.hemoglobin && patient.hemoglobin < 10) {
    shortScore += 8;
    weekScore += 5;
    longScore += 3;
    chronicLoad += 2;
    symptomOutcome += 6;
  }

  if (patient.age >= 80) {
    shortScore += 10;
    weekScore += 8;
    longScore += 6;
    chronicLoad += 6;
    cardiacOutcome += 8;
    respiratoryOutcome += 6;
  } else if (patient.age >= training.meanAge) {
    shortScore += 5;
    weekScore += 4;
    longScore += 4;
    chronicLoad += 4;
    cardiacOutcome += 4;
  }

  if (patient.copdGold >= 4) {
    shortScore += 16;
    weekScore += 12;
    longScore += 10;
    chronicLoad += 10;
    respiratoryOutcome += 24;
    symptomOutcome += 10;
    triggers.push(`COPD GOLD ${patient.copdGold}: reserva pulmonar reducida.`);
    keyFindings.push(`EPOC avanzado: GOLD ${patient.copdGold}.`);
  } else if (patient.copdGold >= 3) {
    shortScore += 11;
    weekScore += 9;
    longScore += 8;
    chronicLoad += 8;
    respiratoryOutcome += 16;
    symptomOutcome += 6;
  } else if (patient.copdGold === 2) {
    shortScore += 6;
    weekScore += 5;
    longScore += 5;
    chronicLoad += 5;
    respiratoryOutcome += 8;
  }

  if (patient.heartFailureHistory === "Si") {
    shortScore += 14;
    weekScore += 10;
    longScore += 8;
    chronicLoad += 9;
    cardiacOutcome += 24;
    respiratoryOutcome += 6;
    triggers.push("Antecedente de falla cardiaca.");
    keyFindings.push("Antecedente de falla cardiaca con impacto sobre el riesgo cardiopulmonar.");
  }

  if (patient.smokingStatus === "Alta carga") {
    shortScore += 8;
    weekScore += 8;
    longScore += 10;
    chronicLoad += 8;
    respiratoryOutcome += 12;
    symptomOutcome += 6;
  } else if (patient.smokingStatus === "Activo") {
    shortScore += 6;
    weekScore += 6;
    longScore += 8;
    chronicLoad += 6;
    respiratoryOutcome += 9;
    symptomOutcome += 4;
  } else if (patient.smokingStatus === "Exfumador") {
    shortScore += 3;
    weekScore += 4;
    longScore += 5;
    chronicLoad += 4;
    respiratoryOutcome += 5;
  }

  if (packHistory >= 80) {
    shortScore += 10;
    weekScore += 12;
    longScore += 16;
    chronicLoad += 10;
    respiratoryOutcome += 18;
    cardiacOutcome += 6;
    symptomOutcome += 4;
    triggers.push(`Carga tabaquica extrema: ${packHistory} pack-years.`);
    keyFindings.push(`Carga tabaquica extrema: ${packHistory} pack-years.`);
  } else if (packHistory >= 40) {
    shortScore += 6;
    weekScore += 8;
    longScore += 10;
    chronicLoad += 6;
    respiratoryOutcome += 10;
    cardiacOutcome += 4;
    triggers.push(`Carga tabaquica relevante: ${packHistory} pack-years.`);
  }

  if (patient.bmi && patient.bmi < 18.5) {
    shortScore += 6;
    weekScore += 5;
    longScore += 5;
    chronicLoad += 4;
    triggers.push("IMC bajo, posible fragilidad nutricional.");
  } else if (patient.bmi && patient.bmi > 35) {
    shortScore += 4;
    weekScore += 4;
    longScore += 4;
    chronicLoad += 4;
  }

  if (region.airQualityIndex >= 85) {
    shortScore += 12;
    weekScore += 10;
    longScore += 7;
    chronicLoad += 5;
    respiratoryOutcome += 10;
    symptomOutcome += 4;
    triggers.push(`Calidad del aire exigente en ${region.label}: AQI ${region.airQualityIndex}.`);
  } else if (region.airQualityIndex >= 65) {
    shortScore += 7;
    weekScore += 6;
    longScore += 4;
    chronicLoad += 3;
    respiratoryOutcome += 6;
    triggers.push(`Calidad del aire intermedia en ${region.label}: AQI ${region.airQualityIndex}.`);
  }

  if (region.temperatureC >= 28) {
    shortScore += 5;
    weekScore += 4;
    longScore += 2;
    chronicLoad += 2;
    triggers.push(`Temperatura ambiental alta: ${region.temperatureC}C.`);
  } else if (region.temperatureC <= 12) {
    shortScore += 6;
    weekScore += 5;
    longScore += 3;
    chronicLoad += 2;
    triggers.push(`Temperatura ambiental baja: ${region.temperatureC}C.`);
  }

  if (region.humidity >= 75) {
    shortScore += 3;
    weekScore += 3;
    longScore += 2;
    chronicLoad += 1;
    symptomOutcome += 2;
  }

  if (elevation >= 2400) {
    const altitudeRespPenalty = Math.round(8 + (12 * smokingIntensity));
    shortScore += altitudeRespPenalty;
    weekScore += altitudeRespPenalty;
    longScore += altitudeRespPenalty + 3;
    chronicLoad += 5;
    respiratoryOutcome += altitudeRespPenalty + 6;
    cardiacOutcome += 4;
    triggers.push(`Altitud alta: ${elevation} m sobre el nivel del mar, con mayor exigencia ventilatoria.`);
    keyFindings.push(`Altitud alta ${elevation} m: eleva el riesgo respiratorio en fumadores y exfumadores.`);
  } else if (elevation >= 1400) {
    const altitudeRespPenalty = Math.round(4 + (8 * smokingIntensity));
    shortScore += altitudeRespPenalty;
    weekScore += altitudeRespPenalty;
    longScore += altitudeRespPenalty + 2;
    chronicLoad += 3;
    respiratoryOutcome += altitudeRespPenalty + 3;
    triggers.push(`Altitud intermedia: ${elevation} m con ajuste por reserva respiratoria.`);
  }

  shortScore *= region.respiratoryStress || 1;
  weekScore *= region.respiratoryStress || 1;
  longScore *= region.respiratoryStress || 1;
  shortScore *= region.accessPressure;
  weekScore *= region.accessPressure;
  longScore *= region.accessPressure;
  chronicLoad *= (region.respiratoryStress || 1) * region.accessPressure;
  respiratoryOutcome *= (region.respiratoryStress || 1) * region.accessPressure;
  cardiacOutcome *= region.accessPressure;
  symptomOutcome *= (1 + ((region.airQualityIndex || 0) >= 75 ? 0.04 : 0));

  const overallAcute = Math.round((shortScore * 0.36) + (respiratoryOutcome * 0.34) + (cardiacOutcome * 0.18) + (symptomOutcome * 0.12));
  const weekRiskBase = Math.round((shortScore * 0.38) + weekScore + (chronicLoad * 0.25));
  const longRiskBase = Math.round((weekScore * 0.42) + longScore + chronicLoad);
  const shortRisk = Math.min(98, overallAcute);
  const weekRisk = Math.min(98, Math.max(shortRisk, weekRiskBase, Math.round((respiratoryOutcome * 0.45) + (cardiacOutcome * 0.32) + (symptomOutcome * 0.28))));
  const longRisk = Math.min(98, Math.max(weekRisk, longRiskBase, Math.round((respiratoryOutcome * 0.32) + (cardiacOutcome * 0.46) + (symptomOutcome * 0.36) + chronicLoad)));
  const outcomeRisks = {
    respiratory: Math.min(98, Math.round(respiratoryOutcome)),
    cardiac: Math.min(98, Math.round(cardiacOutcome)),
    dangerousSymptom: Math.min(98, Math.round(symptomOutcome)),
  };
  const dominantRiskType = Object.entries(outcomeRisks).sort((a, b) => b[1] - a[1])[0]?.[0] || "respiratory";

  if (shortRisk >= 70) recommendations.push("Agendar control medico prioritario en menos de 24 horas.");
  else if (shortRisk >= 45) recommendations.push("Programar seguimiento clinico dentro de 48 a 72 horas.");
  else recommendations.push("Mantener seguimiento ordinario con reevaluacion segun agenda.");

  if (oxygen && oxygen < expectedOxygen - 2) recommendations.push("Verificar signos respiratorios y considerar soporte de oxigeno segun criterio medico.");
  if (patient.glucose >= 200) recommendations.push("Revisar plan metabolico y confirmar adherencia terapeutica.");
  if (patient.heartFailureHistory === "Si") recommendations.push("Correlacionar con balance hidrico y sintomas cardiovasculares.");
  if (packHistory >= 40) recommendations.push(`Considerar intervencion intensiva sobre tabaquismo: ${packHistory} pack-years registrados.`);
  if (patient.respiratoryRate >= 28) recommendations.push("La frecuencia respiratoria amerita reevaluacion temprana y vigilancia estrecha por posible deterioro ventilatorio.");
  if (elevation >= 1400 && patient.smokingStatus !== "Nunca") recommendations.push(`La altitud de ${region.label} (${elevation} m) debe endurecer la lectura de saturacion y disnea.`);
  if (patient.locationCity) recommendations.push(`Ajustar interpretacion al contexto de ${region.label}: ${region.careFocus}.`);
  recommendations.push(`Contexto ambiental: ${region.climate}, ${region.temperatureC}C, AQI ${region.airQualityIndex}, humedad ${region.humidity}%.`);
  recommendations.push(region.recommendationFocus);

  if (dominantRiskType === "respiratory") {
    recommendations.unshift("El frente dominante es respiratorio: priorizar oxigenacion, trabajo ventilatorio y tolerancia al esfuerzo.");
  } else if (dominantRiskType === "cardiac") {
    recommendations.unshift("El frente dominante es cardiaco: vigilar perfusion, tension arterial, pulso y congestión.");
  } else {
    recommendations.unshift("El frente dominante es la aparicion de sintomas peligrosos: vigilar cambio clinico, secreciones y disnea subjetiva.");
  }

  const confidenceInputs = [
    patient.oxygenSaturation,
    patient.respiratoryRate,
    patient.pulse,
    patient.glucose,
    patient.creatinine,
    patient.copdGold,
    patient.locationCity,
    patient.packHistory,
  ];
  const confidence = Math.round((confidenceInputs.filter(Boolean).length / confidenceInputs.length) * 100);

  return {
    region,
    shortRisk,
    weekRisk,
    longRisk,
    outcomeRisks,
    dominantRiskType,
    confidence,
    expectedOxygen,
    environmentalSummary: `${region.label}: ${region.climate}, ${region.temperatureC}C, AQI ${region.airQualityIndex}, humedad ${region.humidity}%, altitud ${elevation} m`,
    summary:
      dominantRiskType === "respiratory"
        ? `Predomina el riesgo respiratorio (${outcomeRisks.respiratory}%). La altitud, la oxigenacion y la carga tabaquica estan pesando en el caso.`
        : dominantRiskType === "cardiac"
          ? `Predomina el riesgo cardiaco (${outcomeRisks.cardiac}%). La hemodinamia y los antecedentes cardiovasculares requieren vigilancia estrecha.`
          : `Predomina el riesgo de nuevo sintoma peligroso (${outcomeRisks.dangerousSymptom}%). Conviene vigilancia clinica cercana y reevaluacion.`,
    triggers: [
      `Subriesgos -> respiratorio ${outcomeRisks.respiratory}% | cardiaco ${outcomeRisks.cardiac}% | sintoma peligroso ${outcomeRisks.dangerousSymptom}%.`,
      ...triggers,
      ...keyFindings,
    ].slice(0, 8),
    keyFindings: keyFindings.length ? keyFindings : ["Sin hallazgos diferenciales mayores en los datos actuales."],
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
  const outerEdge = 12;
  const innerEdge = 18;
  const nearLeft = clientX >= rect.left - outerEdge && clientX <= rect.left + innerEdge;
  const nearRight = clientX <= rect.right + outerEdge && clientX >= rect.right - innerEdge;
  const nearTop = clientY >= rect.top - outerEdge && clientY <= rect.top + innerEdge;
  const nearBottom = clientY <= rect.bottom + outerEdge && clientY >= rect.bottom - innerEdge;

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
  scrollElementIntoViewport(widget, { align: "start", extraOffset: 14 });
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
    scrollElementIntoViewport(workspacePanel, { align: "start", extraOffset: 12 });
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

  scrollElementIntoViewport(widget, { align: "start", extraOffset: 14 });
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
    scrollToWidgetKey("patients");
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
    scrollToWidgetKey("labs");
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
    ? `Motor IA: ${state.trainingProfile.selectedModelName} (${state.trainingProfile.selectedModelPrecision}%)`
    : "Motor IA: usando perfil base mientras carga dataset";
  renderAiDebugWindow();
}

async function loadClinicalTrainingProfile() {
  try {
    const manifest = await loadTrainingManifest({ forceRefresh: true });
    const trainingProfile = manifest?.trainingProfile;
    const activeModel = manifest?.activeModel;

    if (!trainingProfile || !activeModel) {
      throw new Error("El manifiesto IA no trae modelo activo.");
    }

    state.trainingProfile = {
      ...state.trainingProfile,
      ...trainingProfile,
      ready: true,
      selectedModelName: activeModel.name,
      selectedModelPrecision: activeModel.combinedPrecision,
      triagePrecision: activeModel.triage?.precision_weighted || trainingProfile.triagePrecision,
      hospitalizationPrecision:
        activeModel.hospitalization?.precision_weighted || trainingProfile.hospitalizationPrecision,
      minimumPrecisionTarget:
        manifest.minimumPrecisionTarget || trainingProfile.minimumPrecisionTarget || 90,
      calibrationMode:
        trainingProfile.calibrationMode || "Entrenamiento supervisado offline con manifiesto reutilizable",
    };
    state.trainingManifest = manifest;

    aiTrainingBadge.textContent = summarizeActiveModel(manifest);
    doctorPanelTraining.textContent = `Motor IA: ${activeModel.name} (${activeModel.combinedPrecision}%)`;
    renderDashboard();
  } catch (error) {
    state.trainingProfile = { ...fallbackTrainingProfile };
    state.trainingManifest = null;
    aiTrainingBadge.textContent = "Usando perfil base";
    doctorPanelTraining.textContent = "Motor IA: perfil base cargado";
    setStatus(`No se completo la calibracion local: ${formatAppError(error, "carga del manifiesto IA")}`, "error");
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
    setStatus(formatAppError(error, "creacion de la alerta IA"), "error");
  }
}

window.toggleMainMenu = function toggleMainMenu() {
  mainMenu.style.display = mainMenu.style.display === "block" ? "none" : "block";
};

window.toggleUserMenu = function toggleUserMenu() {
  userMenu.classList.toggle("visible");
};

if (mainMenuButton) {
  mainMenuButton.addEventListener("click", () => {
    window.toggleMainMenu();
  });
}

if (doctorMenuButton) {
  doctorMenuButton.addEventListener("click", () => {
    window.toggleUserMenu();
  });
}

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
  const clickedAiDebug = event.target.closest(".ai-debug-window") || event.target.closest(".ai-debug-toggle");

  if (!clickedUserMenu) userMenu.classList.remove("visible");
  if (!clickedContextMenu) hideContextMenu();
  if (!clickedMainMenu) mainMenu.style.display = "none";
  if (event.target === widgetPicker) hideWidgetPicker();
  if (event.target === quickAccessPicker) hideQuickAccessPicker();
  if (event.target === devNotice) hideDevNotice();
  if (!clickedAiDebug && state.aiDebugOpen && !state.aiDebugMinimized) {
    stopAiDebugDrag();
    stopAiDebugResize();
  }
});

document.addEventListener("mousemove", (event) => {
  if (state.aiDebugResizeSession) {
    handleAiDebugResize(event);
    return;
  }

  if (state.aiDebugDrag) {
    handleAiDebugDrag(event);
    return;
  }

  if (state.resizeSession) {
    handleWidgetResizeMove(event);
    return;
  }

  if (state.uiMode === "remove-widget") {
    handleWidgetInteractionMove(event);
  }
});

document.addEventListener("mouseup", () => {
  stopAiDebugResize();
  stopAiDebugDrag();
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
    scrollToWidgetKey("notes");
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
      setStatus("Redimensionado activo en este widget. Arrastra desde el borde o una esquina.", "info");
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
    setStatus(formatAppError(error, "guardado del layout"), "error");
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
        packHistory: formData.get("packHistory"),
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
    setStatus(formatAppError(error, "guardado del paciente"), "error");
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
    setStatus(formatAppError(error, "guardado de notas"), "error");
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
      setStatus(formatAppError(error, "actualizacion del perfil"), "error");
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
      setStatus(formatAppError(error, "guardado del tema"), "error");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setStatus(formatAppError(error, "cierre de sesion"), "error");
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

if (aiDebugToggleButton) {
  aiDebugToggleButton.addEventListener("click", () => {
    if (state.aiDebugOpen) {
      state.aiDebugMinimized = false;
      renderAiDebugWindow();
      requestAnimationFrame(clampAiDebugWindowPosition);
      return;
    }

    openAiDebugWindow();
  });
}

if (minimizeAiDebugButton) {
  minimizeAiDebugButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAiDebugMinimize();
  });
}

if (closeAiDebugButton) {
  closeAiDebugButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeAiDebugWindow();
  });
}

if (aiDebugHeader) {
  aiDebugHeader.addEventListener("mousedown", (event) => {
    const controlButton = event.target.closest("button");
    if (controlButton || event.button !== 0) return;
    beginAiDebugDrag(event);
  });
}

if (aiDebugResizeHandles.length) {
  aiDebugResizeHandles.forEach((handle) => {
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      beginAiDebugResize(handle.dataset.aiDebugResize, event);
    });
  });
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
    scrollToWidgetKey("notes");
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
        setStatus(formatAppError(error, "sincronizacion de pacientes"), "error");
      }
    );
  });
}

window.addEventListener("resize", syncTopbarOffset);
window.addEventListener("resize", clampAiDebugWindowPosition);

bootDashboard();
