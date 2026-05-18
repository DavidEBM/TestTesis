# Detalles Tecnicos de Foxcat Medical

Este documento esta orientado a informaticos y personal tecnico que necesite entender la estructura general del proyecto, sus variables mas relevantes y los puntos donde es mas comun hacer modificaciones.

## 1. Vision tecnica rapida

Foxcat Medical es una aplicacion web cliente que:

- inicia en `index.html`
- precarga un manifiesto IA entrenado antes del login
- redirige al login en `healtUsurper/login.html`
- autentica con Firebase Authentication
- carga el dashboard en `healtUsurper/FirstView/dashboard.html`
- sincroniza pacientes y preferencias visuales con Firestore
- usa un manifiesto exportado por `healtUsurper/test/Training.py` para el modulo de IA clinica explicable

## 2. Variables importantes

No se listan todas las variables del proyecto. Solo las mas importantes para mantenimiento y personalizacion.

### 2.1 Variables de estructura del dashboard

Archivo principal: `healtUsurper/FirstView/dashboard.js`

#### `defaultWidgetOrder`

Define el orden base de los widgets visibles en el dashboard.

Ejemplo de uso:

- cambiar el orden inicial del tablero
- agregar una nueva clave si se crea un nuevo widget

Impacto esperado:

- modifica el orden por defecto para usuarios nuevos
- si se cambia una clave existente, tambien debe actualizarse en `widgetCatalog` y en el HTML

#### `widgetCatalog`

Mapa central de widgets. Cada clave contiene:

- `label`
- `description`
- `shortcutDescription`

Ejemplo de uso:

- renombrar widgets
- cambiar textos de ayuda
- exponer un widget nuevo en menus de seleccion y accesos rapidos

Recomendacion:

- mantener las claves estables, por ejemplo `notes`, `patients`, `labs`
- si se cambia una clave, revisar accesos rapidos, insercion de widgets y renderizado

#### `defaultQuickAccess`

Lista inicial de accesos rapidos del panel izquierdo.

Ejemplo de uso:

- agregar un atajo por defecto a `visual-settings`
- quitar accesos si se quiere un panel mas limpio para nuevos usuarios

Campos relevantes por item:

- `id`
- `type`
- `target`
- `label`

### 2.2 Estado global de la interfaz

#### `state`

Objeto principal de estado de la UI. Es una de las piezas mas importantes del sistema.

Campos recomendados para entender primero:

- `patients`: pacientes cargados desde Firestore
- `selectedPatientId`: paciente activo en el dashboard
- `layoutOrder`: orden actual de widgets
- `widgetSizes`: tamanos persistidos por widget
- `hiddenWidgetKeys`: widgets ocultos
- `quickAccessItems`: accesos rapidos activos
- `theme`: `light` o `dark`
- `uiMode`: modo actual de interaccion, actualmente centrado en `idle` y `remove-widget`
- `placementTarget`: objetivo temporal usado en el flujo de eliminacion
- `activeResizeWidgetKey`: widget actualmente habilitado para resize fino
- `resizeSession`: estado temporal del redimensionamiento por bordes
- `aiDebugOpen`: controla si la ventana tecnica de IA esta visible
- `aiDebugMinimized`: controla si la ventana tecnica esta minimizada
- `aiDebugPosition`: posicion libre del panel tecnico flotante
- `aiDebugDrag`: estado temporal del arrastre del panel tecnico
- `aiDebugSize`: tamano persistido en memoria para el panel tecnico
- `aiDebugResizeSession`: estado temporal del resize del panel tecnico por bordes
- `doctorProfile`: perfil ligero persistido por medico dentro de `userLayouts`, usado para `displayName` y `photoUrl`

Posibles modificaciones:

- agregar nuevos modos de interfaz dentro de `uiMode`
- persistir mas preferencias visuales dentro del mismo estado
- introducir filtros activos por medico o por prioridad

Precaucion:

- si se agregan campos nuevos al estado y deben persistirse, revisar `saveUserLayout()` y `loadUserLayout()`
- si se agregan mas textos visibles al widget de consulta, conviene mantener traducciones al español de cualquier nombre interno o clave tecnica

### 2.3 Variables de IA clinica y contexto regional

#### `regionProfiles`

Mapa de perfiles regionales simulados usados por la IA.

Contiene datos como:

- altitud
- temperatura
- humedad
- calidad del aire
- ajuste de oxigenacion
- enfoque de recomendacion

Posibles modificaciones:

- agregar nuevas ciudades
- ajustar altitudes y factores ambientales
- personalizar recomendaciones por hospital o sede

Impacto:

- cambia el texto explicativo del widget IA
- altera algunos calculos del riesgo clinico orientativo

#### `fallbackTrainingProfile`

Perfil minimo usado mientras el dataset local aun no carga o falla.

Posibles modificaciones:

- actualizar medias base
- cambiar la ciudad base
- adaptar el perfil a otro conjunto de pacientes

#### `training-manifest.json`

Archivo generado por `healtUsurper/test/Training.py`.

Contiene:

- modelo activo seleccionado
- metricas de precision y accuracy
- candidatos evaluados
- perfil estadistico resumido para el dashboard
- muestras de datos para depuracion

Ventaja:

- evita recalcular el dataset dentro del dashboard
- permite precargar la IA desde `index.html`
- centraliza mantenimiento y actualizaciones del modelo
- sirve como fuente auditable para el panel de depuracion clinica

#### Orquestacion IA del caso

El dashboard ya no se limita a leer un `modelo ganador` global. Tambien construye una capa de `orquestacion IA por paciente`.

Eso significa que:

- usa el manifiesto exportado para conocer el motor ganador real
- combina reglas clinicas explicables para contextualizar el paciente actual
- decide que metodos mostrar como `activos`, `proxy clinico` o `pendientes`
- genera un pronostico anticipado si el paciente no se trata en la ventana sugerida

La orquestacion actual se apoya en funciones como:

- `computeClinicalAssessment(patient)`
- `buildClinicalForecast(patient, assessment, region)`
- `buildAiMethodRouting(patient, assessment, region)`
- `buildAiDebugData(patient)`
- `buildConsultationAnalysis(patient)`
- `buildConsultationTimeline(assessment)`

#### Widget `Analisis de consulta`

Este widget se diseno para una lectura mas corta que la del widget `IA medica de apoyo`.

Objetivo:

- resumir el caso sin obligar al medico a leer todos los detonantes y porcentajes primero
- traducir nombres internos o variables tecnicas a lenguaje clinico visible
- convertir la lectura temporal del riesgo en una frase operativa breve

Ejemplo de salida esperada:

- `Durante aproximadamente x horas no se espera un riesgo elevado...`
- `Despues de y horas, el riesgo podria subir hasta z%`

Esto reemplaza en ese widget la idea de mostrar tres porcentajes grandes aislados como primera lectura.

Regla tecnica importante:

- la frase resumida debe derivarse de las mismas ventanas del motor principal (`24 a 72 horas`, `1 semana`, `1+ mes`)
- no debe inventar una ventana segura separada si `shortRisk` ya es alto
- si el riesgo temprano ya es alto, el widget debe decirlo explicitamente y no prometer horas de bajo riesgo

#### Estados `Activa`, `Proxy clinico` y `Pendiente`

Interpretacion tecnica:

- `Activa`: la capa ya interviene directamente en la lectura del caso actual o coincide con el modelo ganador del manifiesto.
- `Proxy clinico`: la capa ya tiene representacion funcional en la explicacion clinica del caso, pero no necesariamente tiene hoy un artefacto independiente invocado por el frontend para ese rol exacto.
- `Pendiente`: la capa existe en la arquitectura objetivo o en la reunion funcional, pero todavia no tiene suficiente senal, implementacion o artefacto separado para mostrarse como activa.

Importante para mantenimiento:

- `Proxy clinico` no significa falso; significa que el sistema esta siendo honesto sobre el nivel de implementacion runtime.
- `Pendiente` evita documentar como desplegado algo que todavia esta en fase de planeacion o futura exportacion.

#### `expectedOxygen`

Variable generada dentro de `computeClinicalAssessment(patient)`.

Uso:

- estima la saturacion esperada del paciente segun contexto base y ajuste regional

Posibles modificaciones:

- redondear mas agresivamente
- usar una formula distinta
- introducir ajuste por edad, IMC o gravedad

### 2.4 Variables de autenticacion y datos

Archivo relevante: `healtUsurper/firebase/firebase-config.js`

#### `firebaseConfig`

Configuracion de Firebase.

Campos conocidos:

- `authDomain`
- `storageBucket`
- otros identificadores del proyecto Firebase

Posibles modificaciones:

- migrar a otro proyecto Firebase
- separar entorno de desarrollo y produccion

Precaucion:

- si cambia el proyecto, revisar reglas, Authentication y colecciones de Firestore

#### `auth`

Instancia de Firebase Authentication.

Uso principal:

- login
- logout
- persistencia de sesion
- deteccion de usuario autenticado

#### `db`

Instancia de Firestore.

Uso principal:

- lectura y escritura de `patients`
- lectura y escritura de `userLayouts`

## 3. Puntos frecuentes de personalizacion

### 3.1 Cambiar el orden o disponibilidad de widgets

Revisar:

- `defaultWidgetOrder`
- `widgetCatalog`
- `hiddenWidgetKeys`
- `getDefaultInsertBeforeKey(widgetKey)`

Nota:

- el agregado de widgets ahora es instantaneo
- la posicion de insercion se calcula con el orden base del tablero
- despues del agregado se aplica un resaltado temporal para ubicar el widget nuevo

### 3.2 Cambiar accesos rapidos iniciales

Revisar:

- `defaultQuickAccess`
- `renderQuickAccessList()`
- `renderQuickAccessPicker()`

### 3.3 Cambiar reglas de evaluacion IA

Revisar:

- `computeClinicalAssessment(patient)`
- `regionProfiles`
- `fallbackTrainingProfile`
- archivos de prueba en `healtUsurper/test/`

### 3.4 Cambiar persistencia del layout por medico

Revisar:

- `loadUserLayout(userId)`
- `saveUserLayout()`
- coleccion `userLayouts`

Nota actual:

- la foto del medico ya no se apoya solo en `Auth.photoURL`
- el dashboard persiste la imagen en `userLayouts.doctorProfile.photoUrl`
- esto evita errores al intentar guardar `data URLs` largas directamente como `photoURL` de Firebase Auth
- `displayName` puede seguir sincronizandose con Auth como apoyo, pero la fuente principal de UI para la foto es `doctorProfile`

### 3.4.1 Cambiar el flujo de entrenamiento IA centralizado

Revisar:

- `healtUsurper/test/Training.py`
- `healtUsurper/ai/training-manifest.json`
- `healtUsurper/ai/model-loader.js`

Flujo actual:

- `Training.py` carga el Excel
- crea objetivos de `Triage` y `Hospitalization_Risk`
- entrena varios modelos candidatos
- selecciona el mejor por precision combinada
- si no llega al `90%`, vuelve a intentar con modelos ajustados
- exporta un manifiesto JSON y artefactos `.joblib`

Importante:

- el navegador no entrena modelos Python directamente
- `index.html` solo precarga el manifiesto ya generado

### 3.5 Cambiar comportamiento de resize y cursores

Revisar:

- `getResizeDirectionForPointer(widget, clientX, clientY)`
- `beginWidgetResize(widget, direction, event)`
- `handleWidgetResizeMove(event)`
- reglas CSS `data-resize-cursor`

Posibles modificaciones:

- ampliar o reducir el area sensible cambiando `outerEdge` e `innerEdge`
- personalizar los cursores por tema
- desactivar resize diagonal o vertical si el proyecto lo requiere

### 3.6 Cambiar el scroll compensado del dashboard

Revisar:

- `getTopbarScrollOffset(extra)`
- `scrollElementIntoViewport(element, options)`
- `renderWorkspace(title, content)`
- `scrollToWidgetKey(widgetKey)`

Uso:

- evitar que un bloque quede oculto por la barra superior fija
- ajustar el margen visual al abrir el `Centro de acciones`
- reutilizar el scroll compensado para widgets y vistas auxiliares

### 3.7 Cambiar el panel tecnico flotante de IA

Revisar:

- `buildAiDebugData(patient)`
- `renderAiDebugWindow()`
- `openAiDebugWindow()`
- `toggleAiDebugMinimize()`
- `beginAiDebugDrag(event)`
- `beginAiDebugResize(direction, event)`
- `handleAiDebugResize(event)`
- `clampAiDebugSize(size)`
- `applyAiDebugWindowGeometry()`
- `trainingProfile.selectedModelName`
- estilos `ai-debug-*` en `dashboard.css`

Que muestra actualmente:

- orquestacion IA del paciente
- conteo de metodos `activos`, `proxy clinico` y `pendientes`
- pronostico sin tratamiento y ventana critica
- modelo activo
- origen de la IA: manifiesto entrenado o perfil base
- modo de calibracion
- precision tecnica estimada
- precision del modelo entrenado
- metrica de seleccion del modelo
- fecha del manifiesto y cantidad de candidatos evaluados
- cobertura de variables disponibles y faltantes
- documento, estado y contexto del paciente analizado
- metricas de triage y hospitalizacion
- resumen estadistico del dataset usado para entrenar
- datos de prueba reducidos
- variables clinicas y regionales
- detonantes y recomendaciones visibles para el caso
- bloque de validacion heuristica resumido
- matematica resumida
- traza corta del proceso

### 3.7.1 Interpretacion tecnica de metricas visibles

#### `precision tecnica estimada`

- se calcula en frontend
- depende de cobertura de variables del paciente y tamano relativo del dataset de referencia
- sirve como indicador operativo de completitud del caso
- no debe interpretarse como validacion clinica certificada

#### `precision del modelo entrenado`

- sale del `training-manifest.json`
- corresponde al ultimo ganador offline exportado
- no cambia automaticamente porque un medico agregue pacientes en Firestore

#### `AUC-ROC`

- mide capacidad discriminativa del modelo
- mientras mas alto, mejor separa clases
- en el manifiesto suele verse ya escalado a porcentaje
- en bloques matematicos crudos puede existir originalmente como `0-1`

#### `Triage`

- objetivo de clasificacion temprana o nivel inicial de prioridad
- el panel muestra sus metricas del mejor candidato ganador

#### `Hospitalizacion`

- objetivo de clasificacion del riesgo de hospitalizacion o descompensacion asociada
- el panel lo separa de `triage` porque no son exactamente la misma tarea

#### `Artefactos`

- son exportaciones de entrenamiento offline
- normalmente `.joblib`
- pueden existir varios artefactos aun cuando el frontend use principalmente el manifiesto JSON para explicar el caso

#### `Prec`, `Sens`, `Esp`

- `Prec`: precision ponderada
- `Sens`: sensibilidad
- `Esp`: especificidad

Lectura rapida recomendada:

- `Sens` alta: menos riesgo de omitir positivos reales
- `Esp` alta: menos falsos positivos
- `Prec` alta: mejor calidad promedio de las clases predichas

#### `Reentrenamiento: Sin ajustes extra`

Puede aparecer cuando:

- la primera ronda de candidatos ya supero el umbral objetivo
- no fue necesario entrar al bloque de modelos `adjusted` / `retry`
- `retrainedWithAdjustments` quedo en `false`

No implica fallo.

Implica que:

- el flujo base ya fue suficiente
- el mejor modelo inicial no requirio una segunda tanda de tuning para superar el minimo

#### Por que algunas metricas aparecen en `%` y otras en decimal

La respuesta corta es: porque pertenecen a familias matematicas distintas.

Se muestran normalmente como porcentaje:

- `precision`
- `accuracy`
- `recall`
- `f1`
- `auc_roc` cuando el manifiesto ya la redondea a escala `0-100`
- `sensitivity`
- `specificity`
- coberturas de reglas o recomendaciones

Se muestran normalmente como decimal:

- correlaciones como `Spearman`
- valores donde importa conservar signo y magnitud entre `-1` y `1`

Ejemplo:

- `Spearman O2 vs riesgo = -0.717` indica relacion inversa
- `Cobertura de detonantes = 92%` indica proporcion de casos cubiertos

Regla tecnica util:

- si el dato expresa `proporcion de cumplimiento`, suele convertirse a `%`
- si expresa `direccion o fuerza de asociacion`, suele quedarse en decimal

Precaucion:

- la precision visible es una metrica tecnica interna y no una validacion clinica certificada
- el panel tecnico ahora tambien se puede redimensionar desde bordes y esquinas; si se cambia su UX revisar JS y CSS juntos

## 4. Diagrama de flujo

```mermaid
flowchart TD
    A["index.html"] --> B["healthUsurper/login.html"]
    
    B --> C{"¿Usuario autenticado?"}
    
    C -- "No" --> D["Mostrar formulario de login / registro"]
    D --> B
    
    C -- "Sí" --> E["dashboard.html"]
    
    E --> F["bootDashboard()"]
    F --> G["setPersistence + onAuthStateChanged"]
    G --> H["loadUserLayout(user.uid)"]
    H --> I["onSnapshot (patients)"]
    I --> J["renderDashboard()"]
    
    J --> K["Interacciones del usuario"]
    
    K --> L["Agregar / editar / eliminar pacientes"]
    K --> M["Editar layout y widgets"]
    K --> N["Usar accesos rápidos"]
    K --> O["Ejecutar IA clínica orientativa"]
    
    L --> I
    M --> P["saveUserLayout()"]
    N --> J
    O --> J
```

## 5. Diagrama de red aproximado

Este diagrama es una aproximacion basada solo en lo visible en el codigo actual.

```mermaid
flowchart LR
    U[Usuario / Navegador]
    I[index.html]
    M0[training-manifest.json]
    L[login.html + login.js]
    D[dashboard.html + dashboard.js + dashboard.css]
    F[Firebase Authentication]
    FS[Cloud Firestore]
    T1[Training.py]
    T2[230PatientsCOPD.xlsx]
    T3[conteo_locations.csv]

    U --> I
    I --> M0
    I --> L
    L --> F
    L --> M0
    F --> D
    D --> FS
    D --> M0
    FS --> D
    T1 --> T2
    T1 --> T3
    T1 --> M0
```

## 6. Diagrama / mapa del sitio web

```mermaid
flowchart TD
    A[Inicio]
    A --> B[index.html]
    B --> C[Login]
    C --> D[Dashboard principal]

    D --> E[Panel izquierdo: Accesos rapidos]
    D --> F[Panel derecho: Resumen del turno]
    D --> G[Menu superior izquierdo]
    D --> H[Menu usuario / medico]
    D --> I[Widgets clinicos]
    D --> J[Workspace / Vista auxiliar]
    D --> K[Panel tecnico flotante de IA]

    E --> J
    G --> J
    I --> J
    K --> I
    H --> C
```

## 7. Estructura tecnica resumida de archivos

- `index.html`: pantalla de arranque y redireccion al login
- `healtUsurper/login.html`: interfaz de acceso
- `healtUsurper/login.js`: login, registro y redireccion por sesion
- `healtUsurper/FirstView/dashboard.html`: estructura del dashboard
- `healtUsurper/FirstView/dashboard.css`: estilos, modo oscuro, overlays y layout
- `healtUsurper/FirstView/dashboard.js`: logica principal de UI, widgets, IA y persistencia
- `healtUsurper/ai/model-loader.js`: carga y cache del manifiesto IA para index, login y dashboard
- `healtUsurper/ai/training-manifest.json`: resumen exportado del modelo entrenado
- `healtUsurper/firebase/firebase-config.js`: inicializacion de Firebase
- `healtUsurper/firebase/firestore.rules`: reglas de Firestore
- `healtUsurper/test/230PatientsCOPD.xlsx`: dataset local de apoyo
- `healtUsurper/test/conteo_locations.csv`: distribucion local por ubicacion
- `healtUsurper/test/Training.py`: entrenamiento offline, seleccion del mejor modelo y exportacion del manifiesto

Campos persistidos relevantes en `userLayouts`:

- `widgetOrder`
- `widgetSizes`
- `hiddenWidgetKeys`
- `quickAccessItems`
- `doctorProfile.displayName`
- `doctorProfile.photoUrl`
- `theme`
- `updatedAt`

## 8. Recomendaciones para futuras modificaciones

- Si se agrega un widget nuevo, actualizar `dashboard.html`, `widgetCatalog`, `defaultWidgetOrder` y la logica de render.
- Si se cambia el comportamiento de insercion de widgets, revisar `addWidgetInstantly()` y `getDefaultInsertBeforeKey()`.
- Si se cambia la experiencia de resize, revisar tanto JS como los cursores SVG embebidos en CSS.
- Si se ajusta el scroll del dashboard, mantener la compensacion del `topbar` para no ocultar el contenido.
- Si se cambia el panel tecnico de IA, conservar la transparencia de que la precision es estimada y explicable.
- Si se cambia la IA, entrenar y exportar primero desde `Training.py` antes de esperar cambios en el dashboard.
- Si se cambia la IA, mantener separada la parte explicativa de la parte de calculo para que siga siendo auditable.
- Si se agregan nuevas IAs al panel, distinguir siempre entre `activa`, `proxy clinico` y `pendiente` para no sobredeclarar implementacion runtime.
- Si se cambian escalas de metricas, documentar si el valor queda en `0-1`, `-1 a 1` o `0-100`, porque eso afecta la lectura del panel y la comparacion historica.
- Si se agregan nuevas preferencias de usuario, definir si van a `localStorage`, `userLayouts` o ambas.
- Si el sistema crece, conviene separar `dashboard.js` en modulos: autenticacion, layout, IA, pacientes, accesos rapidos y render.

## 9. Limitaciones conocidas

- La IA es orientativa y local al navegador; no es un servicio clinico remoto real.
- El panel tecnico de IA expone trazas y estadisticas resumidas, pero no reemplaza auditoria clinica formal.
- El dashboard consume un manifiesto precalculado; si el dataset cambia y no se reejecuta `Training.py`, la IA mostrara informacion desactualizada.
- No todas las IAs listadas en la arquitectura tienen hoy el mismo nivel de implementacion runtime; algunas capas se muestran como `proxy clinico` o `pendientes` precisamente para reflejar esa diferencia.
- El diagrama de red no incluye backend propio porque en el codigo actual no aparece uno distinto de Firebase.
- El proyecto depende de servir archivos por `localhost` o web server; `file://` no es suficiente para `fetch`.
