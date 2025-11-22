import { Injectable, signal, effect } from '@angular/core';
import { ChannelInfo } from '../models/channel-info.model';

const LOCAL_STORAGE_KEY = 'youtube-seo-channel-infos';

@Injectable({
  providedIn: 'root',
})
export class ChannelInfoService {
  infos = signal<ChannelInfo[]>(this.loadFromLocalStorage());

  constructor() {
    effect(() => {
      this.saveToLocalStorage(this.infos());
    });
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (e) {
        // Fallback if crypto.randomUUID fails (non-secure context)
      }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private loadFromLocalStorage(): ChannelInfo[] {
    if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              return parsed.map((item: any) => ({
                ...item,
                id: item.id || this.generateUUID()
              })) as ChannelInfo[];
            }
          } catch (e) {
            console.error('Error parsing channel infos:', e);
            return [];
          }
        }
    }
    return this.getDefaultData();
  }

  private getDefaultData(): ChannelInfo[] {
    return [];
  }

  private saveToLocalStorage(infos: ChannelInfo[]) {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(infos));
    }
  }

  addInfo(info: Omit<ChannelInfo, 'id'>) {
    const newInfo: ChannelInfo = { ...info, id: this.generateUUID() };
    this.infos.update(infos => [...infos, newInfo]);
  }

  updateInfo(updatedInfo: ChannelInfo) {
    this.infos.update(infos =>
      infos.map(i => (i.id === updatedInfo.id ? updatedInfo : i))
    );
  }

  deleteInfo(id: string) {
    this.infos.update(infos => infos.filter(i => i.id !== id));
  }

  replaceAll(infos: ChannelInfo[]) {
    // Ensure imported data has IDs
    const sanitized = infos.map(i => ({ ...i, id: i.id || this.generateUUID() }));
    this.infos.set(sanitized);
  }
}