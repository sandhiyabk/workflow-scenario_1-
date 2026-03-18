# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Workflow Automation System.

## Project Structure
The project is organized into two main parts:
- `backend/`: Node.js + Express API with Prisma ORM.
- `frontend/`: React + TypeScript UI built with Vite.

---

## 1. Database Setup (Railway or Supabase)

1.  Create a **PostgreSQL** database on a managed provider like [Railway](https://railway.app/) or [Supabase](https://supabase.com/).
2.  Copy the **Database connection string** (e.g., `postgresql://...`).
3.  Ensure your IP or the deployment platform's IP is allowed to connect.

---

## 2. Backend Deployment (Render or Railway)

### Environment Variables
Set the following environment variables in your backend hosting platform:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `PORT`: Usually `3001` (or whatever the platform provides).
- `FRONTEND_URL`: The URL of your deployed frontend (e.g., `https://your-app.vercel.app`).
- `NODE_ENV`: `production`.

### Deployment Steps
1.  **Connect Repo**: Connect your GitHub repository.
2.  **Root Directory**: Set searching/root directory to `backend`.
3.  **Build Command**: `npm install && npm run build`
4.  **Start Command**: `npm start`
5.  **Post-Install**: The `package.json` includes `postinstall: prisma generate` to ensure the client is ready.

### Database Migrations
Run the following command locally after setting your production `DATABASE_URL` in a temporary `.env` file (or use the platform's CLI):
```bash
cd backend
npx prisma migrate deploy
```

---

## 3. Frontend Deployment (Vercel)

### Environment Variables
Set the following environment variables in Vercel:
- `VITE_API_BASE_URL`: The URL of your deployed backend (e.g., `https://your-api.onrender.com`).

### Deployment Steps
1.  **Connect Repo**: Connect your GitHub repository.
2.  **Root Directory**: Set to `frontend`.
3.  **Framework Preset**: Vite.
4.  **Build Command**: `npm install && npm run build`
5.  **Output Directory**: `dist`.

---

## 4. Local Production Test

To test the production builds locally:

### Backend
```bash
cd backend
npm install
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm install
# Ensure .env has VITE_API_BASE_URL=http://localhost:3001
npm run build
npm run preview
```

---

## Important Commands Reference

| Operation | Command |
| :--- | :--- |
| **Install All** | `npm install` (in root, frontend, and backend) |
| **Prisma Generate** | `npx prisma generate` (in backend) |
| **Prisma Migrate** | `npx prisma migrate deploy` (in backend) |
| **Build Backend** | `npm run build` (in backend) |
| **Build Frontend** | `npm run build` (in frontend) |

---

## Troubleshooting
- **CORS Errors**: Ensure the `FRONTEND_URL` in backend env matches your Vercel URL exactly.
- **Database Connection**: Verify `DATABASE_URL` format and that the database provider allows external connections.
- **API Not Found**: Ensure `VITE_API_BASE_URL` is set correctly in the frontend and includes the protocol (`https://`).
