import { PageResponseProductCard } from '../../app/api/model/page-response-product-card';
import { fetchPublishedProductSlugs } from './sitemap-slugs';

function jsonResponse(body: PageResponseProductCard): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('fetchPublishedProductSlugs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loops pages until hasNext is false, collecting every slug in order', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ slug: 'a' }, { slug: 'b' }], page: 0, hasNext: true }),
      )
      .mockResolvedValueOnce(jsonResponse({ content: [{ slug: 'c' }], page: 1, hasNext: false }));
    vi.stubGlobal('fetch', fetchMock);

    const slugs = await fetchPublishedProductSlugs('http://backend.test');

    expect(slugs).toEqual(['a', 'b', 'c']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/public/v1/products?page=0&size=48',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/public/v1/products?page=1&size=48',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('skips products without a slug', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ content: [{ slug: 'a' }, {}], page: 0, hasNext: false })),
    );

    const slugs = await fetchPublishedProductSlugs('http://backend.test');

    expect(slugs).toEqual(['a']);
  });

  it('throws on a non-ok response instead of returning a partial sitemap silently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })));

    await expect(fetchPublishedProductSlugs('http://backend.test')).rejects.toThrow('HTTP 500');
  });

  it('returns an empty list without any page having content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ content: [], page: 0, hasNext: false })));

    const slugs = await fetchPublishedProductSlugs('http://backend.test');

    expect(slugs).toEqual([]);
  });
});
