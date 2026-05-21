const skeletonStyle = {
  borderRadius: 16,
  background: 'linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.98) 50%, rgba(15,23,42,0.92) 100%)',
  backgroundSize: '200% 100%',
  animation: 'smartpark-page-shimmer 1.15s linear infinite',
}

function SkeletonBlock({ height, width = '100%', radius = 16, style = {} }) {
  return (
    <div
      style={{
        ...skeletonStyle,
        height,
        width,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

export default function PageSkeleton({ compact = false }) {
  return (
    <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: compact ? '12px 0' : '8px 0 20px' }}>
      <style>{`
        @keyframes smartpark-page-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <SkeletonBlock height={18} width={140} radius={999} />
          <SkeletonBlock height={compact ? 42 : 58} width="min(480px, 92%)" />
          <SkeletonBlock height={16} width="min(620px, 100%)" radius={12} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
            <SkeletonBlock key={index} height={compact ? 112 : 134} />
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.35fr) minmax(320px, 0.8fr)',
            gap: 16,
          }}
        >
          <SkeletonBlock height={compact ? 260 : 340} />
          <div style={{ display: 'grid', gap: 16 }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={160} />
          </div>
        </div>
      </div>
    </div>
  )
}
