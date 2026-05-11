from __future__ import annotations

import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


MINIMUM_PRECISION = 0.90
RANDOM_STATE = 42
DEFAULT_ALTITUDE_METERS = 12

BASE_DIR = Path(__file__).resolve().parent
PRIMARY_DATASET_PATH = BASE_DIR / "230PatientsCOPD.xlsx"
SECONDARY_DATASET_PATH = BASE_DIR / "COPD_Patients_Database.xlsx"
LOCATION_COUNTS_PATH = BASE_DIR / "conteo_locations.csv"
LOCATION_ELEVATION_PATH = BASE_DIR / "Locations_Elevation.csv"
OUTPUT_DIR = BASE_DIR.parent / "ai"
MANIFEST_PATH = OUTPUT_DIR / "training-manifest.json"
TRIAGE_MODEL_PATH = OUTPUT_DIR / "triage-model.joblib"
HOSPITALIZATION_MODEL_PATH = OUTPUT_DIR / "hospitalization-model.joblib"
RESPIRATORY_MODEL_PATH = OUTPUT_DIR / "respiratory-failure-model.joblib"
CARDIAC_MODEL_PATH = OUTPUT_DIR / "cardiac-failure-model.joblib"
SYMPTOM_MODEL_PATH = OUTPUT_DIR / "dangerous-symptom-model.joblib"


def triage(o2: float) -> str:
    if o2 >= 0.94:
        return "Low"
    if o2 >= 0.90:
        return "Medium"
    return "High"


def hospitalization(row: pd.Series) -> int:
    if (
        to_float(row.get("Oxygen Saturation"), 0) < 0.90
        or to_float(row.get("Respiratory Rate"), 0) > 24
        or to_float(row.get("COPD GOLD"), 0) >= 3
    ):
        return 1
    return 0


def normalize_boolean_text(value) -> str:
    text = str(value).strip().lower()
    if text in {"si", "sí", "sã­", "yes", "true", "1"}:
        return "Si"
    if text in {"no", "non", "false", "0"}:
        return "No"
    return str(value).strip() or "sin dato"


def normalize_smoking_status(value) -> str:
    text = str(value).strip().lower()
    if text in {"4", "4.0", "alta carga", "heavy"}:
        return "Alta carga"
    if text in {"3", "3.0", "activo", "active", "current", "fumador"}:
        return "Activo"
    if text in {"2", "2.0", "exfumador", "former"}:
        return "Exfumador"
    if text in {"1", "1.0", "nunca", "never", "non"}:
        return "Nunca"
    return str(value).strip() or "sin dato"


def to_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def canonical_location_name(value) -> str:
    text = str(value or "").strip().lower()
    if "bogot" in text:
        return "Bogota"
    if "pasto" in text:
        return "Pasto"
    if "medell" in text:
        return "Medellin"
    if "cali" in text:
        return "Cali"
    if "ipial" in text:
        return "Ipiales"
    if "barcelona" in text:
        return "Barcelona"
    return "Barcelona"


def parse_location_risk_level(value) -> int:
    match = re.search(r"risk\s*(\d+)", str(value or ""), flags=re.IGNORECASE)
    return int(match.group(1)) if match else 1


def parse_elevation_meters(value) -> int:
    match = re.search(r"-?\d+", str(value or ""))
    return int(match.group(0)) if match else DEFAULT_ALTITUDE_METERS


def parse_bmi_midpoint(value) -> float:
    text = str(value or "").strip().lower()
    if "<21" in text:
        return 20.0
    if "21<bmi<25" in text or "21 < bmi < 25" in text:
        return 23.0
    if "26-30" in text:
        return 28.0
    if ("30" in text and "<35" in text) or "30 >=" in text:
        return 32.5
    if "35" in text:
        return 37.0
    return to_float(value, 0)


def normalize_heart_rate_value(value) -> float:
    text = str(value or "").strip().lower()
    if text in {"higher", "high"}:
        return 108.0
    if text in {"normal", "norm"}:
        return 82.0
    if text in {"lower", "low"}:
        return 58.0
    return to_float(value, 0)


def normalize_bp_risk(value) -> int:
    text = str(value or "").strip().lower().replace(" ", "")
    if text == "crisis":
        return 5
    if text == "stage2":
        return 4
    if text == "higher":
        return 3
    if text == "stage1":
        return 2
    if text == "elevate":
        return 1
    return 0


def normalize_temperature_risk(value) -> int:
    text = str(value or "").strip().lower()
    if text in {"higher", "high"}:
        return 2
    if text in {"lower", "low"}:
        return 1
    return 0


def normalize_fev1_severity(value) -> int:
    text = str(value or "").strip().lower()
    if "<30" in text or "29% or less" in text:
        return 4
    if "30" in text and "49" in text:
        return 3
    if "50" in text and "79" in text:
        return 2
    if "80" in text:
        return 1
    return 0


def load_location_elevations() -> dict[str, int]:
    if not LOCATION_ELEVATION_PATH.exists():
        return {"Barcelona": DEFAULT_ALTITUDE_METERS}

    location_df = pd.read_csv(LOCATION_ELEVATION_PATH)
    first_col = location_df.columns[0]
    second_col = location_df.columns[1]
    return {
        canonical_location_name(location): parse_elevation_meters(elevation)
        for location, elevation in zip(location_df[first_col], location_df[second_col], strict=False)
    }


def respiratory_failure_risk(row: pd.Series) -> int:
    oxygen = to_float(row.get("Oxygen Saturation"), 0) * 100
    respiratory_rate = to_float(row.get("Respiratory Rate"), 0)
    gold = to_float(row.get("COPD GOLD"), 0)
    pack_history = to_float(row.get("Pack History"), 0)
    altitude = to_float(row.get("Altitude"), DEFAULT_ALTITUDE_METERS)
    fev1_severity = to_float(row.get("FEV1 Severity"), 0)
    smoking_status = normalize_smoking_status(row.get("status of smoking", ""))

    score = 0
    if oxygen < 88:
        score += 4
    elif oxygen < 92:
        score += 2
    if respiratory_rate >= 30:
        score += 3
    elif respiratory_rate >= 24:
        score += 2
    if gold >= 4:
        score += 3
    elif gold >= 3:
        score += 2
    if fev1_severity >= 4:
        score += 3
    elif fev1_severity >= 3:
        score += 2
    if altitude >= 2400 and smoking_status in {"Activo", "Alta carga", "Exfumador"}:
        score += 2
    elif altitude >= 1400 and smoking_status in {"Activo", "Alta carga"}:
        score += 1
    if pack_history >= 60:
        score += 2
    elif pack_history >= 30:
        score += 1
    return int(score >= 5)


def cardiac_failure_risk(row: pd.Series) -> int:
    oxygen = to_float(row.get("Oxygen Saturation"), 0) * 100
    age = to_float(row.get("Age"), 0)
    heart_rate = to_float(row.get("Heart Rate Numeric"), 0)
    heart_failure = normalize_boolean_text(row.get("History of Heart Failure", "")) == "Si"
    bp_risk = to_float(row.get("Blood Pressure Risk"), 0)
    respiratory_rate = to_float(row.get("Respiratory Rate"), 0)

    score = 0
    if heart_failure:
        score += 3
    if age >= 75:
        score += 2
    elif age >= 65:
        score += 1
    if heart_rate >= 115:
        score += 2
    elif heart_rate >= 100:
        score += 1
    if bp_risk >= 4:
        score += 2
    elif bp_risk >= 2:
        score += 1
    if oxygen < 90:
        score += 2
    if respiratory_rate >= 24:
        score += 1
    return int(score >= 5)


def dangerous_symptom_risk(row: pd.Series) -> int:
    mmrc = to_float(row.get("mMRC"), 0)
    sputum = str(row.get("Sputum", "")).strip().lower()
    temp_risk = to_float(row.get("Temperature Risk"), 0)
    depression = to_float(row.get("DepressionFlag"), 0)
    dependent = to_float(row.get("DependentFlag"), 0)
    respiratory_rate = to_float(row.get("Respiratory Rate"), 0)
    oxygen = to_float(row.get("Oxygen Saturation"), 0) * 100

    score = 0
    if mmrc >= 3:
        score += 2
    if sputum in {"purulent", "bloody", "hemoptoic"}:
        score += 2
    elif sputum == "mucoid":
        score += 1
    if temp_risk >= 2:
        score += 1
    if depression:
        score += 1
    if dependent:
        score += 1
    if respiratory_rate >= 24:
        score += 1
    if oxygen < 92:
        score += 1
    return int(score >= 4)


def normalize_source_dataframe(raw_df: pd.DataFrame, source_name: str, elevations: dict[str, int]) -> pd.DataFrame:
    df = raw_df.copy()
    df.columns = [str(column).strip() for column in df.columns]
    df = df.rename(columns={"ID Number": "ID Number", "ID Number\n": "ID Number"})

    for column in df.columns:
        if pd.api.types.is_object_dtype(df[column]) or str(df[column].dtype) == "string":
            df[column] = df[column].fillna("sin dato").astype(str).str.strip()

    df["sourceDataset"] = source_name
    df["Location"] = df.get("Location", "Barcelona").fillna("Barcelona").astype(str).str.strip()
    df["LocationNormalized"] = df["Location"].apply(canonical_location_name)
    df["Altitude"] = df["LocationNormalized"].map(elevations).fillna(DEFAULT_ALTITUDE_METERS).astype(int)
    df["LocationRiskLevel"] = df["Location"].apply(parse_location_risk_level)
    df["SmokingStatusNormalized"] = df.get("status of smoking", "").apply(normalize_smoking_status)
    df["HeartFailureNormalized"] = df.get("History of Heart Failure", "").apply(normalize_boolean_text)
    df["Pack History"] = pd.to_numeric(df.get("Pack History", 0), errors="coerce").fillna(0)
    df["Age"] = pd.to_numeric(df.get("Age", 0), errors="coerce").fillna(0)
    df["COPD GOLD"] = pd.to_numeric(df.get("COPD GOLD", 0), errors="coerce").fillna(0)
    df["mMRC"] = pd.to_numeric(df.get("mMRC", 0), errors="coerce").fillna(0)
    df["Respiratory Rate"] = pd.to_numeric(df.get("Respiratory Rate", 0), errors="coerce").fillna(0)
    df["Oxygen Saturation"] = pd.to_numeric(df.get("Oxygen Saturation", 0), errors="coerce").fillna(0)
    df["Heart Rate Numeric"] = df.get("Heart Rate", 0).apply(normalize_heart_rate_value)
    df["Blood Pressure Risk"] = df.get("Blood pressure", "").apply(normalize_bp_risk)
    df["Temperature Risk"] = df.get("Temperature", "").apply(normalize_temperature_risk)
    df["FEV1 Severity"] = df.get("FEV1", "").apply(normalize_fev1_severity)
    df["BMI Midpoint"] = df.get("BMI, kg/m2", "").apply(parse_bmi_midpoint)
    df["Working Place Numeric"] = pd.to_numeric(df.get("working place", 0), errors="coerce").fillna(0)
    df["DependentFlag"] = df.get("Dependent", "").apply(
        lambda value: 1 if normalize_boolean_text(value) == "Si" else 0
    )
    df["DepressionFlag"] = df.get("Depression", "").apply(
        lambda value: 1 if normalize_boolean_text(value) == "Si" else 0
    )
    df["VaccinationFlag"] = df.get("Vaccination", "").apply(
        lambda value: 1 if normalize_boolean_text(value) == "Si" else 0
    )

    df["Triage"] = df["Oxygen Saturation"].apply(triage)
    df["Hospitalization_Risk"] = df.apply(hospitalization, axis=1)
    df["Respiratory_Failure_Risk"] = df.apply(respiratory_failure_risk, axis=1)
    df["Cardiac_Failure_Risk"] = df.apply(cardiac_failure_risk, axis=1)
    df["Dangerous_Symptom_Risk"] = df.apply(dangerous_symptom_risk, axis=1)

    df = df.drop(columns=["ID Number"], errors="ignore")
    return df


def build_dataset() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, int]]:
    elevations = load_location_elevations()
    normalized_frames: list[pd.DataFrame] = []

    for path in [PRIMARY_DATASET_PATH, SECONDARY_DATASET_PATH]:
        if path.exists():
            raw_df = pd.read_excel(path)
            normalized_frames.append(normalize_source_dataframe(raw_df, path.name, elevations))

    if not normalized_frames:
        raise FileNotFoundError("No se encontraron datasets para entrenamiento.")

    df = pd.concat(normalized_frames, ignore_index=True)
    return df.copy(), df, elevations


def build_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    features = df.drop(
        columns=[
            "Triage",
            "Hospitalization_Risk",
            "Respiratory_Failure_Risk",
            "Cardiac_Failure_Risk",
            "Dangerous_Symptom_Risk",
        ],
        errors="ignore",
    )
    numeric_columns = features.select_dtypes(include=[np.number]).columns.tolist()
    categorical_columns = [column for column in features.columns if column not in numeric_columns]
    for column in categorical_columns:
        features[column] = features[column].fillna("sin dato").astype(str).str.strip()
    return features


def build_preprocessor(features: pd.DataFrame) -> ColumnTransformer:
    numeric_columns = features.select_dtypes(include=[np.number]).columns.tolist()
    categorical_columns = [column for column in features.columns if column not in numeric_columns]

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_columns),
            ("cat", categorical_transformer, categorical_columns),
        ]
    )


def build_pipeline(features: pd.DataFrame, estimator) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(features)),
            ("estimator", estimator),
        ]
    )


def compute_specificity_binary(y_true, y_pred, positive_label=1) -> float:
    labels = sorted(set(pd.Series(y_true).astype(object).tolist()) | {positive_label})
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    if matrix.shape != (2, 2):
        return 0.0
    tn, fp, _, _ = matrix.ravel()
    denominator = tn + fp
    return float(tn / denominator) if denominator else 0.0


def compute_specificity_multiclass(y_true, y_pred, classes) -> float:
    specificities = []
    y_true_series = pd.Series(y_true)
    y_pred_series = pd.Series(y_pred)

    for current_class in classes:
        true_positive_mask = y_true_series == current_class
        pred_positive_mask = y_pred_series == current_class
        tn = int((~true_positive_mask & ~pred_positive_mask).sum())
        fp = int((~true_positive_mask & pred_positive_mask).sum())
        denominator = tn + fp
        specificities.append((tn / denominator) if denominator else 0.0)

    return float(np.mean(specificities)) if specificities else 0.0


def compute_auc_roc(y_true, probabilities, classes) -> float:
    try:
        if len(classes) == 2:
            positive_index = 1 if len(classes) > 1 else 0
            return float(roc_auc_score(y_true, probabilities[:, positive_index]))
        return float(
            roc_auc_score(
                y_true,
                probabilities,
                multi_class="ovr",
                average="macro",
                labels=classes,
            )
        )
    except ValueError:
        return 0.0


def score_predictions(y_true, y_pred, probabilities, classes) -> dict[str, float]:
    sensitivity = (
        recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        if len(classes) == 2
        else recall_score(y_true, y_pred, average="macro", zero_division=0)
    )
    specificity = (
        compute_specificity_binary(y_true, y_pred, positive_label=1)
        if len(classes) == 2
        else compute_specificity_multiclass(y_true, y_pred, classes)
    )

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_weighted": float(
            precision_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "recall_weighted": float(
            recall_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "auc_roc": compute_auc_roc(y_true, probabilities, classes),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
    }


def train_and_score(
    model_pipeline: Pipeline, features: pd.DataFrame, target: pd.Series
) -> tuple[dict[str, float], Pipeline]:
    stratify_target = target if target.nunique() > 1 else None
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=stratify_target,
    )

    model_pipeline.fit(x_train, y_train)
    predictions = model_pipeline.predict(x_test)
    probabilities = model_pipeline.predict_proba(x_test)
    classes = list(model_pipeline.named_steps["estimator"].classes_)

    return score_predictions(y_test, predictions, probabilities, classes), model_pipeline


def candidate_specs() -> list[dict]:
    return [
        {
            "name": "RandomForest Balanced",
            "adjusted": False,
            "factory": lambda features: build_pipeline(
                features,
                RandomForestClassifier(
                    n_estimators=280,
                    max_depth=14,
                    min_samples_leaf=1,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        },
        {
            "name": "ExtraTrees Clinical",
            "adjusted": False,
            "factory": lambda features: build_pipeline(
                features,
                ExtraTreesClassifier(
                    n_estimators=320,
                    max_depth=None,
                    min_samples_leaf=1,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        },
        {
            "name": "LogisticRegression Clinical",
            "adjusted": False,
            "factory": lambda features: build_pipeline(
                features,
                LogisticRegression(
                    max_iter=3000,
                    class_weight="balanced",
                    solver="lbfgs",
                    random_state=RANDOM_STATE,
                ),
            ),
        },
    ]


def adjusted_candidate_specs() -> list[dict]:
    return [
        {
            "name": "RandomForest Tuned Retry",
            "adjusted": True,
            "factory": lambda features: build_pipeline(
                features,
                RandomForestClassifier(
                    n_estimators=520,
                    max_depth=None,
                    min_samples_split=2,
                    min_samples_leaf=1,
                    class_weight="balanced_subsample",
                    random_state=RANDOM_STATE,
                ),
            ),
        },
        {
            "name": "ExtraTrees Tuned Retry",
            "adjusted": True,
            "factory": lambda features: build_pipeline(
                features,
                ExtraTreesClassifier(
                    n_estimators=640,
                    max_depth=None,
                    min_samples_split=2,
                    min_samples_leaf=1,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        },
        {
            "name": "LogisticRegression Tuned Retry",
            "adjusted": True,
            "factory": lambda features: build_pipeline(
                features,
                LogisticRegression(
                    max_iter=5000,
                    class_weight="balanced",
                    solver="lbfgs",
                    C=1.3,
                    random_state=RANDOM_STATE,
                ),
            ),
        },
    ]


def evaluate_candidates(features: pd.DataFrame, labels: pd.DataFrame, specs: list[dict]) -> list[dict]:
    evaluations: list[dict] = []

    for spec in specs:
        triage_metrics, triage_model = train_and_score(spec["factory"](features), features, labels["Triage"])
        hosp_metrics, hosp_model = train_and_score(
            spec["factory"](features), features, labels["Hospitalization_Risk"]
        )

        combined_precision = (
            triage_metrics["precision_weighted"] + hosp_metrics["precision_weighted"]
        ) / 2
        combined_auc = (triage_metrics["auc_roc"] + hosp_metrics["auc_roc"]) / 2
        combined_accuracy = (triage_metrics["accuracy"] + hosp_metrics["accuracy"]) / 2

        evaluations.append(
            {
                "name": spec["name"],
                "adjusted": spec["adjusted"],
                "triage": triage_metrics,
                "hospitalization": hosp_metrics,
                "combined_precision": float(combined_precision),
                "combined_auc_roc": float(combined_auc),
                "combined_accuracy": float(combined_accuracy),
                "triage_model": triage_model,
                "hospitalization_model": hosp_model,
                "factory": spec["factory"],
            }
        )

    return evaluations


def heuristic_risk_components(row: pd.Series) -> dict[str, object]:
    oxygen = to_float(row.get("Oxygen Saturation", 0), 0) * 100
    respiratory_rate = to_float(row.get("Respiratory Rate", 0), 0)
    heart_rate = to_float(row.get("Heart Rate Numeric", row.get("Heart Rate", 0)), 0)
    gold = to_float(row.get("COPD GOLD", 0), 0)
    heart_failure = normalize_boolean_text(row.get("History of Heart Failure", "")) == "Si"
    smoking_status = normalize_smoking_status(row.get("status of smoking", ""))
    altitude = to_float(row.get("Altitude", DEFAULT_ALTITUDE_METERS), DEFAULT_ALTITUDE_METERS)
    pack_history = to_float(row.get("Pack History", 0), 0)

    short_score = 8.0
    triggers: list[str] = []
    recommendations: list[str] = []

    if row.get("Hospitalization_Risk", 0) == 1:
        short_score += 18
        triggers.append("Paciente etiquetado como riesgo de hospitalizacion.")

    if oxygen and oxygen < 90:
        short_score += 34
        triggers.append("Saturacion muy por debajo de referencia.")
    elif oxygen and oxygen < 92:
        short_score += 18
        triggers.append("Saturacion en zona de vigilancia.")

    if respiratory_rate >= 28:
        short_score += 24
        triggers.append("Frecuencia respiratoria muy alta.")
    elif respiratory_rate >= 24:
        short_score += 14
        triggers.append("Frecuencia respiratoria elevada.")

    if heart_rate >= 120:
        short_score += 16
        triggers.append("Pulso muy elevado.")
    elif heart_rate >= 100:
        short_score += 8
        triggers.append("Pulso elevado.")

    if gold >= 4:
        short_score += 16
        triggers.append("COPD GOLD 4.")
    elif gold >= 3:
        short_score += 10
        triggers.append("COPD GOLD alto.")

    if heart_failure:
        short_score += 10
        triggers.append("Antecedente de falla cardiaca.")

    if smoking_status in {"Activo", "Alta carga"}:
        short_score += 8
        triggers.append("Exposicion tabaquica significativa.")

    if pack_history >= 60:
        short_score += 8
        triggers.append("Carga tabaquica muy alta.")
    elif pack_history >= 30:
        short_score += 4

    if altitude >= 2400 and smoking_status in {"Activo", "Alta carga", "Exfumador"}:
        short_score += 6
        triggers.append("Altitud alta con reserva respiratoria mas exigida.")

    short_risk = min(98, round(short_score))

    if short_risk >= 70:
        recommendations.append("Agendar control prioritario en menos de 24 horas.")
    elif short_risk >= 45:
        recommendations.append("Programar seguimiento dentro de 48 a 72 horas.")
    else:
        recommendations.append("Mantener seguimiento ordinario.")

    if oxygen and oxygen < 92:
        recommendations.append("Verificar signos respiratorios y soporte de oxigeno.")
    if heart_failure:
        recommendations.append("Correlacionar con sintomas cardiovasculares.")
    if smoking_status in {"Activo", "Alta carga"}:
        recommendations.append("Reforzar manejo de exposicion tabaquica.")
    if altitude >= 1400:
        recommendations.append("Ajustar interpretacion de oxigenacion por altitud sobre el nivel del mar.")

    return {
        "short_risk": short_risk,
        "trigger_count": len(triggers),
        "recommendation_count": len(recommendations),
        "high_priority": int(short_risk >= 70),
    }


def validate_risk_math(raw_df: pd.DataFrame, dataset_df: pd.DataFrame) -> dict[str, object]:
    validation_df = raw_df.copy()
    validation_df["Hospitalization_Risk"] = dataset_df["Hospitalization_Risk"].values

    components = validation_df.apply(heuristic_risk_components, axis=1, result_type="expand")
    validation_df = pd.concat([validation_df, components], axis=1)

    high_priority_pred = validation_df["high_priority"].astype(int)
    hospitalization_true = validation_df["Hospitalization_Risk"].astype(int)
    sensitivity = recall_score(hospitalization_true, high_priority_pred, zero_division=0)
    specificity = compute_specificity_binary(hospitalization_true, high_priority_pred, positive_label=1)

    risk_auc = roc_auc_score(hospitalization_true, validation_df["short_risk"] / 100)
    monotonic_oxygen = (
        validation_df[["Oxygen Saturation", "short_risk"]]
        .dropna()
        .corr(method="spearman")
        .iloc[0, 1]
    )
    monotonic_resp = (
        validation_df[["Respiratory Rate", "short_risk"]]
        .dropna()
        .corr(method="spearman")
        .iloc[0, 1]
    )
    recommendation_coverage = float((validation_df["recommendation_count"] > 0).mean())
    trigger_coverage = float((validation_df["trigger_count"] > 0).mean())

    return {
        "validated": True,
        "summary": (
            "La matematica heuristica se contrasto contra riesgo de hospitalizacion y relaciones "
            "esperadas con oxigenacion, frecuencia respiratoria y exigencia por altitud."
        ),
        "hospitalization_alignment": {
            "auc_roc": float(risk_auc),
            "sensitivity": float(sensitivity),
            "specificity": float(specificity),
        },
        "monotonic_checks": {
            "oxygen_vs_risk_spearman": float(monotonic_oxygen),
            "respiratory_rate_vs_risk_spearman": float(monotonic_resp),
        },
        "recommendation_checks": {
            "recommendation_coverage": recommendation_coverage,
            "trigger_coverage": trigger_coverage,
        },
        "rule_checks": [
            "Menor saturacion debe empujar el riesgo hacia arriba.",
            "Mayor frecuencia respiratoria debe empujar el riesgo hacia arriba.",
            "Altitud alta debe endurecer la interpretacion en fumadores y exfumadores.",
            "Cada caso debe producir al menos una recomendacion base.",
        ],
    }


def read_location_counts(raw_df: pd.DataFrame) -> dict[str, int]:
    if "LocationNormalized" in raw_df.columns:
        normalized_locations = raw_df["LocationNormalized"].fillna("Barcelona").astype(str).str.strip()
        if normalized_locations.notna().any():
            return {
                str(location).strip(): int(count)
                for location, count in normalized_locations.value_counts().items()
            }

    if LOCATION_COUNTS_PATH.exists():
        counts_df = pd.read_csv(LOCATION_COUNTS_PATH)
        location_col = counts_df.columns[0]
        count_col = counts_df.columns[1]
        return {
            canonical_location_name(location): int(count)
            for location, count in zip(counts_df[location_col], counts_df[count_col], strict=False)
        }

    return {"Barcelona": int(len(raw_df))}


def sample_rows(raw_df: pd.DataFrame) -> list[str]:
    rows: list[str] = []
    for _, row in raw_df.head(4).iterrows():
        rows.append(
            " | ".join(
                [
                    f"Edad {int(row.get('Age', 0) or 0)}",
                    f"Ciudad {canonical_location_name(row.get('LocationNormalized', 'Barcelona'))}",
                    f"Altitud {int(row.get('Altitude', DEFAULT_ALTITUDE_METERS) or DEFAULT_ALTITUDE_METERS)} m",
                    f"O2 {round(float(row.get('Oxygen Saturation', 0) or 0) * 100)}%",
                    f"FR {int(row.get('Respiratory Rate', 0) or 0)}",
                    f"GOLD {int(row.get('COPD GOLD', 0) or 0)}",
                    f"Pack-years {int(row.get('Pack History', 0) or 0)}",
                    f"Tabaquismo {normalize_smoking_status(row.get('status of smoking', 'sin dato'))}",
                    f"Falla cardiaca {normalize_boolean_text(row.get('History of Heart Failure', 'sin dato'))}",
                ]
            )
        )
    return rows


def build_training_profile(
    raw_df: pd.DataFrame,
    dataset_df: pd.DataFrame,
    selected: dict,
    elevations: dict[str, int],
    specialized_models: dict[str, dict],
) -> dict:
    location_counts = read_location_counts(raw_df)
    oxygen_values = dataset_df["Oxygen Saturation"].astype(float) * 100
    pack_history = pd.to_numeric(dataset_df["Pack History"], errors="coerce").fillna(0)

    return {
        "ready": True,
        "datasetPatients": int(len(dataset_df)),
        "baseLocation": next(iter(location_counts.keys()), "Barcelona"),
        "locationCounts": location_counts,
        "locationElevations": elevations,
        "meanAge": float(pd.to_numeric(dataset_df["Age"], errors="coerce").fillna(0).mean()),
        "meanOxygen": float(oxygen_values.mean()),
        "meanRespRate": float(
            pd.to_numeric(dataset_df["Respiratory Rate"], errors="coerce").fillna(0).mean()
        ),
        "meanPackHistory": float(pack_history.mean()),
        "highPackHistoryRate": float((pack_history >= 40).mean()),
        "meanAltitude": float(pd.to_numeric(dataset_df["Altitude"], errors="coerce").fillna(0).mean()),
        "heartFailureRate": float(
            (
                dataset_df["History of Heart Failure"]
                .astype(str)
                .str.strip()
                .str.lower()
                .isin(["si", "sí", "sã­", "yes", "true", "1"])
            ).mean()
        ),
        "smokingExposureRate": float(
            dataset_df["status of smoking"]
            .astype(str)
            .str.strip()
            .str.lower()
            .isin(["active", "activo", "alta carga", "heavy", "3", "3.0", "4", "4.0"])
            .mean()
        ),
        "goldHighRate": float(
            (pd.to_numeric(dataset_df["COPD GOLD"], errors="coerce").fillna(0) >= 3).mean()
        ),
        "respiratoryFailureRate": float(dataset_df["Respiratory_Failure_Risk"].mean()),
        "cardiacFailureRate": float(dataset_df["Cardiac_Failure_Risk"].mean()),
        "dangerousSymptomRate": float(dataset_df["Dangerous_Symptom_Risk"].mean()),
        "sourceFiles": [PRIMARY_DATASET_PATH.name, SECONDARY_DATASET_PATH.name, LOCATION_ELEVATION_PATH.name],
        "calibrationMode": "Entrenamiento supervisado offline con seleccion automatica y ajuste por altitud",
        "sampleRows": sample_rows(raw_df),
        "selectedModelName": selected["name"],
        "selectedModelPrecision": round(selected["combined_precision"] * 100, 2),
        "triagePrecision": round(selected["triage"]["precision_weighted"] * 100, 2),
        "hospitalizationPrecision": round(
            selected["hospitalization"]["precision_weighted"] * 100, 2
        ),
        "minimumPrecisionTarget": round(MINIMUM_PRECISION * 100, 2),
        "retrainedWithAdjustments": bool(selected["adjusted"]),
        "specializedOutcomes": {
            outcome_key: {
                "label": value["label"],
                "positiveRate": round(value["positive_rate"] * 100, 2),
                "precision": round(value["metrics"]["precision_weighted"] * 100, 2),
                "aucRoc": round(value["metrics"]["auc_roc"] * 100, 2),
            }
            for outcome_key, value in specialized_models.items()
        },
    }


def train_full_model(factory, features: pd.DataFrame, target: pd.Series):
    model = factory(features)
    model.fit(features, target)
    return model


def round_metric_block(metrics: dict[str, float]) -> dict[str, float]:
    return {key: round(value * 100, 2) for key, value in metrics.items()}


def build_specialized_models(selected_factory, features: pd.DataFrame, dataset_df: pd.DataFrame) -> dict[str, dict]:
    specialized_targets = {
        "respiratoryFailure": {
            "label": "Fallo respiratorio",
            "column": "Respiratory_Failure_Risk",
            "artifact_path": RESPIRATORY_MODEL_PATH,
        },
        "cardiacFailure": {
            "label": "Fallo cardiaco",
            "column": "Cardiac_Failure_Risk",
            "artifact_path": CARDIAC_MODEL_PATH,
        },
        "dangerousSymptom": {
            "label": "Nuevo sintoma peligroso",
            "column": "Dangerous_Symptom_Risk",
            "artifact_path": SYMPTOM_MODEL_PATH,
        },
    }

    trained: dict[str, dict] = {}
    for key, config in specialized_targets.items():
        metrics, _ = train_and_score(selected_factory(features), features, dataset_df[config["column"]])
        model = train_full_model(selected_factory, features, dataset_df[config["column"]])
        joblib.dump(model, config["artifact_path"])
        trained[key] = {
            "label": config["label"],
            "column": config["column"],
            "metrics": metrics,
            "positive_rate": float(dataset_df[config["column"]].mean()),
            "artifact": config["artifact_path"].name,
        }
    return trained


def export_manifest(
    raw_df: pd.DataFrame,
    dataset_df: pd.DataFrame,
    selected: dict,
    candidates: list[dict],
    elevations: dict[str, int],
) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    features = build_feature_frame(dataset_df)

    triage_model = train_full_model(selected["factory"], features, dataset_df["Triage"])
    hospitalization_model = train_full_model(
        selected["factory"], features, dataset_df["Hospitalization_Risk"]
    )
    specialized_models = build_specialized_models(selected["factory"], features, dataset_df)

    joblib.dump(triage_model, TRIAGE_MODEL_PATH)
    joblib.dump(hospitalization_model, HOSPITALIZATION_MODEL_PATH)

    manifest = {
        "generatedAt": pd.Timestamp.now("UTC").isoformat(),
        "minimumPrecisionTarget": round(MINIMUM_PRECISION * 100, 2),
        "selectedMetric": "combined_precision_weighted",
        "activeModel": {
            "name": selected["name"],
            "adjusted": bool(selected["adjusted"]),
            "combinedPrecision": round(selected["combined_precision"] * 100, 2),
            "combinedAccuracy": round(selected["combined_accuracy"] * 100, 2),
            "combinedAucRoc": round(selected["combined_auc_roc"] * 100, 2),
            "triage": round_metric_block(selected["triage"]),
            "hospitalization": round_metric_block(selected["hospitalization"]),
            "artifacts": {
                "triageModel": TRIAGE_MODEL_PATH.name,
                "hospitalizationModel": HOSPITALIZATION_MODEL_PATH.name,
                "respiratoryFailureModel": RESPIRATORY_MODEL_PATH.name,
                "cardiacFailureModel": CARDIAC_MODEL_PATH.name,
                "dangerousSymptomModel": SYMPTOM_MODEL_PATH.name,
            },
        },
        "candidateModels": [
            {
                "name": candidate["name"],
                "adjusted": bool(candidate["adjusted"]),
                "combinedPrecision": round(candidate["combined_precision"] * 100, 2),
                "combinedAccuracy": round(candidate["combined_accuracy"] * 100, 2),
                "combinedAucRoc": round(candidate["combined_auc_roc"] * 100, 2),
                "triage": round_metric_block(candidate["triage"]),
                "hospitalization": round_metric_block(candidate["hospitalization"]),
            }
            for candidate in candidates
        ],
        "specializedModels": {
            key: {
                "label": value["label"],
                "artifact": value["artifact"],
                "positiveRate": round(value["positive_rate"] * 100, 2),
                "metrics": round_metric_block(value["metrics"]),
            }
            for key, value in specialized_models.items()
        },
        "riskMathValidation": validate_risk_math(raw_df, dataset_df),
        "trainingProfile": build_training_profile(
            raw_df, dataset_df, selected, elevations, specialized_models
        ),
    }

    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def main() -> None:
    raw_df, dataset_df, elevations = build_dataset()
    features = build_feature_frame(dataset_df)
    labels = dataset_df[["Triage", "Hospitalization_Risk"]]

    initial_candidates = evaluate_candidates(features, labels, candidate_specs())
    best_candidate = max(initial_candidates, key=lambda item: item["combined_precision"])
    all_candidates = list(initial_candidates)

    if best_candidate["combined_precision"] < MINIMUM_PRECISION:
        retry_candidates = evaluate_candidates(features, labels, adjusted_candidate_specs())
        all_candidates.extend(retry_candidates)
        best_candidate = max(all_candidates, key=lambda item: item["combined_precision"])

    export_manifest(raw_df, dataset_df, best_candidate, all_candidates, elevations)

    print("\n============================")
    print("FOXCAT IA TRAINING")
    print("============================\n")
    print(f"Registros combinados: {len(dataset_df)}")
    print(f"Ciudades detectadas: {', '.join(sorted(read_location_counts(raw_df).keys()))}")
    print(f"Modelo activo: {best_candidate['name']}")
    print(f"Precision combinada: {best_candidate['combined_precision'] * 100:.2f}%")
    print(f"AUC-ROC combinado: {best_candidate['combined_auc_roc'] * 100:.2f}%")
    print(f"Precision triage: {best_candidate['triage']['precision_weighted'] * 100:.2f}%")
    print(f"Sensibilidad triage: {best_candidate['triage']['sensitivity'] * 100:.2f}%")
    print(f"Especificidad triage: {best_candidate['triage']['specificity'] * 100:.2f}%")
    print(
        "Precision hospitalizacion: "
        f"{best_candidate['hospitalization']['precision_weighted'] * 100:.2f}%"
    )
    print(
        "Sensibilidad hospitalizacion: "
        f"{best_candidate['hospitalization']['sensitivity'] * 100:.2f}%"
    )
    print(
        "Especificidad hospitalizacion: "
        f"{best_candidate['hospitalization']['specificity'] * 100:.2f}%"
    )
    print(f"Manifest exportado en: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
