// Utilidades compartidas por los scripts que siembran datos en shop-backend-service
// (seed-e2e-catalog.mjs, seed-demo-catalog.mjs). Solo para desarrollo: este repo
// nunca llama a /api/admin/** desde la aplicación, solo desde estos scripts.

import { deflateSync } from 'node:zlib';

export function readAdminConfig() {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8080';
  const email = process.env.ADMIN_EMAIL ?? 'admin@tienda.local';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error(
      'Falta ADMIN_PASSWORD. Define la misma contraseña que ADMIN_INITIAL_PASSWORD ' +
        'en el .env del backend, por ejemplo:\n' +
        '  ADMIN_PASSWORD=... pnpm e2e:seed',
    );
    process.exit(1);
  }

  return { apiBaseUrl, email, password };
}

export async function connect({ apiBaseUrl, email, password }) {
  async function request(path, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${method} ${path} → ${response.status}\n${detail}`);
    }

    return response.status === 204 || response.status === 202 ? null : response.json();
  }

  console.log(`Autenticando como ${email} contra ${apiBaseUrl}...`);
  const { accessToken } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  const admin = (path, options = {}) => request(path, { ...options, token: accessToken });

  async function ensureCategories(categories) {
    const idsByName = new Map();
    for (const category of await admin('/api/admin/v1/categories')) {
      idsByName.set(category.name, category.id);
    }

    for (const category of categories) {
      if (idsByName.has(category.name)) {
        console.log(`Categoría "${category.name}" ya existe, se reutiliza.`);
        continue;
      }
      const created = await admin('/api/admin/v1/categories', {
        method: 'POST',
        body: { name: category.name, sortOrder: category.sortOrder, active: true },
      });
      idsByName.set(created.name, created.id);
      console.log(`Categoría "${created.name}" creada.`);
    }
    return idsByName;
  }

  async function existingProductIdsBySku() {
    const page = await admin('/api/admin/v1/products?size=100');
    return new Map(page.content.map((product) => [product.sku, product.id]));
  }

  /** `POST /products` exige todos los campos primitivos del record (stock, sortOrder): sin ellos Jackson responde 400 genérico. */
  async function createAndPublishProduct(product, categoryId) {
    const created = await admin('/api/admin/v1/products', {
      method: 'POST',
      body: {
        sku: product.sku,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description ?? '',
        usageInstructions: product.usageInstructions ?? '',
        categoryId,
        price: product.price,
        stock: 0,
        trackStock: false,
        featured: false,
        sortOrder: 0,
      },
    });
    await admin(`/api/admin/v1/products/${created.id}/publish`, { method: 'POST' });
    return created;
  }

  async function uploadImage(productId, png) {
    const formData = new FormData();
    formData.set('file', new Blob([png], { type: 'image/png' }), 'seed.png');

    const response = await fetch(`${apiBaseUrl}/api/admin/v1/products/${productId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`POST products/${productId}/images → ${response.status}\n${await response.text()}`);
    }
  }

  /** No hay `GET .../images` en el backend todavía (solo POST/DELETE): se confirma el procesado en segundo plano sondeando la respuesta pública. */
  async function waitForImage(slug) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const product = await request(`/api/public/v1/products/${slug}`);
      if (product.images?.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`La imagen de "${slug}" no terminó de procesarse a tiempo.`);
  }

  return {
    admin,
    request,
    ensureCategories,
    existingProductIdsBySku,
    createAndPublishProduct,
    uploadImage,
    waitForImage,
  };
}

function crc32(buffer) {
  const table = crc32.table ?? (crc32.table = buildCrcTable());
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

/**
 * PNG cuadrado sin dependencias, con un degradado vertical de `top` a `bottom`
 * (`[r, g, b]`). Suficiente para pasar la validación de tipo/dimensiones del
 * backend (ARQUITECTURA.md §7); con el mismo color arriba y abajo es un color
 * sólido.
 */
export function createGradientPng(size, top, bottom) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // profundidad de bits
  ihdrData[9] = 2; // tipo de color: RGB

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const t = size === 1 ? 0 : y / (size - 1);
    const rgb = top.map((channel, i) => Math.round(channel + (bottom[i] - channel) * t));
    const rowStart = y * rowSize;
    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      raw[pixelStart] = rgb[0];
      raw[pixelStart + 1] = rgb[1];
      raw[pixelStart + 2] = rgb[2];
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
