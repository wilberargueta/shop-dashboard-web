import { buildRobotsTxt } from './robots-txt.builder';

describe('buildRobotsTxt', () => {
  it('disallows filtered/query-string URLs and points to the sitemap', () => {
    const robots = buildRobotsTxt('https://tienda.test');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /*?');
    expect(robots).toContain('Sitemap: https://tienda.test/sitemap.xml');
  });
});
