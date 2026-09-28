import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AnalyticsEventService } from './analytics-event.service';

function configure(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_BASE_URL, useValue: '' },
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return TestBed.inject(AnalyticsEventService);
}

describe('AnalyticsEventService', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('does nothing on the server', () => {
    const service = configure('server');
    service.sendWhatsAppClick(2);

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a WHATSAPP_CLICK event with the product count and a session id via sendBeacon', () => {
    const service = configure('browser');
    service.sendWhatsAppClick(3, 'p1');

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('/api/public/v1/events');
    expect(blob.type).toBe('application/json');
    return blob.text().then((raw) => {
      const body = JSON.parse(raw);
      expect(body.type).toBe('WHATSAPP_CLICK');
      expect(body.productId).toBe('p1');
      expect(body.payload).toEqual({ productCount: 3 });
      expect(typeof body.sessionId).toBe('string');
      expect(body.sessionId.length).toBeGreaterThan(0);
    });
  });

  it('falls back to fetch with keepalive when sendBeacon is unavailable', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    const service = configure('browser');
    service.sendWhatsAppClick(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/public/v1/events');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
  });

  it('falls back to fetch with keepalive when sendBeacon returns false', () => {
    sendBeacon.mockReturnValue(false);
    const service = configure('browser');
    service.sendWhatsAppClick(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws, even if sendBeacon itself throws synchronously', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: () => {
        throw new Error('boom');
      },
      configurable: true,
    });
    const service = configure('browser');

    expect(() => service.sendWhatsAppClick(1)).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('swallows a rejected fetch instead of propagating it', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    fetchSpy.mockRejectedValue(new Error('network down'));
    const service = configure('browser');

    expect(() => service.sendWhatsAppClick(1)).not.toThrow();
    await Promise.resolve();
  });
});
