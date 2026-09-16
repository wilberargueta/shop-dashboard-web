import { getOrCreateSessionId } from './session-id';

const STORAGE_KEY = 'analytics_session_id';

describe('getOrCreateSessionId', () => {
  beforeEach(() => sessionStorage.clear());

  it('generates and persists a session id', () => {
    const id = getOrCreateSessionId();

    expect(id).not.toBe('');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it('reuses the stored session id on subsequent calls', () => {
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();

    expect(second).toBe(first);
  });
});
