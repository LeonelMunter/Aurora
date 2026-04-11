# Plataforma Financiera Multi-mercado con IA

## Descripcion
Plataforma de analisis financiero con portfolio tracker,
market analyzer, sentiment engine con IA y panel de patrimonio.
Mercados: cripto global + acciones AR + bonos + FX.

## Stack
- Backend: NestJS + TypeScript + PostgreSQL + Redis
- Frontend: Next.js 14 + Tailwind CSS
- IA: Gemini (free tier) con fallback a Claude y GPT
- Infra: Docker + AWS + Vercel

## Setup local (Windows - sin Docker)

### Requisitos previos
- Node.js 20+
- PostgreSQL instalado nativamente (puerto 5432)
- Redis / Memurai instalado nativamente (puerto 6379)

### Primera vez

#### 1. Clonar el repo
```powershell
git clone <url-del-repo>
cd <nombre-del-repo>
```

#### 2. Crear la base de datos en PostgreSQL
Abri pgAdmin o psql y ejecuta:

```sql
CREATE DATABASE finanzas;
```

#### 3. Configurar variables de entorno del backend
```powershell
cd backend
copy .env.example .env
```

Edita `.env` y completa `DB_PASSWORD` con tu password de PostgreSQL
y `GEMINI_API_KEY` con tu key de Google AI Studio.

#### 4. Instalar dependencias del backend
```powershell
cd backend
npm install
```

#### 5. Levantar el backend
```powershell
npm run start:dev
```

Disponible en `http://localhost:3001`
Swagger en `http://localhost:3001/api/docs`

#### 6. Instalar dependencias del frontend
```powershell
cd ../frontend
npm install
```

#### 7. Levantar el frontend
```powershell
npm run dev
```

Disponible en `http://localhost:3000`

### Verificar que todo funciona
- Backend: `GET http://localhost:3001` -> debe responder
- Swagger: `http://localhost:3001/api/docs` -> debe mostrar la UI
- Frontend: `http://localhost:3000` -> debe mostrar el dashboard
- Sidebar visible con todos los links de navegacion
- TokenCounter visible en esquina inferior derecha

### Servicios nativos - verificacion
PostgreSQL: `pg_isready -h localhost -p 5432`
Redis: `memurai-cli ping` (debe responder `PONG`)

### Para produccion (AWS)
En produccion se usa Docker. Ver `docker-compose.yml`.

## Estructura
`/backend` -> API REST + WebSocket (NestJS)
`/frontend` -> Dashboard (Next.js)

## Etapas
- Etapa 1: Portfolio tracker + Market analyzer + Sentiment engine + IA
- Etapa 2: Automatizacion parcial (OMS + Risk Manager) - proximamente
