export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  durationMs: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastService {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach(l => l(copy));
  }

  public show(options: { title: string; message?: string; type?: ToastType; durationMs?: number }): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = {
      id,
      title: options.title,
      message: options.message,
      type: options.type || 'success',
      durationMs: options.durationMs ?? 4000
    };

    // Keep max 5 toasts visible
    this.toasts = [...this.toasts.slice(-4), newItem];
    this.notify();

    if (newItem.durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, newItem.durationMs);
    }

    return id;
  }

  public success(title: string, message?: string, durationMs?: number) {
    return this.show({ title, message, type: 'success', durationMs });
  }

  public info(title: string, message?: string, durationMs?: number) {
    return this.show({ title, message, type: 'info', durationMs });
  }

  public warning(title: string, message?: string, durationMs?: number) {
    return this.show({ title, message, type: 'warning', durationMs });
  }

  public error(title: string, message?: string, durationMs?: number) {
    return this.show({ title, message, type: 'error', durationMs: durationMs ?? 6000 });
  }

  public dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  public clearAll() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastService();
