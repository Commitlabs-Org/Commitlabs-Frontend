export interface AddressEntry {
  address: string;
  label: string;
}

const STORAGE_KEY = 'commitlabs:address-book';

function load(): AddressEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AddressEntry[];
  } catch {}
  return [];
}

function persist(entries: AddressEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export const addressBook = {
  getAll(): AddressEntry[] {
    return load();
  },

  add(address: string, label: string): void {
    const entries = load().filter((e) => e.address !== address);
    persist([...entries, { address, label: label.trim() }]);
  },

  remove(address: string): void {
    persist(load().filter((e) => e.address !== address));
  },

  update(address: string, label: string): void {
    persist(load().map((e) => (e.address === address ? { ...e, label: label.trim() } : e)));
  },

  labelFor(address: string): string | undefined {
    return load().find((e) => e.address === address)?.label;
  },

  clear(): void {
    persist([]);
  },
};
