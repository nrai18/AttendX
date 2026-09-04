import React, { useEffect, useState, useMemo } from 'react';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { api } from '../../lib/api';
import { Loader2, ChevronLeft, Calendar as CalendarIcon, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Environment, ContactShadows } from '@react-three/drei';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import * as THREE from 'three';
import { format, subDays, addDays, isWithinInterval, parseISO } from 'date-fns';

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

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export const ReportView: React.FC = () => {
  const navigate = useNavigate();
  const { subjects, activeSemesterId, events } = useAttendanceStore();
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

  // Overall calculations
  const totalAttended = subjects?.reduce((acc, s) => acc + s.attended, 0) || 0;
  const totalClasses = subjects?.reduce((acc, s) => acc + s.total, 0) || 0;
  const overallPercentage = totalClasses === 0 ? 100 : Math.round((totalAttended / totalClasses) * 100);

  // Expected classes calculation
  const totalExpectedRemaining = subjects?.reduce((acc, s: any) => acc + (s.remainingClasses || 0), 0) || 0;

  // Compute past week & past month summaries
  const { weeklyStats, monthlyStats, weeklyChart } = useMemo(() => {
    const today = new Date();
    
    let wAttended = 0, wTotal = 0, mAttended = 0, mTotal = 0;
    const wChart = [];

    // Week chart
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => l.date.startsWith(dateStr));
      const attended = dayLogs.filter(l => l.status === 'PRESENT').length;
      const total = dayLogs.length;
      wAttended += attended;
      wTotal += total;
      wChart.push({ name: format(d, 'EEE'), attended, missed: total - attended, total });
    }

    // Month chart
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => l.date.startsWith(dateStr));
      const attended = dayLogs.filter(l => l.status === 'PRESENT').length;
      const total = dayLogs.length;
      mAttended += attended;
      mTotal += total;
    }

    return {
      weeklyStats: { attended: wAttended, total: wTotal, missed: wTotal - wAttended, pct: wTotal ? Math.round((wAttended/wTotal)*100) : 100 },
      monthlyStats: { attended: mAttended, total: mTotal, missed: mTotal - mAttended, pct: mTotal ? Math.round((mAttended/mTotal)*100) : 100 },
      weeklyChart: wChart,
    };
  }, [logs]);

  // Compute upcoming events
  const { upcomingWeekEvents, upcomingMonthEvents } = useMemo(() => {
    const today = new Date();
    const next7 = addDays(today, 7);
    const next30 = addDays(today, 30);
    
    const wEvents = events?.filter((e: any) => {
      try {
        const ed = parseISO(e.date);
        return isWithinInterval(ed, { start: today, end: next7 });
      } catch { return false; }
    }) || [];

    const mEvents = events?.filter((e: any) => {
      try {
        const ed = parseISO(e.date);
        return isWithinInterval(ed, { start: today, end: next30 });
      } catch { return false; }
    }) || [];

    return { upcomingWeekEvents: wEvents, upcomingMonthEvents: mEvents };
  }, [events]);

  const subjectPieData = useMemo(() => {
    return subjects?.map(s => ({
      name: s.code || s.name.substring(0, 10),
      value: s.attended || 1 // fallback to 1 to show on chart even if 0
    })) || [];
  }, [subjects]);

  const expectedClassesData = useMemo(() => {
    return subjects?.map((s: any) => ({
      name: s.code || s.name.substring(0, 5),
      remaining: s.remainingClasses || 0,
      attended: s.attended || 0
    })) || [];
  }, [subjects]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 animate-in fade-in duration-300">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/today')}
            className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Analytics Report</h1>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-8">
        
        {/* 3D Visualizer */}
        <div className="w-full h-[350px] bg-card border border-border/50 rounded-3xl overflow-hidden relative shadow-lg">
          <div className="absolute top-4 left-4 z-10">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">LIVE TELEMETRY</span>
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

        {/* Weekly & Monthly Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border/50 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Past 7 Days</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black">{weeklyStats.pct}%</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">{weeklyStats.attended} attended / {weeklyStats.missed} missed</p>
          </div>
          <div className="bg-card border border-border/50 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Past 30 Days</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black">{monthlyStats.pct}%</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">{monthlyStats.attended} attended / {monthlyStats.missed} missed</p>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold">Weekly Performance Trend</h2>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyChart} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAttended" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="attended" stroke="#10b981" fillOpacity={1} fill="url(#colorAttended)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expected Classes Simulation Chart */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-bold">Expected Remaining Classes</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Total of <span className="font-bold text-foreground">{totalExpectedRemaining}</span> classes remaining in the semester.
          </p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expectedClassesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#374151'}} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="attended" name="Attended So Far" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                <Bar dataKey="remaining" name="Expected Remaining" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Attendance Distribution Pie Chart */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-pink-500" />
            <h2 className="text-base font-bold">Attendance Distribution</h2>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subjectPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subjectPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px' }} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Events Section */}
        <div className="w-full bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold">Upcoming Semester Events</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Next 7 Days ({upcomingWeekEvents.length})</h3>
              {upcomingWeekEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">No events in the next 7 days.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingWeekEvents.map((e: any) => (
                    <div key={e.id} className="p-3 bg-muted/30 border border-border/30 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{format(parseISO(e.date), 'MMM d, yyyy')}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full">{e.eventType || e.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Next 30 Days ({upcomingMonthEvents.length})</h3>
              {upcomingMonthEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">No upcoming events this month.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMonthEvents.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="p-3 bg-muted/30 border border-border/30 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{format(parseISO(e.date), 'MMM d, yyyy')}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-secondary/20 text-secondary-foreground rounded-full">{e.eventType || e.type}</span>
                    </div>
                  ))}
                  {upcomingMonthEvents.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">+{upcomingMonthEvents.length - 5} more events...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};
