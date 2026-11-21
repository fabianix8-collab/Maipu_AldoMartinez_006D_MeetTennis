# MeetTennis

Aplicación web para encontrar rivales de tenis, compartir horarios disponibles,
coordinar partidos y consultar resultados y clasificaciones por categoría.
Proyecto académico de la sección Maipú, Aldo Martínez, 006D.

## Aplicación publicada

- [Abrir MeetTennis](https://maipu-aldo-martinez-006-d-meet-tenn.vercel.app)
- [Estado de la API](https://meettennis-api.onrender.com/api/health)

El frontend se publica en Vercel y el backend en Render. La aplicación necesita
conexión a internet para autenticación, datos, imágenes de productos y mapas.

## Funciones

- Registro con fotografía, inicio de sesión y recuperación de contraseña por correo.
- Disponibilidad semanal con días, horas y zona o cancha preferida.
- Búsqueda de rivales, invitaciones y confirmación de asistencia.
- Registro de resultados y confirmación por el rival antes de afectar el ranking.
- Ranking por categoría, tabla de puntos y progreso de ascenso.
- Canchas de Santiago con ubicaciones revisadas y recorridos en auto o a pie.
- Chat con actualización mediante eventos del servidor (SSE).
- Reseñas de jugadores y recomendaciones de equipamiento con enlaces a tiendas.
- Interfaz en español e inglés y navegación inferior para móviles.
- Monitoreo y gestión de roles para administradores.

## Estructura del repositorio

```text
.github/workflows/ci.yml        Comprobaciones automáticas de GitHub
meet-tennis/
  frontend/                    React, Vite y Tailwind CSS
    src/                       Pantallas, componentes y utilidades
    test/                      Pruebas de interfaz y lógica del cliente
  backend/                     API REST con Node.js y Express
    src/                       Rutas, autenticación y reglas de negocio
    scripts/                   SQL de instalación y mantenimiento manual
    data/                      Catálogos revisados de canchas y productos
    test/                      Pruebas del servidor
Fase 1/, Fase 2/, Fase 3/        Documentación y evidencias académicas
render.yaml                    Configuración de despliegue del backend
```

El frontend accede a los datos mediante `/api`. Las claves de Supabase y las
operaciones de base de datos pertenecen al backend. Los resultados del ranking se
calculan en el servidor a partir de partidos confirmados.

## Ejecutar en desarrollo

Requisitos: Node.js 24 LTS, npm y un proyecto Supabase con Auth y Storage.
Los comandos siguientes se ejecutan desde la raíz del repositorio en PowerShell.

### Preparar el backend

```powershell
cd meet-tennis/backend
npm ci
Copy-Item .env.example .env
```

Completar `.env` con las credenciales del proyecto. Nunca subir este archivo a Git.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto de Express; `3000` en desarrollo. |
| `NODE_ENV` | `development` o `production`. |
| `SUPABASE_URL` | Dirección del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Clave pública para autenticación. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio, exclusiva del backend. |
| `CORS_ORIGIN` | Orígenes permitidos en producción, separados por coma. |
| `FRONTEND_URL` | Dirección del frontend para recuperación de contraseña. |
| `MONITORING_EMAILS` | Administradores de respaldo en instalaciones sin columna `rol`. |

En Supabase SQL Editor, ejecutar los archivos numerados de
`meet-tennis/backend/scripts/`, desde `01_base.sql` hasta `10_usuario_fechas.sql`,
en orden. `01_base.sql` permite crear las tablas base en un proyecto nuevo y
conserva las tablas existentes. Los scripts posteriores amplían el esquema.

Después, desde `meet-tennis/backend`, cargar los catálogos revisados:

```powershell
node scripts/actualizar_catalogo_canchas.mjs
node scripts/actualizar_catalogo_canchas.mjs --confirmar
node scripts/agregar_productos.mjs
node scripts/agregar_productos.mjs --confirmar
npm run dev
```

Los comandos sin `--confirmar` muestran el plan de cambios. Para detalles de las
fuentes y de la sincronización, consultar [los catálogos](meet-tennis/backend/data/README.md).

### Iniciar el frontend

En otra terminal, desde la raíz del repositorio:

```powershell
cd meet-tennis/frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173`. Vite dirige `/api` al backend local en el puerto 3000.
Las variables opcionales de mapas están en `frontend/.env.example`; no se necesita
una clave privada para los proveedores configurados por defecto.

### Configurar recuperación de contraseña

En Supabase, **Authentication → URL Configuration**, establecer la dirección del
frontend como **Site URL** y autorizar estas redirecciones según el entorno:

- `http://localhost:5173/restablecer-contrasena`
- `http://127.0.0.1:5173/restablecer-contrasena`
- `https://maipu-aldo-martinez-006-d-meet-tenn.vercel.app/restablecer-contrasena`

En la plantilla de recuperación, conservar `{{ .ConfirmationURL }}`. El envío de
correos depende de la configuración de Auth/SMTP del proyecto Supabase.

### Habilitar un administrador

Después de ejecutar `09_admin_rol.sql`, registrar la cuenta en la app y, desde
`meet-tennis/backend`, ejecutar:

```powershell
node scripts/promover_admin.mjs --email correo-del-administrador
node scripts/promover_admin.mjs --aplicar --email correo-del-administrador
```

El primer comando permite revisar la cuenta. El segundo aplica el rol. Los
administradores adicionales se gestionan en `/admin-usuarios`. El script SQL no
promueve nombres ni correos de ejemplo.

## Verificación

Desde `meet-tennis/backend`:

```powershell
npm test
```

Desde `meet-tennis/frontend`:

```powershell
npm run lint
npm test
npm run build
```

GitHub Actions ejecuta las pruebas del backend y el lint, las pruebas y la
compilación del frontend en cada push a `main` y en los pull requests. Utiliza
valores sintéticos para Supabase; no necesita credenciales de producción.

## Despliegue

- **Backend:** usar el Blueprint de [render.yaml](render.yaml), con raíz
  `meet-tennis/backend`. Configurar las variables de entorno en Render.
- **Frontend:** importar el repositorio en Vercel con raíz `meet-tennis/frontend`.
  Ejecutar `npm run build` y publicar `dist`. [vercel.json](meet-tennis/frontend/vercel.json)
  dirige `/api` a Render y permite recargar las rutas de React.
- **Datos:** los scripts SQL y de mantenimiento son manuales; no se ejecutan
  automáticamente al desplegar la aplicación.

## Notas de funcionamiento

- Cada categoría tiene su propia clasificación. Ganar suma 40, 25 o 10 puntos y
  perder resta 5, 15 o 25 según el rival sea de categoría superior, igual o inferior.
  Para ascender se requieren al menos 10 partidos válidos y 85 % de victorias contra
  categorías iguales o superiores. El ascenso es opcional y conserva el historial.
- Las recomendaciones enlazan a tiendas externas; MeetTennis no procesa pagos
  ni reservas de canchas. Los precios del catálogo corresponden a su revisión.
- Los recorridos usan servicios públicos de mapas y rutas. No incluyen tráfico
  en tiempo real y dependen de la disponibilidad del proveedor.
- El chat SSE distribuye avisos dentro de un proceso de backend. Para desplegar
  varias réplicas se necesita un canal compartido de eventos.
- La descripción «Sobre mí» del perfil se conserva localmente en el navegador.

Los scripts `seed_demo.js` y `seed_partidos.js` generan datos de demostración;
son herramientas opcionales de desarrollo y no forman parte del inicio normal.
Las pruebas y las capturas de verificación usan datos sintéticos, separados de la
sesión del usuario. Las capturas y respaldos locales están excluidos de Git.
