import { redactConnectionString, redactError } from './redact.js';

describe('redactConnectionString', () => {
  it('should mask password in mongodb:// URI', () => {
    expect(redactConnectionString('mongodb://user:secret@host:27017/db'))
      .toBe('mongodb://user:***@host:27017/db');
  });

  it('should mask password in mongodb+srv:// URI', () => {
    expect(redactConnectionString('mongodb+srv://user:secret@cluster.example.com/db'))
      .toBe('mongodb+srv://user:***@cluster.example.com/db');
  });

  it('should leave URIs without password unchanged', () => {
    expect(redactConnectionString('mongodb://localhost:27017'))
      .toBe('mongodb://localhost:27017');
  });

  it('should mask URI embedded inside an error message', () => {
    const msg = 'Auth failed when connecting to mongodb://admin:topsecret@host:27017/admin: bad creds';

    expect(redactConnectionString(msg))
      .toBe('Auth failed when connecting to mongodb://admin:***@host:27017/admin: bad creds');
  });

  it('redactError should handle Error objects', () => {
    expect(redactError(new Error('mongodb://u:p@h:27017'))).toBe('mongodb://u:***@h:27017');
  });

  it('redactError should handle non-Error values', () => {
    expect(redactError('mongodb://u:p@h:27017')).toBe('mongodb://u:***@h:27017');
    expect(redactError(42)).toBe('42');
  });
});
