import { Component } from '@angular/core';

@Component({
  selector: 'app-skeleton-card',
  templateUrl: './skeleton-card.html',
  styleUrl: './skeleton-card.css',
  host: { 'aria-hidden': 'true' },
})
export class SkeletonCard {}
