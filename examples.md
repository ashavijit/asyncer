# Examples

How you can use `asyncer` to reduce repetition and improve code quality.

---

## Route Handlers

### Without asyncer
```typescript
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});
```

### With asyncer
```typescript
import { apiHandler, assertExists } from 'asyncer';

app.get('/users/:id', apiHandler(async (req) => {
  const user = await User.findById(req.params.id);
  return assertExists(user, 'User not found');
}));
```

---

## Error Handling & Assertions

### Without asyncer
```typescript
async function updateProfile(req, res) {
  if (!req.body.email) {
    throw new Error('Email is required'); // Results in 500 if not handled
  }
  
  const user = await User.findOne({ email: req.body.email });
  if (user && user.id !== req.user.id) {
    return res.status(409).json({ message: 'Email taken' });
  }
}
```

### With asyncer
```typescript
import { assert, ApiError } from 'asyncer';

async function updateProfile(req) {
  assert(req.body.email, 'Email is required', 400);
  
  const user = await User.findOne({ email: req.body.email });
  if (user && user.id !== req.user.id) {
    throw ApiError.conflict('Email taken');
  }
}
```

---

## Async Safety (safeAsync)

### Without asyncer
```typescript
let user;
try {
  user = await db.users.find(id);
} catch (error) {
  logger.error(error);
  return handleFailure(error);
}
// continue with user
```

### With asyncer
```typescript
import { safeAsync } from 'asyncer';

const [error, user] = await safeAsync(db.users.find(id));
if (error) {
  logger.error(error);
  return handleFailure(error);
}
// continue with user
```

---

## Retries & Timeouts

### Without asyncer
```typescript
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
```

### With asyncer
```typescript
import { retry, withTimeout } from 'asyncer';

async function fetchWithRetry(url) {
  return retry(
    () => withTimeout(fetch(url).then(r => r.json()), 5000),
    3,
    1000
  );
}
```

---

## Controlled Concurrency

### Without asyncer
```typescript
// Difficult to implement manually without external libraries (like p-limit)
// Usually ends up being sequential (slow) or full parallel (risky)
const results = [];
for (const item of items) {
  results.push(await process(item));
}
```

### With asyncer
```typescript
import { parallelLimit } from 'asyncer';

const results = await parallelLimit(
  items.map(item => () => process(item)),
  5
);
```

---

## Request Context

### Without asyncer
```typescript
// Requires passing user/trace data through every single function call
async function controller(req) {
  const traceId = req.headers['x-trace-id'];
  await serviceA(traceId, data);
}

async function serviceA(traceId, data) {
  await repositoryB(traceId, data);
}
```

### With asyncer
```typescript
import { runWithContext, getContext, setContext } from 'asyncer';

// Set once in middleware/handler
runWithContext(() => {
  setContext('traceId', req.headers['x-trace-id']);
  await serviceA(data);
}, { traceId: req.headers['x-trace-id'] });

// Access anywhere
async function repositoryB(data) {
  const traceId = getContext('traceId');
}
```

---

## Batch Processing

### Without asyncer
```typescript
const items = [...];
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const chunk = items.slice(i, i + batchSize);
  await db.insertMany(chunk);
}
```

### With asyncer
```typescript
import { batch } from 'asyncer';

const insertBatch = batch(100, (chunk) => db.insertMany(chunk));
await insertBatch(items);
```
