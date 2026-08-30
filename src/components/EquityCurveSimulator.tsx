import React, { useState, useMemo } from 'react';
import { Trade } from '../types';
import { TrendingUp, BarChart2, Activity, Award, Calendar, Hash } from 'lucide-react';

interface EquityCurveSimulatorProps {
  trades: Trade[];
}

export default function EquityCurveSimulator({ trades }: EquityCurveSimulatorProps) {
  const [viewMode, setViewMode] = useState<"trade" | "day">("trade");

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
    let currentEquity = 0;
    
    if (viewMode === "trade") {
      return sortedTrades.map((t, index) => {
        currentEquity += Number(t.profitLoss);
        return {
          label: `Trade ${index + 1}`,
          equity: currentEquity,
          pnl: Number(t.profitLoss),
          date: t.entryDate
        };
      });
    } else {
      // Group by day
      const dailyMap: Record<string, number> = {};
      sortedTrades.forEach(t => {
        if (!dailyMap[t.entryDate]) dailyMap[t.entryDate] = 0;
        dailyMap[t.entryDate] += Number(t.profitLoss);
      });
      
      const sortedDays = Object.keys(dailyMap).sort();
      return sortedDays.map(date => {
        currentEquity += dailyMap[date];
        return {
          label: date,
          equity: currentEquity,
          pnl: dailyMap[date],
          date: date
        };
      });
    }
  }, [sortedTrades, viewMode]);

  // Best Setup Calculation
  const bestSetup = useMemo(() => {
    if (sortedTrades.length === 0) return null;

    const setups: Record<string, { pnl: number, wins: number, total: number }> = {};

    sortedTrades.forEach(t => {
      // Create a composite key if fields exist, otherwise 'Unknown'
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
      // Minimum 2 trades to be considered a "setup" for statistical relevance if possible, else 1
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

  // SVG Chart Configuration
  const width = 800;
  const height = 300;
  const padding = 40;

  const minEquity = chartData.length > 0 ? Math.min(0, ...chartData.map(d => d.equity)) : 0;
  const maxEquity = chartData.length > 0 ? Math.max(0, ...chartData.map(d => d.equity)) : 100;
  
  const rangeY = (maxEquity - minEquity) || 100;
  const scaleY = (height - 2 * padding) / rangeY;
  
  const rangeX = Math.max(chartData.length - 1, 1);
  const scaleX = (width - 2 * padding) / rangeX;

  const getPoints = () => {
    if (chartData.length === 0) return "";
    return chartData.map((d, i) => {
      const x = padding + (i * scaleX);
      const y = height - padding - ((d.equity - minEquity) * scaleY);
      return `${x},${y}`;
    }).join(" ");
  };

  const zeroY = height - padding - ((0 - minEquity) * scaleY);

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

      {chartData.length > 0 ? (
        <div className="space-y-6">
          {/* Equity Chart Panel */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 relative overflow-x-auto">
            <div className="min-w-[600px]">
              <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                  const y = padding + (height - 2 * padding) * tick;
                  const value = maxEquity - (rangeY * tick);
                  return (
                    <g key={tick}>
                      <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                      <text x={padding - 10} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                        ${value.toFixed(0)}
                      </text>
                    </g>
                  );
                })}
                
                {/* Zero Line if applicable */}
                {minEquity < 0 && maxEquity > 0 && (
                  <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#cbd5e1" strokeWidth="1.5" opacity="0.3" />
                )}

                {/* The Line */}
                <polyline
                  points={getPoints()}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Data Points */}
                {chartData.map((d, i) => {
                  const x = padding + (i * scaleX);
                  const y = height - padding - ((d.equity - minEquity) * scaleY);
                  const isProfit = d.equity >= (chartData[i-1]?.equity || 0);
                  return (
                    <circle 
                      key={i} 
                      cx={x} 
                      cy={y} 
                      r="4" 
                      fill={isProfit ? "#34d399" : "#fb7185"} 
                      stroke="#0f172a" 
                      strokeWidth="2" 
                    >
                      <title>{d.label}: ${d.equity.toFixed(2)} (PnL: ${d.pnl.toFixed(2)})</title>
                    </circle>
                  );
                })}
              </svg>
            </div>
            <div className="absolute top-4 right-4 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs font-mono">
              <span className="text-slate-400">Total Return: </span>
              <span className={chartData[chartData.length - 1].equity >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
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
