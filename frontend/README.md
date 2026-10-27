# SimetFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

# SIMET · Frontend

SPA de control de asistencia creada con Angular 22, standalone components y Tailwind CSS 3.

## Desarrollo local

Desde la raíz del monorepo, inicia el backend en una terminal y después la SPA en otra:

```powershell
npm --prefix backend run dev
npm --prefix frontend start
```

Angular sirve la app en `http://localhost:4200` y reenvía `/api` a `http://localhost:3000` mediante `proxy.conf.json`. Copia `backend/.env.example` a `backend/.env` y configura las credenciales antes de iniciar Express.

## Configuración de producción

En Vercel, configura `frontend/public/config.js` con la URL pública HTTPS del backend de Render, incluyendo `/api`:

```js
window.SIMET_API_URL = 'https://TU-SERVICIO.onrender.com/api';
```

La API debe permitir en CORS el dominio de Vercel. El valor predeterminado `/api` sirve para desarrollo con proxy o para despliegues con proxy inverso.

## Evaluaciones de personal

Antes de desplegar el módulo de evaluaciones, selecciona `simet_asistencia` en MySQL Workbench/Aiven y ejecuta una vez el script `database/evaluaciones.sql`. El script reutiliza la tabla `puestos` existente, crea las tablas de criterios, evaluaciones y respuestas, y agrega criterios iniciales sin duplicarlos si se vuelve a ejecutar. El acceso a `/admin/evaluaciones` y a `/api/evaluaciones/*` está reservado al rol ID 3 (`Jefe Autorizado`).

## Validación

```powershell
npm --prefix frontend run build
npm --prefix frontend test -- --watch=false
```
