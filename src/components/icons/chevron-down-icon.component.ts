
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-chevron-down-icon',
  standalone: true,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChevronDownIconComponent {}
