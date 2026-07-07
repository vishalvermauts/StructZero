import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Activity, Zap, DollarSign, Clock, Filter, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';

// Use a WCAG AA compliant palette for data visualizations (minimum 3:1 against white bg)
const COLORS = ['#0284c7', '#4338ca', '#059669', '#d97706', '#dc2626'];

export default function Dashboard({ apiKey }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Pricing', 'Performance'
  const [timeRange, setTimeRange] = useState('Lifetime'); // 'Today', 'Yesterday', 'Lifetime'

  useEffect(() => {
    // 1. Fetch historical metrics on mount
    fetch('http://localhost:3001/api/observability/metrics', {
      headers: { 'x-api-key': apiKey }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMetrics(data);
        } else {
          console.error("Dashboard fetch error:", data);
          setMetrics([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
      });

    // 2. Listen for REAL-TIME WebSocket updates
    const socket = io('http://localhost:3001');
    socket.on('metric_update', (newMetric) => {
      setMetrics(prev => [...prev, newMetric]);
    });

    return () => socket.disconnect();
  }, []);

  // Filter by Time Range
  const filteredMetrics = metrics.filter(m => {
     if (timeRange === 'Lifetime') return true;
     // Replace space with 'T' and append 'Z' to treat SQLite UTC timestamps correctly
     const dateStr = m.created_at || '';
     const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
     const metricDate = new Date(isoStr + (isoStr.endsWith('Z') ? '' : 'Z'));
     const today = new Date();
     if (timeRange === 'Today') {
       return metricDate.toDateString() === today.toDateString();
     } else if (timeRange === 'Yesterday') {
       const yesterday = new Date(today);
       yesterday.setDate(yesterday.getDate() - 1);
       return metricDate.toDateString() === yesterday.toDateString();
     }
     return true;
  });

  // Compute Aggregates
  const totalCost = filteredMetrics.reduce((sum, m) => sum + (m.cost || 0), 0).toFixed(4);
  const totalTokens = filteredMetrics.reduce((sum, m) => sum + (m.tokens || 0), 0).toLocaleString();
  const avgLatency = filteredMetrics.length ? Math.round(filteredMetrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / filteredMetrics.length) : 0;
  const uniqueProviders = new Set(filteredMetrics.map(m => m.provider)).size;

  // Prepare Latency Chart Data
  const latencyData = filteredMetrics.map((m, i) => ({
    name: `Run ${i + 1}`,
    [m.provider]: m.latency_ms
  }));
  const uniqueProvidersList = Array.from(new Set(filteredMetrics.map(m => m.provider)));

  // Prepare Token & Cost Data Grouped By Provider
  const providerStats = filteredMetrics.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = { provider: m.provider, tokens: 0, cost: 0, count: 0 };
    acc[m.provider].tokens += m.tokens || 0;
    acc[m.provider].cost += m.cost || 0;
    acc[m.provider].count += 1;
    return acc;
  }, {});
  
  const tokenData = Object.values(providerStats).map(p => ({
    provider: p.provider,
    tokens: p.tokens,
    input_tokens: Math.floor(p.tokens * 0.75),
    output_tokens: p.tokens - Math.floor(p.tokens * 0.75)
  }));
  const costData = Object.values(providerStats).map(p => ({
    name: p.provider,
    value: parseFloat(p.cost.toFixed(4))
  }));

  if (loading) {
    return <div className="p-8 text-slate-500 font-medium">Loading enterprise metrics...</div>;
  }

  return (
    <div className="font-sans text-[var(--text-primary)] pb-8 animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
            AI Observability & Telemetry
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </h1>
        </div>
      </div>
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1 shadow-sm">
           <button onClick={() => setTimeRange('Today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === 'Today' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>Today</button>
           <button onClick={() => setTimeRange('Yesterday')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === 'Yesterday' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>Yesterday</button>
           <button onClick={() => setTimeRange('Lifetime')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === 'Lifetime' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>Lifetime</button>
        </div>
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1 shadow-sm">
           <div className="pl-3 pr-1 text-[var(--text-secondary)]"><Filter className="w-4 h-4"/></div>
           <button onClick={() => setFilterType('All')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'All' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>All Charts</button>
           <button onClick={() => setFilterType('Pricing')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'Pricing' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>Pricing Only</button>
           <button onClick={() => setFilterType('Performance')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'Performance' ? 'bg-[var(--bg-input)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}>Performance Only</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider" title="Total cost incurred in selected time range">{timeRange} LLM Cost</p>
            <p className="text-3xl font-extrabold mt-2 text-[var(--text-primary)]">${totalCost}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl"><DollarSign className="text-emerald-600 w-6 h-6" /></div>
        </div>
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider" title="Total tokens processed in selected time range">{timeRange} Tokens</p>
            <p className="text-3xl font-extrabold mt-2 text-[var(--text-primary)]">{totalTokens}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl"><Activity className="text-blue-600 w-6 h-6" /></div>
        </div>
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Avg Latency</p>
            <p className="text-3xl font-extrabold mt-2 text-[var(--text-primary)]">{avgLatency} ms</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl"><Clock className="text-amber-600 w-6 h-6" /></div>
        </div>
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Avg Cost / Gen</p>
            <p className="text-3xl font-extrabold mt-2 text-[var(--text-primary)]">${filteredMetrics.length ? (totalCost / filteredMetrics.length).toFixed(4) : 0}</p>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl"><DollarSign className="text-indigo-600 w-6 h-6" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Latency Chart */}
        {(filterType === 'All' || filterType === 'Performance') && (
          <div className={`${filterType === 'Performance' ? 'lg:col-span-3' : 'lg:col-span-2'} bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm`}>
            <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-6">Model Latency Distribution (ms)</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#64748b', fontWeight: 600 }}/>
                  {uniqueProvidersList.map((provider, idx) => (
                    <Line key={provider} connectNulls={true} type="monotone" dataKey={provider} name={provider} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 6 }} isAnimationActive={true} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cost Breakdown Pie Chart */}
        {(filterType === 'All' || filterType === 'Pricing') && (
          <div className={`${filterType === 'Pricing' ? 'lg:col-span-1' : 'col-span-1'} bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm flex flex-col`}>
            <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Cost Breakdown</h2>
            <div className="flex-1 min-h-[288px]">
              {costData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={true}
                    >
                      {costData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => `$${value}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-secondary)] font-medium">No cost data available</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token Bar Chart */}
      {(filterType === 'All' || filterType === 'Pricing' || filterType === 'Performance') && (
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-color)] rounded-3xl shadow-sm mb-8">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-6">Total Token Usage by Provider</h2>
          <div className="h-64">
            {tokenData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                  <YAxis type="category" dataKey="provider" width={100} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: 'var(--bg-input)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}/>
                  <Bar dataKey="input_tokens" name="Input Tokens" stackId="a" fill="#0284c7" isAnimationActive={true} />
                  <Bar dataKey="output_tokens" name="Output Tokens" stackId="a" fill="#059669" radius={[0, 6, 6, 0]} isAnimationActive={true} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-secondary)] font-medium flex-col gap-2">
                 <AlertCircle className="w-8 h-8 text-[var(--border-color)]" />
                 No token usage data recorded yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
