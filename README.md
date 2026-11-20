# Maipu_AldoMartinez_006D_EquipoXX

## Panel de monitoreo y administración

La app incluye un **panel de monitoreo** en `/monitoreo`, exclusivo para usuarios con rol
`admin`. Desde ahí se ven las estadísticas generales de MeetTennis (usuarios, partidos,
solicitudes, canchas, chat, reseñas, tendencias de 7 días).

La **administración de usuarios** vive en una vista separada, `/admin-usuarios`, accesible
desde el botón junto al de monitoreo en el dashboard (solo para admins). Ahí se listan los
jugadores y se gestionan los roles sin saturar el panel de métricas.

### Roles de usuario
- `jugador` (por defecto): experiencia normal de la app.
- `admin`: acceso al panel de monitoreo y a la administración de usuarios.

Para darse de alta como admin (UNA vez):

1. Ejecutar en Supabase → SQL Editor `backend/scripts/09_admin_rol.sql` (agrega la columna
   `rol` y permite promover por correo o por nombre completo — ajusta las listas dentro del script).
2. Ejecutar `backend/scripts/10_usuario_fechas.sql` (opcional pero recomendado: agrega
   `created_at` a la tabla `usuario`).
3. Alternativa local sin SQL: `node scripts/promover_admin.mjs --aplicar --email tu@correo.cl`
   (desde `backend/`, usa las credenciales del `.env`; nunca muestra las claves).

> **Importante:** si aún no se ejecutó el script 09, el acceso al panel se decide por la
> variable `MONITORING_EMAILS` (correos admin separados por coma). Sin el script 09 y sin
> esa variable, **nadie** puede ver el panel (por seguridad).

Desde el propio panel, un admin puede promover o revocar a otros usuarios sin tocar SQL.

### Endpoints del panel (requieren rol admin)
- `GET /api/monitoring` — estadísticas generales de la app.
- `GET /api/monitoring/acceso` — indica si el usuario autenticado es admin.
- `GET /api/monitoring/usuarios` — lista de usuarios (nombre, correo, comuna, categoría, rol).
- `PATCH /api/monitoring/usuarios/:id/rol` — cambia el rol (`admin` | `jugador`); no permite
  cambiarse el propio rol.

## Configuración del backend

Copia `backend/.env.example` como `backend/.env` y completa los valores:

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (Render lo inyecta). |
| `NODE_ENV` | `development` o `production`. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Clave pública `anon` (para login/registro/refresh). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo backend, nunca exponer). |
| `CORS_ORIGIN` | Orígenes permitidos en producción, separados por coma. Sin esto se deniegan las peticiones cross-origin. |
| `FRONTEND_URL` | Origen del frontend para recuperación de contraseña. Opcional si ese origen ya está en `CORS_ORIGIN`. |
| `MONITORING_EMAILS` | Correos admin (respaldo del panel mientras no exista la columna `rol`). |
| `GOOGLE_MAPS_API_KEY` | (Opcional) API key de Google Maps con la Geocoding API, para el script de coordenadas exactas. |

## Precisión del mapa de canchas

El mapa embebido consulta a Google Maps por la **dirección exacta** de la cancha (no solo por
coordenadas aproximadas), así el pin cae en el lugar correcto. Para afinar aún más las
coordenadas guardadas en la base de datos:

1. Crea una API key en Google Cloud con la **Geocoding API** habilitada.
2. Define `GOOGLE_MAPS_API_KEY` en `backend/.env`.
3. Ejecuta desde `backend/`:
   ```
   node scripts/geocodificar_canchas.mjs
   ```
   El script geocodifica la dirección de cada cancha y actualiza su `latitud`/`longitud`
   con el punto exacto que devuelve Google Maps.

## Seguridad

### Recuperación de contraseña

Desde **Olvidé mi contraseña** en el login se abre `/recuperar-contrasena`.
El correo enviado por Supabase dirige a `/restablecer-contrasena`, donde se ingresa
y confirma la nueva contraseña. El cambio usa una sesión validada por Supabase,
sin operaciones de administrador ni cambios en las tablas del proyecto.

Para habilitar los enlaces en cada entorno:

1. En Supabase → **Authentication → URL Configuration**, configura **Site URL**
   con la dirección del frontend y agrega estas **Redirect URLs** según corresponda:
   - `http://localhost:5173/restablecer-contrasena` (desarrollo con Vite).
   - `http://127.0.0.1:5173/restablecer-contrasena` (si usas esa dirección).
   - `https://<tu-frontend>/restablecer-contrasena` (producción).
2. Configura en el backend `FRONTEND_URL=https://<tu-frontend>` o incluye ese origen
   en `CORS_ORIGIN`. En producción se aceptan únicamente destinos HTTPS autorizados;
   el cliente no puede enviar enlaces a dominios arbitrarios.
3. Conserva `{{ .ConfirmationURL }}` en la plantilla **Reset Password** de Supabase.
   Revisa la configuración de correo/SMTP de tu proyecto para permitir la entrega
   a las cuentas que usarán la app. El código no cambia la configuración de Supabase.

Los enlaces se reciben mediante el flujo implícito: las credenciales se extraen del
fragmento de la URL, se borran de la barra de direcciones y se guardan temporalmente
en `sessionStorage` de esa pestaña. No se inicia una sesión normal en la app.
Los endpoints no devuelven si un correo existe y limitan solicitudes por IP.

- `POST /api/auth/forgot-password`: `{ email, origin }`.
- `POST /api/auth/reset-password`: `{ access_token, refresh_token, password }`.

Documentación: [recuperación de contraseña](https://supabase.com/docs/guides/auth/passwords)
y [Redirect URLs de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

### Controles generales

- **Rate limit por IP** (en memoria, sin dependencias): login 10 intentos / 15 min, registro
  5 / hora, y un límite general de 120 peticiones / minuto en toda la API.
  (Middleware `backend/src/middleware/rateLimit.js`.)
- **CORS restringido**: en producción solo se aceptan los orígenes de `CORS_ORIGIN`.
- **Headers de seguridad**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `X-XSS-Protection` y `Permissions-Policy`.
- **Avatares**: máximo 5 MB y validación del contenido real (magic bytes), no solo el mimetype.
- Todo el acceso a datos pasa por el backend con la `service_role`; RLS sin políticas públicas.

## Despliegue

- **Backend**: Render (ver `render.yaml`). Configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN` y `MONITORING_EMAILS`.
- **Frontend**: Vercel (ver `frontend/vercel.json`), con proxy de `/api/*` hacia el backend.
- **Base de datos**: ejecutar los scripts de `backend/scripts/` en Supabase (SQL Editor) en
  orden: `02_disponibilidad_partidos.sql` … `10_usuario_fechas.sql`.
