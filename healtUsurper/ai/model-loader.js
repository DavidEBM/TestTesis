const STORAGE_KEY = "foxcat-ai-training-manifest";
const SESSION_KEY = "foxcat-ai-training-manifest-session";
const MANIFEST_URL = new URL("./training-manifest.json", import.meta.url);

function safeParse(rawValue) {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function getCachedTrainingManifest() {
  const sessionManifest = safeParse(sessionStorage.getItem(SESSION_KEY));
  if (sessionManifest) return sessionManifest;

  const localManifest = safeParse(localStorage.getItem(STORAGE_KEY));
  if (localManifest) return localManifest;

  return null;
}

export function cacheTrainingManifest(manifest) {
  if (!manifest) return;

  const serialized = JSON.stringify(manifest);
  sessionStorage.setItem(SESSION_KEY, serialized);
  localStorage.setItem(STORAGE_KEY, serialized);
}

export async function fetchTrainingManifest() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar el manifiesto IA (${response.status}).`);
  }

  return response.json();
}

export async function loadTrainingManifest({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getCachedTrainingManifest();
    if (cached) return cached;
  }

  const manifest = await fetchTrainingManifest();
  cacheTrainingManifest(manifest);
  return manifest;
}

export function summarizeActiveModel(manifest) {
  const activeModel = manifest?.activeModel;
  if (!activeModel) return "Modelo IA no cargado";
  return `${activeModel.name} · ${activeModel.combinedPrecision}%`;
}
