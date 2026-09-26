import React, { useState } from 'react';

// Enterprise color palette
const DEFAULT_PALETTE = [
  '#2563eb', // Blue 600
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#8b5cf6', // Violet 500
  '#ec4899', // Pink 500
  '#06b6d4', // Cyan 500
  '#64748b', // Slate 500
  '#3b82f6', // Blue 500
  '#14b8a6', // Teal 500
  '#f97316', // Orange 500
];

// =============================================================================
// 1. DonutChart
// =============================================================================

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerValue?: string | number;
  showLegend?: boolean;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 200,
  thickness = 26,
  centerTitle,
  centerValue,
  showLegend = true,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const slices = data.map((d, i) => {
    const value = d.value || 0;
    const percent = total > 0 ? value / total : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    const color = d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

    return {
      ...d,
      percent,
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />

          {/* Slices */}
          {slices.map((slice, i) => {
            if (slice.percent <= 0) return null;
            const isHovered = hoveredIdx === i;

            return (
              <circle
                key={slice.label + i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? thickness + 4 : thickness}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Label / Hover readout */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '10px',
          }}
        >
          {activeSlice ? (
            <>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  maxWidth: size - thickness * 2 - 10,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeSlice.label}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: activeSlice.color, margin: '2px 0' }}>
                {activeSlice.value.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                {(activeSlice.percent * 100).toFixed(1)}%
              </div>
            </>
          ) : (
            <>
              {centerValue !== undefined ? (
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
                </div>
              ) : (
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  {total.toLocaleString()}
                </div>
              )}
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                {centerTitle || 'Total'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
            width: '100%',
            marginTop: '16px',
            fontSize: '12px',
          }}
        >
          {slices.map((slice, i) => (
            <div
              key={slice.label + i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: hoveredIdx === i ? '#f8fafc' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '3px',
                  background: slice.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>{slice.label}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {slice.value} ({((slice.percent || 0) * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 2. BarChart (Single Series)
// =============================================================================

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  defaultColor?: string;
  yAxisFormatter?: (val: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 220,
  defaultColor = '#3b82f6',
  yAxisFormatter = (v) => v.toLocaleString(),
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const roundedMax = Math.ceil(maxValue * 1.15); // Add 15% headroom

  const ticks = [0, Math.round(roundedMax * 0.33), Math.round(roundedMax * 0.66), roundedMax];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height, position: 'relative', paddingTop: '20px' }}>
        {/* Y-Axis Gridlines & Labels */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 20,
            bottom: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {ticks.slice().reverse().map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px dashed #e2e8f0',
                width: '100%',
                height: '1px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  background: '#ffffff',
                  paddingRight: '6px',
                  transform: 'translateY(-6px)',
                }}
              >
                {yAxisFormatter(t)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            width: '100%',
            height: '100%',
            paddingLeft: '45px',
            paddingBottom: '30px',
            zIndex: 1,
          }}
        >
          {data.map((item, idx) => {
            const barHeightPct = roundedMax > 0 ? (item.value / roundedMax) * 100 : 0;
            const isHovered = hoveredIdx === idx;
            const color = item.color || defaultColor;

            return (
              <div
                key={item.label + idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  height: '100%',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '0 4px',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `calc(${barHeightPct}% + 12px)`,
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div>{item.label}</div>
                    <div style={{ color: '#93c5fd' }}>{item.value.toLocaleString()} days</div>
                    {item.sublabel && <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.sublabel}</div>}
                  </div>
                )}

                {/* Bar */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '36px',
                    height: `${Math.max(barHeightPct, 2)}%`,
                    background: color,
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s ease',
                    opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                    transform: isHovered ? 'scaleY(1.02)' : 'none',
                    transformOrigin: 'bottom',
                  }}
                />

                {/* X-Axis Label */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    fontSize: '11px',
                    color: isHovered ? '#0f172a' : '#64748b',
                    fontWeight: isHovered ? 700 : 500,
                    maxWidth: '65px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 3. MultiSeriesBarChart (Grouped & Stacked)
// =============================================================================

export interface MultiSeriesBarDatum {
  label: string;
  series: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

interface MultiSeriesBarChartProps {
  data: MultiSeriesBarDatum[];
  height?: number;
  stacked?: boolean;
  yAxisFormatter?: (val: number) => string;
  legendPosition?: 'top' | 'bottom';
}

export const MultiSeriesBarChart: React.FC<MultiSeriesBarChartProps> = ({
  data,
  height = 240,
  stacked = false,
  yAxisFormatter = (v) => v.toLocaleString(),
  legendPosition = 'top',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute maximum value
  let maxValue = 1;
  if (stacked) {
    for (const d of data) {
      const sum = d.series.reduce((acc, s) => acc + (s.value || 0), 0);
      if (sum > maxValue) maxValue = sum;
    }
  } else {
    for (const d of data) {
      for (const s of d.series) {
        if ((s.value || 0) > maxValue) maxValue = s.value;
      }
    }
  }

  const roundedMax = Math.ceil(maxValue * 1.15);
  const ticks = [0, Math.round(roundedMax * 0.33), Math.round(roundedMax * 0.66), roundedMax];

  // Extract legend items from first non-empty item
  const legendItems = data.length > 0 ? data[0].series : [];

  const legend = (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
      {legendItems.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color }} />
          <span style={{ color: '#475569', fontWeight: 600 }}>{item.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {legendPosition === 'top' && legend}

      <div style={{ display: 'flex', alignItems: 'flex-end', height, position: 'relative', paddingTop: '20px' }}>
        {/* Y-Axis lines */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 20,
            bottom: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {ticks.slice().reverse().map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px dashed #e2e8f0',
                width: '100%',
                height: '1px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  background: '#ffffff',
                  paddingRight: '6px',
                  transform: 'translateY(-6px)',
                }}
              >
                {yAxisFormatter(t)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            width: '100%',
            height: '100%',
            paddingLeft: '55px',
            paddingBottom: '30px',
            zIndex: 1,
            gap: '4px',
          }}
        >
          {data.map((item, idx) => {
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={item.label + idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  flex: 1,
                  height: '100%',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '90%',
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 20,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px', borderBottom: '1px solid #334155', paddingBottom: '2px' }}>
                      {item.label}
                    </div>
                    {item.series.map((s) => (
                      <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ color: '#cbd5e1' }}>{s.name}:</span>
                        <strong style={{ color: s.color }}>{yAxisFormatter(s.value)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stacked or Grouped Bars */}
                {stacked ? (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '24px',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      height: '100%',
                      justifyContent: 'flex-start',
                    }}
                  >
                    {item.series.map((s) => {
                      const h = roundedMax > 0 ? (s.value / roundedMax) * 100 : 0;
                      if (h <= 0) return null;
                      return (
                        <div
                          key={s.name}
                          style={{
                            width: '100%',
                            height: `${h}%`,
                            background: s.color,
                            transition: 'all 0.2s ease',
                            opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '2px',
                      width: '100%',
                      justifyContent: 'center',
                      height: '100%',
                    }}
                  >
                    {item.series.map((s) => {
                      const h = roundedMax > 0 ? (s.value / roundedMax) * 100 : 0;
                      return (
                        <div
                          key={s.name}
                          style={{
                            width: '45%',
                            maxWidth: '16px',
                            height: `${Math.max(h, 2)}%`,
                            background: s.color,
                            borderRadius: '3px 3px 0 0',
                            transition: 'all 0.2s ease',
                            opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* X-Axis Label */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    fontSize: '10px',
                    color: isHovered ? '#0f172a' : '#64748b',
                    fontWeight: isHovered ? 700 : 500,
                    maxWidth: '45px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 4. CircularGauge
// =============================================================================

interface CircularGaugeProps {
  value: number; // 0 to 100
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  goodThreshold?: number;
  warningThreshold?: number;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  label,
  sublabel,
  size = 120,
  strokeWidth = 10,
  goodThreshold = 80,
  warningThreshold = 65,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  let color = '#10b981'; // Good (Emerald)
  if (clampedValue < warningThreshold) {
    color = '#ef4444'; // Red
  } else if (clampedValue < goodThreshold) {
    color = '#f59e0b'; // Amber
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
            {clampedValue}%
          </div>
        </div>
      </div>

      <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 5. FunnelPipeline
// =============================================================================

export interface FunnelStep {
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

interface FunnelPipelineProps {
  steps: FunnelStep[];
}

export const FunnelPipeline: React.FC<FunnelPipelineProps> = ({ steps }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {steps.map((step, idx) => {
        const color = step.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
        return (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{step.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#0f172a' }}>{step.count.toLocaleString()}</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>({step.percentage}%)</span>
              </div>
            </div>

            {/* Visual Bar */}
            <div style={{ background: '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(step.percentage, 2)}%`,
                  background: color,
                  height: '100%',
                  borderRadius: '5px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
