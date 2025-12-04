# **CloakLink Agent Context**

## **Mission**

CloakLink is a non-custodial, self-hostable privacy payment link generator.  
Core Constraint: Simple Mode (current) uses dedicated receive addresses. Future state requires "Stealth Mode" (derived addresses per invoice). Do not bake in centralized dependencies.

## **Critical Directive**

**ALWAYS** read docs/NEXT_STEPS.md before starting a task. This is the single source of truth for the active iteration plan.

## **Architecture & Stack**

* **Structure:** Monorepo using npm workspaces (/api, /frontend, /indexer).  
* **Frontend:** Next.js 14+ (App Router), Tailwind, Client/Server component separation.  
* **Backend:** Express, Prisma (SQLite), Zod validation.  
* **Indexer:** Node.js polling script (eventually RPC-based).

## **Development Rules**

1. **Strict TypeScript:** No any. All API inputs must be validated with Zod.  
2. **Privacy First:** No external analytics, no logging of PII/keys.  
3. **Comments:** Pragmatic only (why, not what). No emojis.  
4. **State:** Prefer React Server Components for fetching. Use client only for interactivity.

## **Operations**

## Setup  
npm install  
cd api && npx prisma migrate dev --name init && npx prisma generate

## Run (Concurrent API + Frontend)  
npm run dev

## Run Indexer  
npm run dev:indexer  
