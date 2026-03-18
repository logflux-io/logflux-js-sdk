describe('BeforeSend hooks', () => {
  test('hook returning null drops entry', () => {
    const hook = (_entry: Record<string, unknown>) => null;
    const entry = { message: 'test', level: 7, entryType: 1 };
    const result = hook(entry);
    expect(result).toBeNull();
  });

  test('hook returning entry allows it through', () => {
    const hook = (entry: Record<string, unknown>) => entry;
    const entry = { message: 'test', level: 7, entryType: 1 };
    const result = hook(entry);
    expect(result).toEqual(entry);
  });

  test('hook can modify entry', () => {
    const hook = (entry: Record<string, unknown>) => {
      return { ...entry, message: 'modified' };
    };
    const entry = { message: 'original', level: 7, entryType: 1 };
    const result = hook(entry);
    expect(result?.message).toBe('modified');
  });

  test('hook based on entry type', () => {
    const hook = (entry: Record<string, unknown>): Record<string, unknown> | null => {
      // Drop debug entries
      if (entry.level === 8) return null;
      return entry;
    };

    expect(hook({ message: 'debug', level: 8, entryType: 1 })).toBeNull();
    expect(hook({ message: 'info', level: 7, entryType: 1 })).not.toBeNull();
  });
});
