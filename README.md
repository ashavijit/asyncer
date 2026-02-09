# asyncer

> **Write less. Ship safer async APIs.**

`asyncer` is a lightweight, framework-independent utility toolkit that standardizes asynchronous behavior and error handling in Node.js backend applications. 0 dependencies, pure TypeScript, and built for maximum composability.

---


## The Difference

### Standard Express/Fastify Pattern
```typescript
app.get('/user/:id', async (req, res, next) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: false, message: 'Missing ID' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
```

### With `asyncer`
```typescript
import { apiHandler, assert, assertExists } from 'asyncer';

app.get('/user/:id', apiHandler(async (req) => {
  assert(req.params.id, 'Missing ID', 400);
  return assertExists(await User.findById(req.params.id), 'User not found');
}));
```

---

# Installation

```bash
npm install asyncer
```

---

##  Core Modules

| Module | Purpose | Keywords |
|--------|---------|----------|
| **Handler** | Framework wrapping & middleware | `apiHandler`, `asyncHandler`, `compose`, `guard` |
| **Error** | Standardized error system | `ApiError`, `assert`, `wrapError`, `isApiError` |
| **Async** | Control flow & safety | `safeAsync`, `retryAsync`, `withTimeout`, `debounce` |
| **Concurrency** | Performance & limits | `parallel`, `sequence`, `parallelLimit`, `semaphore` |
| **Response** | Predictable JSON shapes | `success`, `failure`, `paginated`, `noContent` |
| **Context** | Request-scoped storage | `runWithContext`, `getContext`, `setContext` |

---

## Key Features

### 1. Robust Error System
Standardize how you throw and catch errors across your entire stack.

```typescript
import { ApiError, assert } from 'asyncer';

assert(user.isActive, 'Account suspended', 403);

throw ApiError.notFound('Resource not found', { id: 123 });
throw ApiError.unprocessable('Validation failed', { field: 'email' });
```

### 2. Functional Handlers
Clean up your controllers by removing repetitive `try/catch` and `res.json()` calls.

```typescript
import { apiHandler } from 'asyncer';

export const getUsers = apiHandler(async (req) => {
  return await UserService.findAll(); 
});
```

### 3. Safety First (Go-style)
Avoid nesting code in `try/catch` blocks using the tuple pattern.

```typescript
import { safeAsync } from 'asyncer';

const [error, data] = await safeAsync(promise);
if (error) return handle(error);
process(data);
```

### 4. Advanced Concurrency
Manage complex async workflows with built-in limits and safety guards.

```typescript
import { parallelLimit, retry, withTimeout } from 'asyncer';

const results = await parallelLimit(
  items.map(item => () => retry(() => process(item), 3)),
  5
);
const data = await withTimeout(fetchExternalData(), 5000);
```

### 5. Request-Scoped Context
Follow logs or user data across deep function calls without prop-drilling.

```typescript
import { setContext, getContext, runWithContext } from 'asyncer';

runWithContext(() => {
  setContext('traceId', 'abc-123');
  someDeepFunction();
});

function someDeepFunction() {
  const traceId = getContext('traceId'); // 'abc-123'
}
```

---

## 📖 API Reference

### Error Handling
- `ApiError(status, message, details?)`: Custom error class.
- `assert(condition, message, status)`: Throws `ApiError` if condition is falsy.
- `assertExists(value, message, status)`: Throws `ApiError` if value is null/undefined.
- `isApiError(err)`: Type guard for `ApiError`.

### Async Utilities
- `safeAsync(promise)`: Returns `[error, result]`.
- `retryAsync(fn, options)`: Advanced retry with exponential backoff.
- `withTimeout(promise, ms)`: Promise with timeout rejection.
- `sleep(ms)`: Promisified setTimeout.
- `debounce(fn, ms)`: Debounced async function execution.

### Concurrency
- `parallel(tasks)`: `Promise.all` for task functions.
- `sequence(tasks)`: Runs tasks one after another.
- `parallelLimit(tasks, limit)`: Runs tasks with controlled concurrency.
- `semaphore(limit)`: Access control for shared resources.
- `batch(size, processor)`: Process large arrays in chunks.

### Response Helpers
- `success(data, message?)`: standard success object.
- `failure(message, details?)`: standard error object.
- `paginated(data, meta)`: standardized pagination object.

---

### For More examples, check out the [examples](examples.md) file.

``` If you find any issues or have suggestions for improvement, please open an issue on GitHub.```
---
  
``` Do leave a star if you find this useful! ::))```
---

## License

MIT
