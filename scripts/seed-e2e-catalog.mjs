#!/usr/bin/env node
// Siembra un catálogo mínimo (2 categorías, 5 productos publicados, 1 imagen)
// en un backend de shop-backend-service recién levantado, para que los e2e
// de Playwright (ROADMAP.md W15) tengan datos reales contra los que correr.
// Idempotente: se puede ejecutar varias veces sin duplicar nada.
//
// Requiere ADMIN_PASSWORD (la contraseña real del ADMIN de ese backend).
// Nunca se hardcodea un secreto aquí.

import { connect, createGradientPng, readAdminConfig } from './lib/admin-client.mjs';

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

const client = await connect(readAdminConfig());
const categoryIdsByName = await client.ensureCategories(CATEGORIES);
const productIdBySku = await client.existingProductIdsBySku();

for (const product of PRODUCTS) {
  if (productIdBySku.has(product.sku)) {
    console.log(`Producto "${product.sku}" ya existe, se omite.`);
    continue;
  }
  const created = await client.createAndPublishProduct(product, categoryIdsByName.get(product.category));
  productIdBySku.set(created.sku, created.id);
  console.log(`Producto "${created.name}" creado y publicado.`);
}

const lavanda = PRODUCTS.find((product) => product.sku === LAVANDA_SKU);
const lavandaId = productIdBySku.get(LAVANDA_SKU);
const lavandaSlug = (await client.admin(`/api/admin/v1/products/${lavandaId}`)).slug;
const lavandaDetail = await client.request(`/api/public/v1/products/${lavandaSlug}`);

if (lavandaDetail.images?.length > 0) {
  console.log(`"${lavanda.name}" ya tiene imagen, se omite la subida.`);
} else {
  console.log(`Subiendo imagen a "${lavanda.name}"...`);
  const lilac = [186, 156, 214];
  await client.uploadImage(lavandaId, createGradientPng(200, lilac, lilac));
  await client.waitForImage(lavandaSlug);
  console.log('Imagen procesada.');
}

console.log('Catálogo de e2e sembrado.');
