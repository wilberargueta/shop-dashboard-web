import { Component } from '@angular/core';

@Component({
  selector: 'app-product-detail-skeleton',
  templateUrl: './product-detail-skeleton.html',
  styleUrl: './product-detail-skeleton.css',
  host: { 'aria-hidden': 'true' },
})
export class ProductDetailSkeleton {}
