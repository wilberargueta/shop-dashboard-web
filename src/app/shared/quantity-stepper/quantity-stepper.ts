import { Component, computed, input, model } from '@angular/core';

let nextInstanceId = 0;

/**
 * Selector de cantidad accesible (patrón WAI-ARIA de spinner numérico): un
 * `<input type="number">` central con botones +/- a los lados. El valor del
 * input se anuncia solo a los lectores de pantalla al cambiar (no hace falta
 * `aria-live` adicional). Presentación pura, sin lógica de selección — W9
 * lo reutiliza en el panel de selección.
 */
@Component({
  selector: 'app-quantity-stepper',
  templateUrl: './quantity-stepper.html',
  styleUrl: './quantity-stepper.css',
})
export class QuantityStepper {
  readonly quantity = model(1);
  readonly min = input(1);
  readonly disabled = input(false);

  protected readonly instanceId = `quantity-stepper-${nextInstanceId++}`;
  protected readonly decrementDisabled = computed(() => this.disabled() || this.quantity() <= this.min());

  protected decrement(): void {
    if (this.decrementDisabled()) {
      return;
    }
    this.quantity.update((value) => Math.max(this.min(), value - 1));
  }

  protected increment(): void {
    if (this.disabled()) {
      return;
    }
    this.quantity.update((value) => value + 1);
  }

  protected onInputChange(event: Event): void {
    if (this.disabled()) {
      return;
    }
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    this.quantity.set(Math.max(this.min(), Math.trunc(value)));
  }
}
