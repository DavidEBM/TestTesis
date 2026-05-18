# Foxcat Medical + Firebase

Foxcat Medical es un dashboard clinico visual con estilo pastel, autenticacion Firebase y widgets personalizables por medico.

## Funciones principales

- Login con `Email/Password` de Firebase.
- Dashboard pastel con modo claro y oscuro.
- Foto del medico guardada en `userLayouts.doctorProfile.photoUrl`, con `displayName` auxiliar en `Auth` cuando hace falta.
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

### Orquestacion IA por paciente

El widget `IA medica de apoyo` y el `Panel de depuracion clinica` ahora no muestran solo un modelo ganador global. Tambien construyen una `ruta IA por caso`, es decir, que metodos participan para el paciente actual segun su riesgo, cobertura de datos y horizonte temporal.

Metodos contemplados actualmente por la interfaz:

- `Arbol de Decision (CHAID)`: se usa como capa activa para estratificar peligro temprano y abrir la rama inicial del caso.
- `Regresion Logistica Binaria (Wald)`: se usa como capa activa para explicar la fuerza de asociacion de variables como edad, tabaquismo, O2, creatinina o glucosa con el desenlace.
- `Random Forest`: se muestra como capa activa cuando coincide con el modelo ganador exportado por el manifiesto; si no coincide, se muestra como comparador de generalizacion.
- `MLP`: se muestra como capa `proxy clinico` o `pendiente` para casos con mayor carga cronica y riesgo de reingreso.
- `Algoritmos Geneticos`: se muestran como capa `proxy clinico` o `pendiente` para priorizacion de variables en calidad de vida / deterioro acumulado.
- `Propensity Score Matching`: se muestra como capa `proxy clinico` o `pendiente` cuando el caso parece candidato a rehabilitacion y comparacion observacional.

Estados visibles:

- `Activa`: el metodo ya participa de la lectura del caso actual dentro del motor de interfaz o coincide con el modelo ganador exportado.
- `Proxy clinico`: el metodo se representa como capa explicativa y de apoyo clinico, pero todavia no existe un artefacto dedicado separado consumido en tiempo real por el dashboard para ese punto exacto.
- `Pendiente`: el metodo fue definido como parte de la arquitectura objetivo, pero aun no tiene una activacion fuerte para ese paciente o no tiene un artefacto/runtime separado listo para navegarlo desde el dashboard.

Importante:

- `Activa` no significa que todo ocurra en vivo dentro del navegador como entrenamiento online.
- `Proxy clinico` no significa inventado; significa que la UI ya expresa ese rol clinico con reglas y contexto, aunque no necesariamente exista hoy un `.joblib` exclusivo para esa capa.
- `Pendiente` evita vender como implementado algo que todavia esta en diseño, validacion o futura exportacion.

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
- El widget ahora tambien muestra un `pronostico anticipado si no se trata`, con ventana critica, senal centinela y escenario de deterioro probable.
- El widget `Analisis de consulta` resume la IA en lenguaje mas corto y evita mostrar nombres internos en ingles al medico o al paciente.

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

## Widget `Analisis de consulta`

Este widget resume la `IA medica de apoyo` para lectura rapida en consulta.

Muestra:

- resumen breve del caso
- puntos fuertes
- puntos debiles
- recomendaciones cortas para el medico
- una lectura compacta del riesgo en el tiempo
- tiempo estimado con riesgo bajo
- desde cuando empezaria a ser preocupante no seguir las recomendaciones
- posibles afectaciones futuras
- acciones `Agendar Cita` y `Mandar Resumen al paciente`

Decision de interfaz:

- se evito mostrar tres porcentajes grandes aislados
- ahora se usa una frase corta del tipo `Durante x horas... despues de y horas el riesgo podria subir hasta z%`
- esto ayuda a que el medico entienda primero la conclusion operativa
- esa frase no usa una logica aparte: se deriva de las mismas ventanas del modulo IA (`24 a 72 horas`, `1 semana`, `1+ mes`) para evitar contradicciones

## Lenguaje de interfaz

En la capa visible para medico y paciente se prioriza:

- traducir nombres internos o tecnicos a lenguaje clinico entendible
- no exponer claves internas como `respiratory`, `cardiac` o `dangerousSymptom` directamente
- usar equivalentes como `respiratorio`, `cardiopulmonar` o `sintomas de alarma`
- condensar la lectura temporal del riesgo en una explicacion breve

## Panel tecnico de IA

El widget `IA medica de apoyo` incluye un boton de tuerca.

Desde ese panel tecnico se puede ver:

- orquestacion IA del paciente
- metodos `activos`, `proxy clinico` y `pendientes`
- pronostico sin tratamiento y ventana critica
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

### Significado de estados y metricas del panel tecnico

#### Estados de IA

- `Activa`: el metodo ya esta participando en el caso actual.
- `Proxy clinico`: el metodo ya esta representado en la explicacion clinica del caso, pero todavia no necesariamente tiene un artefacto independiente conectado al dashboard.
- `Pendiente`: el metodo esta contemplado en la arquitectura pero aun no se activa con suficiente senal o aun no se exporta como parte del runtime.

#### Precision tecnica estimada

- Es una metrica `operativa interna`.
- Se calcula en el frontend usando cobertura de variables del paciente y tamano/solidez de la base de referencia.
- Sirve para decir cuan completa parece la entrada del caso, no para certificar clinicamente el modelo.

#### Precision del modelo entrenado

- Viene del `training-manifest.json`.
- Corresponde al mejor candidato ganador del ultimo entrenamiento offline.
- No es una precision recalculada en vivo cada vez que se abre el dashboard.

#### AUC-ROC

- Mide capacidad de separacion entre clases, por ejemplo bajo vs alto riesgo.
- Se interpreta entre `0` y `1` en matematica pura, pero en el panel del manifiesto ya suele mostrarse escalado a `0-100`.
- Mientras mas alto, mejor capacidad discriminativa global.
- No reemplaza sensibilidad ni especificidad; las complementa.

#### Triage

- Resume el rendimiento del modelo sobre la tarea de clasificar urgencia inicial o nivel de atencion del caso.
- En el manifiesto incluye metricas como `accuracy`, `precision_weighted`, `recall_weighted`, `f1_weighted`, `auc_roc`, `sensitivity` y `specificity`.

#### Hospitalizacion

- Resume el rendimiento del modelo sobre la tarea de estimar riesgo de hospitalizacion o descompensacion que lleve a ese desenlace.
- Se interpreta igual que el bloque de `triage`, pero para otro objetivo.

#### Artefactos

- Son archivos exportados, normalmente `.joblib`, generados por `Training.py`.
- Ejemplos actuales:
  - `triage-model.joblib`
  - `hospitalization-model.joblib`
  - `respiratory-failure-model.joblib`
  - `cardiac-failure-model.joblib`
  - `dangerous-symptom-model.joblib`
- Que un artefacto exista significa que hubo exportacion offline; no implica que todos se esten invocando en tiempo real desde el frontend con inferencia Python en navegador.

#### Prec, Sens y Esp

- `Prec`: precision ponderada. De las predicciones positivas o clases emitidas, cuantas fueron correctas en promedio ponderado.
- `Sens`: sensibilidad o `recall`. De los casos verdaderamente positivos, cuantos logro detectar el modelo.
- `Esp`: especificidad. De los casos verdaderamente negativos, cuantos logro mantener como negativos.

Lectura rapida:

- alta `Sens` ayuda a no dejar pasar pacientes de riesgo.
- alta `Esp` ayuda a no sobreactivar alertas en casos no peligrosos.
- alta `Prec` ayuda a que lo que el modelo marque tenga mejor calidad general.

#### Por que puede salir `Reentrenamiento: Sin ajustes extra`

- Porque el primer bloque de candidatos ya supero el umbral minimo (`90%` en el flujo actual) y no fue necesario lanzar la tanda de reintentos ajustados.
- Porque el modelo ganador inicial ya era suficiente por precision combinada.
- Porque `Training.py` solo marca `retrainedWithAdjustments` cuando realmente entra al segundo ciclo de candidatos tuneds / retry.

En otras palabras:

- `Sin ajustes extra` no significa error.
- Significa que el entrenamiento base ya fue suficiente.

#### Por que en la validacion matematica hay decimales y porcentajes mezclados

- Porque no todas las metricas nacen en la misma escala matematica.
- Algunas son proporciones naturales entre `0` y `1`, y en el panel se convierten a porcentaje multiplicando por `100`.
- Otras se muestran mejor como coeficientes o correlaciones y por eso se dejan en decimal.

Casos tipicos:

- `AUC-ROC heuristico`, `sensibilidad`, `especificidad`, `cobertura de recomendaciones` y `cobertura de detonantes` suelen venir como `0-1` y luego se presentan como `%`.
- `Spearman O2 vs riesgo` y `Spearman FR vs riesgo` son correlaciones. Su dominio natural es `-1` a `1`, por eso se dejan con decimales como `-0.717` o `0.685`.

Regla mental util:

- si representa `proporcion de cumplimiento`, es normal verlo como `%`.
- si representa `fuerza/direccion de relacion`, es normal verlo como decimal.

## Ciclo de entrenamiento IA

El entrenamiento no ocurre dentro del navegador. El flujo actual es offline y manual:

- `healtUsurper/test/Training.py` lee `230PatientsCOPD.xlsx` y `conteo_locations.csv`.
- entrena varios modelos candidatos para triage y hospitalizacion.
- calcula metricas combinadas y selecciona el mejor candidato por precision/AUC.
- guarda el resultado ganador en `healtUsurper/ai/training-manifest.json`.
- exporta tambien los artefactos `triage-model.joblib` y `hospitalization-model.joblib`.

Puntos importantes para operacion y futuras actualizaciones:

- el dashboard solo consume el manifiesto ya exportado; no reentrena automaticamente.
- los pacientes nuevos guardados desde la pagina en Firestore no entran al modelo por si solos.
- para incluir pacientes nuevos en la IA hay que consolidarlos en el dataset fuente y volver a ejecutar `Training.py`.
- la "mejor precision" visible en el panel tecnico corresponde al ultimo manifiesto ganador exportado, no a un entrenamiento en vivo.
- si cambian las reglas heuristicas del riesgo en `dashboard.js`, conviene volver a contrastarlas con el dataset y regenerar el manifiesto.
- el panel puede mostrar varias capas IA por paciente, pero eso no significa que todas ya tengan entrenamiento online separado en el navegador.
- cuando el panel muestra `proxy clinico`, la capa ya tiene sentido clinico y explicativo, pero puede seguir dependiendo del motor heuristico y del manifiesto principal en vez de un artefacto individual dedicado.
- el widget `Analisis de consulta` debe mantenerse corto, narrativo y con terminologia traducida para un usuario no tecnico.

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
- `doctorProfile.displayName`
- `doctorProfile.photoUrl`
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
