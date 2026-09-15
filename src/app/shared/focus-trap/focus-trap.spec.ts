import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { FocusTrap } from './focus-trap';

@Component({
  selector: 'app-host',
  imports: [FocusTrap],
  template: `
    <button type="button" id="outside">Fuera</button>
    <div appFocusTrap [returnFocusTo]="returnTo ? outsideButton() : null">
      <button type="button" id="first">Primero</button>
      <button type="button" id="last">Último</button>
    </div>
  `,
})
class HostComponent {
  returnTo = false;

  outsideButton(): HTMLElement {
    return document.getElementById('outside') as HTMLElement;
  }
}

function dispatchTab(options: { shiftKey?: boolean } = {}): void {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: !!options.shiftKey, bubbles: true });
  document.activeElement?.dispatchEvent(event);
}

describe('FocusTrap', () => {
  it('focuses the first focusable element inside the host on render', async () => {
    await render(HostComponent);

    expect(document.activeElement?.id).toBe('first');
  });

  it('wraps focus from the last element to the first on Tab', async () => {
    const { fixture } = await render(HostComponent);
    (document.getElementById('last') as HTMLElement).focus();

    dispatchTab();
    fixture.detectChanges();

    expect(document.activeElement?.id).toBe('first');
  });

  it('wraps focus from the first element to the last on Shift+Tab', async () => {
    await render(HostComponent);
    (document.getElementById('first') as HTMLElement).focus();

    dispatchTab({ shiftKey: true });

    expect(document.activeElement?.id).toBe('last');
  });

  it('returns focus to returnFocusTo when the host is destroyed', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { returnTo: true } });
    await fixture.whenStable();

    fixture.destroy();

    expect(document.activeElement?.id).toBe('outside');
  });
});
