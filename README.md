# TP3 — Simulación de Montecarlo · Fábrica de Muebles

UTN · Ingeniería en Sistemas de Información · Simulación 2026

---

## Requisitos previos

Solo necesitás tener instalado **Docker Desktop** en tu máquina. No hace falta Python ni ninguna otra dependencia local.

- **Windows / Mac**: descargá e instalá desde https://www.docker.com/products/docker-desktop
- **Linux**: seguí la guía oficial https://docs.docker.com/engine/install/

Para verificar que quedó bien instalado, abrí una terminal y ejecutá:

```bash
docker --version
docker compose version
```

Si ambos comandos devuelven un número de versión, estás listo.

---

## Levantar el proyecto

**1. Clonar o descargar el repositorio**

```bash
git clone <url-del-repo>
cd tp-3
```

**2. Construir y levantar los contenedores**

```bash
docker compose up --build
```

La primera vez tarda unos minutos porque descarga la imagen de Python e instala las dependencias.

**3. Abrir la aplicación**

Una vez que en la terminal aparezca algo como:

```
web-1  | Starting development server at http://0.0.0.0:8000/
```

Abrí el navegador y entrá a:

```
http://localhost:8000
```

**4. Detener el proyecto**

```bash
docker compose down
```

---

## Estructura del proyecto

```
tp-3/
│
├── core/                        # Configuración global del proyecto Django
│   ├── settings.py              # Parámetros del proyecto: apps instaladas, base de datos, etc.
│   ├── urls.py                  # Punto de entrada de todas las URLs del sistema
│   ├── wsgi.py                  # Interfaz para servidores de producción (WSGI)
│   └── asgi.py                  # Interfaz para servidores de producción (ASGI)
│
├── apps/                        # Carpeta que contiene todas las aplicaciones del sistema
│   └── muebles/                 # App principal: simulación de la fábrica de muebles
│       │
│       ├── views.py             # Punto de entrada de la API y de las páginas HTML
│       │                        # Acá se reciben los requests y se devuelven las respuestas
│       │
│       ├── urls.py              # Define las rutas (endpoints) de esta app
│       │                        # Por ejemplo: / → página principal, /api/simulation/ → API
│       │
│       ├── service.py           # LÓGICA DEL SISTEMA
│       │                        # Acá está (o va a estar) toda la lógica de Montecarlo.
│       │                        # Si necesitás modificar la simulación, este es el archivo.
│       │
│       ├── serializers.py       # Define la estructura de los datos que entran y salen de la API
│       │                        # Valida que el JSON del request tenga la forma correcta
│       │
│       ├── templates/           # Archivos HTML que se sirven al navegador
│       │   └── muebles/
│       │       ├── base.html    # Layout base: estructura HTML, carga de CSS y JS
│       │       └── simulation.html  # Página principal: formulario + tabla de resultados
│       │
│       └── static/              # Archivos estáticos que usa el navegador
│           └── muebles/
│               ├── css/
│               │   └── simulation.css   # Estilos visuales de la app
│               └── js/
│                   └── simulation.js    # Lógica del frontend: hace fetch a la API
│                                        # y renderiza los resultados en la tabla
│
├── Dockerfile                   # Instrucciones para construir la imagen Docker
├── docker-compose.yml           # Orquesta los contenedores (qué imagen, puertos, volúmenes)
├── .dockerignore                # Archivos que Docker ignora al construir (como .venv)
├── manage.py                    # CLI de Django: correr servidor, migraciones, etc.
└── requirements.txt             # Dependencias Python del proyecto
```

---

## Cómo funciona el flujo de datos

```
Navegador
   │
   │  GET /          → Django sirve el HTML (simulation.html)
   │  POST /api/simulation/  → el JS hace fetch con los parámetros del form
   │
views.py  (recibe el request)
   │
service.py  (ejecuta la simulación, devuelve los resultados)
   │
views.py  (empaqueta la respuesta en JSON)
   │
simulation.js  (recibe el JSON, dibuja la tabla y los stats en pantalla)
```

---

## Dónde hacer modificaciones

| Qué querés cambiar | Archivo |
|--------------------|---------|
| Lógica de la simulación (Montecarlo) | `apps/muebles/service.py` |
| Endpoints de la API | `apps/muebles/urls.py` + `apps/muebles/views.py` |
| Estructura del HTML / formulario | `apps/muebles/templates/muebles/simulation.html` |
| Estilos visuales | `apps/muebles/static/muebles/css/simulation.css` |
| Comportamiento del frontend (fetch, tabla) | `apps/muebles/static/muebles/js/simulation.js` |
| Configuración global del proyecto | `core/settings.py` |
