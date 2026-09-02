import React, { useEffect, useState, useMemo } from 'react';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { api } from '../../lib/api';
import { Loader2, ChevronLeft, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Environment, ContactShadows } from '@react-three/drei';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as THREE from 'three';
import { format, subDays, parseISO } from 'date-fns';

// 3D Ring Component
const GlowingRing = ({ percentage }: { percentage: number }) => {
  const meshRef = React.useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const color = percentage >= 75 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef}>
        <torusGeometry args={[1.5, 0.4, 32, 100, (percentage / 100) * Math.PI * 2]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Background ring for the empty part */}
      <mesh rotation-z={(percentage / 100) * Math.PI * 2}>
        <torusGeometry args={[1.5, 0.38, 32, 100, ((100 - percentage) / 100) * Math.PI * 2]} />
        <meshStandardMaterial color="#1f2937" transparent opacity={0.3} />
      </mesh>
      
      <Text
        position={[0, 0, 0]}
        fontSize={0.8}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
      >
        {`${percentage}%`}
      </Text>
      <Text
        position={[0, -0.6, 0]}
        fontSize={0.2}
        color="#9ca3af"
        anchorX="center"
        anchorY="middle"
      >
        OVERALL
      </Text>
    </Float>
  );
};

export const ReportView: React.FC = () => {
  const navigate = useNavigate();
  const { subjects, activeSemesterId } = useAttendanceStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!activeSemesterId) return;
      try {
        const res = await api.get('/attendance/logs');
        setLogs(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [activeSemesterId]);

  // Calculate overall current percentage
  const totalAttended = subjects?.reduce((acc, s) => acc + s.attended, 0) || 0;
  const totalClasses = subjects?.reduce((acc, s) => acc + s.total, 0) || 0;
  const overallPercentage = totalClasses === 0 ? 100 : Math.round((totalAttended / totalClasses) * 100);

  // Generate last 7 days chart data
  const chartData = useMemo(() => {
    if (!logs.length) return [];
    
    const data = [];
    const today = new Date();
    
    // We'll calculate a moving average or just a daily metric
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      
      // Find all logs up to this date to calculate rolling percentage
      // For simplicity, just finding logs ON this date
      const dayLogs = logs.filter(l => l.date.startsWith(dateStr));
      const attended = dayLogs.filter(l => l.status === 'PRESENT').length;
      const total = dayLogs.length;
      
      data.push({
        name: format(d, 'EEE'), // Mon, Tue
        value: total > 0 ? Math.round((attended / total) * 100) : 100, // Or whatever metric makes sense
        attended,
        total
      });
    }
    return data;
  }, [logs]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 animate-in fade-in duration-300">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/today')}
            className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Performance Report</h1>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-8">
        
        {/* 3D Visualizer */}
        <div className="w-full h-[350px] bg-card border border-border/50 rounded-3xl overflow-hidden relative shadow-lg">
          <div className="absolute top-4 left-4 z-10">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">LIVE</span>
          </div>
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            <GlowingRing percentage={overallPercentage} />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={4} />
            <Environment preset="city" />
          </Canvas>
        </div>

        {/* Recharts Area Graph */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-bold">Past 7 Days Trend</h2>
          </div>
          
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold">Subject Breakdown</h2>
          </div>
          <div className="space-y-3">
            {subjects?.map(sub => {
              const pct = sub.total === 0 ? 100 : Math.round((sub.attended / sub.total) * 100);
              const color = pct >= (75) ? 'bg-emerald-500' : 'bg-red-500';
              return (
                <div key={sub.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold truncate max-w-[200px]">{sub.name}</span>
                    <span className="text-sm font-bold">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
};
