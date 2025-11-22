
import { Component, ChangeDetectionStrategy, signal, inject, output, OnInit, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PresetService } from '../../services/preset.service';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { Preset } from '../../models/preset.model';
import { TrashIconComponent } from '../icons/trash-icon.component';
import { PencilIconComponent } from '../icons/pencil-icon.component';
import { TitleFormulaService } from '../../services/title-formula.service';
import { DescriptionFormulaService } from '../../services/description-template.service';
import { TitleFormula } from '../../models/title-formula.model';
import { DescriptionFormula } from '../../models/description-template.model';
import { ChannelInfoService } from '../../services/channel-info.service';
import { ChannelInfo, Playlist } from '../../models/channel-info.model';

const LAST_BACKUP_TIMESTAMP_KEY = 'youtube-seo-last-backup-timestamp';
const LAST_BACKUP_HASH_KEY = 'youtube-seo-last-backup-hash';

type ActiveTab = 'presets' | 'channels' | 'formulas' | 'descriptionFormulas' | 'import_export';

// Helper for UUID generation (safe for all contexts)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface ImportData {
  presets: Preset[];
  channelInfos: ChannelInfo[];
  titleFormulas: TitleFormula[];
  descriptionFormulas: DescriptionFormula[];
}

@Component({
  selector: 'app-preset-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TrashIconComponent, PencilIconComponent],
  templateUrl: './preset-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresetManagerComponent implements OnInit {
  presetService = inject(PresetService);
  titleFormulaService = inject(TitleFormulaService);
  descriptionFormulaService = inject(DescriptionFormulaService);
  channelInfoService = inject(ChannelInfoService);
  geminiService = inject(GeminiService);
  toastService = inject(ToastService);

  closeModal = output<void>();

  // Data signals
  presets = this.presetService.presets;
  titleFormulas = this.titleFormulaService.formulas;
  descriptionFormulas = this.descriptionFormulaService.formulas;
  channelInfos = this.channelInfoService.infos;

  // UI State
  activeTab = signal<ActiveTab>('presets');
  isAnalyzingTitles = signal(false);
  isAnalyzingDescription = signal(false);
  isDraggingOver = signal(false);
  animationState = signal<'entering' | 'entered' | 'leaving'>('entering');
  deletingId = signal<string | null>(null);
  
  // Import/Export state
  lastBackupDate = signal<Date | null>(null);
  hasUnsavedChanges = signal<boolean>(false);
  
  // New Import Flow State
  importFile = signal<File | null>(null);
  importPreviewData = signal<ImportData | null>(null);
  importError = signal<string | null>(null);
  
  // Computeds for Import Preview
  importCounts = computed(() => {
    const data = this.importPreviewData();
    if (!data) return null;
    return {
      presets: data.presets.length,
      channels: data.channelInfos.length,
      titles: data.titleFormulas.length,
      descriptions: data.descriptionFormulas.length,
      total: data.presets.length + data.channelInfos.length + data.titleFormulas.length + data.descriptionFormulas.length
    };
  });

  private isMouseDownOnBackdrop = false;

  // Editing state signals
  editingPreset = signal<Preset | null>(null);
  presetForm = signal<Preset>({ id: '', name: '', titleFormulaId: '', descriptionFormulaId: '', channelInfoId: '' });

  editingFormula = signal<TitleFormula | null>(null);
  formulaForm = signal<TitleFormula>({ id: '', name: '', instruction: '' });
  titleAnalysisFiles = signal<File[]>([]);
  rawTitlesInput = signal<string>('');
  isAnalysisDisabled = computed(() => {
    return (this.titleAnalysisFiles().length === 0 && this.rawTitlesInput().trim() === '') || this.isAnalyzingTitles();
  });

  editingDescriptionFormula = signal<DescriptionFormula | null>(null);
  descriptionFormulaForm = signal<DescriptionFormula>({ id: '', name: '', template: '', example: '' });
  rawDescriptionInput = signal<string>('');
  
  editingChannelInfo = signal<ChannelInfo | null>(null);
  channelInfoForm = signal<ChannelInfo>({ id: '', profileName: '', channelName: '', channelLink: '', playlists: [], shortDescription: '', channelTags: '' });

  constructor() {
      effect(() => {
          this.checkForUnsavedChanges();
      });

      effect(() => {
        this.activeTab();
        untracked(() => this.deletingId.set(null));
      });
  }

  ngOnInit() {
    setTimeout(() => this.animationState.set('entered'), 10);
  }

  close() {
    this.animationState.set('leaving');
    setTimeout(() => {
      this.closeModal.emit();
    }, 300);
  }

  onBackdropMousedown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.isMouseDownOnBackdrop = true;
    }
  }

  onBackdropMouseup(event: MouseEvent): void {
    if (this.isMouseDownOnBackdrop && event.target === event.currentTarget) {
      this.close();
    }
    this.isMouseDownOnBackdrop = false;
  }

  // --- Common Delete UI Logic ---
  initiateDelete(event: Event, id: string) {
    event.stopPropagation();
    this.deletingId.set(id);
  }

  cancelDelete(event: Event) {
    event.stopPropagation();
    this.deletingId.set(null);
  }

  // --- Preset Methods ---
  openPresetModal(preset: Preset | null = null) {
    if (preset) {
      this.presetForm.set({ ...preset });
    } else {
      this.presetForm.set({ id: '', name: '', titleFormulaId: this.titleFormulas()[0]?.id ?? '', descriptionFormulaId: this.descriptionFormulas()[0]?.id ?? '', channelInfoId: this.channelInfos()[0]?.id ?? '' });
    }
    this.editingPreset.set(this.presetForm());
  }

  savePreset() {
    const formValue = this.presetForm();
    if (formValue.id) {
      this.presetService.updatePreset(formValue);
      this.toastService.success('Đã cập nhật Preset thành công');
    } else {
      this.presetService.addPreset(formValue);
      this.toastService.success('Đã thêm Preset mới thành công');
    }
    this.editingPreset.set(null);
  }

  initiateDeletePreset(event: Event, id: string) {
    this.initiateDelete(event, id);
  }

  confirmDeletePreset(event: Event) {
    event.stopPropagation();
    const id = this.deletingId();
    if (id) {
      this.presetService.deletePreset(id);
      this.toastService.success('Đã xóa Preset thành công');
      this.deletingId.set(null);
    }
  }

  // --- Channel Info Methods ---
  openChannelInfoModal(info: ChannelInfo | null = null) {
    if (info) {
      const infoCopy = JSON.parse(JSON.stringify(info));
      this.channelInfoForm.set({ channelTags: '', ...infoCopy });
    } else {
      this.channelInfoForm.set({ id: '', profileName: '', channelName: '', channelLink: '', spotifyLink: '', contactEmail: '', playlists: [], shortDescription: '', channelTags: '' });
    }
    this.editingChannelInfo.set(this.channelInfoForm());
  }

  private extractYouTubeIdentifier(input: string): string | null {
    if (!input) return null;
    const trimmedInput = input.trim();
    const urlPattern = /(?:youtube\.com\/(?:@|channel\/|c\/|user\/))([a-zA-Z0-9_.-]+)/;
    const urlMatch = trimmedInput.match(urlPattern);
    if (urlMatch && urlMatch[1]) {
      const identifier = urlMatch[1];
      return `@${identifier.replace(/^@/, '')}`;
    }
    const standalonePattern = /^([@a-zA-Z0-9_.-]+)$/;
    const standaloneMatch = trimmedInput.match(standalonePattern);
    if (standaloneMatch && standaloneMatch[1]) {
      let identifier = standaloneMatch[1];
      if (identifier.startsWith('@')) {
        return identifier;
      }
      return `@${identifier}`;
    }
    return null;
  }

  saveChannelInfo() {
    const formValue = this.channelInfoForm();
    if (!formValue.profileName || !formValue.channelName || !formValue.channelLink) {
      this.toastService.warning('Tên hồ sơ, Tên kênh và Link kênh là bắt buộc.');
      return;
    }

    const identifier = this.extractYouTubeIdentifier(formValue.channelLink);
    if (!identifier) {
      this.toastService.warning('Link kênh YouTube không hợp lệ.');
      return;
    }

    if (formValue.channelLink.includes('?sub_confirmation=1')) {
      // It's already formatted
    } else {
       formValue.channelLink = `https://www.youtube.com/${identifier}?sub_confirmation=1`;
    }

    if (formValue.id) {
      this.channelInfoService.updateInfo(formValue);
      this.toastService.success('Cập nhật thông tin kênh thành công');
    } else {
      this.channelInfoService.addInfo(formValue);
      this.toastService.success('Thêm thông tin kênh thành công');
    }
    this.editingChannelInfo.set(null);
  }

  initiateDeleteChannelInfo(event: Event, id: string) {
    event.stopPropagation();
    
    const presetsUsingInfo = this.presets().filter(p => p.channelInfoId === id);
    if (presetsUsingInfo.length > 0) {
      const presetNames = presetsUsingInfo.map(p => p.name).join(', ');
      this.toastService.error(`Không thể xóa vì đang được dùng bởi preset: ${presetNames}`);
      return;
    }

    this.deletingId.set(id);
  }

  confirmDeleteChannelInfo(event: Event) {
    event.stopPropagation();
    const id = this.deletingId();
    if (id) {
      this.channelInfoService.deleteInfo(id);
      this.toastService.success('Đã xóa hồ sơ kênh');
      this.deletingId.set(null);
    }
  }

  addPlaylist() {
    this.channelInfoForm.update(form => {
      if (!form.playlists) {
        form.playlists = [];
      }
      if (form.playlists.length < 5) {
        form.playlists.push({ name: '', link: '' });
      }
      return { ...form };
    });
  }

  removePlaylist(index: number) {
    this.channelInfoForm.update(form => {
      form.playlists?.splice(index, 1);
      return { ...form };
    });
  }

  // --- Title Formula Methods ---
  openFormulaModal(formula: TitleFormula | null = null) {
    this.titleAnalysisFiles.set([]);
    this.rawTitlesInput.set('');
    if (formula) {
      this.formulaForm.set({ ...formula });
    } else {
      this.formulaForm.set({ id: '', name: '', instruction: '' });
    }
    this.editingFormula.set(this.formulaForm());
  }

  saveFormula() {
    const formValue = this.formulaForm();
    if (!formValue.name || !formValue.instruction) {
      this.toastService.warning('Vui lòng phân tích hoặc điền đầy đủ thông tin.');
      return;
    }
    if (formValue.id) {
      this.titleFormulaService.updateFormula(formValue);
      this.toastService.success('Đã cập nhật công thức tiêu đề');
    } else {
      this.titleFormulaService.addFormula(formValue);
      this.toastService.success('Đã thêm công thức tiêu đề');
    }
    this.editingFormula.set(null);
  }

  initiateDeleteFormula(event: Event, id: string) {
    event.stopPropagation();
    
    const presetsUsingFormula = this.presets().filter(p => p.titleFormulaId === id);
    if (presetsUsingFormula.length > 0) {
      const presetNames = presetsUsingFormula.map(p => p.name).join(', ');
      this.toastService.error(`Không thể xóa vì đang được dùng bởi preset: ${presetNames}`);
      return;
    }

    this.deletingId.set(id);
  }

  confirmDeleteFormula(event: Event) {
    event.stopPropagation();
    const id = this.deletingId();
    if (id) {
      this.titleFormulaService.deleteFormula(id);
      this.toastService.success('Đã xóa công thức tiêu đề');
      this.deletingId.set(null);
    }
  }
  
  handleTitleFilesSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.titleAnalysisFiles.set(Array.from(input.files).filter(file => file.type === 'text/plain'));
    }
    input.value = ''; 
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files).filter(file => file.type === 'text/plain');
      if(files.length > 0) {
        this.titleAnalysisFiles.set(files);
      }
    }
  }

  removeFile(fileToRemove: File) {
    this.titleAnalysisFiles.update(files => files.filter(f => f !== fileToRemove));
  }

  async analyzeTitles() {
    const files = this.titleAnalysisFiles();
    const rawTitles = this.rawTitlesInput();

    if (files.length === 0 && !rawTitles.trim()) return;

    this.isAnalyzingTitles.set(true);
    try {
      let combinedText = '';
      if (rawTitles.trim()) {
        combinedText = rawTitles;
      } else {
        const fileContents = await Promise.all(
          files.map(file => file.text())
        );
        combinedText = fileContents.join('\n---\n');
      }
      
      const result = await this.geminiService.generateTitleFormulaFromExamples(combinedText);
      this.formulaForm.update(form => ({ 
        ...form, 
        name: result.name,
        instruction: result.instruction 
      }));
      this.titleAnalysisFiles.set([]); 
      this.rawTitlesInput.set('');
      this.toastService.success('Phân tích tiêu đề hoàn tất!');
    } catch (error) {
      console.error(error);
      this.toastService.error('Lỗi phân tích tiêu đề.');
    } finally {
      this.isAnalyzingTitles.set(false);
    }
  }

  // --- Description Formula Methods ---
  openDescriptionFormulaModal(formula: DescriptionFormula | null = null) {
    this.rawDescriptionInput.set('');
    if (formula) {
      this.descriptionFormulaForm.set({ ...formula, example: formula.example || '' });
    } else {
      this.descriptionFormulaForm.set({ id: '', name: '', template: '', example: '' });
    }
    this.editingDescriptionFormula.set(this.descriptionFormulaForm());
  }

  async analyzeDescription() {
    const rawDescription = this.rawDescriptionInput();
    if (!rawDescription) return;

    this.isAnalyzingDescription.set(true);
    try {
      const result = await this.geminiService.generateDescriptionFormulaFromExample(rawDescription);
      this.descriptionFormulaForm.update(form => ({
        ...form,
        name: result.name,
        template: result.template,
        example: rawDescription, 
      }));
      this.toastService.success('Phân tích mô tả hoàn tất!');
    } catch (error) {
      console.error(error);
      this.toastService.error('Lỗi phân tích mô tả.');
    } finally {
      this.isAnalyzingDescription.set(false);
    }
  }

  saveDescriptionFormula() {
    const formValue = this.descriptionFormulaForm();
    if (formValue.id) {
      this.descriptionFormulaService.updateFormula(formValue);
      this.toastService.success('Đã cập nhật công thức mô tả');
    } else {
      this.descriptionFormulaService.addFormula(formValue);
      this.toastService.success('Đã thêm công thức mô tả');
    }
    this.editingDescriptionFormula.set(null);
  }

  initiateDeleteDescriptionFormula(event: Event, id: string) {
    event.stopPropagation();
    
    const presetsUsingFormula = this.presets().filter(p => p.descriptionFormulaId === id);
    if (presetsUsingFormula.length > 0) {
      const presetNames = presetsUsingFormula.map(p => p.name).join(', ');
      this.toastService.error(`Không thể xóa vì đang được dùng bởi preset: ${presetNames}`);
      return;
    }

    this.deletingId.set(id);
  }

  confirmDeleteDescriptionFormula(event: Event) {
    event.stopPropagation();
    const id = this.deletingId();
    if (id) {
      this.descriptionFormulaService.deleteFormula(id);
      this.toastService.success('Đã xóa công thức mô tả');
      this.deletingId.set(null);
    }
  }

  // --- Import/Export Methods ---
  private calculateCurrentDataHash(): string {
    const dataToHash = {
      presets: this.presets(),
      channelInfos: this.channelInfos(),
      titleFormulas: this.titleFormulas(),
      descriptionFormulas: this.descriptionFormulas(),
    };
    const dataString = JSON.stringify(dataToHash);
    if (dataString.length === 0) {
        return '0';
    }
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash | 0; 
    }
    return hash.toString();
  }

  private checkForUnsavedChanges() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const timestampStr = localStorage.getItem(LAST_BACKUP_TIMESTAMP_KEY);
    const savedHash = localStorage.getItem(LAST_BACKUP_HASH_KEY);

    if (timestampStr) {
        this.lastBackupDate.set(new Date(parseInt(timestampStr, 10)));
    } else {
        this.lastBackupDate.set(null);
    }

    const currentHash = this.calculateCurrentDataHash();
    const hasData = this.presets().length > 0 || this.channelInfos().length > 0 || this.titleFormulas().length > 0 || this.descriptionFormulas().length > 0;
    
    if (!savedHash && hasData) {
        this.hasUnsavedChanges.set(true);
    } else {
        this.hasUnsavedChanges.set(currentHash !== savedHash);
    }
  }

  private updateBackupStatus() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const currentHash = this.calculateCurrentDataHash();
      const timestamp = Date.now().toString();

      localStorage.setItem(LAST_BACKUP_TIMESTAMP_KEY, timestamp);
      localStorage.setItem(LAST_BACKUP_HASH_KEY, currentHash);
      
      this.lastBackupDate.set(new Date(parseInt(timestamp, 10)));
      this.hasUnsavedChanges.set(false);
  }
  
  exportAllData() {
    const dataToExport = {
      presets: this.presets(),
      channelInfos: this.channelInfos(),
      titleFormulas: this.titleFormulas(),
      descriptionFormulas: this.descriptionFormulas(),
    };

    const blob = new Blob([JSON.stringify(dataToExport)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `youtube-seo-optimizer-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.updateBackupStatus();
    this.toastService.success('Đã tải xuống bản sao lưu!');
  }

  // --- NEW IMPORT LOGIC ---

  async onFileSelectedForImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    this.importFile.set(file);
    this.importError.set(null);
    this.importPreviewData.set(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error("Định dạng JSON không hợp lệ.");
      }
      
      const presets = Array.isArray(data.presets) ? data.presets : [];
      const channelInfos = Array.isArray(data.channelInfos) ? data.channelInfos : [];
      const titleFormulas = Array.isArray(data.titleFormulas) ? data.titleFormulas : [];
      const descriptionFormulas = Array.isArray(data.descriptionFormulas) ? data.descriptionFormulas : [];

      const total = presets.length + channelInfos.length + titleFormulas.length + descriptionFormulas.length;

      if (total === 0) {
         throw new Error("Tệp không chứa dữ liệu hợp lệ.");
      }

      this.importPreviewData.set({
        presets,
        channelInfos,
        titleFormulas,
        descriptionFormulas
      });

    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : "Lỗi không xác định khi đọc tệp.");
      this.importPreviewData.set(null);
    } finally {
      input.value = ''; 
    }
  }

  // Methods to remove items from preview
  removeImportItem(type: keyof ImportData, index: number) {
    this.importPreviewData.update(data => {
      if (!data) return null;
      const newData = { ...data };
      const array = [...newData[type]];
      array.splice(index, 1);
      newData[type] = array as any; // TypeScript cast simplification
      return newData;
    });
  }

  cancelImport() {
    this.importFile.set(null);
    this.importPreviewData.set(null);
    this.importError.set(null);
  }

  executeImport() {
    const data = this.importPreviewData();
    if (!data) return;

    this.mergeData(data);
    
    this.updateBackupStatus();
    this.cancelImport(); 
    this.activeTab.set('presets'); 
  }

  private mergeData(data: ImportData) {
    const importedChannelInfos = data.channelInfos;
    const importedTitleFormulas = data.titleFormulas;
    const importedDescriptionFormulas = data.descriptionFormulas;
    const importedPresets = data.presets;

    const idMap = new Map<string, string>();
      
    const newChannelInfos: ChannelInfo[] = [];
    const newTitleFormulas: TitleFormula[] = [];
    const newDescriptionFormulas: DescriptionFormula[] = [];
    const newPresets: Preset[] = [];

    // 1. Remap Dependencies
    importedChannelInfos.forEach((info) => {
      const newId = generateUUID();
      if (info.id) idMap.set(info.id, newId);
      newChannelInfos.push({ ...info, id: newId });
    });

    importedTitleFormulas.forEach((formula) => {
      const newId = generateUUID();
      if (formula.id) idMap.set(formula.id, newId);
      newTitleFormulas.push({ ...formula, id: newId });
    });

    importedDescriptionFormulas.forEach((formula) => {
      const newId = generateUUID();
      if (formula.id) idMap.set(formula.id, newId);
      newDescriptionFormulas.push({ ...formula, id: newId });
    });
    
    // 2. Remap Presets
    importedPresets.forEach((preset) => {
      newPresets.push({
          ...preset,
          id: generateUUID(),
          channelInfoId: idMap.get(preset.channelInfoId) ?? preset.channelInfoId,
          titleFormulaId: idMap.get(preset.titleFormulaId) ?? preset.titleFormulaId,
          descriptionFormulaId: idMap.get(preset.descriptionFormulaId) ?? preset.descriptionFormulaId
      });
    });

    // 3. Update State
    if (newChannelInfos.length) this.channelInfoService.infos.update(c => [...c, ...newChannelInfos]);
    if (newTitleFormulas.length) this.titleFormulaService.formulas.update(c => [...c, ...newTitleFormulas]);
    if (newDescriptionFormulas.length) this.descriptionFormulaService.formulas.update(c => [...c, ...newDescriptionFormulas]);
    if (newPresets.length) this.presetService.presets.update(c => [...c, ...newPresets]);

    this.toastService.success(`Đã nhập thành công: ${newPresets.length} Presets, ${newChannelInfos.length} Kênh, ${newTitleFormulas.length + newDescriptionFormulas.length} Công thức.`);
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }
}
