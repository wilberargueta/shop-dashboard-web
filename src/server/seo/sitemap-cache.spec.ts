import { getCachedSitemapXml, resetSitemapCacheForTests } from './sitemap-cache';

describe('getCachedSitemapXml', () => {
  beforeEach(() => resetSitemapCacheForTests());

  it('builds once and reuses the cached value within the TTL window', async () => {
    const build = vi.fn().mockResolvedValue('<xml-1/>');
    let now = 0;

    const first = await getCachedSitemapXml(build, () => now);
    now += 1_000;
    const second = await getCachedSitemapXml(build, () => now);

    expect(first).toBe('<xml-1/>');
    expect(second).toBe('<xml-1/>');
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('rebuilds once the TTL (1 hour) has elapsed', async () => {
    const build = vi.fn().mockResolvedValueOnce('<xml-1/>').mockResolvedValueOnce('<xml-2/>');
    let now = 0;

    await getCachedSitemapXml(build, () => now);
    now += 3_600_001;
    const second = await getCachedSitemapXml(build, () => now);

    expect(second).toBe('<xml-2/>');
    expect(build).toHaveBeenCalledTimes(2);
  });
});
