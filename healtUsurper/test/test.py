import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# ==========================
# 1. Cargar dataset
# ==========================

df = pd.read_excel("230PatientsCOPD.xlsx")

# ==========================
# 2. Agregar altitud (Barcelona)
# ==========================

ALTURA_BARCELONA = 12
df["Altitude"] = ALTURA_BARCELONA

# ==========================
# 3. Crear TRIAGE
# ==========================

def triage(o2):
    if o2 >= 0.94:
        return "Low"
    elif o2 >= 0.90:
        return "Medium"
    else:
        return "High"

df["Triage"] = df["Oxygen Saturation"].apply(triage)

# ==========================
# 4. Crear riesgo hospitalización
# ==========================

def hospitalizacion(row):

    if (
        row["Oxygen Saturation"] < 0.90
        or row["Respiratory Rate"] > 24
        or row["COPD GOLD"] >= 3
    ):
        return 1
    else:
        return 0

df["Hospitalization_Risk"] = df.apply(hospitalizacion, axis=1)

# ==========================
# 5. Limpiar columnas innecesarias
# ==========================

df = df.drop(columns=["ID Number\n"], errors="ignore")

# ==========================
# 6. Convertir variables categóricas
# ==========================

encoders = {}

for col in df.select_dtypes(include=["object","string","category"]).columns:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    encoders[col] = le

# ==========================
# 7. MODELO TRIAGE
# ==========================

X_triage = df.drop(columns=["Triage", "Hospitalization_Risk"])
y_triage = df["Triage"]

X_train, X_test, y_train, y_test = train_test_split(
    X_triage, y_triage, test_size=0.2, random_state=42
)

modelo_triage = RandomForestClassifier(n_estimators=200, random_state=42)
modelo_triage.fit(X_train, y_train)

pred = modelo_triage.predict(X_test)

print("\n============================")
print("Reporte TRIAGE")
print("============================\n")

print(classification_report(y_test, pred))

# ==========================
# 8. MODELO HOSPITALIZACION
# ==========================

X_hosp = df.drop(columns=["Hospitalization_Risk", "Triage"])
y_hosp = df["Hospitalization_Risk"]

X_train2, X_test2, y_train2, y_test2 = train_test_split(
    X_hosp, y_hosp, test_size=0.2, random_state=42
)

modelo_hospital = RandomForestClassifier(n_estimators=200, random_state=42)
modelo_hospital.fit(X_train2, y_train2)

pred2 = modelo_hospital.predict(X_test2)

print("\n============================")
print("Reporte HOSPITALIZACION")
print("============================\n")

print(classification_report(y_test2, pred2))

# ==========================
# 9. Generar paciente aleatorio
# ==========================

paciente = {}

for col in X_triage.columns:
    paciente[col] = np.random.choice(df[col])

paciente_df = pd.DataFrame([paciente])

# ==========================
# 10. Predicciones
# ==========================

triage_pred = modelo_triage.predict(paciente_df)
hospital_pred = modelo_hospital.predict(paciente_df)

# Probabilidad hospitalización
hospital_prob = modelo_hospital.predict_proba(paciente_df)

print("\n============================")
print("PACIENTE GENERADO")
print("============================\n")

print(paciente_df)

print("\n============================")
print("RESULTADO TRIAGE")
print("============================\n")

print("Nivel de riesgo:", triage_pred[0])

print("\n============================")
print("HOSPITALIZACION")
print("============================\n")

print("Hospitalización probable:", hospital_pred[0])
print("Probabilidad:", round(hospital_prob[0][1]*100,2), "%")