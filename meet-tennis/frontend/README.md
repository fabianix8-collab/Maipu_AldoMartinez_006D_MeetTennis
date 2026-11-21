# Frontend de MeetTennis

Interfaz React con Vite y Tailwind CSS. Consultar el [README del proyecto](../../README.md)
para configurar Supabase, iniciar el backend y preparar el despliegue.

Desde esta carpeta:

```powershell
npm ci
npm run dev
```

Vite abre la app en `http://localhost:5173` y dirige `/api` al backend local en
`http://localhost:3000`. `npm run lint`, `npm test` y `npm run build` verifican el
código, las pruebas y la compilación. La salida se genera en `dist/`.

## Idiomas de MeetTennis


El switch pequeño **ES / EN**, con una pelota de tenis que se desliza al cambiar
de idioma, aparece debajo de la campana y salir en el inicio,
junto a las acciones del encabezado en las demás pantallas y en la esquina
superior de inicio de sesión y registro. Al pulsarlo se alterna entre español e
inglés. El idioma inicial sigue la preferencia guardada; si no existe,
se usa el idioma del navegador (inglés o español como respaldo). La selección se
guarda en `localStorage` con la clave `meettennis_language` y se sincroniza entre
pestañas sin cerrar la sesión ni reiniciar los formularios.

Las traducciones de la interfaz están en `src/lib/translations/en.js` y se aplican
al mostrar el texto mediante `useLanguage()` de `src/lib/i18n.js`. Los nombres,
direcciones, mensajes y reseñas escritos por jugadores conservan su contenido.
Las categorías, filtros y valores enviados a la API mantienen sus identificadores
originales. Los importes siguen expresados en pesos chilenos (CLP).

Ejecutar `npm test` para verificar preferencias, interpolaciones, errores,
notificaciones y el renderizado de todas las pantallas en los dos idiomas.

## Recorridos dentro de la app

Con la ubicación habilitada, **Cómo llegar** abre un mapa interactivo de calles
con manzanas grises, calles blancas, parques verdes y agua azul, en un marco azul
oscuro y esmeralda. La cancha se marca con una pelota de tenis y la
ubicación del jugador con un punto azul. Se puede elegir **En auto** o **A pie**,
consultar la distancia y el tiempo estimados del recorrido.
El mapa permite zoom, desplazamiento y volver a encuadrar la ruta completa.
Una vez calculado el recorrido, **Iniciar navegación** permite abrir Google Maps
de forma opcional. El botón permanece visible bajo el mapa y respeta la selección
**En auto** o **A pie**; Maps obtiene la posición del dispositivo en ese momento.
El recorrido se dibuja al abrirlo y muestra puntos en movimiento, un pulso en el
origen y un giro suave de la pelota. La animación es automática y respeta la
preferencia de movimiento reducido del dispositivo.

La ubicación debe estar previamente autorizada en el navegador. Si falta,
la vista indica que hay que activarla desde **Cerca de mí**, sin solicitar un
nuevo permiso al abrir el recorrido. Las coordenadas se conservan solamente en
memoria durante la visita y se envían al servicio de rutas al calcular el camino.
Las canchas sin coordenadas verificadas no generan recorridos aproximados.

Se usa Leaflet con un fondo vectorial MapLibre/OpenFreeMap basado en OpenStreetMap
y recorridos OSRM/FOSSGIS. La paleta plana se define en `src/lib/estiloMapa.js`;
conserva las calles y zonas reales, sin crear manzanas o parques ficticios. El
mapa incluye nombres de comunas y avenidas; al acercarse aparecen sectores y
calles locales. Se conservan los nombres propios en español en ambos idiomas,
con separación automática de etiquetas para mantener la legibilidad. El
renderizador vectorial se carga únicamente al abrir el mapa. Requiere
internet; las estimaciones no incluyen tráfico en tiempo real. Los servicios
públicos son de disponibilidad variable: no se precargan recorridos, se reutilizan
los resultados durante cinco minutos y las consultas se separan al menos un segundo.
Para usar otro servidor compatible, configura las variables de `.env.example`.
Los créditos del mapa y del servicio de rutas, junto con el enlace para corregir
el mapa, se integran en un pie pequeño dentro del propio mapa.

`node scripts/verify-public-route.mjs` comprueba rutas entre dos recintos públicos
del catálogo, sin usar la ubicación real del usuario. `scripts/preview-route.mjs`
verifica el mapa con Chrome de prueba en el puerto 9223, la app en el 5173 y datos
de dos canchas públicas simulados; guarda las capturas en `.local/` (ignorado).
