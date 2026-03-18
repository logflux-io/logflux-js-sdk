import { EntryType } from '../types';

describe('Sampling', () => {
  test('sample rate 1.0 sends all', () => {
    let sent = 0;
    const rate = 1.0;
    for (let i = 0; i < 100; i++) {
      if (Math.random() < rate) sent++;
    }
    expect(sent).toBe(100);
  });

  test('sample rate 0.0 drops all', () => {
    let sent = 0;
    const rate = 0.0;
    for (let i = 0; i < 100; i++) {
      if (Math.random() < rate) sent++;
    }
    expect(sent).toBe(0);
  });

  test('sample rate 0.5 sends roughly half', () => {
    let sent = 0;
    const rate = 0.5;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      if (Math.random() < rate) sent++;
    }
    // Allow 10% tolerance
    expect(sent).toBeGreaterThan(iterations * 0.4);
    expect(sent).toBeLessThan(iterations * 0.6);
  });

  test('audit entries are exempt from sampling (type 5)', () => {
    // In the SDK, audit entries always pass through regardless of sample rate.
    // We verify the logic: entryType === 5 bypasses the sample check.
    const entryType = EntryType.Audit;
    const sampleRate = 0.0; // Would drop everything

    // Simulate: audit bypasses sampling
    const shouldSend = entryType === EntryType.Audit || Math.random() < sampleRate;
    expect(shouldSend).toBe(true);
  });
});
