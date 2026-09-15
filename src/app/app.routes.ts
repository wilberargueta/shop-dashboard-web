import { Routes } from '@angular/router';
import { CatalogPage } from './features/catalog/catalog-page/catalog-page';
import { ProductDetailPage } from './features/product/product-detail-page/product-detail-page';

export const routes: Routes = [
  { path: '', component: CatalogPage },
  { path: 'p/:slug', component: ProductDetailPage },
];
