#!/usr/bin/env node
// Siembra productos de demostración de Gaby's Beauty (categorías "Cabello" y
// "Uñas", 6 productos con foto de relleno y dos con descuento) para ver el
// sitio con un catálogo realista. Complementa a seed-e2e-catalog.mjs sin
// tocar sus categorías ("Aceites"/"Cremas"), de las que dependen los e2e, y
// deja el catálogo total en 12 productos: justo una página (`catalog.page_size`),
// así que ningún e2e depende de un segundo lote del scroll infinito.
// Idempotente. Las fotos son degradados de relleno: sustitúyelas por las
// reales desde el backoffice.
//
// Requiere ADMIN_PASSWORD: ADMIN_PASSWORD=... pnpm seed:demo

import { connect, createGradientPng, readAdminConfig } from './lib/admin-client.mjs';

const CATEGORIES = [
  { name: 'Cabello', sortOrder: 2 },
  { name: 'Uñas', sortOrder: 3 },
];

const PRODUCTS = [
  {
    sku: 'CAB-001',
    name: 'Shampoo hidratante de argán 400ml',
    category: 'Cabello',
    price: 14.5,
    shortDescription: 'Limpia con suavidad y deja brillo',
    description: '<p>Shampoo sin sulfatos con aceite de argán. Hidrata desde la primera lavada y controla el frizz.</p>',
    usageInstructions: 'Aplicar sobre el cabello húmedo, masajear y enjuagar. Repetir si es necesario.',
    colors: [[250, 214, 211], [244, 166, 166]],
  },
  {
    sku: 'CAB-002',
    name: 'Mascarilla reparadora de keratina 250ml',
    category: 'Cabello',
    price: 19,
    shortDescription: 'Repara el cabello dañado por el calor',
    description: '<p>Tratamiento intensivo con keratina para cabello maltratado por planchas, secadores y tintes.</p>',
    usageInstructions: 'Dejar actuar 5 minutos después del shampoo y enjuagar con agua fría.',
    discount: { type: 'PERCENTAGE', value: 15 },
    colors: [[253, 227, 225], [217, 120, 138]],
  },
  {
    sku: 'CAB-003',
    name: 'Sérum antifrizz de coco 60ml',
    category: 'Cabello',
    price: 12,
    shortDescription: 'Sella las puntas y da brillo sin pesar',
    description: '<p>Sérum ligero con aceite de coco para terminar el peinado. Efecto sedoso todo el día.</p>',
    colors: [[255, 243, 232], [244, 190, 170]],
  },
  {
    sku: 'UNA-001',
    name: 'Esmalte semipermanente rosa pétalo 15ml',
    category: 'Uñas',
    price: 8.5,
    shortDescription: 'Color rosa pétalo, hasta 3 semanas',
    description: '<p>Esmalte semipermanente de secado en lámpara UV/LED. Cobertura pareja y brillo espejo.</p>',
    usageInstructions: 'Aplicar capas finas y curar cada capa en lámpara UV/LED.',
    colors: [[250, 205, 215], [229, 143, 165]],
  },
  {
    sku: 'UNA-002',
    name: 'Set de limas profesionales (6 piezas)',
    category: 'Uñas',
    price: 6,
    shortDescription: 'Distintos granos para natural y acrílico',
    description: '<p>Seis limas de diferentes granos para dar forma y pulir uñas naturales o acrílicas.</p>',
    discount: { type: 'PERCENTAGE', value: 10 },
    colors: [[242, 232, 247], [201, 177, 222]],
  },
  {
    sku: 'UNA-003',
    name: 'Aceite nutritivo para cutículas 15ml',
    category: 'Uñas',
    price: 5.5,
    shortDescription: 'Hidrata y suaviza las cutículas',
    description: '<p>Aceite con vitamina E y almendras dulces para cutículas secas y uñas quebradizas.</p>',
    usageInstructions: 'Aplicar una gota en cada uña y masajear. Usar a diario.',
    colors: [[255, 240, 224], [247, 196, 160]],
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

  if (product.discount) {
    await client.admin(`/api/admin/v1/products/${created.id}/discount`, {
      method: 'PUT',
      body: product.discount,
    });
  }

  const [top, bottom] = product.colors;
  await client.uploadImage(created.id, createGradientPng(400, top, bottom));
  await client.waitForImage(created.slug);
  console.log(`Producto "${created.name}" creado${product.discount ? ' con descuento' : ''}, con foto.`);
}

console.log('Catálogo de demostración sembrado.');
