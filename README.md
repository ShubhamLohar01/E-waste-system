# E-waste Management System

A full-stack web application for managing electronic waste (e-waste) collection, tracking, and recycling. The system supports multiple user roles—from individual donors and local collectors to hubs, delivery workers, recyclers, bulk generators, and admins—with role-based dashboards and a reward wallet for participants.

## Features

- **Authentication** – Login and registration with JWT-based sessions
- **Role-based dashboards**
  - **Small User** – Donate e-waste, track pickups, earn rewards
  - **Local Collector** – Manage local collections and handoffs
  - **Hub** – Oversee regional aggregation and logistics
  - **Delivery Worker** – Handle pickups and deliveries
  - **Recycler** – Process received e-waste and report outcomes
  - **Bulk Generator** – Manage large-volume e-waste from organizations
  - **Admin** – System-wide oversight and configuration
- **Reward Wallet** – Points/rewards for small users based on contributions
- **QR codes** – For tracking and verifying items
- **Email notifications** – Via Nodemailer integration

## Tech Stack

- **Frontend:** React 18, React Router 6 (SPA), TypeScript, Vite, TailwindCSS 3, Radix UI, Lucide React
- **Backend:** Express 5, TypeScript
- **Auth:** JWT, bcrypt
- **Validation:** Zod
- **Testing:** Vitest

## Project Structure

```
client/                 # React SPA
├── pages/              # Route components (Index, auth, dashboards)
├── components/         # UI components and ProtectedRoute
├── context/            # AuthContext
├── App.tsx
└── global.css

server/                 # Express API
├── index.ts
└── routes/             # API handlers

shared/                 # Shared types (client & server)
└── api.ts
```

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

## Getting Started

### Install dependencies

```bash
pnpm install
```

### Environment variables

Create a `.env` file in the project root if needed (e.g. for JWT secret, email, or DB). See `.env.example` if provided.

### Run development server

Runs both frontend and backend on a single port (default **8080**):

```bash
pnpm dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Other commands

| Command        | Description              |
|----------------|--------------------------|
| `pnpm build`   | Production build         |
| `pnpm start`   | Run production server    |
| `pnpm typecheck` | TypeScript check       |
| `pnpm test`    | Run Vitest tests         |

## API

API routes are prefixed with `/api/`. Auth and business endpoints are defined under `server/routes/` and mounted in `server/index.ts`.

## License

MIT (or specify your license)

## Repository

[https://github.com/ShubhamLohar01/E-waste-system](https://github.com/ShubhamLohar01/E-waste-system)
