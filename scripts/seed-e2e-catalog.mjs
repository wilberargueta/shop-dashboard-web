#!/usr/bin/env node
// Siembra un catálogo mínimo (2 categorías, 5 productos publicados, 1 imagen)
// en un backend de shop-backend-service recién levantado, para que los e2e
// de Playwright (ROADMAP.md W15) tengan datos reales contra los que correr.
// Idempotente: se puede ejecutar varias veces sin duplicar nada.
//
// Requiere ADMIN_PASSWORD (la contraseña real del ADMIN de ese backend).
// Nunca se hardcodea un secreto aquí.

import { deflateSync } from 'node:zlib';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8080';
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@tienda.local';
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.error(
    'Falta ADMIN_PASSWORD. Define la misma contraseña que ADMIN_INITIAL_PASSWORD ' +
      'en el .env del backend, por ejemplo:\n' +
      '  ADMIN_PASSWORD=... pnpm e2e:seed',
  );
  process.exit(1);
}

const CATEGORIES = [{ name: 'Aceites', sortOrder: 0 }, { name: 'Cremas', sortOrder: 1 }];

// Solo LAVANDA_SKU sube una imagen: es el único producto que
// `e2e/whatsapp-flow.spec.ts` abre para ver el carrusel (mockeando una
// segunda imagen a partir de la real, ver `mockLavandaWithTwoImages`). Los
// demás no necesitan ninguna — un producto se publica igual sin imágenes
// (`primaryImage: null`), y ningún otro caso de Playwright depende de eso.
const LAVANDA_SKU = 'ACE-001';

const PRODUCTS = [
  {
    sku: LAVANDA_SKU,
    name: 'Aceite esencial de lavanda 30ml',
    category: 'Aceites',
    price: 25.0,
    shortDescription: 'Relajante, 100% puro',
  },
  {
    sku: 'ACE-002',
    name: 'Aceite esencial de árbol de té 30ml',
    category: 'Aceites',
    price: 22.0,
    shortDescription: 'Purificante, uso tópico diluido',
  },
  {
    sku: 'ACE-003',
    name: 'Aceite esencial de eucalipto 30ml',
    category: 'Aceites',
    price: 20.0,
    shortDescription: 'Descongestionante, aromaterapia',
  },
  {
    sku: 'CRE-001',
    name: 'Crema hidratante de karite 200ml',
    category: 'Cremas',
    price: 18.0,
    shortDescription: 'Manteca de karité, piel seca',
  },
  {
    sku: 'CRE-002',
    name: 'Crema hidratante de aloe vera 200ml',
    category: 'Cremas',
    price: 16.0,
    shortDescription: 'Aloe vera, uso diario',
  },
];

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

/** PNG mínimo, sin dependencias: un cuadrado sólido de un color, suficiente para pasar la validación de tipo/dimensiones del backend (ARQUITECTURA.md §7). */
function createSolidPng(size, [r, g, b]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // profundidad de bits
  ihdrData[9] = 2; // tipo de color: RGB

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      raw[pixelStart] = r;
      raw[pixelStart + 1] = g;
      raw[pixelStart + 2] = b;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function uploadImage(productId, token) {
  const png = createSolidPng(200, [186, 156, 214]);
  const formData = new FormData();
  formData.set('file', new Blob([png], { type: 'image/png' }), 'seed.png');

  const response = await fetch(`${apiBaseUrl}/api/admin/v1/products/${productId}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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

console.log(`Autenticando como ${adminEmail} contra ${apiBaseUrl}...`);
const { accessToken } = await request('/api/auth/login', {
  method: 'POST',
  body: { email: adminEmail, password: adminPassword },
});

const categoryIdsByName = new Map();
const existingCategories = await request('/api/admin/v1/categories', { token: accessToken });
for (const category of existingCategories) {
  categoryIdsByName.set(category.name, category.id);
}

for (const category of CATEGORIES) {
  if (categoryIdsByName.has(category.name)) {
    console.log(`Categoría "${category.name}" ya existe, se reutiliza.`);
    continue;
  }

  const created = await request('/api/admin/v1/categories', {
    method: 'POST',
    token: accessToken,
    body: { name: category.name, sortOrder: category.sortOrder, active: true },
  });
  categoryIdsByName.set(created.name, created.id);
  console.log(`Categoría "${created.name}" creada.`);
}

const existingProducts = await request('/api/admin/v1/products?size=100', { token: accessToken });
const productIdBySku = new Map(existingProducts.content.map((product) => [product.sku, product.id]));

for (const product of PRODUCTS) {
  if (productIdBySku.has(product.sku)) {
    console.log(`Producto "${product.sku}" ya existe, se omite.`);
    continue;
  }

  const created = await request('/api/admin/v1/products', {
    method: 'POST',
    token: accessToken,
    body: {
      sku: product.sku,
      name: product.name,
      shortDescription: product.shortDescription,
      description: '',
      usageInstructions: '',
      categoryId: categoryIdsByName.get(product.category),
      price: product.price,
      stock: 0,
      trackStock: false,
      featured: false,
      sortOrder: 0,
    },
  });
  productIdBySku.set(created.sku, created.id);

  await request(`/api/admin/v1/products/${created.id}/publish`, {
    method: 'POST',
    token: accessToken,
  });

  console.log(`Producto "${created.name}" creado y publicado.`);
}

const lavanda = PRODUCTS.find((product) => product.sku === LAVANDA_SKU);
const lavandaSlug = (await request(`/api/admin/v1/products/${productIdBySku.get(LAVANDA_SKU)}`, {
  token: accessToken,
})).slug;
const lavandaDetail = await request(`/api/public/v1/products/${lavandaSlug}`);

if (lavandaDetail.images?.length > 0) {
  console.log(`"${lavanda.name}" ya tiene imagen, se omite la subida.`);
} else {
  console.log(`Subiendo imagen a "${lavanda.name}"...`);
  await uploadImage(productIdBySku.get(LAVANDA_SKU), accessToken);
  await waitForImage(lavandaSlug);
  console.log('Imagen procesada.');
}

console.log('Catálogo de e2e sembrado.');
