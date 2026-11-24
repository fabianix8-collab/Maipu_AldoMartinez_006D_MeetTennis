# MeetTennis

## Descripción del proyecto
**MeetTennis** es una aplicación web progresiva (PWA) dirigida a tenistas amateur y recreativos de Santiago. 

Resuelve el problema de depender de grupos informales de WhatsApp o redes sociales para encontrar compañeros de juego. La aplicación centraliza el emparejamiento según nivel y disponibilidad horaria, permite proponer partidos seleccionando cancha, coordinar mediante chat directo, ubicar canchas cercanas, registrar resultados y competir en un ranking por categorías.

## Tecnologías utilizadas
* **Lenguajes:** JavaScript y SQL.
* **Frontend:** React, Vite, TailwindCSS (PWA).
* **Backend:** Node.js, Express.
* **Base de Datos y Seguridad:** Supabase (PostgreSQL, Supabase Auth y políticas RLS).
* **Cloud / Despliegue:** Vercel (Frontend), Render (Backend) y GitHub.

## Instrucciones para ejecutar el proyecto localmente

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/fabianix8-collab/Maipu_AldoMartinez_006D_MeetTennis.git](https://github.com/fabianix8-collab/Maipu_AldoMartinez_006D_MeetTennis.git)
   cd Maipu_AldoMartinez_006D_MeetTennis

   cd meet-tennis/backend
    npm install

    Crea un archivo .env dentro de backend con las variables de entorno de Supabase (PORT, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)

    npm run dev
    cd meet-tennis/frontend
    npm install
   npm run dev

## Integrantes del equipo y roles
**Fabián Baeza** – Backend, despliegue y documentación
**Felipe Sandoval** – Funcionalidades clave y seguridad
**Sebastián Toledo** – Frontend y documentación técnica

## Metodología de trabajo
El equipo utilizó la metodología ágil Scrum, trabajando de forma iterativa a lo largo de 18 semanas divididas en 9 sprints de 2 semanas cada uno, alineando las entregas a tres fases de evaluación (diseño inicial, desarrollo del MVP y operación/despliegue)

## Arquitectura de la solución
La solución opera bajo una arquitectura de 3 capas desplegada en servicios gestionados en la nube
**Capa de Presentación (Frontend – Vercel):** Aplicación web progresiva (PWA) desarrollada en React + Vite que se ejecuta en el navegador del cliente y envía peticiones HTTP/JSON adjuntando el token JWT de sesión.
**Capa de Negocio (Backend – Render):** API REST en Node.js + Express que valida los tokens mediante middleware y gestiona la lógica de cuenta/notificaciones, matchmaking, ranking/reputación y geolocalización.
**Capa de Datos (Supabase):** Servicio BaaS que maneja el registro e inicio de sesión (Supabase Auth) y almacena los datos relacionales en PostgreSQL con control de acceso
