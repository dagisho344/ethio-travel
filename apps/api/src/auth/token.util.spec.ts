import { hashToken } from './token.util';

describe('token utilities', () => {
  it('hashes tokens deterministically without storing the plaintext value', () => {
    const token = 'plain-refresh-token-for-test';
    const hash = hashToken(token);

    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });
});
