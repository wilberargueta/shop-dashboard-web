import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SelectionRoot } from './features/selection/selection-root/selection-root';
import { SelectionService } from './features/selection/selection.service';

@Component({
  imports: [RouterOutlet, SelectionRoot],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  /**
   * `SelectionRoot` (montado una vez aquí, hermano de `<router-outlet>`)
   * necesita saber si su panel está abierto para poner `inert` en el resto
   * de la app (PROJECT_SPEC.md §6, regla 7 del modal, aplicada igual al
   * diálogo de selección): el panel vive fuera del árbol de `<router-outlet>`,
   * así que es `App` quien puede envolverlo.
   */
  protected readonly selection = inject(SelectionService);
}
