import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { IntersectOnVisible } from './intersect-on-visible';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(): void {
    // No hace falta registrar el elemento: el test dispara trigger() a mano.
  }

  unobserve(): void {
    // Idem: no hay estado que limpiar en el fake.
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

@Component({
  selector: 'app-host',
  imports: [IntersectOnVisible],
  template: `<div appIntersectOnVisible [disabled]="disabled" (visible)="onVisible()"></div>`,
})
class HostComponent {
  disabled = false;
  visibleCount = 0;

  onVisible(): void {
    this.visibleCount++;
  }
}

describe('IntersectOnVisible', () => {
  let originalIntersectionObserver: typeof IntersectionObserver;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  it('emits visible when the observed element intersects', async () => {
    const { fixture } = await render(HostComponent);
    await fixture.whenStable();

    FakeIntersectionObserver.instances[0].trigger(true);

    expect(fixture.componentInstance.visibleCount).toBe(1);
  });

  it('does not emit while disabled', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { disabled: true } });
    await fixture.whenStable();

    FakeIntersectionObserver.instances[0].trigger(true);

    expect(fixture.componentInstance.visibleCount).toBe(0);
  });

  it('disconnects the observer when the host is destroyed', async () => {
    const { fixture } = await render(HostComponent);
    await fixture.whenStable();

    const observer = FakeIntersectionObserver.instances[0];
    fixture.destroy();

    expect(observer.disconnected).toBe(true);
  });
});
