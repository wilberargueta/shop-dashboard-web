import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WHATSAPP_SETTINGS } from '../../core/config/whatsapp-settings.token';

/** Encabezado de marca: el nombre de la tienda sale de la configuración, no de una cadena fija. */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  protected readonly storeName = inject(WHATSAPP_SETTINGS).storeName;
}
