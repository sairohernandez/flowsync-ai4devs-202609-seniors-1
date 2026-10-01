# PRD — FlowSync: Módulo de Autenticación y Gestión de Cuentas (E1)

> **Ingeniería inversa** — Generado a partir del código fuente en `backend/` y `frontend/`  
> **Fecha:** 2026-09-30 | **Autor análisis:** shernandez@grupocolono.com  
> **Audiencia:** Analistas / Arquitectos / QA

---

## 1. Resumen Ejecutivo

FlowSync es una aplicación web de gestión de tareas en equipo diseñada para equipos remotos que necesitan visibilidad en tiempo real sobre en qué trabaja cada integrante sin interrupciones. El módulo E1 —objeto de este documento— cubre el ciclo completo de identidad y acceso: registro de nuevas cuentas, autenticación por credenciales, persistencia de sesión entre visitas, consulta del perfil propio y cierre de sesión seguro. La implementación utiliza tokens de acceso opacos (no JWT) almacenados en base de datos, lo que permite revocación inmediata en servidor. El frontend maneja la sesión desde `localStorage` con rehidratación automática al cargar la aplicación, garantizando que rutas protegidas nunca sean accesibles sin autenticación válida.

---

## 2. Alcance

### Incluido en este componente (E1)
- Registro de usuario con nombre completo (opcional), email único y contraseña confirmada
- Inicio de sesión por email y contraseña
- Emisión y almacenamiento de token de acceso opaco en base de datos
- Rehidratación de sesión al recargar la aplicación (validación del token contra el servidor)
- Consulta del perfil del usuario autenticado
- Cierre de sesión con revocación del token en servidor
- Protección de rutas: redireccionamiento a `/login` para usuarios no autenticados
- Protección de rutas públicas: redireccionamiento a `/profile` para usuarios ya autenticados

### Excluido / Fuera de alcance
- Recuperación de contraseña olvidada
- Verificación de email (no hay flujo de confirmación por correo)
- Autenticación con proveedores externos (OAuth, Google, GitHub)
- Gestión de múltiples sesiones activas simultáneas por usuario
- Roles y permisos diferenciados (el sistema es completamente plano)
- Cambio de contraseña o actualización de perfil desde la UI
- Vencimiento configurable de tokens (el campo `expires_at` existe en BD pero no se usa en E1)
- Gestión de organizaciones o espacios de trabajo (espacio único compartido)

---

## 3. Entidades y Modelo de Datos

### 3.1 Entidad: `users`

| Campo | Tipo | Requerido | Descripción | Regla de negocio |
|-------|------|-----------|-------------|-----------------|
| `id` | INTEGER (PK, autoincrement) | Sí | Identificador único del usuario | Generado por BD |
| `full_name` | VARCHAR | No (nullable) | Nombre completo del usuario | Puede omitirse en el registro; se muestra como "Sin nombre" en UI |
| `email` | VARCHAR(254) | Sí | Dirección de correo electrónico | Único en la tabla; formato email válido; máximo 254 caracteres |
| `password` | VARCHAR | Sí | Contraseña hasheada | Mínimo 8, máximo 32 caracteres; nunca se expone en respuestas de API |
| `created_at` | TIMESTAMP | Sí | Fecha de creación de la cuenta | Generada automáticamente |
| `updated_at` | TIMESTAMP | No | Última actualización | Actualizada automáticamente por Lucid ORM |

**Campo virtual (getter, no persiste en BD):**
| Campo | Tipo | Descripción | Regla |
|-------|------|-------------|-------|
| `initials` | STRING (2 chars) | Iniciales del usuario para avatar | Si hay `fullName`: primera letra de la primera y última palabra en mayúsculas. Si no hay `fullName`: primeras dos letras del email antes del `@` en mayúsculas |

### 3.2 Entidad: `auth_access_tokens`

| Campo | Tipo | Requerido | Descripción | Regla de negocio |
|-------|------|-----------|-------------|-----------------|
| `id` | INTEGER (PK, autoincrement) | Sí | Identificador único del token | Generado por BD |
| `tokenable_id` | INTEGER (FK → users.id) | Sí | Usuario propietario del token | ON DELETE CASCADE: si el usuario se elimina, sus tokens se eliminan |
| `type` | VARCHAR | Sí | Tipo de token | [SUPUESTO] Valor fijo `'auth_token'` según convención AdonisJS |
| `name` | VARCHAR | No | Nombre descriptivo del token | No utilizado en E1 |
| `hash` | VARCHAR | Sí | Hash del token almacenado | Solo el hash vive en BD; el token en claro solo se emite una vez |
| `abilities` | TEXT | Sí | Capacidades del token (JSON) | [SUPUESTO] Valor `["*"]` (todos los permisos) por defecto |
| `created_at` | TIMESTAMP | No | Fecha de creación | Generada automáticamente |
| `updated_at` | TIMESTAMP | No | Última actualización | Generada automáticamente |
| `last_used_at` | TIMESTAMP | No | Último uso del token | Actualizado por el guard en cada request autenticado |
| `expires_at` | TIMESTAMP | No | Fecha de vencimiento | NULL en E1; tokens no vencen por tiempo |

### 3.3 Exposición pública del usuario (Transformer)

El `UserTransformer` define los campos que el API expone. La contraseña **nunca** aparece en ninguna respuesta.

| Campo expuesto | Origen |
|----------------|--------|
| `id` | BD |
| `fullName` | BD |
| `email` | BD |
| `createdAt` | BD |
| `updatedAt` | BD |
| `initials` | Getter del modelo |

---

## 4. Flujos Funcionales

### 4.1 Flujo principal: Registro de cuenta nueva

```
1. Usuario navega a /register (o es redirigido si va a ruta protegida)
2. Usuario completa formulario:
   - fullName (opcional): texto libre
   - email: dirección de correo
   - password: contraseña
   - passwordConfirmation: repetición de contraseña
3. Frontend valida antes de enviar al backend:
   - password !== passwordConfirmation → error de campo local (no va al servidor)
   - fullName.trim() → si vacío, se envía null
4. POST /api/v1/auth/signup con payload
5. Backend ejecuta signupValidator:
   - fullName: nullable (puede ser null o string)
   - email: formato válido, máximo 254 chars, ÚNICO en tabla users
   - password: mínimo 8, máximo 32 chars
   - passwordConfirmation: igual a password
6. Si validación falla → 422 con fieldErrors por campo
7. Si email ya existe → 422 con error en campo email ("Ya existe una cuenta con este correo")
8. Usuario creado con User.create({ fullName, email, password })
   - password es hasheada automáticamente por withAuthFinder
9. Token generado inmediatamente con User.accessTokens.create(user)
10. Respuesta 200: { data: { user: UserTransformer, token: string } }
11. Frontend guarda token en localStorage['flowsync.token']
12. AuthProvider actualiza estado: user = respuesta.user, status = 'authenticated'
13. PublicOnlyRoute detecta 'authenticated' → redirige a /profile
```

**Flujos alternativos (registro):**
- 4a. Si email ya registrado → paso 6 devuelve error en campo email
- 4b. Si contraseñas no coinciden → frontend intercepta antes de paso 4, muestra error de campo

### 4.2 Flujo principal: Inicio de sesión

```
1. Usuario navega a /login
2. Si hay sessionError (sesión anterior caducada/error) → se muestra banner informativo
3. Usuario completa email y password
4. POST /api/v1/auth/login
5. Backend ejecuta loginValidator:
   - email: formato válido
   - password: sin longitud mínima (no se revela si la contraseña es "corta")
6. User.verifyCredentials(email, password):
   - Busca usuario por email
   - Verifica hash de contraseña
   - Si falla cualquiera → 400 con mensaje "Email o contraseña incorrectos"
7. Token generado: User.accessTokens.create(user)
8. Respuesta 200: { data: { user: UserTransformer, token: string } }
9. Frontend: mismo flujo que pasos 11-13 del registro
```

**Flujos alternativos (login):**
- 6a. Email no existe → mismo error genérico 400 (no revela si el email está registrado)
- 6b. Contraseña incorrecta → mismo error genérico 400

### 4.3 Flujo: Rehidratación de sesión al cargar la app

```
1. App carga (main.tsx monta AuthProvider)
2. AuthProvider lee localStorage['flowsync.token']
3. Si no hay token → status = 'anonymous' (no hay request al servidor)
4. Si hay token:
   a. status = 'loading' (UI muestra FullScreenLoader para evitar rebote)
   b. GET /api/v1/account/profile con Authorization: Bearer <token>
   c. Si 200 → startSession(token, user): status = 'authenticated'
   d. Si 401 (token inválido/revocado) → clearSession(): borra localStorage, status = 'anonymous'
   e. Si otro error (red caída, servidor sin respuesta) → status = 'anonymous' pero token se conserva [SUPUESTO: decisión de diseño para no borrar sesión en outages temporales]
5. Router evalúa la ruta solicitada:
   - Ruta protegida + anonymous → /login
   - Ruta pública + authenticated → /profile
   - Ruta protegida + authenticated → renderiza página
```

### 4.4 Flujo: Consulta de perfil

```
1. Usuario autenticado en /profile
2. ProfilePage obtiene user del AuthContext (ya en memoria desde login/rehidratación)
3. Muestra: avatar con initials, fullName (o "Sin nombre"), email
4. "Miembro desde" formateado con Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })
5. Botón "Cerrar sesión"
[No hay request adicional al renderizar; el perfil viene del estado en AuthContext]
```

### 4.5 Flujo: Cierre de sesión

```
1. Usuario hace clic en "Cerrar sesión" en /profile
2. Frontend ejecuta clearSession() PRIMERO (borra localStorage, estado → anonymous)
3. ProtectedRoute detecta 'anonymous' → redirige a /login inmediatamente
4. En background: POST /api/v1/account/logout con Authorization: Bearer <token_anterior>
5. Backend obtiene usuario autenticado, ejecuta auth.user.currentAccessToken.delete()
6. Token revocado en BD; cualquier request futuro con ese token recibe 401
[La redirección ocurre independientemente del resultado del paso 4]
```

---

## 5. Reglas de Negocio

| ID Regla | Descripción | Condición | Consecuencia |
|----------|-------------|-----------|--------------|
| RN-01 | Email único | Se intenta registrar con email ya existente en `users` | Error 422 en campo `email`: "Ya existe una cuenta con este correo" |
| RN-02 | Formato de email | Email no cumple formato RFC | Error 422 en campo `email` |
| RN-03 | Longitud máxima de email | Email supera 254 caracteres | Error 422 en campo `email` |
| RN-04 | Longitud de contraseña (registro) | Contraseña < 8 o > 32 caracteres en signup | Error 422 en campo `password` con indicación de límites |
| RN-05 | Confirmación de contraseña | `password !== passwordConfirmation` en formulario | Error de campo en `passwordConfirmation` antes de enviar al servidor |
| RN-06 | Nombre completo opcional | `fullName` puede omitirse o enviarse vacío | Se almacena como `null` en BD; se muestra "Sin nombre" en UI |
| RN-07 | Generación de iniciales | Cálculo de avatar | Si `fullName` tiene al menos dos palabras: primera letra de primera y última. Si `fullName` tiene una sola palabra: primeras dos letras. Si `fullName` es null: primeras dos letras del email antes del `@`. Siempre en mayúsculas |
| RN-08 | Contraseña hasheada | Siempre al crear usuario | La contraseña en claro nunca se almacena. El hash lo gestiona `withAuthFinder` automáticamente |
| RN-09 | Contraseña nunca expuesta | En cualquier respuesta de API | `password` tiene `serializeAs: null`; el `UserTransformer` no la incluye en `pick()` |
| RN-10 | Token opaco (no JWT) | Al emitir token en login o signup | Solo el hash del token se almacena en BD; el valor en claro se emite una única vez |
| RN-11 | Sesión inmediata tras registro | Tras `POST /auth/signup` exitoso | El usuario recibe token y queda autenticado sin paso adicional de login |
| RN-12 | Error genérico en login | Email o contraseña incorrectos | Mensaje único "Email o contraseña incorrectos" sin distinguir cuál falló (evita enumeración de usuarios) |
| RN-13 | Sin longitud mínima en login | Campo `password` en loginValidator | No se aplica regla de mínimo de caracteres en login para no revelar si la contraseña es "corta" |
| RN-14 | Revocación en logout | Al cerrar sesión | El token se elimina de `auth_access_tokens`; los subsecuentes requests con ese token reciben 401 |
| RN-15 | Sesión local se limpia antes de revocar | En `logout()` del AuthProvider | La UI reacciona inmediatamente sin esperar respuesta del servidor, mejorando la UX |
| RN-16 | Rehidratación con 401 limpia sesión | Token inválido/revocado al recargar | Se borra `localStorage` y el usuario llega al login |
| RN-17 | Rehidratación con error de red conserva token | Error de red al recargar (no 401) | [SUPUESTO] El token se conserva; el usuario queda anónimo pero puede reintentar más tarde |
| RN-18 | Token sin vencimiento temporal | Campo `expires_at` en BD es NULL | Los tokens no expiran por tiempo; solo se revocan explícitamente en logout |
| RN-19 | Cascade delete de tokens | Si un usuario se elimina de BD | Sus tokens se eliminan automáticamente (ON DELETE CASCADE) |

---

## 6. Criterios de Aceptación

### CA-01: Registro exitoso con nombre completo ✅

**GIVEN** que el sistema no tiene ningún usuario con el email `ana@ejemplo.com`  
**WHEN** el usuario envía `POST /api/v1/auth/signup` con `{ fullName: "Ana López", email: "ana@ejemplo.com", password: "secreta123", passwordConfirmation: "secreta123" }`  
**THEN**
- La respuesta HTTP es `200 OK`
- El cuerpo tiene la estructura `{ data: { user: { id, fullName: "Ana López", email: "ana@ejemplo.com", initials: "AL", createdAt, updatedAt }, token: "<string no vacío>" } }`
- El campo `password` **no** aparece en `data.user`
- Se crea una fila en `users` con `full_name = "Ana López"`
- Se crea una fila en `auth_access_tokens` con `tokenable_id` apuntando al nuevo usuario

---

### CA-02: Registro exitoso sin nombre completo ✅

**GIVEN** que no existe ningún usuario con el email `user@ejemplo.com`  
**WHEN** el usuario envía signup con `{ fullName: null, email: "user@ejemplo.com", password: "secreta123", passwordConfirmation: "secreta123" }`  
**THEN**
- Respuesta `200 OK`
- `data.user.fullName` es `null`
- `data.user.initials` es `"US"` (primeras dos letras del email antes del `@`)
- Se crea fila en `users` con `full_name IS NULL`

---

### CA-03: Registro con email duplicado ❌

**GIVEN** que existe un usuario con `email = "ana@ejemplo.com"`  
**WHEN** se envía signup con ese mismo email  
**THEN**
- Respuesta `422 Unprocessable Entity`
- El cuerpo incluye errores en el campo `email` con mensaje indicando que el correo ya está en uso
- No se crea ninguna fila nueva en `users` ni en `auth_access_tokens`

---

### CA-04: Registro con contraseñas que no coinciden (validación frontend) ❌

**GIVEN** que el formulario de registro está visible  
**WHEN** el usuario escribe `password: "secreta123"` y `passwordConfirmation: "diferente456"` y hace clic en "Crear cuenta"  
**THEN**
- **No** se envía ningún request al servidor
- Se muestra error de campo bajo `passwordConfirmation`
- El formulario permanece en pantalla con los datos ingresados

---

### CA-05: Registro con contraseña demasiado corta ❌

**GIVEN** que el formulario de registro está visible  
**WHEN** se envía signup con `password: "abc"` (menos de 8 caracteres)  
**THEN**
- Respuesta `422 Unprocessable Entity`
- El cuerpo incluye error en el campo `password` indicando el mínimo requerido
- No se crea usuario

---

### CA-06: Inicio de sesión exitoso ✅

**GIVEN** que existe un usuario con `email = "ana@ejemplo.com"` y contraseña `"secreta123"`  
**WHEN** se envía `POST /api/v1/auth/login` con `{ email: "ana@ejemplo.com", password: "secreta123" }`  
**THEN**
- Respuesta `200 OK`
- El cuerpo contiene `{ data: { user: { id, fullName, email, initials, createdAt, updatedAt }, token: "<string>" } }`
- Se crea una nueva fila en `auth_access_tokens` para ese usuario

---

### CA-07: Inicio de sesión con credenciales incorrectas ❌

**GIVEN** que existe un usuario con `email = "ana@ejemplo.com"`  
**WHEN** se envía login con `{ email: "ana@ejemplo.com", password: "wrongpassword" }`  
**THEN**
- Respuesta `400 Bad Request`
- El mensaje de error NO distingue si falló el email o la contraseña (mensaje genérico)
- No se emite ningún token

---

### CA-08: Inicio de sesión con email inexistente ❌

**GIVEN** que no existe ningún usuario con `email = "nobody@ejemplo.com"`  
**WHEN** se envía login con ese email  
**THEN**
- Respuesta `400 Bad Request`
- El mensaje de error es el mismo que cuando la contraseña es incorrecta (no revela que el email no existe)

---

### CA-09: Consulta de perfil con token válido ✅

**GIVEN** que el usuario tiene un token válido obtenido en login o registro  
**WHEN** se envía `GET /api/v1/account/profile` con header `Authorization: Bearer <token>`  
**THEN**
- Respuesta `200 OK`
- El cuerpo contiene `{ data: { id, fullName, email, initials, createdAt, updatedAt } }`
- El campo `password` no aparece en la respuesta

---

### CA-10: Consulta de perfil sin token 🔒

**GIVEN** que no se incluye el header `Authorization` en la petición  
**WHEN** se envía `GET /api/v1/account/profile`  
**THEN**
- Respuesta `401 Unauthorized`
- No se devuelve información del usuario

---

### CA-11: Consulta de perfil con token inválido o revocado 🔒

**GIVEN** que el token fue revocado (logout previo) o es un valor arbitrario  
**WHEN** se envía `GET /api/v1/account/profile` con `Authorization: Bearer <token_invalido>`  
**THEN**
- Respuesta `401 Unauthorized`
- No se devuelve información del usuario

---

### CA-12: Cierre de sesión exitoso ✅

**GIVEN** que el usuario tiene un token válido  
**WHEN** se envía `POST /api/v1/account/logout` con `Authorization: Bearer <token>`  
**THEN**
- Respuesta `200 OK` con mensaje de confirmación
- La fila correspondiente al token se elimina de `auth_access_tokens`
- Un posterior `GET /account/profile` con ese mismo token recibe `401`

---

### CA-13: Logout sin autenticación 🔒

**GIVEN** que no se incluye header de autorización  
**WHEN** se envía `POST /api/v1/account/logout`  
**THEN**
- Respuesta `401 Unauthorized`

---

### CA-14: Rehidratación de sesión con token válido ✅

**GIVEN** que el usuario tiene `flowsync.token` en `localStorage` con un token vigente  
**WHEN** el usuario recarga la página  
**THEN**
- La UI muestra un spinner (`FullScreenLoader`) mientras se valida
- Se envía `GET /account/profile` con el token
- Al recibir `200`, el estado pasa a `authenticated` y se renderiza la página solicitada
- No se solicita login nuevamente

---

### CA-15: Rehidratación con token revocado ❌

**GIVEN** que `localStorage` tiene un token que fue revocado (por logout en otra pestaña, por ejemplo)  
**WHEN** el usuario recarga la página  
**THEN**
- La UI muestra spinner mientras valida
- El servidor responde `401`
- `localStorage` se limpia (clave `flowsync.token` eliminada)
- El usuario es redirigido a `/login`

---

### CA-16: Protección de ruta — usuario no autenticado accede a ruta protegida 🔒

**GIVEN** que no hay sesión activa (no hay token o el token es inválido)  
**WHEN** el usuario intenta navegar a `/profile`  
**THEN**
- Es redirigido automáticamente a `/login`
- La URL de `/profile` no se renderiza

---

### CA-17: Protección de ruta pública — usuario autenticado accede a login 🔒

**GIVEN** que el usuario tiene sesión activa válida  
**WHEN** el usuario navega a `/login` o `/register`  
**THEN**
- Es redirigido automáticamente a `/profile`
- Las páginas de login/registro no se muestran

---

### CA-18: Formulario de login muestra error de sesión caducada ⚠️

**GIVEN** que el usuario llegó a `/login` porque su token fue revocado durante la rehidratación  
**WHEN** la página de login se renderiza  
**THEN**
- Se muestra un banner o mensaje informativo explicando que la sesión expiró (el `sessionError` del contexto)
- El formulario de login está disponible para ingresar nuevamente

---

### CA-19: Formato de iniciales — nombre con múltiples palabras ✅

**GIVEN** un usuario con `fullName = "María José Rodríguez"`  
**WHEN** se consulta la propiedad `initials`  
**THEN**
- El valor es `"MR"` (primera letra de la primera y última palabra, en mayúsculas)

---

### CA-20: Formato de iniciales — sin nombre (null) ✅

**GIVEN** un usuario con `fullName = null` y `email = "pedro@colono.com"`  
**WHEN** se consulta la propiedad `initials`  
**THEN**
- El valor es `"PE"` (primeras dos letras antes del `@`, en mayúsculas)

---

### CA-21: Registro con email sin formato válido ❌

**GIVEN** que el formulario de registro está visible  
**WHEN** se envía signup con `email: "no-es-un-email"`  
**THEN**
- Respuesta `422 Unprocessable Entity`
- Error en campo `email` indicando formato inválido

---

### CA-22: Acceso a endpoint protegido con token de otro usuario 🔒

**GIVEN** que el usuario A tiene un token válido  
**WHEN** se envía `GET /api/v1/account/profile` con el token del usuario A  
**THEN**
- La respuesta devuelve únicamente el perfil del usuario A
- No hay forma de obtener el perfil de otro usuario desde este endpoint

---

## 7. Requisitos No Funcionales

### 7.1 Seguridad

| Aspecto | Implementación detectada |
|---------|--------------------------|
| Contraseñas | Hasheadas con `withAuthFinder(hash)` de AdonisJS (bcrypt por defecto) |
| Tokens | Opacos (no JWT); solo el hash vive en BD; el valor en claro se emite una sola vez |
| CORS | Configurado en `config/cors.ts` [SUPUESTO: `origin` restringido a orígenes permitidos] |
| CSRF | `force_json_response_middleware` fuerza Accept: JSON; CSRF Shield disponible en `config/shield.ts` pero [POR DEFINIR] si está activo |
| Enumeración de usuarios | Login devuelve error genérico sin distinguir email vs. contraseña (RN-12) |
| Exposición de datos sensibles | `password` marcado `serializeAs: null`; excluido del Transformer |
| Auth en rutas protegidas | `middleware.auth()` sobre el grupo `/account` |
| Silent auth | `silent_auth_middleware` corre en todas las rutas; no bloquea, solo hidrata `auth.user` si hay token válido |

### 7.2 Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| Error de validación (422) | `fieldErrors` por campo; mensajes traducidos al español por `api.ts` en el frontend |
| Credenciales inválidas (400) | Mensaje genérico único |
| No autenticado (401) | Respuesta JSON con indicación de autorización requerida; frontend limpia sesión |
| Error de red (frontend) | `ApiError` con mensaje "No se pudo conectar con el servidor" |
| Excepciones no controladas | Handler global en `app/exceptions/handler.ts` [SUPUESTO: responde JSON con mensaje genérico] |

### 7.3 Rendimiento

- La validación de unicidad de email (`database.unique`) implica una consulta a BD en cada intento de registro. [SUPUESTO: aceptable para la carga esperada de un proyecto de práctica; en producción se requeriría index en `users.email`, ya presente por la restricción UNIQUE]
- No hay caché de sesión en el backend; cada request autenticado valida el token contra BD.
- La rehidratación de sesión emite exactamente 1 request (`GET /profile`) al cargar la app.

### 7.4 Logging

- [SUPUESTO] AdonisJS registra por defecto en `config/logger.ts` (Pino); los errores de autenticación y validación deberían ser visibles en los logs del servidor.
- [POR DEFINIR] No se detectó logging de auditoría explícito para eventos de seguridad (logins fallidos, intentos de acceso no autorizado).

### 7.5 Accesibilidad (Frontend)

- `aria-invalid` y `aria-describedby` en inputs de formulario
- `FieldError` enlazado por `id` al input correspondiente
- `FullScreenLoader` con `role="status"`, `aria-live="polite"` y texto `sr-only`
- Botones deshabilitados con feedback visual durante operaciones asíncronas

### 7.6 Internacionalización

- Mensajes de error de VineJS traducidos al español en `api.ts` mediante la función `translate()`
- Fechas formateadas con `Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })`
- [POR DEFINIR] No existe mecanismo para cambiar el idioma en tiempo de ejecución

---

*Fin del documento — FlowSync E1 | Análisis por ingeniería inversa | shernandez*


#Respuesta parte B

1. Cuántos requisitos escribió el agente, y cuántos comprobaste tú abriendo el código. Los dos números, tal cual salieron. No los redondees ni los expliques. Comprobar significa haber ido a mirar si el código hace eso; leer el requisito y que suene razonable no cuenta.

R/19 Requisitos por codigo solo pude validar 1 la RN 4- Longitud de constraseñas. 

2. Las incoherencias que aparecieron al escribirla. Una línea cada una, con dónde se ve. No las busques a propósito: aparecen solas, porque una regla que se cumple en casi todas partes canta en cuanto intentas escribirla como si se cumpliera siempre.


R/ La verdad es que no lo he encontrado

3. Lo que no supiste decidir si era un bug o el contrato. Al menos una, y en una frase, qué dos lecturas se contradecían. Esta es la lista que importa. No es lo que estaba mal: es lo que podría estar bien o mal según a quién le preguntes, y no había forma de decidirlo leyendo el código.


No se puede saber si es un contrato o bug.
RN-12	Error genérico en login	Email o contraseña incorrectos	Mensaje único "Email o contraseña incorrectos" sin distinguir cuál falló (evita enumeración de usuarios)

