# Foxcat Medical + Firebase

Foxcat Medical es un dashboard clinico visual con estilo pastel, autenticacion Firebase y widgets personalizables por medico.

## Funciones principales

- Login con `Email/Password` de Firebase.
- Dashboard pastel con modo claro y oscuro.
- Foto del medico guardada en `photoURL`.
- Widgets clinicos conectados al paciente seleccionado.
- Reordenamiento y redimensionamiento de widgets.
- Agregar u ocultar widgets con clic derecho.
- Resaltado automatico del widget recien agregado para ubicarlo rapido.
- Cursores pastel personalizados para redimensionamiento en modo claro y oscuro.
- Accesos rapidos personalizables en el panel lateral izquierdo.
- Panel lateral derecho con resumen del turno y opciones futuras en desarrollo.
- IA medica explicable con ajuste por contexto clinico y ambiental.

## IA medica

La IA usa el paciente seleccionado, el dataset local de `healtUsurper/test/230PatientsCOPD.xlsx` y el conteo de ubicaciones en `healtUsurper/test/conteo_locations.csv`.

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

## Flujo de uso

1. Habilita `Email/Password` en Firebase Authentication.
2. Agrega `localhost` a los dominios autorizados de Firebase.
3. Sirve el proyecto con `Live Server` o cualquier servidor local.
4. Abre [index.html](c:/Users/David/Downloads/Test/index.html).
5. Inicia sesion desde [healtUsurper/login.html](c:/Users/David/Downloads/Test/healtUsurper/login.html).
6. Entra al dashboard en [healtUsurper/FirstView/dashboard.html](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.html).

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
3. Arrastra desde cualquier borde o esquina del widget.
4. El cursor cambia a una variante pastel segun la direccion del ajuste.

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
- [healtUsurper/firebase/firebase-config.js](c:/Users/David/Downloads/Test/healtUsurper/firebase/firebase-config.js)
- [healtUsurper/firebase/firestore.rules](c:/Users/David/Downloads/Test/healtUsurper/firebase/firestore.rules)

## Recomendacion tecnica

Sirve siempre el proyecto desde `localhost` o un hosting web. El dashboard usa `fetch` para cargar el dataset local y no debe abrirse como `file://`.
