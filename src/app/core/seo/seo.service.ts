import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { WHATSAPP_SETTINGS } from '../config/whatsapp-settings.token';

export type SeoJsonLdId = 'ld-product' | 'ld-itemlist' | 'ld-breadcrumb' | 'ld-organization';

export interface SeoPageTags {
  title: string;
  description: string;
  /** Absoluta; alimenta `og:url` y `<link rel="canonical">`. */
  url: string;
  type: 'website' | 'product';
  /** Absoluta (versión `detail`). Sin ella se retiran `og:image`/`twitter:image`. */
  image?: string;
}

/**
 * Envuelve `Title`/`Meta` (ya seguros en SSR) más dos cosas que Angular no
 * ofrece de fábrica: `<link rel="canonical">` y bloques
 * `<script type="application/ld+json">`. Se inyecta `DOCUMENT` — nunca el
 * `document` global, que no existe en servidor — la misma técnica que usan
 * internamente `Meta`/`Title`, ya verificada en este repo (caso 41, W6).
 *
 * `<head>` es compartido entre páginas, no se recrea por componente: por eso
 * `updatePageTags` retira `og:image`/`twitter:image` explícitamente cuando no
 * hay imagen, y cada bloque JSON-LD tiene un `id` propio para que una página
 * pueda limpiar solo el suyo (`removeJsonLd`) sin tocar el de otras (p. ej.
 * `Organization`, montado una sola vez en `App`).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly storeName = inject(WHATSAPP_SETTINGS).storeName;

  updatePageTags(tags: SeoPageTags): void {
    this.title.setTitle(tags.title);
    this.meta.updateTag({ name: 'description', content: tags.description });
    this.meta.updateTag({ property: 'og:type', content: tags.type });
    this.meta.updateTag({ property: 'og:title', content: tags.title });
    this.meta.updateTag({ property: 'og:description', content: tags.description });
    this.meta.updateTag({ property: 'og:url', content: tags.url });
    this.meta.updateTag({ property: 'og:site_name', content: this.storeName });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: tags.title });
    this.meta.updateTag({ name: 'twitter:description', content: tags.description });

    if (tags.image) {
      this.meta.updateTag({ property: 'og:image', content: tags.image });
      this.meta.updateTag({ name: 'twitter:image', content: tags.image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    this.setCanonical(tags.url);
  }

  setJsonLd(id: SeoJsonLdId, data: Record<string, unknown>): void {
    let script = this.document.head.querySelector<HTMLScriptElement>(`script#${id}`);
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  removeJsonLd(id: SeoJsonLdId): void {
    this.document.head.querySelector(`script#${id}`)?.remove();
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
