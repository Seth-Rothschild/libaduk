import { browser } from '$app/environment';

class Notifications {
  items = $state([]);
  unreadCount = $state(0);

  async refresh() {
    if (!browser) return;
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    this.items = await res.json();
    this.unreadCount = this.items.filter((n) => !n.read).length;
  }

  add(notification) {
    this.items = [notification, ...this.items];
    this.unreadCount++;
  }

  async markAllRead() {
    if (this.unreadCount === 0) return;
    this.items = this.items.map((n) => (n.read ? n : { ...n, read: true }));
    this.unreadCount = 0;
    await fetch('/api/notifications/read', { method: 'POST' });
  }

  async clear() {
    this.items = [];
    this.unreadCount = 0;
    await fetch('/api/notifications/clear', { method: 'POST' });
  }
}

export const notifications = new Notifications();
