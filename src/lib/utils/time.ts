export function buildWholeHours(): {label: string; value: string}[] {
  return Array.from({ length: 24 }, (_, h) => {
    const label = new Date(0, 0, 0, h).toLocaleTimeString([], { hour: 'numeric' });
    const value = `${String(h).padStart(2, '0')}:00`;
    return { label, value };
  });
}