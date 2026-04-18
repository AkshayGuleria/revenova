import { ConfigService } from '@nestjs/config';
import { getQueueConfig } from './queue.config';

describe('getQueueConfig', () => {
  const makeConfigService = (overrides: Record<string, any> = {}) => {
    const defaults: Record<string, any> = {
      REDIS_HOST: undefined,
      REDIS_PORT: undefined,
      ...overrides,
    };
    return {
      get: jest.fn((key: string, defaultValue?: any) =>
        defaults[key] !== undefined ? defaults[key] : defaultValue,
      ),
    } as unknown as ConfigService;
  };

  // ---------------------------------------------------------------------------
  // Connection defaults
  // ---------------------------------------------------------------------------

  describe('connection', () => {
    it('uses localhost and port 6379 when env vars are absent', () => {
      const config = getQueueConfig(makeConfigService());

      expect(config.connection).toEqual({ host: 'localhost', port: 6379 });
    });

    it('uses REDIS_HOST from config service when set', () => {
      const config = getQueueConfig(
        makeConfigService({ REDIS_HOST: 'redis.internal' }),
      );

      expect(config.connection).toMatchObject({ host: 'redis.internal' });
    });

    it('uses REDIS_PORT from config service when set', () => {
      const config = getQueueConfig(makeConfigService({ REDIS_PORT: 6380 }));

      expect(config.connection).toMatchObject({ port: 6380 });
    });

    it('uses both custom host and port together', () => {
      const config = getQueueConfig(
        makeConfigService({ REDIS_HOST: 'cache.prod', REDIS_PORT: 6399 }),
      );

      expect(config.connection).toEqual({ host: 'cache.prod', port: 6399 });
    });

    it('calls configService.get with correct keys and defaults', () => {
      const cs = makeConfigService();
      getQueueConfig(cs);

      expect(cs.get).toHaveBeenCalledWith('REDIS_HOST', 'localhost');
      expect(cs.get).toHaveBeenCalledWith('REDIS_PORT', 6379);
    });
  });

  // ---------------------------------------------------------------------------
  // defaultJobOptions — retry / backoff
  // ---------------------------------------------------------------------------

  describe('defaultJobOptions.attempts', () => {
    it('sets 3 retry attempts', () => {
      const config = getQueueConfig(makeConfigService());

      expect(config.defaultJobOptions?.attempts).toBe(3);
    });
  });

  describe('defaultJobOptions.backoff', () => {
    it('uses exponential backoff strategy', () => {
      const config = getQueueConfig(makeConfigService());

      expect(config.defaultJobOptions?.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      });
    });

    it('sets initial delay of 1000ms', () => {
      const config = getQueueConfig(makeConfigService());
      const backoff = config.defaultJobOptions?.backoff as { type: string; delay: number };

      expect(backoff.delay).toBe(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // defaultJobOptions — removeOnComplete
  // ---------------------------------------------------------------------------

  describe('defaultJobOptions.removeOnComplete', () => {
    it('retains completed jobs for 1 hour (3600 seconds)', () => {
      const config = getQueueConfig(makeConfigService());
      const removeOnComplete = config.defaultJobOptions?.removeOnComplete as {
        age: number;
        count: number;
      };

      expect(removeOnComplete.age).toBe(3600);
    });

    it('keeps at most 100 completed jobs', () => {
      const config = getQueueConfig(makeConfigService());
      const removeOnComplete = config.defaultJobOptions?.removeOnComplete as {
        age: number;
        count: number;
      };

      expect(removeOnComplete.count).toBe(100);
    });

    it('removeOnComplete has both age and count fields', () => {
      const config = getQueueConfig(makeConfigService());

      expect(config.defaultJobOptions?.removeOnComplete).toMatchObject({
        age: expect.any(Number),
        count: expect.any(Number),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // defaultJobOptions — removeOnFail
  // ---------------------------------------------------------------------------

  describe('defaultJobOptions.removeOnFail', () => {
    it('retains failed jobs for 24 hours (86400 seconds)', () => {
      const config = getQueueConfig(makeConfigService());
      const removeOnFail = config.defaultJobOptions?.removeOnFail as {
        age: number;
      };

      expect(removeOnFail.age).toBe(86400);
    });

    it('failed jobs are kept significantly longer than completed jobs', () => {
      const config = getQueueConfig(makeConfigService());
      const removeOnComplete = config.defaultJobOptions?.removeOnComplete as { age: number };
      const removeOnFail = config.defaultJobOptions?.removeOnFail as { age: number };

      expect(removeOnFail.age).toBeGreaterThan(removeOnComplete.age);
    });
  });

  // ---------------------------------------------------------------------------
  // Shape / contract
  // ---------------------------------------------------------------------------

  describe('return value shape', () => {
    it('returns an object with connection and defaultJobOptions', () => {
      const config = getQueueConfig(makeConfigService());

      expect(config).toHaveProperty('connection');
      expect(config).toHaveProperty('defaultJobOptions');
    });

    it('is deterministic — same input produces same output', () => {
      const cs = makeConfigService({
        REDIS_HOST: 'redis.test',
        REDIS_PORT: 6379,
      });

      const first = getQueueConfig(cs);
      const second = getQueueConfig(cs);

      expect(first).toEqual(second);
    });

    it('does not include unexpected top-level keys', () => {
      const config = getQueueConfig(makeConfigService());
      const keys = Object.keys(config);

      expect(keys).toEqual(
        expect.arrayContaining(['connection', 'defaultJobOptions']),
      );
      expect(keys.length).toBe(2);
    });
  });
});
