import { Routes } from '@angular/router';
import { CatalogPage } from './features/catalog/catalog-page/catalog-page';

export const routes: Routes = [
  { path: '', component: CatalogPage },
  {
    path: 'p/:slug',
    loadComponent: () =>
      import('./features/product/product-detail-page/product-detail-page').then((m) => m.ProductDetailPage),
  },
];
