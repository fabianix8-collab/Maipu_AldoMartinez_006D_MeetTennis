# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
# Idiomas de MeetTennis

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
