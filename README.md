# Maipu_AldoMartinez_006D_EquipoXX

## Panel de monitoreo y administración

La app incluye un **panel de monitoreo** en `/monitoreo`, exclusivo para usuarios con rol
`admin`. Desde ahí se ven las estadísticas generales de MeetTennis (usuarios, partidos,
solicitudes, canchas, chat, reseñas, tendencias de 7 días) y se administran los roles.

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

Desde el propio panel, un admin puede promover o revocar a otros usuarios sin tocar SQL.

### Endpoints del panel (requieren rol admin)
- `GET /api/monitoring` — estadísticas generales de la app.
- `GET /api/monitoring/acceso` — indica si el usuario autenticado es admin.
- `GET /api/monitoring/usuarios` — lista de usuarios (nombre, correo, comuna, categoría, rol).
- `PATCH /api/monitoring/usuarios/:id/rol` — cambia el rol (`admin` | `jugador`); no permite
  cambiarse el propio rol.

### Seguridad básica
- Las rutas de login/registro tienen rate limit por IP (en memoria, sin dependencias):
  login 10 intentos / 15 min y registro 5 / hora. (Middleware `backend/src/middleware/rateLimit.js`.)
- Todo el acceso a datos pasa por el backend con la `service_role`; RLS sin políticas públicas.