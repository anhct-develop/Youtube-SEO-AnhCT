
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-pencil-icon',
  standalone: true,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PencilIconComponent {}
