import { Directive, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Atrapa el foco dentro del host mientras está activa: enfoca el primer
 * elemento enfocable al montarse (`afterNextRender`, nunca en servidor),
 * cicla `Tab`/`Shift+Tab` dentro de los elementos enfocables del host, y
 * devuelve el foco a `returnFocusTo` al destruirse. No maneja `Escape`:
 * cerrar el diálogo que la usa es decisión de cada host.
 */
@Directive({
  selector: '[appFocusTrap]',
})
export class FocusTrap {
  readonly returnFocusTo = input<HTMLElement | null>(null);

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.focusFirst();

      const host = this.elementRef.nativeElement;
      const onKeydown = (event: KeyboardEvent): void => this.handleKeydown(event);
      host.addEventListener('keydown', onKeydown);

      this.destroyRef.onDestroy(() => {
        host.removeEventListener('keydown', onKeydown);
        this.returnFocusTo()?.focus();
      });
    });
  }

  private focusFirst(): void {
    this.focusableElements()[0]?.focus();
  }

  private focusableElements(): HTMLElement[] {
    const elements = this.elementRef.nativeElement.querySelectorAll(FOCUSABLE_SELECTOR);
    return Array.from(elements) as HTMLElement[];
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.elementRef.nativeElement.ownerDocument.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
