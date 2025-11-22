
import { Component, ChangeDetectionStrategy, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresetService } from '../../services/preset.service';
import { GeminiService } from '../../services/gemini.service';
import { MetadataResult } from '../../models/metadata-result.model';
import { ResultCardComponent } from '../result-card/result-card.component';
import { PresetManagerComponent } from '../preset-manager/preset-manager.component';
import { TitleFormulaService } from '../../services/title-formula.service';
import { DescriptionFormulaService } from '../../services/description-template.service';
import { ChannelInfoService } from '../../services/channel-info.service';
import { ToastService } from '../../services/toast.service';
import { ChevronDownIconComponent } from '../icons/chevron-down-icon.component';

// Helper for safe UUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

interface UploadedItem {
  id: string;
  file: File;
  preview: string;
  results: MetadataResult[];
  status: 'idle' | 'generating' | 'done' | 'error';
  isExpanded: boolean;
}

@Component({
  selector: 'app-metadata-generator',
  standalone: true,
  imports: [CommonModule, ResultCardComponent, PresetManagerComponent, ChevronDownIconComponent],
  templateUrl: './metadata-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataGeneratorComponent {
  presetService = inject(PresetService);
  geminiService = inject(GeminiService);
  titleFormulaService = inject(TitleFormulaService);
  descriptionFormulaService = inject(DescriptionFormulaService);
  channelInfoService = inject(ChannelInfoService);
  toastService = inject(ToastService);

  // Data signals
  presets = this.presetService.presets;
  titleFormulas = this.titleFormulaService.formulas;
  descriptionFormulas = this.descriptionFormulaService.formulas;
  channelInfos = this.channelInfoService.infos;
  
  // Selection signals
  selectedPresetId = signal<string>('');
  selectedChannelInfoId = signal<string>('');
  selectedTitleFormulaId = signal<string>('');
  selectedDescriptionFormulaId = signal<string>('');
  seoKeywords = signal<string>('');
  tracklist = signal<string>('');

  // New Image Handling
  uploadedItems = signal<UploadedItem[]>([]);
  
  // UI State signals
  globalLoading = signal(false);
  loadingStatus = signal<string | null>(null);
  showManagementModal = signal(false);
  isDraggingOver = signal(false);

  // Computed signal for channel info
  selectedChannelInfo = computed(() => {
    const infoId = this.selectedChannelInfoId();
    if (!infoId) return null;
    return this.channelInfos().find(i => i.id === infoId) ?? null;
  });
  
  constructor() {
    // Effect to sync dropdowns when a preset is selected
    effect(() => {
      const presetId = this.selectedPresetId();
      if (presetId) {
        const preset = this.presets().find(p => p.id === presetId);
        if (preset) {
          this.selectedTitleFormulaId.set(preset.titleFormulaId);
          this.selectedDescriptionFormulaId.set(preset.descriptionFormulaId);
          this.selectedChannelInfoId.set(preset.channelInfoId);
        }
      }
    });
  }
  
  private handleFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;

    const newItems: UploadedItem[] = [];
    
    Array.from(fileList).forEach(file => {
      if (!file.type.startsWith('image/')) {
        this.toastService.warning(`Bỏ qua tệp không phải ảnh: ${file.name}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedItems.update(items => [
          ...items, 
          {
            id: generateUUID(),
            file: file,
            preview: reader.result as string,
            results: [],
            status: 'idle',
            isExpanded: true // Automatically expand new items
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(input.files);
    input.value = ''; 
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    this.handleFiles(event.dataTransfer?.files || null);
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    
    // Mock FileList object
    if (files.length > 0) {
      event.preventDefault();
       // Manually handle since we can't easily construct a FileList
       files.forEach(file => {
          const reader = new FileReader();
          reader.onload = () => {
            this.uploadedItems.update(currentItems => [
              ...currentItems, 
              {
                id: generateUUID(),
                file: file,
                preview: reader.result as string,
                results: [],
                status: 'idle',
                isExpanded: true
              }
            ]);
          };
          reader.readAsDataURL(file);
       });
    }
  }

  removeItem(id: string, event: Event): void {
    event.stopPropagation();
    this.uploadedItems.update(items => items.filter(item => item.id !== id));
  }
  
  toggleItemExpand(id: string) {
    this.uploadedItems.update(items => 
      items.map(item => item.id === id ? { ...item, isExpanded: !item.isExpanded } : item)
    );
  }

  onPresetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPresetId.set(select.value);
  }

  onChannelInfoChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedChannelInfoId.set(select.value);
    this.selectedPresetId.set(''); 
  }

  onTitleFormulaChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTitleFormulaId.set(select.value);
    this.selectedPresetId.set('');
  }

  onDescriptionFormulaChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDescriptionFormulaId.set(select.value);
    this.selectedPresetId.set(''); 
  }

  onKeywordsChange(event: Event): void {
    this.seoKeywords.set((event.target as HTMLTextAreaElement).value);
  }

  onTracklistChange(event: Event): void {
    this.tracklist.set((event.target as HTMLTextAreaElement).value);
  }

  isGenerationDisabled(): boolean {
    return this.uploadedItems().length === 0 || !this.selectedTitleFormulaId() || !this.selectedDescriptionFormulaId() || !this.selectedChannelInfoId();
  }

  async generateMetadata(): Promise<void> {
    if (this.isGenerationDisabled() || this.globalLoading()) return;

    this.globalLoading.set(true);
    this.loadingStatus.set('Đang chuẩn bị...');

    const titleFormula = this.titleFormulas().find(f => f.id === this.selectedTitleFormulaId());
    const descriptionFormula = this.descriptionFormulas().find(t => t.id === this.selectedDescriptionFormulaId());
    const channelInfo = this.selectedChannelInfo();
    const keywords = this.seoKeywords();
    const tracklistValue = this.tracklist();

    if (!titleFormula || !descriptionFormula || !channelInfo) {
      this.toastService.error('Thiếu thông tin cấu hình.');
      this.globalLoading.set(false);
      return;
    }

    const itemsToProcess = this.uploadedItems(); // Process all, or filter for specific status if needed

    try {
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        
        // Update status to generating
        this.updateItemStatus(item.id, 'generating');
        this.loadingStatus.set(`Đang xử lý ảnh ${i + 1} / ${itemsToProcess.length}: ${item.file.name}`);

        try {
          const base64 = await this.fileToBase64(item.file);
          const results: MetadataResult[] = [];
          
          // Generate 5 variations strictly
          for (let j = 0; j < 5; j++) {
            const result = await this.geminiService.generateMetadata(
              base64, 
              titleFormula.instruction, 
              descriptionFormula.template, 
              descriptionFormula.example, 
              channelInfo, 
              keywords, 
              tracklistValue, 
              j
            );
            results.push(result);
          }

          this.uploadedItems.update(current => 
            current.map(curr => curr.id === item.id ? { ...curr, results, status: 'done', isExpanded: true } : curr)
          );

        } catch (error) {
          console.error(`Error processing ${item.file.name}`, error);
          this.updateItemStatus(item.id, 'error');
        }
      }
      
      this.toastService.success('Đã hoàn tất quá trình tạo Metadata!');
    } catch (err) {
      console.error(err);
      this.toastService.error('Đã xảy ra lỗi chung.');
    } finally {
      this.globalLoading.set(false);
      this.loadingStatus.set(null);
    }
  }
  
  private updateItemStatus(id: string, status: UploadedItem['status']) {
    this.uploadedItems.update(items => 
      items.map(item => item.id === id ? { ...item, status } : item)
    );
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultStr = reader.result as string;
        resolve(resultStr.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  }
}
