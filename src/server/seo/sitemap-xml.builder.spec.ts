import { buildSitemapXml } from './sitemap-xml.builder';

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('buildSitemapXml', () => {
  it('produces well-formed XML', () => {
    const xml = buildSitemapXml('https://tienda.test', ['a', 'b']);
    const doc = parse(xml);

    expect(doc.querySelector('parsererror')).toBeNull();
  });

  it('includes the home page plus one entry per slug', () => {
    const xml = buildSitemapXml('https://tienda.test', ['aceite-de-lavanda', 'crema-facial']);
    const locs = Array.from(parse(xml).querySelectorAll('url > loc')).map((el) => el.textContent);

    expect(locs).toEqual([
      'https://tienda.test/',
      'https://tienda.test/p/aceite-de-lavanda',
      'https://tienda.test/p/crema-facial',
    ]);
  });

  it('lists only the home page without any product', () => {
    const xml = buildSitemapXml('https://tienda.test', []);
    const locs = Array.from(parse(xml).querySelectorAll('url > loc')).map((el) => el.textContent);

    expect(locs).toEqual(['https://tienda.test/']);
  });

  it('escapes XML-special characters in a slug', () => {
    const xml = buildSitemapXml('https://tienda.test', ['aceite-&-miel']);

    expect(xml).toContain('aceite-&amp;-miel');
    expect(parse(xml).querySelector('parsererror')).toBeNull();
  });
});
