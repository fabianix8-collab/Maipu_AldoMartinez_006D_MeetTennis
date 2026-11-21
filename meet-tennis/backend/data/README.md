# Catálogo de canchas

`canchas.json` es la lista revisada de recintos ofrecidos en MeetTennis. Incluye
nombre, dirección (terminada en comuna), coordenadas y fuentes. No contiene tarifas
ni clasificaciones de acceso para mostrar en la interfaz.

Los puntos proceden de las fichas públicas de Easycancha, de recintos identificados
en OpenStreetMap, de mapas municipales, de fichas cartográficas públicas y de las
coordenadas confirmadas por el usuario. No se aceptan como
ubicaciones de canchas los centros de una comuna, una calle o un barrio devueltos
por un geocodificador. Las fuentes cartográficas se guardan en `ubicacionFuente`.

San Joaquín conserva su dirección municipal comprobada, Sierra Bella 2836. Al no
haber un punto de cancha suficientemente comprobado, `mapaPorDireccion` habilita
la búsqueda de esa dirección en Google Maps. Se excluye del cálculo por distancia
hasta verificar sus coordenadas; no se le asigna el centro de la calle.

## Sincronizar Supabase

Desde `backend`, con su `.env` habitual:

```powershell
node scripts/actualizar_catalogo_canchas.mjs
node scripts/actualizar_catalogo_canchas.mjs --confirmar
node scripts/actualizar_catalogo_canchas.mjs --resumen
```

El primer comando muestra el plan. El segundo respalda la tabla en `.local/`
(ignorado por Git), inserta las nuevas fichas, actualiza las equivalentes sin cambiar
sus ID y vuelve a leer los datos para verificar que no quedan cambios pendientes.
Es seguro repetirlo. Este es el único comando de mantenimiento del catálogo.
`--resumen` verifica sin escribir y comprueba también el listado filtrado que usa la API.

Los registros retirados se conservan exclusivamente como respaldo histórico de los
partidos, solicitudes y disponibilidades existentes. No se borran sus referencias.
La API de canchas y la recomendación de cancha filtran por los nombres vigentes;
las nuevas solicitudes/disponibilidades rechazan un ID retirado. Es necesario
desplegar el backend actualizado para que este filtro se aplique en la web publicada.

## Revisar ubicaciones

`node scripts/consultar_ubicaciones_canchas.mjs` consulta únicamente los datos públicos
de las fichas Easycancha y guarda la evidencia en `.local/`; no actualiza Supabase ni
aprueba automáticamente una ubicación. El catálogo debe revisarse antes de sincronizar.

No se incluyen AFT, Don Carlos, Mundial Lawn Tennis Club, Pato Cornejo, Club Náutico,
Parque Bernardo Leighton, Parque Mahuida ni Parque Cerrillos. Tampoco se ofrecen
recintos de tenis sin dirección/acceso comprobados. La ficha antigua "Club de Tenis
Parque Araucano", situada en Cerro Colorado 4661, se corrige a Federación de Tenis;
no representa las canchas municipales del Parque Araucano.

## Recomendaciones de productos

`productos-adicionales.json` contiene 12 recomendaciones de Decathlon Chile y
Wilson Chile, revisadas el 21 de noviembre de 2026. Cada enlace apunta a la ficha
del producto que respalda su nombre, fotografía y precio en CLP. Los precios son
los observados durante la revisión; no se sincronizan automáticamente con las tiendas.

Desde `backend`, con su `.env` habitual y la tabla del script `08_productos.sql`:

```powershell
node scripts/agregar_productos.mjs
node scripts/agregar_productos.mjs --confirmar
```

El primer comando muestra las altas pendientes. El segundo agrega únicamente las
fichas que no existen por enlace ni nombre y comprueba el resultado. Conserva los
productos anteriores y sus ID; volver a ejecutarlo no duplica las recomendaciones.
Los nombres y descripciones también están traducidos en el catálogo inglés del frontend.
