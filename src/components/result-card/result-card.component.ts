
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetadataResult } from '../../models/metadata-result.model';
import { ClipboardIconComponent } from '../icons/clipboard-icon.component';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [CommonModule, ClipboardIconComponent],
  templateUrl: './result-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block'
  }
})
export class ResultCardComponent {
  result = input.required<MetadataResult>();
  index = input.required<number>();
  thumbnailUrl = input.required<string>();

  unquotedPinnedComment = computed(() => {
    const comment = this.result().pinnedComment;
    if (comment.startsWith('"') && comment.endsWith('"')) {
      return comment.slice(1, -1);
    }
    return comment;
  });

  copyToClipboard(text: string | string[], element: HTMLElement) {
    const textToCopy = Array.isArray(text) ? text.join(', ') : text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalHTML = element.innerHTML;
      element.innerText = 'Đã sao chép!';
      setTimeout(() => {
        element.innerHTML = originalHTML;
      }, 1500);
    });
  }
}
