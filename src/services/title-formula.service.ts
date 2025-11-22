import { Injectable, signal, effect } from '@angular/core';
import { TitleFormula } from '../models/title-formula.model';

const LOCAL_STORAGE_KEY = 'youtube-seo-title-formulas';

@Injectable({
  providedIn: 'root',
})
export class TitleFormulaService {
  formulas = signal<TitleFormula[]>(this.loadFromLocalStorage());

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

  private loadFromLocalStorage(): TitleFormula[] {
    if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              return parsed.map((item: any) => ({
                ...item,
                id: item.id || this.generateUUID()
              })) as TitleFormula[];
            }
          } catch (e) {
            console.error('Error parsing title formulas:', e);
            return [];
          }
        }
    }
    return this.getDefaultData();
  }

  private getDefaultData(): TitleFormula[] {
    return [];
  }

  private saveToLocalStorage(formulas: TitleFormula[]) {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formulas));
    }
  }

  addFormula(formula: Omit<TitleFormula, 'id'>) {
    const newFormula: TitleFormula = { ...formula, id: this.generateUUID() };
    this.formulas.update(formulas => [...formulas, newFormula]);
  }

  updateFormula(updatedFormula: TitleFormula) {
    this.formulas.update(formulas =>
      formulas.map(f => (f.id === updatedFormula.id ? updatedFormula : f))
    );
  }

  deleteFormula(id: string) {
    this.formulas.update(formulas => formulas.filter(f => f.id !== id));
  }

  replaceAll(formulas: TitleFormula[]) {
    const sanitized = formulas.map(f => ({ ...f, id: f.id || this.generateUUID() }));
    this.formulas.set(sanitized);
  }
}