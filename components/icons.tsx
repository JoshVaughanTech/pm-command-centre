export const TLIcon = {
  plus: (size = 16) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  send: (size = 16) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2L2 7l5 2 2 5z" />
    </svg>
  ),
  refresh: (size = 16) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a5 5 0 018.5-3.5L13 6M13 3v3h-3" />
      <path d="M13 8a5 5 0 01-8.5 3.5L3 10M3 13v-3h3" />
    </svg>
  ),
  spark: (size = 16) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.3 4.3L13.5 6l-4.2 1.3L8 11.5 6.7 7.3 2.5 6l4.2-1.3z" />
      <path d="M12 10l.6 1.8 1.9.7-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.7z" opacity=".6" />
    </svg>
  ),
};
