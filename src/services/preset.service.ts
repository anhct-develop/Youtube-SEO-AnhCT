import { Injectable, signal, effect } from '@angular/core';
import { Preset } from '../models/preset.model';

const LOCAL_STORAGE_KEY = 'youtube-seo-presets';

@Injectable({
  providedIn: 'root',
})
export class PresetService {
  presets = signal<Preset[]>(this.loadFromLocalStorage());

  constructor() {
    effect(() => {
      this.saveToLocalStorage(this.presets());
    });
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (e) {
        // Fallback if crypto.randomUUID fails
      }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private loadFromLocalStorage(): Preset[] {
    if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              // Ensure every preset has an ID (Patch fix for legacy data)
              // Force ID to be a string to match delete logic
              return parsed.map((p: any) => ({
                ...p,
                id: String(p.id || this.generateUUID())
              })) as Preset[];
            }
          } catch (error) {
            console.error('Error parsing presets from local storage:', error);
            return [];
          }
        }
    }
    return this.getDefaultData();
  }

  private getDefaultData(): Preset[] {
    return [];
  }

  private saveToLocalStorage(presets: Preset[]) {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(presets));
    }
  }

  addPreset(preset: Omit<Preset, 'id'>) {
    const newPreset: Preset = { ...preset, id: this.generateUUID() };
    this.presets.update(presets => [...presets, newPreset]);
  }

  updatePreset(updatedPreset: Preset) {
    this.presets.update(presets =>
      presets.map(p => (p.id === updatedPreset.id ? updatedPreset : p))
    );
  }

  deletePreset(id: string) {
    // Use String() comparison to be safe against type mismatches in legacy data
    this.presets.update(presets => presets.filter(p => String(p.id) !== String(id)));
  }

  replaceAll(presets: Preset[]) {
    const sanitized = presets.map(p => ({ ...p, id: String(p.id || this.generateUUID()) }));
    this.presets.set(sanitized);
  }
}