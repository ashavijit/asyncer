import {
  ApiError,
  success,
  failure,
  paginated,
  safeAsync,
  retryAsync,
  retry,
  withTimeout,
  sleep,
  parallel,
  sequence,
  parallelLimit,
  assert,
  assertExists,
  isApiError,
  runWithContext,
  setContext,
  getContext,
  semaphore,
  pipeline,
  batch,
} from 'asyncer';

console.log('='.repeat(60));
console.log('Asyncer Package - Example Application');
console.log('='.repeat(60));

async function mockDbQuery(id, shouldFail = false) {
  await sleep(100);
  if (shouldFail) {
    throw new Error('Database connection failed');
  }
  return { id, name: `User ${id}`, email: `user${id}@example.com` };
}

let apiCallAttempt = 0;
async function unreliableApiCall() {
  apiCallAttempt++;
  await sleep(50);
  if (apiCallAttempt < 3) {
    throw new Error(`API call failed (attempt ${apiCallAttempt})`);
  }
  return { data: 'Success after retries!' };
}

async function main() {
  console.log('\n1. Response Helpers');
  console.log('-'.repeat(40));

  const successResponse = success({ id: 1, name: 'John' }, 'User retrieved');
  console.log('success():', JSON.stringify(successResponse, null, 2));

  const failureResponse = failure('Validation failed', { field: 'email' });
  console.log('failure():', JSON.stringify(failureResponse, null, 2));

  const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const paginatedResponse = paginated(users, { page: 1, limit: 10, total: 25 });
  console.log('paginated():', JSON.stringify(paginatedResponse, null, 2));

  console.log('\n2. ApiError Class');
  console.log('-'.repeat(40));

  const notFoundError = ApiError.notFound('User not found');
  console.log('ApiError.notFound():', notFoundError.toJSON());

  const badRequestError = ApiError.badRequest('Invalid input', { field: 'email' });
  console.log('ApiError.badRequest():', badRequestError.toJSON());

  console.log('isApiError() check:', isApiError(notFoundError));

  console.log('\n3. safeAsync - Go-style Error Handling');
  console.log('-'.repeat(40));

  const [error1, user1] = await safeAsync(mockDbQuery('123'));
  if (error1) {
    console.log('Query failed:', error1.message);
  } else {
    console.log('Query succeeded:', user1);
  }

  const [error2, user2] = await safeAsync(mockDbQuery('456', true));
  if (error2) {
    console.log('Query failed (expected):', error2.message);
  } else {
    console.log('Query succeeded:', user2);
  }

  console.log('\n4. retryAsync - Retry with Backoff');
  console.log('-'.repeat(40));

  apiCallAttempt = 0;
  try {
    const result = await retryAsync(unreliableApiCall, {
      retries: 3,
      delay: 100,
      onRetry: (err, attempt) => {
        console.log(`  Retry attempt ${attempt}: ${err.message}`);
      },
    });
    console.log('retryAsync result:', result);
  } catch (err) {
    console.log('All retries failed:', err.message);
  }

  console.log('\n5. withTimeout');
  console.log('-'.repeat(40));

  try {
    const fastResult = await withTimeout(mockDbQuery('fast'), 500);
    console.log('Fast query completed:', fastResult.id);
  } catch (err) {
    console.log('Fast query timed out');
  }

  try {
    const slowQuery = sleep(1000).then(() => ({ id: 'slow' }));
    await withTimeout(slowQuery, 200, 'Query took too long');
  } catch (err) {
    console.log('Slow query timed out (expected):', err.message);
  }

  console.log('\n6. parallel - Concurrent Execution');
  console.log('-'.repeat(40));

  const startParallel = Date.now();
  const [userA, userB, userC] = await parallel([
    () => mockDbQuery('A'),
    () => mockDbQuery('B'),
    () => mockDbQuery('C'),
  ]);
  console.log('Parallel results:', [userA.id, userB.id, userC.id]);
  console.log(`Time taken: ${Date.now() - startParallel}ms (should be ~100ms)`);

  console.log('\n7. sequence - Sequential Execution');
  console.log('-'.repeat(40));

  const startSequence = Date.now();
  const sequenceResults = await sequence([
    () => mockDbQuery('X'),
    () => mockDbQuery('Y'),
    () => mockDbQuery('Z'),
  ]);
  console.log('Sequence results:', sequenceResults.map((r) => r.id));
  console.log(`Time taken: ${Date.now() - startSequence}ms (should be ~300ms)`);

  console.log('\n8. parallelLimit - Controlled Concurrency');
  console.log('-'.repeat(40));

  const tasks = Array.from({ length: 6 }, (_, i) => () => mockDbQuery(`${i + 1}`));
  const startLimited = Date.now();
  const limitedResults = await parallelLimit(tasks, 2);
  console.log('Limited parallel results:', limitedResults.map((r) => r.id));
  console.log(`Time taken: ${Date.now() - startLimited}ms (limit=2, should be ~300ms)`);

  console.log('\n9. assert / assertExists');
  console.log('-'.repeat(40));

  try {
    const userId = '12345';
    assert(userId, 'User ID is required', 400);
    console.log('assert passed for userId:', userId);

    const user = await mockDbQuery('999');
    const validatedUser = assertExists(user, 'User not found', 404);
    console.log('assertExists passed:', validatedUser.id);

    assert(null, 'This should fail', 400);
  } catch (err) {
    if (isApiError(err)) {
      console.log('Assert threw ApiError (expected):', err.message);
    }
  }

  console.log('\n10. Context - AsyncLocalStorage');
  console.log('-'.repeat(40));

  await runWithContext(async () => {
    setContext('requestId', 'req-abc-123');
    setContext('userId', 42);

    console.log('Inside context:');
    console.log('  requestId:', getContext('requestId'));
    console.log('  userId:', getContext('userId'));

    await sleep(50);

    console.log('After async operation (context preserved):');
    console.log('  requestId:', getContext('requestId'));
  }, { initialValue: 'test' });

  console.log('\n11. Semaphore - Concurrency Control');
  console.log('-'.repeat(40));

  const sem = semaphore(2);
  console.log('Semaphore created with limit 2');
  console.log('Available slots:', sem.available);

  await sem.acquire();
  console.log('After 1st acquire, available:', sem.available);

  await sem.acquire();
  console.log('After 2nd acquire, available:', sem.available);

  sem.release();
  console.log('After 1st release, available:', sem.available);

  sem.release();
  console.log('After 2nd release, available:', sem.available);

  console.log('\n12. Pipeline - Data Transformation');
  console.log('-'.repeat(40));

  const rawData = { value: 10 };
  const pipelineResult = await pipeline(rawData, [
    async (data) => ({ ...data, value: data.value * 2 }),
    async (data) => ({ ...data, value: data.value + 5 }),
    async (data) => ({ ...data, processed: true }),
  ]);
  console.log('Pipeline input:', rawData);
  console.log('Pipeline output:', pipelineResult);

  console.log('\n13. Batch Processing');
  console.log('-'.repeat(40));

  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const batchProcessor = batch(3, async (chunk) => {
    console.log(`  Processing batch: [${chunk.join(', ')}]`);
    await sleep(50);
    return chunk.map((n) => n * 2);
  });

  const batchResults = await batchProcessor(items);
  console.log('Batch results:', batchResults);

  console.log('\n' + '='.repeat(60));
  console.log('All examples completed successfully!');
  console.log('='.repeat(60));
}

main().catch(console.error);
