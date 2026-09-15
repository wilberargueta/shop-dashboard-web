import { Directive, DestroyRef, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Emite `visible` cuando el elemento host entra en el viewport. El
 * `IntersectionObserver` se crea dentro de `afterNextRender`, que nunca se
 * ejecuta en el servidor — esa es la guarda de plataforma que exige
 * PROJECT_SPEC.md §8 ("solo se activa tras la hidratación"), sin necesidad
 * de comprobar `isPlatformBrowser` a mano.
 */
@Directive({
  selector: '[appIntersectOnVisible]',
})
export class IntersectOnVisible {
  readonly disabled = input(false);
  readonly visible = output<void>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const observer = new IntersectionObserver((entries) => {
        if (this.disabled()) {
          return;
        }
        if (entries.some((entry) => entry.isIntersecting)) {
          this.visible.emit();
        }
      });

      observer.observe(this.elementRef.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
