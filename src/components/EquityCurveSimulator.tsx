import React, { useState, useMemo } from 'react';
import { Trade, Transaction } from '../types';
import { TrendingUp, TrendingDown, BarChart2, Activity, Award, Calendar, Hash, Lightbulb, AlertTriangle } from 'lucide-react';

interface EquityCurveSimulatorProps {
  trades: Trade[];
  transactions: Transaction[];
}

export default function EquityCurveSimulator({ trades, transactions }: EquityCurveSimulatorProps) {
  const [viewMode, setViewMode] = useState<"trade" | "day">("trade");
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number, y: number, label: string, equity: number, pnl: number } | null>(null);

  // Calculate Initial Funding Balance
  const initialBalance = useMemo(() => {
    if (!transactions) return 0;
    return transactions.reduce((acc, tx) => {
      return tx.type === 'DEPOSIT' ? acc + Number(tx.amount) : acc - Number(tx.amount);
    }, 0);
  }, [transactions]);

  // Sort trades chronologically
  const sortedTrades = useMemo(() => {
    return [...trades]
      .filter(t => t.profitLoss !== undefined)
      .sort((a, b) => {
        const dateA = new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime();
        const dateB = new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime();
        return dateA - dateB;
      });
  }, [trades]);

  // Data processing for Chart
  const chartData = useMemo(() => {
    let currentEquity = initialBalance;

    // Always start the curve at point 0 (Initial Balance)
    const initialPoint = {
      label: "Initial Balance",
      equity: initialBalance,
      pnl: 0,
      date: sortedTrades[0]?.entryDate || new Date().toISOString().split('T')[0]
    };

    if (viewMode === "trade") {
      const points = sortedTrades.map((t, index) => {
        currentEquity += Number(t.profitLoss);
        return {
          label: `Trade ${index + 1} (${t.symbol || 'Unknown'})`,
          equity: currentEquity,
          pnl: Number(t.profitLoss),
          date: t.entryDate
        };
      });
      return [initialPoint, ...points];
    } else {
      // Group by day
      const dailyMap: Record<string, number> = {};
      sortedTrades.forEach(t => {
        if (!dailyMap[t.entryDate]) dailyMap[t.entryDate] = 0;
        dailyMap[t.entryDate] += Number(t.profitLoss);
      });

      const sortedDays = Object.keys(dailyMap).sort();
      const points = sortedDays.map(date => {
        currentEquity += dailyMap[date];
        return {
          label: date,
          equity: currentEquity,
          pnl: dailyMap[date],
          date: date
        };
      });
      return [initialPoint, ...points];
    }
  }, [sortedTrades, viewMode, initialBalance]);

  // Best Setup Calculation
  const bestSetup = useMemo(() => {
    if (sortedTrades.length === 0) return null;

    const setups: Record<string, { pnl: number, wins: number, total: number }> = {};

    sortedTrades.forEach(t => {
      const type = t.setupType || 'Unknown Setup';
      const sym = t.symbol || 'Unknown Symbol';
      const sess = t.session || 'Unknown Session';

      const key = `${type} | ${sym} | ${sess}`;

      if (!setups[key]) {
        setups[key] = { pnl: 0, wins: 0, total: 0 };
      }

      const pnl = Number(t.profitLoss);
      setups[key].pnl += pnl;
      setups[key].total += 1;
      if (pnl > 0) setups[key].wins += 1;
    });

    let best = null;
    let maxPnL = -Infinity;

    for (const [key, stats] of Object.entries(setups)) {
      if (stats.pnl > maxPnL) {
        maxPnL = stats.pnl;
        best = {
          name: key,
          ...stats,
          winRate: (stats.wins / stats.total) * 100
        };
      }
    }

    return best;
  }, [sortedTrades]);

  // Winning Edge Aggregation & Summary
  const { winningNotes, edgeSummary } = useMemo(() => {
    const wins: string[] = [];
    const winningTrades = sortedTrades.filter(t => Number(t.profitLoss) > 0);

    sortedTrades.forEach(t => {
      if (t.notes && t.notes.trim() && Number(t.profitLoss) > 0) {
        wins.push(t.notes.trim());
      }
    });

    let edgeStats = null;
    if (winningTrades.length > 0) {
      const totalProfit = winningTrades.reduce((sum, t) => sum + Number(t.profitLoss), 0);

      const countFreq = (arr: (string | undefined)[]) => {
        const map: Record<string, number> = {};
        arr.forEach(a => {
          if (a && a !== 'Unknown') map[a] = (map[a] || 0) + 1;
        });
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : 'N/A';
      };

      edgeStats = {
        totalWins: winningTrades.length,
        avgWin: totalProfit / winningTrades.length,
        topSymbol: countFreq(winningTrades.map(w => w.symbol)),
        topSession: countFreq(winningTrades.map(w => w.session)),
        topSetup: countFreq(winningTrades.map(w => w.setupType))
      };
    }

    return { winningNotes: wins, edgeSummary: edgeStats };
  }, [sortedTrades]);

  // SVG Chart Configuration
  const width = 800;
  const height = 350;
  const paddingX = 60;
  const paddingY = 40;

  const minEquity = chartData.length > 0 ? Math.min(...chartData.map(d => d.equity)) : 0;
  const maxEquity = chartData.length > 0 ? Math.max(...chartData.map(d => d.equity)) : 100;

  const equityBuffer = (maxEquity - minEquity) * 0.1 || 10;
  const yMin = minEquity - equityBuffer;
  const yMax = maxEquity + equityBuffer;

  const rangeY = (yMax - yMin) || 100;
  const scaleY = (height - 2 * paddingY) / rangeY;

  const rangeX = Math.max(chartData.length - 1, 1);
  const scaleX = (width - 2 * paddingX) / rangeX;

  const getPoints = () => {
    if (chartData.length === 0) return "";
    return chartData.map((d, i) => {
      const x = paddingX + (i * scaleX);
      const y = height - paddingY - ((d.equity - yMin) * scaleY);
      return `${x},${y}`;
    }).join(" ");
  };

  const zeroY = height - paddingY - ((0 - yMin) * scaleY);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-sm tracking-wide uppercase font-mono flex items-center gap-2">
            <Activity className="text-indigo-400" size={18} />
            Equity Curve Simulator
          </h3>
          <p className="text-[10px] text-slate-500">Analyze your account growth trajectory and discover your most profitable setups.</p>
        </div>

        <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("trade")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${viewMode === "trade" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Hash size={12} />
            Per Trade
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${viewMode === "day" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Calendar size={12} />
            Per Day
          </button>
        </div>
      </div>

      {chartData.length > 1 ? (
        <div className="space-y-6">
          {/* Equity Chart Panel */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 relative overflow-x-auto">
            <div className="min-w-[600px] relative" onMouseLeave={() => setHoveredPoint(null)}>

              <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Horizontal Grid Lines and Y-Axis Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                  const y = paddingY + (height - 2 * paddingY) * tick;
                  const value = yMax - (rangeY * tick);
                  return (
                    <g key={`y-${tick}`}>
                      <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                      <text x={paddingX - 10} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                        ${value.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Date/Trade Labels */}
                {chartData.map((d, i) => {
                  const labelSkip = Math.ceil(chartData.length / 10);
                  if (i % labelSkip !== 0 && i !== chartData.length - 1 && i !== 0) return null;

                  const x = paddingX + (i * scaleX);
                  const y = height - paddingY + 20;
                  return (
                    <g key={`x-${i}`}>
                      <line x1={x} y1={height - paddingY} x2={x} y2={height - paddingY + 5} stroke="#64748b" strokeWidth="1" />
                      <text x={x} y={y} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                        {viewMode === "day" ? d.date.split('-').slice(1).join('/') : i === 0 ? "Start" : d.label.split(' ')[1]}
                      </text>
                    </g>
                  );
                })}

                {/* Zero Line if applicable */}
                {yMin < 0 && yMax > 0 && (
                  <line x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} stroke="#cbd5e1" strokeWidth="1.5" opacity="0.3" />
                )}

                {/* The Line connecting the dots */}
                <polyline
                  points={getPoints()}
                  fill="none"
                  stroke="#9b9ca1ff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Interactive Data Points */}
                {chartData.map((d, i) => {
                  const x = paddingX + (i * scaleX);
                  const y = height - paddingY - ((d.equity - yMin) * scaleY);
                  const isProfit = i === 0 ? true : d.equity >= (chartData[i - 1]?.equity || 0);
                  const isHovered = hoveredPoint?.x === x && hoveredPoint?.y === y;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={isHovered ? "7" : "4"}
                      fill={isProfit ? "#34d399" : "#fb7185"}
                      stroke="#0f172a"
                      strokeWidth={isHovered ? "3" : "2"}
                      onMouseMove={() => setHoveredPoint({ x, y, label: d.label, equity: d.equity, pnl: d.pnl })}
                      className="cursor-pointer transition-all duration-150"
                    />
                  );
                })}
              </svg>

              {/* Hover Tooltip rendered absolutely over the chart */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs z-10 transform -translate-x-1/2 -translate-y-full"
                  style={{ left: `${(hoveredPoint.x / width) * 100}%`, top: `calc(${(hoveredPoint.y / height) * 100}% - 10px)` }}
                >
                  <p className="font-bold text-slate-200 mb-1">{hoveredPoint.label}</p>
                  <div className="font-mono flex justify-between gap-4">
                    <span className="text-slate-400">Equity:</span>
                    <span className="text-white">${hoveredPoint.equity.toFixed(2)}</span>
                  </div>
                  {hoveredPoint.label !== "Initial Balance" && (
                    <div className="font-mono flex justify-between gap-4">
                      <span className="text-slate-400">Profit:</span>
                      <span className={hoveredPoint.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {hoveredPoint.pnl >= 0 ? "+" : ""}${hoveredPoint.pnl.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="absolute top-4 right-4 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs font-mono">
              <span className="text-slate-400">Current Balance: </span>
              <span className={chartData[chartData.length - 1].equity >= initialBalance ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                ${chartData[chartData.length - 1].equity.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Best Setup Insight Panel */}
          {bestSetup && (
            <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Award size={100} />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                  <TrendingUp size={20} />
                </div>
                <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider font-mono">Top Performing Setup</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 relative z-10">
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">Configuration</p>
                  <p className="text-xs font-semibold text-slate-200">{bestSetup.name.split(' | ')[0]}</p>
                  <p className="text-[10px] text-slate-500">{bestSetup.name.split(' | ')[1]} • {bestSetup.name.split(' | ')[2]}</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">Total Generated</p>
                  <p className="text-lg font-bold text-emerald-400">${bestSetup.pnl.toFixed(2)}</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">Win Rate</p>
                  <p className="text-lg font-bold text-indigo-400">{bestSetup.winRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-500">{bestSetup.wins}W / {bestSetup.total - bestSetup.wins}L</p>
                </div>
              </div>
            </div>
          )}

          {/* The Edge (Winning Ideas) - Expanded Full Width */}
          <div className="bg-slate-950/60 border border-emerald-900/40 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-emerald-900/30 pb-3">
              <Lightbulb size={20} className="text-emerald-400" />
              <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono">Your Edge (Best Ideas & Summary)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Statistical Edge Summary */}
              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">Edge Profile Summary</h5>
                {edgeSummary ? (
                  <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-mono">Win Count</span>
                      <span className="text-sm font-bold text-emerald-400">{edgeSummary.totalWins} Trades</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-mono">Average Win</span>
                      <span className="text-sm font-bold text-emerald-400">${edgeSummary.avgWin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-mono">Dominant Setup</span>
                      <span className="text-xs font-bold text-slate-200">{edgeSummary.topSetup}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-mono">Best Asset</span>
                      <span className="text-xs font-bold text-slate-200">{edgeSummary.topSymbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-mono">Optimal Time</span>
                      <span className="text-xs font-bold text-slate-200">{edgeSummary.topSession}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No winning trades logged to generate an edge profile.</p>
                )}
              </div>

              {/* Edge Notes */}
              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">Tracked Edge Notes</h5>
                {winningNotes.length > 0 ? (
                  <div className="space-y-3">
                    <ul className="list-none space-y-3 text-xs text-slate-300">
                      {winningNotes.slice(0, 5).map((note, idx) => (
                        <li key={idx} className="flex items-start gap-3 bg-emerald-950/10 border border-emerald-900/20 p-2.5 rounded-lg">
                          <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                          <span className="leading-relaxed opacity-90 line-clamp-3">{note}</span>
                        </li>
                      ))}
                    </ul>
                    {winningNotes.length > 5 && (
                      <p className="text-[10px] text-emerald-500 font-mono mt-2 text-center bg-emerald-950/30 py-1.5 rounded">
                        + {winningNotes.length - 5} more winning ideas tracked.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No notes logged for winning trades yet.</p>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
          <BarChart2 size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-mono">No trading data available.</p>
          <p className="text-[10px] mt-2">Log completed trades to generate your equity curve and setup analysis.</p>
        </div>
      )}
    </div>
  );
}
