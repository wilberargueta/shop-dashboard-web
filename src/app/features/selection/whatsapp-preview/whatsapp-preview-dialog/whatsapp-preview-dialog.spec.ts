import { render, screen, fireEvent } from '@testing-library/angular';
import { AnalyticsEventService } from '../../../../core/analytics/analytics-event.service';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from '../../../../core/config/whatsapp-settings.token';
import { SITE_URL } from '../../../../core/config/site-url.token';
import { WhatsAppSelectionLine } from '../../whatsapp-template/whatsapp-template.model';
import { WhatsAppPreviewDialog } from './whatsapp-preview-dialog';

const SETTINGS: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: 'Mi Tienda',
  templates: {
    single: '{{tienda}} - {{producto}} x{{cantidad}} - {{subtotal}} - {{url}}',
    multiHeader: 'Pedido de {{tienda}}:',
    multiItem: '- {{producto}} x{{cantidad}} = {{subtotal}}',
    multiFooter: 'Total: {{total}}',
  },
};

function buildLine(overrides: Partial<WhatsAppSelectionLine> = {}): WhatsAppSelectionLine {
  return {
    name: 'Aceite esencial de lavanda 30ml',
    sku: 'ACE-001',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 20,
    currency: 'USD',
    discountPercentage: 20,
    quantity: 2,
    ...overrides,
  };
}

describe('WhatsAppPreviewDialog', () => {
  let sendWhatsAppClick: ReturnType<typeof vi.fn>;
  let windowOpen: ReturnType<typeof vi.spyOn>;
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    sendWhatsAppClick = vi.fn();
    windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
  });

  function renderDialog(inputs: Partial<{ lines: readonly WhatsAppSelectionLine[]; returnFocusTo: HTMLElement | null }> = {}) {
    return render(WhatsAppPreviewDialog, {
      inputs: { lines: [buildLine()], returnFocusTo: null, ...inputs },
      providers: [
        { provide: WHATSAPP_SETTINGS, useValue: SETTINGS },
        { provide: SITE_URL, useValue: 'http://localhost:4200' },
        { provide: AnalyticsEventService, useValue: { sendWhatsAppClick } },
      ],
    });
  }

  it('renders the dialog labelled by its heading, with the rendered message', async () => {
    await renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toContain('Vista previa');

    expect(
      screen.getByText('Mi Tienda - Aceite esencial de lavanda 30ml x2 - $40.00 - http://localhost:4200/p/aceite-esencial-de-lavanda-30ml'),
    ).toBeTruthy();
  });

  it('emits closed on Escape, on the close button and on backdrop click', async () => {
    const onClosed = vi.fn();
    const { container } = await render(WhatsAppPreviewDialog, {
      inputs: { lines: [buildLine()], returnFocusTo: null },
      providers: [
        { provide: WHATSAPP_SETTINGS, useValue: SETTINGS },
        { provide: SITE_URL, useValue: 'http://localhost:4200' },
        { provide: AnalyticsEventService, useValue: { sendWhatsAppClick } },
      ],
      on: { closed: onClosed },
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClosed).toHaveBeenCalledTimes(2);

    const backdrop = container.querySelector('.whatsapp-preview-dialog__backdrop');
    if (!backdrop) throw new Error('backdrop not found');
    fireEvent.click(backdrop);
    expect(onClosed).toHaveBeenCalledTimes(3);
  });

  it('traps focus inside the dialog on mount and returns it to the given origin on close', async () => {
    const origin = document.createElement('button');
    document.body.appendChild(origin);

    const { fixture } = await renderDialog({ returnFocusTo: origin });

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await fixture.whenStable();
    fixture.destroy();

    expect(document.activeElement).toBe(origin);
    origin.remove();
  });

  it('"Enviar" opens the correctly encoded wa.me URL', async () => {
    await renderDialog({
      lines: [buildLine({ name: 'Café & Té', quantity: 1, effectivePrice: 10 })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(windowOpen).toHaveBeenCalledTimes(1);
    const [url, target, features] = windowOpen.mock.calls[0] as [string, string, string];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(url).toContain('https://wa.me/50370000000?text=');
    expect(decodeURIComponent((url as string).split('?text=')[1])).toContain('Café & Té');
  });

  it('a failing analytics call never blocks the redirect', async () => {
    sendWhatsAppClick.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    await renderDialog();

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))).not.toThrow();
    expect(windowOpen).toHaveBeenCalledTimes(1);
  });

  it('"Copiar" copies the message without URL-encoding it', async () => {
    await renderDialog({ lines: [buildLine({ name: 'Café & Té', quantity: 1, effectivePrice: 10 })] });

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await Promise.resolve();

    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    expect(clipboardWriteText.mock.calls[0][0]).toContain('Café & Té');
    expect(clipboardWriteText.mock.calls[0][0]).not.toContain('%');
  });
});
