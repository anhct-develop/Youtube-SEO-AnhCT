import { Injectable, signal, effect } from '@angular/core';
import { DescriptionFormula } from '../models/description-template.model';

const LOCAL_STORAGE_KEY = 'youtube-seo-description-formulas';

@Injectable({
  providedIn: 'root',
})
export class DescriptionFormulaService {
  formulas = signal<DescriptionFormula[]>(this.loadFromLocalStorage());

  constructor() {
    effect(() => {
      this.saveToLocalStorage(this.formulas());
    });
  }

  private generateUUID(): string {
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

  private loadFromLocalStorage(): DescriptionFormula[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            return parsed.map((item: any) => ({
              ...item,
              id: item.id || this.generateUUID()
            })) as DescriptionFormula[];
          }
        } catch (e) {
           console.error('Error parsing description formulas:', e);
           return [];
        }
      }
    }
    return this.getDefaultData();
  }

  private getDefaultData(): DescriptionFormula[] {
    return [];
  }

  private saveToLocalStorage(formulas: DescriptionFormula[]) {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formulas));
    }
  }

  addFormula(formula: Omit<DescriptionFormula, 'id'>) {
    const newFormula: DescriptionFormula = { ...formula, id: this.generateUUID() };
    this.formulas.update(formulas => [...formulas, newFormula]);
  }

  updateFormula(updatedFormula: DescriptionFormula) {
    this.formulas.update(formulas =>
      formulas.map(t => (t.id === updatedFormula.id ? updatedFormula : t))
    );
  }

  deleteFormula(id: string) {
    this.formulas.update(formulas => formulas.filter(t => t.id !== id));
  }

  replaceAll(formulas: DescriptionFormula[]) {
    const sanitized = formulas.map(f => ({ ...f, id: f.id || this.generateUUID() }));
    this.formulas.set(sanitized);
  }
}