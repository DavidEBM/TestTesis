# Foxcat Medical

Foxcat Medical es una aplicacion web clinica para personal medico. Usa Firebase Authentication, Cloud Firestore, un dashboard de widgets personalizables por medico y un modulo de IA clinica explicable basado en un manifiesto entrenado offline.

El proyecto usa una licencia personalizada: permite uso libre no comercial para investigacion, aprendizaje, revision, modificacion y prototipado, pero exige autorizacion escrita previa para uso comercial, empresarial, institucional o productivo. Ver `LICENSE`.

## Estado actual

- Login y registro con `Email/Password` de Firebase.
- Dashboard modular con modo claro/oscuro.
- Widgets clinicos conectados al paciente seleccionado.
- Orden, visibilidad y tamanos de widgets persistidos por medico en `userLayouts`.
- Edicion visual del layout con arrastre, previsualizacion de destino y auto-scroll vertical al acercar el cursor a los bordes de la ventana.
- Redimensionamiento de widgets desde bordes y esquinas.
- Agregar widgets ocultos desde menu contextual.
- Eliminar widgets visibles con previsualizacion y confirmacion por clic.
- Accesos rapidos editables en el panel izquierdo.
- CRUD de pacientes desde el modulo de pacientes.
- Importacion/exportacion de pacientes con soporte de CSV/XLSX/SQL segun la logica actual del dashboard.
- Widget local de cuestionarios para guardar enlaces o QR en `localStorage`.
- Panel tecnico flotante de IA con arrastre, minimizar, cerrar y resize.
- Precarga de recursos principales desde `index.html`.

## Como ejecutar

1. Habilita `Email/Password` en Firebase Authentication.
2. Agrega `localhost` al listado de dominios autorizados de Firebase.
3. Sirve el proyecto con un servidor local, por ejemplo:

```powershell
python -m http.server 8000
```

4. Abre `http://localhost:8000/index.html`.
5. Inicia sesion y entra al dashboard.

No abras el dashboard como `file://`; el proyecto usa modulos ES y `fetch`.

## Flujo principal

1. `index.html` precarga recursos y redirige al login.
2. `healtUsurper/login.html` y `login.js` autentican al usuario.
3. `healtUsurper/FirstView/dashboard.html` carga la interfaz clinica.
4. `dashboard.js` carga preferencias de `userLayouts`, escucha `patients` en Firestore y renderiza los widgets.
5. `model-loader.js` carga `healtUsurper/ai/training-manifest.json` para el modulo IA.

## Widgets actuales

El orden base vive en `defaultWidgetOrder` y las etiquetas en `widgetCatalog`.

Widgets disponibles:

- `overview`: resumen del paciente.
- `medic-ai`: IA medica de apoyo.
- `consult-analysis`: analisis corto de consulta.
- `alerts`: alertas clinicas.
- `agenda`: agenda del paciente.
- `status`: estado del tablero.
- `form`: modulo de pacientes.
- `questionnaires`: cuestionarios del paciente.
- `patients`: pacientes sincronizados.
- `labs`: laboratorios y signos.
- `critical`: seguimiento prioritario.
- `location`: ubicacion del paciente.
- `notes`: notas del paciente.

## Menu contextual del dashboard

Haz clic derecho dentro del dashboard.

Opciones actuales:

- `Seleccionar primer paciente`.
- `Ir a notas del paciente`.
- `Editar posiciones`.
- `Agregar widget`.
- `Eliminar widget`.

### Editar posiciones

Activa el modo de edicion desde el menu contextual. En este modo:

- arrastra un widget para cambiarlo de posicion;
- la interfaz muestra una previsualizacion del destino;
- el orden solo se aplica al soltar;
- si acercas el cursor al borde superior o inferior de la ventana, la pagina hace scroll automaticamente;
- confirma con el boton verde para persistir el layout;
- cancela con el boton rojo para volver al ultimo layout guardado.

### Redimensionar widgets

1. Entra en `Editar posiciones`.
2. Haz doble clic sobre el widget que quieres redimensionar.
3. Arrastra desde un borde o esquina.
4. Guarda o cancela el layout.

### Agregar widgets

1. Abre `Agregar widget`.
2. Selecciona un widget oculto.
3. El sistema lo inserta segun el orden base.
4. El widget se resalta y la vista hace scroll hacia el.

### Eliminar widgets

1. Abre `Eliminar widget`.
2. Mueve el cursor sobre un widget visible.
3. El objetivo se marca con una visual de eliminacion.
4. Haz clic izquierdo para ocultarlo.
5. Haz clic derecho para cancelar.

Siempre debe quedar al menos un widget visible.

## Pacientes

La coleccion principal es `patients`.

Campos usados por el dashboard:

- `name`
- `documentId`
- `age`
- `condition`
- `status`
- `photoUrl`
- `bloodPressureSystolic`
- `bloodPressureDiastolic`
- `pulse`
- `glucose`
- `hemoglobin`
- `creatinine`
- `oxygenSaturation`
- `respiratoryRate`
- `bmi`
- `packHistory`
- `copdGold`
- `smokingStatus`
- `heartFailureHistory`
- `ecg`
- `bnp`
- `coronaryHistory`
- `arrhythmias`
- `locationCity`
- `locationElevationM`
- `locationRiskLevel`
- `ward`
- `room`
- `appointmentTime`
- `monitoringTime`
- `labTime`
- `notes`
- `createdAt`
- `createdBy`
- `updatedAt`
- `lastConsultationAt`

El modulo de pacientes permite crear, editar, ver historia, eliminar con doble confirmacion y registrar cita medica del dia.

## Preferencias por medico

La coleccion `userLayouts` guarda:

- `widgetOrder`
- `widgetSizes`
- `hiddenWidgetKeys`
- `quickAccessItems`
- `theme`
- `doctorProfile.displayName`
- `doctorProfile.photoUrl`
- `updatedAt`

La foto del medico se guarda en `doctorProfile.photoUrl`, no solo en `Auth.photoURL`, para evitar limites practicos al manejar imagenes codificadas.

## Cuestionarios

El widget `questionnaires` guarda cuestionarios en `localStorage` con la clave `foxcat-patient-questionnaires`.

Cada item puede contener:

- `id`
- `title`
- `purpose`
- `url`
- `qrDataUrl`
- `createdAt`

Estos datos son locales al navegador. No se sincronizan con Firestore en el estado actual.

## IA clinica

La IA visible en el dashboard es orientativa y explicable. No reemplaza criterio medico ni protocolos institucionales.

Archivos principales:

- `healtUsurper/test/Training.py`: entrenamiento offline.
- `healtUsurper/ai/training-manifest.json`: manifiesto exportado.
- `healtUsurper/ai/model-loader.js`: carga y cache del manifiesto.
- `healtUsurper/FirstView/dashboard.js`: interpretacion clinica y render.

El entrenamiento no ocurre en el navegador. El dashboard consume el manifiesto ya generado y lo combina con reglas clinicas explicables para el paciente actual.

La evaluacion por paciente usa funciones como:

- `computeClinicalAssessment(patient)`
- `buildClinicalForecast(patient, assessment, region)`
- `buildAiMethodRouting(patient, assessment, region)`
- `buildDomainRiskTimeline(assessment)`
- `buildConsultationAnalysis(patient)`
- `buildAiDebugData(patient)`

El panel tecnico muestra, entre otros datos:

- modelo activo del manifiesto;
- precision tecnica estimada;
- precision del modelo entrenado;
- metricas de triage y hospitalizacion;
- cobertura de datos del paciente;
- contexto regional;
- detonantes y recomendaciones;
- riesgos respiratorio, cardiaco y de sintoma peligroso;
- capas IA en estado `Activa`, `Proxy clinico` o `Pendiente`.

## Contexto regional

`regionProfiles` define perfiles ambientales usados por la interpretacion clinica:

- Barcelona
- Pasto-Narino
- Cali
- Medellin
- Bogota
- Ipiales

Cada perfil puede aportar altitud, clima, temperatura, calidad del aire, humedad, ajuste de oxigenacion y foco de recomendacion.

## Archivos clave

- `index.html`
- `healtUsurper/login.html`
- `healtUsurper/login.js`
- `healtUsurper/FirstView/dashboard.html`
- `healtUsurper/FirstView/dashboard.css`
- `healtUsurper/FirstView/dashboard.js`
- `healtUsurper/ai/model-loader.js`
- `healtUsurper/ai/training-manifest.json`
- `healtUsurper/test/Training.py`
- `healtUsurper/firebase/firebase-config.js`
- `healtUsurper/firebase/firestore.rules`

## Linea de tiempo resumida

- Base inicial: login Firebase, dashboard clinico y widgets principales.
- Personalizacion: persistencia de layout, tema, tamanos, widgets ocultos y accesos rapidos por medico.
- IA explicable: carga de manifiesto offline, panel tecnico y analisis de consulta.
- Pacientes: modulo CRUD, importacion, exportacion e historia clinica.
- Cuestionarios: widget local para enlaces y QR.
- Layout reciente: eliminar widgets con visual clara, mover widgets con previsualizacion estable y auto-scroll durante el arrastre.
