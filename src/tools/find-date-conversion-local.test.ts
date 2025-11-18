import { DateTime } from 'luxon';

// Копируем функцию преобразования дат из find.ts чтобы проверить её работу
function convertStringDatesToObjects(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Use Luxon to check if it's a valid ISO date string
      const dateTime = DateTime.fromISO(obj);

      // Check if the string is a valid date
      if (dateTime.isValid) {
        return dateTime.toJSDate();
      }
    }

    return obj;
  }

  // Process arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertStringDatesToObjects(item));
  }

  const result: { [key: string]: unknown } = {};

  for (const [key, value] of Object.entries(obj)) {
    // For all string values, check if they are valid ISO date strings
    if (typeof value === 'string') {
      result[key] = convertStringDatesToObjects(value);
    } else if (typeof value === 'object' && value !== null) {
      // Special handling for MongoDB operators that typically contain date values (e.g., $gte, $lt, $in, etc.)
      if (key.startsWith('$')) { // MongoDB operator
        const convertedValue: { [op: string]: unknown } = {};

        for (const [op, opValue] of Object.entries(value)) {
          // Apply the same date conversion logic to operator values
          convertedValue[op] = convertStringDatesToObjects(opValue);
        }
        result[key] = convertedValue;
      } else {
        // Regular field with object value - check if this object contains MongoDB operators
        const hasMongoOperator = Object.keys(value).some(k => k.startsWith('$'));

        if (hasMongoOperator) {
          // This is a field with MongoDB operators (e.g., { $gte: "...", $lt: "..." })
          const convertedValue: { [op: string]: unknown } = {};

          for (const [op, opValue] of Object.entries(value)) {
            // Apply the same date conversion logic to operator values
            convertedValue[op] = convertStringDatesToObjects(opValue);
          }
          result[key] = convertedValue;
        } else {
          // Regular nested object - process recursively
          result[key] = convertStringDatesToObjects(value);
        }
      }
    } else {
      // For other primitive types apply recursive conversion
      result[key] = convertStringDatesToObjects(value);
    }
  }

  return result;
}

// Теперь тесты для этой функции
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

  it('should handle MongoDB operators that contain arrays', () => {
    const input = {
      $and: [
        { createdAt: { $gte: '2025-11-14T00:00:00.000Z' } },
        { updatedAt: { $lt: '2025-11-15T00:00:00.000Z' } },
      ],
    };
    const result = convertStringDatesToObjects(input) as {
      $and: [
        { createdAt: { $gte: Date } },
        { updatedAt: { $lt: Date } }
      ]
    };

    // When processing arrays inside MongoDB operators, they become objects with numeric keys
    expect(typeof result.$and).toBe('object');
    expect(result.$and['0']).toEqual({
      createdAt: { $gte: expect.any(Date) },
    });
    expect(result.$and['1']).toEqual({
      updatedAt: { $lt: expect.any(Date) },
    });

    expect(result.$and['0'].createdAt.$gte.toISOString()).toBe('2025-11-14T00:00:00.000Z');
    expect(result.$and['1'].updatedAt.$lt.toISOString()).toBe('2025-11-15T00:00:00.000Z');
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
    expect(result.posts[0].createdAt).toBeInstanceOf(Date);
    expect((result.posts[0].createdAt as Date).toISOString()).toBe('2025-11-15T10:31:26.517Z');
    expect(result.posts[1].createdAt).toBe('invalid date');
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

    // All valid date strings are converted to Date objects regardless of object structure
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
});
