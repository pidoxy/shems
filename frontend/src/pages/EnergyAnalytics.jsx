import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend, PointElement, LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Zap, DollarSign, Wind, Lightbulb, CalendarDays, TrendingDown, CheckCircle2 } from 'lucide-react';
import { ROOM_COLORS, generateHourlyConsumption } from '../data/mockData';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, PointElement, LineElement,
);

const { labels: hourLabels, room1, room2, room3, room4 } = generateHourlyConsumption();

export default function EnergyAnalytics({ rooms }) {
  const totalEnergy = rooms.reduce((s, r) => s + r.energy24h, 0);
  const totalCost   = rooms.reduce((s, r) => s + r.estimatedCost, 0);
  const acUsage     = totalEnergy * 0.972;
  const lightUsage  = totalEnergy * 0.028;
  const withoutSHEMS = totalEnergy * 1.97;
  const savingsPct   = (((withoutSHEMS - totalEnergy) / withoutSHEMS) * 100).toFixed(1);

  /* Energy by Room */
  const byRoomData = {
    labels: rooms.map(r => r.name.replace(' Room', '').replace('Master ', '')),
    datasets: [
      { label: 'AC',       data: rooms.map(r => +(r.energy24h * 0.972).toFixed(2)), backgroundColor: '#3B82F6', borderRadius: 4, barPercentage: 0.6 },
      { label: 'Lighting', data: rooms.map(r => +(r.energy24h * 0.028).toFixed(2)), backgroundColor: '#F97316', borderRadius: 4, barPercentage: 0.6 },
    ],
  };
  const byRoomOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 11 } } },
      y: { grid: { color: '#F1F5F9' }, ticks: { color: '#94A3B8', font: { size: 11 } } },
    },
  };

  /* Donut */
  const donutData = {
    labels: ['Air Conditioner', 'Lighting'],
    datasets: [{ data: [97.2, 2.8], backgroundColor: ['#3B82F6', '#F97316'], borderWidth: 0, hoverOffset: 6 }],
  };
  const donutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } },
    },
  };

  /* Hourly stacked bar */
  const hourlyData = {
    labels: hourLabels,
    datasets: [
      { label: 'Room 1', data: room1, backgroundColor: '#93C5FD', stack: 'stack', borderRadius: 2 },
      { label: 'Room 2', data: room2, backgroundColor: '#818CF8', stack: 'stack', borderRadius: 2 },
      { label: 'Room 3', data: room3, backgroundColor: '#7DD3FC', stack: 'stack', borderRadius: 2 },
      { label: 'Room 4', data: room4, backgroundColor: '#A5F3FC', stack: 'stack', borderRadius: 2 },
    ],
  };
  const hourlyOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, color: '#64748B', padding: 12 } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 }, callback: (_, i) => (i % 4 === 0 ? hourLabels[i] : ''), maxRotation: 0 } },
      y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { color: '#94A3B8', font: { size: 11 } } },
    },
  };

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Energy Analytics</h1>
          <p>Smart Home Energy Management System</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1E293B', background: '#fff' }}>
          <CalendarDays size={14} strokeWidth={1.8} color="#64748B" />
          Today: 13 Feb 2026
          <span style={{ color: '#94A3B8' }}>▾</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">
            <Zap size={13} color="#F59E0B" fill="#F59E0B" /> Total Consumption
          </div>
          <div className="stat-value">{totalEnergy.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8' }}>kWh</span></div>
          <div className="stat-sub good">
            <TrendingDown size={12} /> 12% vs yesterday
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <DollarSign size={13} color="#10B981" /> Estimated Cost
          </div>
          <div className="stat-value">₦{Math.round(totalCost * 1180).toLocaleString()}</div>
          <div className="stat-sub good">
            <CheckCircle2 size={12} /> Within budget
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Wind size={13} color="#3B82F6" /> AC Usage
          </div>
          <div className="stat-value">{acUsage.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8' }}>kWh</span></div>
          <div style={{ marginTop: 8 }}>
            <div className="bar-track" style={{ height: 5 }}>
              <div className="bar-fill" style={{ width: '97%', background: '#3B82F6', height: 5 }} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Lightbulb size={13} color="#F97316" /> Lighting Usage
          </div>
          <div className="stat-value">{lightUsage.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8' }}>kWh</span></div>
          <div style={{ marginTop: 8 }}>
            <div className="bar-track" style={{ height: 5 }}>
              <div className="bar-fill" style={{ width: '3%', background: '#F97316', height: 5 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Energy by Room + Donut */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Energy by Room</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
              {[['AC', '#3B82F6'], ['Lighting', '#F97316']].map(([lbl, clr]) => (
                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, background: clr, display: 'inline-block', borderRadius: 2 }} /> {lbl}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ height: 220 }}>
            <Bar data={byRoomData} options={byRoomOptions} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Consumption Breakdown</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 190, height: 190 }}>
              <Doughnut data={donutData} options={donutOptions} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>Total</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{totalEnergy.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>kWh</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
              {[['Air Conditioner', '#3B82F6', '97.2%'], ['Lighting', '#F97316', '2.8%']].map(([lbl, clr, pct]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: clr, display: 'inline-block' }} />
                    {lbl}
                  </span>
                  <span style={{ fontWeight: 700 }}>{pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Efficiency Analysis */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title">Efficiency Analysis</span>
            <span className="active-badge">Active</span>
          </div>
          <div style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={13} /> You saved {savingsPct}% with SHEMS
          </div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Comparing energy usage with and without SHEMS optimization.</p>
          <div className="eff-bar-wrap">
            <div className="eff-bar-label">
              <span>Without SHEMS</span>
              <span className="eff-val danger">{withoutSHEMS.toFixed(2)} kWh</span>
            </div>
            <div className="bar-track" style={{ height: 28, borderRadius: 8 }}>
              <div className="eff-bar-fill-red" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            </div>
          </div>
          <div className="eff-bar-wrap" style={{ marginTop: 16 }}>
            <div className="eff-bar-label">
              <span>With SHEMS</span>
              <span className="eff-val success">{totalEnergy.toFixed(2)} kWh</span>
            </div>
            <div className="bar-track" style={{ height: 28, borderRadius: 8 }}>
              <div style={{ width: `${(totalEnergy / withoutSHEMS) * 100}%`, height: '100%', background: '#10B981', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                Optimized
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Timeline */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Hourly Consumption Timeline</span>
        </div>
        <div className="card-body" style={{ height: 260 }}>
          <Bar data={hourlyData} options={hourlyOptions} />
        </div>
      </div>
    </div>
  );
}
