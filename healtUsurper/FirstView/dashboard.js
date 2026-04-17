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
const doctorPanelTraining = document.getElementById("doctorPanelTraining");
const statusBanner = document.getElementById("statusBanner");
const dashboardGrid = document.getElementById("dashboardGrid");
const layoutGuide = document.getElementById("layoutGuide");
const contextMenu = document.getElementById("contextMenu");
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

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", state.theme === "dark");
  themeToggleButton.textContent = state.theme === "dark" ? "Modo claro" : "Modo oscuro";
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
      applyWidgetSizes({});
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
        <p>Ciudad clinica: ${escapeHtml(region?.label || patient.locationCity)} · Altitud ${region?.altitude || 12} msnm</p>
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
          <span class="soft-pill">O2 esperada aprox. ${assessment.expectedOxygen}%</span>
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
}

function renderWorkspace(title, content) {
  workspaceTitle.textContent = title;
  workspaceBody.innerHTML = content;
  workspacePanel.hidden = false;
}

function closeWorkspace() {
  workspacePanel.hidden = true;
  workspaceTitle.textContent = "Vista auxiliar";
  workspaceBody.innerHTML = "";
  state.workspaceAction = null;
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

mainMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-action]");
  if (!button) return;
  openMainMenuAction(button.dataset.pageAction);
});

leftPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-panel-target]");
  if (!button) return;
  renderWorkspaceAction(button.dataset.panelTarget);
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

bootDashboard();
