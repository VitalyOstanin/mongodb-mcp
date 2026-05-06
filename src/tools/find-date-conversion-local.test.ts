import { DateTime } from 'luxon';

const ISO_DATE_LIKE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

function convertStringDatesToObjects(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string' && ISO_DATE_LIKE.test(obj)) {
      const dateTime = DateTime.fromISO(obj);

      if (dateTime.isValid) {
        return dateTime.toJSDate();
      }
    }

    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertStringDatesToObjects(item));
  }

  const result: { [key: string]: unknown } = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertStringDatesToObjects(value);
  }

  return result;
}

describe('convertStringDatesToObjects', () => {
  it('should return non-object values as-is', () => {
    expect(convertStringDatesToObjects(null)).toBe(null);
    expect(convertStringDatesToObjects('not a date')).toBe('not a date');
    expect(convertStringDatesToObjects(123)).toBe(123);
    expect(convertStringDatesToObjects(true)).toBe(true);
  });

  it('should convert valid ISO date strings to Date objects', () => {
    const dateString = '2025-11-14T10:31:26.517Z';
    const result = convertStringDatesToObjects(dateString);

    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(dateString);
  });

  it('should return invalid date strings as-is', () => {
    const invalidDateString = 'not a date string';
    const result = convertStringDatesToObjects(invalidDateString);

    expect(result).toBe(invalidDateString);
    expect(result).not.toBeInstanceOf(Date);
  });

  it('should not convert short numeric strings (e.g., "123", "2025") to dates', () => {
    expect(convertStringDatesToObjects('123')).toBe('123');
    expect(convertStringDatesToObjects('2025')).toBe('2025');
    expect(convertStringDatesToObjects('active')).toBe('active');
    expect(convertStringDatesToObjects('user-id-abc-123')).toBe('user-id-abc-123');
  });

  it('should handle arrays recursively', () => {
    const input = [
      '2025-11-14T10:31:26.517Z',
      'not a date',
      '2025-11-15T10:31:26.517Z',
    ];
    const result = convertStringDatesToObjects(input) as unknown[];

    expect(Array.isArray(result)).toBe(true);
    expect((result as Date[])[0]).toBeInstanceOf(Date);
    expect(result[1]).toBe('not a date');
    expect((result as Date[])[2]).toBeInstanceOf(Date);
  });

  it('should handle objects with date strings', () => {
    const input = {
      name: 'test',
      createdAt: '2025-11-14T10:31:26.517Z',
      updatedAt: '2025-11-15T10:31:26.517Z',
      status: 'active',
    };
    const result = convertStringDatesToObjects(input) as {
      name: string;
      createdAt: Date;
      updatedAt: Date;
      status: string;
    };

    expect(result).toEqual({
      name: 'test',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      status: 'active',
    });

    expect(result.createdAt.toISOString()).toBe('2025-11-14T10:31:26.517Z');
    expect(result.updatedAt.toISOString()).toBe('2025-11-15T10:31:26.517Z');
  });

  it('should handle MongoDB operators with date values', () => {
    const input = {
      createdAt: {
        $gte: '2025-11-14T00:00:00.000Z',
        $lt: '2025-11-15T00:00:00.000Z',
      },
    };
    const result = convertStringDatesToObjects(input) as {
      createdAt: {
        $gte: Date;
        $lt: Date;
      };
    };

    expect(result).toEqual({
      createdAt: {
        $gte: expect.any(Date),
        $lt: expect.any(Date),
      },
    });

    expect(result.createdAt.$gte.toISOString()).toBe('2025-11-14T00:00:00.000Z');
    expect(result.createdAt.$lt.toISOString()).toBe('2025-11-15T00:00:00.000Z');
  });

  it('should preserve $and array structure with date conversion inside', () => {
    const input = {
      $and: [
        { createdAt: { $gte: '2025-11-14T00:00:00.000Z' } },
        { updatedAt: { $lt: '2025-11-15T00:00:00.000Z' } },
      ],
    };
    const result = convertStringDatesToObjects(input) as {
      $and: Array<{ createdAt?: { $gte: Date }; updatedAt?: { $lt: Date } }>;
    };

    expect(Array.isArray(result.$and)).toBe(true);
    expect(result.$and).toHaveLength(2);
    expect(result.$and[0]!.createdAt!.$gte).toBeInstanceOf(Date);
    expect(result.$and[0]!.createdAt!.$gte.toISOString()).toBe('2025-11-14T00:00:00.000Z');
    expect(result.$and[1]!.updatedAt!.$lt).toBeInstanceOf(Date);
    expect(result.$and[1]!.updatedAt!.$lt.toISOString()).toBe('2025-11-15T00:00:00.000Z');
  });

  it('should preserve $or and $nor arrays', () => {
    const input = {
      $or: [
        { status: 'active' },
        { createdAt: { $gte: '2025-11-14T00:00:00.000Z' } },
      ],
      $nor: [
        { deleted: true },
      ],
    };
    const result = convertStringDatesToObjects(input) as {
      $or: Array<{ status?: string; createdAt?: { $gte: Date } }>;
      $nor: Array<{ deleted: boolean }>;
    };

    expect(Array.isArray(result.$or)).toBe(true);
    expect(Array.isArray(result.$nor)).toBe(true);
    expect(result.$or[0]).toEqual({ status: 'active' });
    expect(result.$or[1]!.createdAt!.$gte).toBeInstanceOf(Date);
    expect(result.$nor[0]).toEqual({ deleted: true });
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        profile: {
          createdAt: '2025-11-14T10:31:26.517Z',
        },
      },
      posts: [
        { createdAt: '2025-11-15T10:31:26.517Z' },
        { createdAt: 'invalid date' },
      ],
    };
    const result = convertStringDatesToObjects(input) as {
      user: {
        profile: {
          createdAt: Date;
        };
      };
      posts: Array<{
        createdAt: Date | string;
      }>;
    };

    expect(result.user.profile.createdAt).toBeInstanceOf(Date);
    expect((result.user.profile.createdAt).toISOString()).toBe('2025-11-14T10:31:26.517Z');
    expect(result.posts[0]!.createdAt).toBeInstanceOf(Date);
    expect((result.posts[0]!.createdAt as Date).toISOString()).toBe('2025-11-15T10:31:26.517Z');
    expect(result.posts[1]!.createdAt).toBe('invalid date');
  });

  it('should convert dates in all objects, including non-operator ones', () => {
    const input = {
      dateRange: {
        startDate: '2025-11-14T00:00:00.000Z',
        endDate: '2025-11-15T00:00:00.000Z',
      },
    };
    const result = convertStringDatesToObjects(input) as {
      dateRange: {
        startDate: Date;
        endDate: Date;
      };
    };

    expect(result).toEqual({
      dateRange: {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      },
    });

    expect(result.dateRange.startDate.toISOString()).toBe('2025-11-14T00:00:00.000Z');
    expect(result.dateRange.endDate.toISOString()).toBe('2025-11-15T00:00:00.000Z');
  });

  it('should convert dates in objects that contain MongoDB operators', () => {
    const input = {
      createdAt: {
        $gte: '2025-11-14T00:00:00.000Z',
        $lt: '2025-11-15T00:00:00.000Z',
        $exists: true,
      },
    };
    const result = convertStringDatesToObjects(input) as {
      createdAt: {
        $gte: Date;
        $lt: Date;
        $exists: boolean;
      };
    };

    expect(result).toEqual({
      createdAt: {
        $gte: expect.any(Date),
        $lt: expect.any(Date),
        $exists: true,
      },
    });

    expect(result.createdAt.$gte.toISOString()).toBe('2025-11-14T00:00:00.000Z');
    expect(result.createdAt.$lt.toISOString()).toBe('2025-11-15T00:00:00.000Z');
  });

  it('should accept date-only ISO strings', () => {
    const result = convertStringDatesToObjects('2025-11-14');

    expect(result).toBeInstanceOf(Date);
  });
});
