
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MetadataGeneratorComponent } from './components/metadata-generator/metadata-generator.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetadataGeneratorComponent, ToastComponent]
})
export class AppComponent {}
