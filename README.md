# Foxcat Medical + Firebase

El proyecto ahora queda orientado a un dashboard pastel, visual y dependiente del paciente seleccionado.

## Lo nuevo

- Login con foto del medico usando `photoURL` de Firebase Auth.
- Dashboard pastel completo.
- Widgets conectados a la informacion del paciente seleccionado.
- Reordenamiento de widgets con clic derecho.
- Guardado del layout por medico en la coleccion `userLayouts`.

## Flujo de uso

1. Habilita `Email/Password` en Firebase Authentication.
2. Agrega `localhost` a los dominios autorizados.
3. Sirve el proyecto con `Live Server` o cualquier servidor local.
4. Registra un medico desde [healtUsurper/login.html](c:/Users/David/Downloads/Test/healtUsurper/login.html).
5. Carga pacientes desde [healtUsurper/FirstView/dashboard.html](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.html).
6. Haz clic derecho dentro del dashboard y usa la opcion `3. Editar posiciones`.

## Colecciones

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
- `hemoglobin`
- `creatinine`
- `ward`
- `room`
- `appointmentTime`
- `monitoringTime`
- `labTime`
- `notes`
- `createdAt`
- `createdBy`

### `userLayouts`

- `widgetOrder`
- `updatedAt`

## Archivos clave

- [healtUsurper/login.js](c:/Users/David/Downloads/Test/healtUsurper/login.js)
- [healtUsurper/FirstView/dashboard.js](c:/Users/David/Downloads/Test/healtUsurper/FirstView/dashboard.js)
- [healtUsurper/firebase/firebase-config.js](c:/Users/David/Downloads/Test/healtUsurper/firebase/firebase-config.js)
- [healtUsurper/firebase/firestore.rules](c:/Users/David/Downloads/Test/healtUsurper/firebase/firestore.rules)
