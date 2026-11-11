import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  grid: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>),
  file: (<><path d="M7 3.5h7l4 4V20H7z" /><path d="M14 3.5V8h4M10 12h5M10 15h5" /></>),
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  back: <path d="M19 12H5m5 5-5-5 5-5" />,
  check: <path d="m5 12 4 4 10-10" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  warning: (<><path d="M12 3.5 21 20H3L12 3.5Z" /><path d="M12 9v4.5M12 17h.01" /></>),
  upload: (<><path d="M12 15V4m0 0L8 8m4-4 4 4" /><path d="M5 14v5h14v-5" /></>),
  download: (<><path d="M12 4v11m0 0-4-4m4 4 4-4" /><path d="M5 19h14" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  undo: (<><path d="m9 8-4 4 4 4" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>),
  redo: (<><path d="m15 8 4 4-4 4" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>),
  issues: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></>),
  link: (<><path d="M9.5 14.5 14.5 9" /><path d="M7 17H6a4 4 0 0 1 0-8h4M17 7h1a4 4 0 0 1 0 8h-4" /></>),
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  trash: <path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  chevleft: <path d="m14 7-5 5 5 5" />,
  chevright: <path d="m10 7 5 5-5 5" />,
  eye: (<><path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" /><circle cx="12" cy="12" r="2.5" /></>),
  zoomin: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M10.5 7.5v6M7.5 10.5h6m2.8 5.8 3.2 3.2" /></>),
  zoomout: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M7.5 10.5h6m2.8 5.8 3.2 3.2" /></>),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  note: (<><path d="M5 4h14v12l-4 4H5z" /><path d="M15 20v-4h4M8 9h8M8 13h4" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  image: (<><rect x="4" y="5" width="16" height="14" rx="1.5" /><circle cx="9" cy="10" r="1.5" /><path d="m5 18 5-5 3 3 2-2 4 4" /></>),
  panel: (<><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M10 5v14" /></>),
  cursor: <path d="m6 4 12 7-5 1.5L11 18 6 4Z" />,
};

export function Icon({ name, size = 18 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
