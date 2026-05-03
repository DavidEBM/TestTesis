# Foxcat Medical + Firebase

Foxcat Medical es un dashboard clinico visual con estilo pastel, autenticacion Firebase y widgets personalizables por medico.

## Funciones principales

- Login con `Email/Password` de Firebase.
- Dashboard pastel con modo claro y oscuro.
- Foto del medico guardada en `photoURL`.
- Widgets clinicos conectados al paciente seleccionado.
- Reordenamiento y redimensionamiento de widgets desde sus bordes y esquinas.
- Agregar u ocultar widgets con clic derecho.
- Resaltado automatico del widget recien agregado para ubicarlo rapido.
- Cursores pastel personalizados para redimensionamiento en modo claro y oscuro.
- Accesos rapidos personalizables en el panel lateral izquierdo.
- Panel lateral derecho con resumen del turno y opciones futuras en desarrollo.
- IA medica explicable con ajuste por contexto clinico y ambiental.
- Panel tecnico flotante de IA con boton de tuerca, minimizar, cerrar, arrastre libre y resize por lados y esquinas.
- Precarga de manifiesto IA, modulos, estilos, imagenes y recurso Excel desde `index.html` para reducir espera en `login` y `dashboard`.

## IA medica

La IA usa el paciente seleccionado, un manifiesto precalculado en `healtUsurper/ai/training-manifest.json`, el dataset local de `healtUsurper/test/230PatientsCOPD.xlsx` y el conteo de ubicaciones en `healtUsurper/test/conteo_locations.csv`.

El entrenamiento y seleccion del mejor modelo viven en `healtUsurper/test/Training.py`.

Flujo actual:

- `Training.py` entrena varios candidatos
- selecciona el mejor por precision combinada
- si no alcanza `90%`, reintenta con ajustes
- exporta `training-manifest.json` y los artefactos `.joblib`
- `index.html` precarga ese manifiesto antes de entrar al login

Tambien incorpora un contexto simulado por ciudad para:

- Barcelona
- Pasto-Narino
- Cali
- Medellin
- Ipiales

Cada perfil incluye:

- Altitud
- Clima
- Temperatura
- Calidad del aire
- Humedad
- Ajuste respiratorio regional

Nota importante:

- La altura de Pasto se fijo en `2527 m sobre el nvl del mar`, tomando como referencia la ubicacion del hospital.
- La IA es orientativa y no reemplaza criterio medico ni protocolos institucionales.
- El panel tecnico muestra una `precision tecnica estimada`, no una validacion clinica formal del modelo.
- El modelo entrenado actualmente se muestra en el dashboard y en el panel tecnico de depuracion clinica.

### Formulas de riesgo y respaldo

Las formulas del riesgo combinan reglas clinicas explicables con variables que suelen asociarse a deterioro respiratorio y necesidad de hospitalizacion en pacientes con EPOC, como:

- saturacion de oxigeno
- frecuencia respiratoria
- clasificacion `COPD GOLD`
- pulso
- glucosa
- creatinina
- antecedente de falla cardiaca

Su respaldo es `clinico-heuristico`: no es un score medico oficial unico ni un paper especifico replicado exactamente, pero si se basa en criterios ampliamente usados en practica clinica para estimar descompensacion, gravedad respiratoria y comorbilidad. Por eso se muestra como ayuda explicable y no como decision automatica final.

## Flujo de uso

1. Habilita `Email/Password` en Firebase Authentication.
2. Agrega `localhost` a los dominios autorizados de Firebase.
3. Ejecuta `python healtUsurper/test/Training.py` cuando actualices el dataset o quieras regenerar modelos.
4. Sirve el proyecto con `Live Server` o cualquier servidor local.
5. Abre [index.html](c:/Users/David/Downloads/Test/index.html).
6. Inicia sesion desde [healtUsurper/login.html](c:/Users/David/Downloads/Test/healtUsurper/login.html).
7. Entra al dashboard en [healtUsurper/FirstView/dashboard.html](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.html).

## Widgets y menu contextual

Haz clic derecho dentro del dashboard para abrir el menu contextual.

Opciones disponibles:

- `Seleccionar primer paciente`
- `Ir a notas del paciente`
- `Editar posiciones`
- `Agregar widget`
- `Eliminar widget`

### Agregar widget

1. Abre un menu emergente minimalista con los widgets disponibles para agregar.
2. Al elegir uno, el widget se agrega de inmediato al dashboard.
3. El sistema lo inserta segun el orden base esperado del tablero.
4. Se hace scroll suave hacia el widget nuevo y se resalta brevemente para identificarlo.

### Eliminar widget

1. Activa el modo eliminar desde el menu contextual.
2. Mueve el cursor sobre un widget visible.
3. Aparecera un recuadro suave y el widget objetivo se vera mas transparente.
4. Haz clic izquierdo para ocultarlo.
5. Haz clic derecho para cancelar.

### Redimensionar widget

1. Activa `Editar posiciones` desde el menu contextual.
2. Haz doble clic sobre el widget que quieres redimensionar.
3. Arrastra desde el borde o una esquina del widget.
4. El cursor cambia a una variante pastel segun la direccion del ajuste.

### Menu superior izquierdo

1. Las opciones como `Marcar turno`, `Resumen del dia` o `Calendario` abren el `Centro de acciones`.
2. El scroll ahora compensa la altura real de la barra superior fija.
3. Esto evita que la vista quede cortada por debajo del encabezado.

## Accesos rapidos

El panel lateral izquierdo ahora permite:

- Agregar accesos rapidos con el boton `+`
- Eliminar accesos rapidos con el boton `-`
- Llevar al usuario al widget o vista asociada al pulsar cada acceso

Los accesos rapidos tambien se guardan por medico dentro del layout persistido.

## Panel derecho

El panel lateral derecho muestra:

- Nombre del medico
- Total de pacientes
- Pacientes en riesgo
- Estado del motor IA

Adicionalmente incluye botones para funciones futuras. Por ahora muestran un aviso llamativo de:

- `opcion en desarrollo, favor esperar futuras actualizaciones.`

## Panel tecnico de IA

El widget `IA medica de apoyo` incluye un boton de tuerca.

Desde ese panel tecnico se puede ver:

- motor activo
- si la IA entrenada proviene de manifiesto o perfil base
- modo de calibracion
- precision tecnica estimada
- precision del modelo entrenado
- fecha de generacion del manifiesto
- metrica usada para seleccionar el modelo
- metricas de triage y hospitalizacion
- total de modelos candidatos evaluados
- estado de reentrenamiento
- cobertura de datos del paciente y faltantes
- documento, contexto regional y senal del caso
- estadisticas del dataset usado para entrenar
- muestras reducidas del dataset local
- variables clinicas y regionales activas
- detonantes y recomendaciones explicables del caso
- validacion heuristica resumida
- matematica resumida usada por el motor heuristico
- traza corta del proceso realizado

La ventana se puede:

- mover libremente por la pantalla
- redimensionar desde bordes, laterales y esquinas
- minimizar
- cerrar

## Precarga y rendimiento

`index.html` ahora:

- precarga `login.js`, `dashboard.js`, `model-loader.js` y `firebase-config.js`
- precarga `styles.css`, `dashboard.css`, `logo.png`, `profile.png` y `training-manifest.json`
- abre `preconnect` y `dns-prefetch` para `gstatic` y `jsdelivr`
- hace warmup de `login.html`, `dashboard.html`, manifiesto y recursos principales antes de redirigir al login

Esto reduce la latencia percibida al entrar por primera vez al login y al dashboard publicado.

## Colecciones usadas

### `patients`

Campos usados actualmente:

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
- `oxygenSaturation`
- `respiratoryRate`
- `hemoglobin`
- `creatinine`
- `bmi`
- `copdGold`
- `smokingStatus`
- `heartFailureHistory`
- `locationCity`
- `ward`
- `room`
- `appointmentTime`
- `monitoringTime`
- `labTime`
- `notes`
- `createdAt`
- `createdBy`

### `userLayouts`

Campos usados actualmente:

- `widgetOrder`
- `widgetSizes`
- `hiddenWidgetKeys`
- `quickAccessItems`
- `theme`
- `updatedAt`

## Archivos clave

- [index.html](c:/Users/David/Downloads/Test/index.html)
- [healtUsurper/login.html](c:/Users/David/Downloads/Test/healtUsurper/login.html)
- [healtUsurper/login.js](c:/Users/David/Downloads/Test/healtUsurper/login.js)
- [healtUsurper/FirstView/dashboard.html](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.html)
- [healtUsurper/FirstView/dashboard.css](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.css)
- [healtUsurper/FirstView/dashboard.js](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.js)
- [healtUsurper/ai/model-loader.js](c:/Users/David/Downloads/Test/healtUsurper/ai/model-loader.js)
- [healtUsurper/ai/training-manifest.json](c:/Users/David/Downloads/Test/healtUsurper/ai/training-manifest.json)
- [healtUsurper/test/Training.py](c:/Users/David/Downloads/Test/healtUsurper/test/Training.py)
- [healtUsurper/firebase/firebase-config.js](c:/Users/David/Downloads/Test/healtUsurper/firebase/firebase-config.js)
- [healtUsurper/firebase/firestore.rules](c:/Users/David/Downloads/Test/healtUsurper/firebase/firestore.rules)

## Recomendacion tecnica

Sirve siempre el proyecto desde `localhost` o un hosting web. El dashboard usa `fetch` para cargar el dataset local y no debe abrirse como `file://`.
