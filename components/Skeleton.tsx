'use client';

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--tl-line-2) 25%, var(--tl-surface-alt) 50%, var(--tl-line-2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '3px',
};

// Shimmer keyframes are defined in globals.css

// ---- SkeletonLine --------------------------------------------------------

type SkeletonLineProps = {
  width?: string;
  height?: string;
};

export function SkeletonLine({ width = '100%', height = '12px' }: SkeletonLineProps) {
  return (
    <>
      {/* shimmer animation from globals.css */}
      <div
        className="skel-line"
        style={{ ...shimmerStyle, width, height }}
        aria-hidden="true"
      />
    </>
  );
}

// ---- SkeletonPanel -------------------------------------------------------

type SkeletonPanelProps = {
  lines?: 3 | 4 | 5;
};

export function SkeletonPanel({ lines = 4 }: SkeletonPanelProps) {
  const bodyLines = Array.from({ length: lines }, (_, i) => i);

  return (
    <>
      {/* shimmer animation from globals.css */}
      <div
        className="skel-panel"
        style={{
          background: 'var(--tl-surface)',
          border: '1px solid var(--tl-line)',
          borderRadius: '6px',
          overflow: 'hidden',
          flex: 1,
        }}
        aria-hidden="true"
      >
        {/* Panel header skeleton */}
        <div
          className="skel-panel-head"
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--tl-line)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ ...shimmerStyle, width: '130px', height: '11px' }} />
          <div style={{ flex: 1 }} />
          <div style={{ ...shimmerStyle, width: '32px', height: '11px' }} />
        </div>

        {/* Panel body lines */}
        <div
          className="skel-panel-body"
          style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {bodyLines.map((i) => (
            <div key={i} style={{ ...shimmerStyle, width: i % 3 === 2 ? '65%' : i % 2 === 1 ? '82%' : '100%', height: '11px' }} />
          ))}
        </div>
      </div>
    </>
  );
}

// ---- SkeletonDashboard ---------------------------------------------------

export function SkeletonDashboard() {
  return (
    <>
      {/* shimmer animation from globals.css */}
      <div
        className="skel-dashboard"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px' }}
        aria-label="Loading dashboard…"
        role="status"
      >
        {/* Daybook — big title + body text */}
        <div
          className="skel-daybook"
          style={{
            background: 'var(--tl-surface)',
            border: '1px solid var(--tl-line)',
            borderRadius: '6px',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
          aria-hidden="true"
        >
          <div style={{ ...shimmerStyle, width: '220px', height: '22px' }} />
          <div style={{ ...shimmerStyle, width: '100%', height: '12px' }} />
          <div style={{ ...shimmerStyle, width: '88%', height: '12px' }} />
          <div style={{ ...shimmerStyle, width: '72%', height: '12px' }} />
        </div>

        {/* Metrics strip — 6 cells */}
        <div
          className="skel-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="skel-metric-cell"
              style={{
                background: 'var(--tl-surface)',
                border: '1px solid var(--tl-line)',
                borderRadius: '6px',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ ...shimmerStyle, width: '55%', height: '10px' }} />
              <div style={{ ...shimmerStyle, width: '70%', height: '18px' }} />
            </div>
          ))}
        </div>

        {/* Two panels side by side */}
        <div
          className="skel-row"
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}
          aria-hidden="true"
        >
          <SkeletonPanel lines={5} />
          <SkeletonPanel lines={4} />
        </div>

        {/* Two more panels side by side */}
        <div
          className="skel-row"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
          aria-hidden="true"
        >
          <SkeletonPanel lines={3} />
          <SkeletonPanel lines={4} />
        </div>
      </div>
    </>
  );
}
