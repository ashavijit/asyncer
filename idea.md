# Product Requirements Document (PRD)

## Product Name

**asyncer** — Async API Utilities

*Tagline*: *Write less. Ship safer async APIs.*

---

## Problem Statement

Backend developers repeatedly write boilerplate for:

* async/await error handling
* try/catch in controllers
* inconsistent API responses
* retries, timeouts, parallelism
* request-scoped context (logging, tracing)

This leads to:

* verbose controllers
* inconsistent error formats
* harder testing & refactoring

---

## Goal

Create a **lightweight, framework-agnostic utility package** that standardizes async API behavior with minimal code and maximum composability.

---

## Non-Goals

* Not a full framework (no routing, DI, ORM)
* No runtime dependencies
* No opinionated HTTP server choice

---

## Target Users

* Node.js / TypeScript backend engineers
* API framework builders (Express, Fastify, Bun, Deno)
* Developers who like FastAPI/Nest DX but want control

---

## Core Principles

* **Zero magic**: everything is explicit
* **Composable**: functions > decorators
* **Async-first**: Promise-native utilities
* **Tiny surface area**: <300 LOC core

---

## Key Features (MVP)

### 1. Async Control

* `asyncHandler(fn)`
* `safeAsync(promise)`
* `retryAsync(fn, retries, delay)`
* `withTimeout(promise, ms)`

### 2. Controller Abstractions

* `apiHandler(fn)`
* `wrapController(fn)`
* Functional middleware composition

### 3. Error System

* `ApiError(status, message, details?)`
* Centralized error propagation
* Predictable response shape

### 4. Response Helpers

* `success(data, message?)`
* `failure(message)`

### 5. Concurrency Utilities

* `parallel(tasks)`
* `sequence(tasks)`

---

## Advanced Features (v1.1+)

* Request context (`AsyncLocalStorage`)
* Assertion helpers (`assert()`)
* Error boundaries (`errorBoundary()`)
* Permission / auth guards
* Concurrency limits

---

## API Example

```ts
export const getUser = apiHandler(async (req) => {
  assert(req.params.id, 'Missing user id')
  return retryAsync(() => User.findById(req.params.id), 2)
})
```

---

## Package Structure

```
axiom/
├── async.ts
├── handler.ts
├── error.ts
├── response.ts
├── context.ts
├── concurrency.ts
└── index.ts
```

---

## Naming Alternatives

* **Axiom** (clean, foundational)
* **Fluxo** (flow-based async)
* **AsyncKit** (descriptive)
* **ZenAPI** (DX focused)
* **BareAPI** (minimalism)

---

## Success Metrics

* 70% reduction in controller LOC
* Single try/catch in entire codebase
* Drop-in adoption (<5 min setup)

---

## Future Extensions

* OpenAPI generation
* Framework adapters (Fastify / Hono / Bun)
* Observability hooks
* Typed request helpers

---

## One-liner Pitch

> **Axiom** is a tiny async utility layer that gives your APIs FastAPI-level cleanliness without taking control away from you.
