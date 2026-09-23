import { useCacheStore } from "../../stores/cacheStore";
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { api } from '../../lib/api';
import { ChevronLeft, Activity, BarChart3, PieChartIcon, CalendarIcon, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, addDays, isAfter, isBefore, parseISO, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// 3D Ring Component
const GlowingRing = ({ percentage }: { percentage: number }) => {
  const groupRef = React.useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * 0.2;
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  const color = '#74313A';

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <group ref={groupRef}>
        <mesh>
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
          <meshStandardMaterial color="#EED3CF" transparent opacity={0.3} />
        </mesh>
      </group>
      
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
        color="#7E2430"
        anchorX="center"
        anchorY="middle"
      >
        OVERALL
      </Text>
    </Float>
  );
};

const COLORS = ['#74313A', '#D35C6D', '#EED3CF', '#7E2430', '#A94A57', '#C48189'];

export const ReportView: React.FC = () => {
  const navigate = useNavigate();
  const { subjects, activeSemesterId, events } = useAttendanceStore();
  const [logs, setLogs] = useState<any[]>(() => {
    return useCacheStore.getState().all_logs || useAttendanceStore.getState().historyLogs || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = useCacheStore.getState().all_logs || useAttendanceStore.getState().historyLogs;
    return !cached || cached.length === 0;
  });

  useEffect(() => {
    const fetchLogs = async () => {
      const cacheStore = useCacheStore.getState();
      const attState = useAttendanceStore.getState();
      const cachedLogs = cacheStore.all_logs || (attState.historyLogs?.length ? attState.historyLogs : null);
      if (cachedLogs && Array.isArray(cachedLogs) && cachedLogs.length > 0) {
        setLogs(cachedLogs);
        setLoading(false);
      }

      const effectiveSemId = activeSemesterId || attState.activeSemesterId;
      if (!effectiveSemId) {
        // Fix fatal early return: always unset loading so spinner does not spin forever
        setLoading(false);
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cachedLogs && attState.historyLogs?.length) {
          setLogs(attState.historyLogs);
        }
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/attendance/logs');
        const data = res.data?.logs || [];
        setLogs(data);
        useCacheStore.getState().setCache('all_logs', data);
      } catch (err) {
        console.error(err);
        const cached = useCacheStore.getState().all_logs || attState.historyLogs;
        if (cached) {
          setLogs(cached);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [activeSemesterId]);

  const { weeklyStats, monthlyStats, weeklyChart } = useMemo(() => {
    const today = new Date();
    let wAttended = 0, wTotal = 0, mAttended = 0, mTotal = 0;
    const wChart = [];

    // Week chart
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter((l: any) => l.date.startsWith(dateStr));
      const countable = dayLogs.filter((l: any) => ['present', 'absent', 'medical', 'od'].includes(l.status));
      const attended = countable.filter((l: any) => ['present', 'medical', 'od'].includes(l.status)).length;
      const missed = countable.filter((l: any) => l.status === 'absent').length;
      const total = countable.length;
      wAttended += attended;
      wTotal += total;
      wChart.push({ name: format(d, 'EEE'), attended, missed, total });
    }

    // Month chart
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter((l: any) => l.date.startsWith(dateStr));
      const countable = dayLogs.filter((l: any) => ['present', 'absent', 'medical', 'od'].includes(l.status));
      const attended = countable.filter((l: any) => ['present', 'medical', 'od'].includes(l.status)).length;
      const total = countable.length;
      mAttended += attended;
      mTotal += total;
    }

    return {
      weeklyStats: { attended: wAttended, total: wTotal, missed: wTotal - wAttended, pct: wTotal ? Math.round((wAttended/wTotal)*100) : 100 },
      monthlyStats: { attended: mAttended, total: mTotal, missed: mTotal - mAttended, pct: mTotal ? Math.round((mAttended/mTotal)*100) : 100 },
      weeklyChart: wChart,
    };
  }, [logs]);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const up = events?.filter((e: any) => isAfter(parseISO(e.date), today) || differenceInDays(parseISO(e.date), today) === 0).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
    const past = events?.filter((e: any) => isBefore(parseISO(e.date), today) && differenceInDays(today, parseISO(e.date)) <= 30 && differenceInDays(parseISO(e.date), today) !== 0).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
    return { upcomingEvents: up, pastEvents: past };
  }, [events]);

  const expectedClassesData = useMemo(() => {
    return subjects.map((s: any) => {
      const remainingClasses = s.remainingClasses || 0;
      const attended = s.attended || 0;
      return { name: s.code || s.name.substring(0, 5), attended, remaining: remainingClasses };
    });
  }, [subjects]);
  const totalExpectedRemaining = expectedClassesData.reduce((acc, curr) => acc + curr.remaining, 0);

  const subjectPieData = useMemo(() => {
    return subjects.map((s: any) => ({ name: s.code || s.name.substring(0, 5), value: s.attended || 0 })).filter(d => d.value > 0);
  }, [subjects]);

  const overallPercentage = useMemo(() => {
    let totalAttended = 0;
    let totalClasses = 0;
    subjects.forEach((s: any) => {
      totalAttended += s.attended || 0;
      totalClasses += s.total || 0;
    });
    return totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
  }, [subjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EED3CF] dark:bg-[#2C0F14] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-[#74313A] border-t-transparent rounded-full" />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  const cardClasses = "bg-white/80 dark:bg-[#74313A]/20 backdrop-blur-2xl border border-white/50 dark:border-[#74313A]/30 shadow-[0_16px_40px_-12px_rgba(116,49,58,0.15)] rounded-[24px] p-6 transition-all hover:shadow-[0_20px_50px_-12px_rgba(116,49,58,0.25)]";

  return (
    <div className="min-h-screen text-[#111827] dark:text-[#FDF8F5] p-4 md:p-8 font-sans overflow-x-hidden selection:bg-[#74313A] selection:text-white">
      <div className="w-full mx-auto space-y-8 pb-20">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="w-12 h-12 rounded-[16px] bg-white/60 dark:bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-white dark:hover:bg-black/40 transition-colors border border-white/40 dark:border-white/10 shadow-sm text-[#74313A] dark:text-[#EED3CF]">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#74313A] dark:text-[#EED3CF]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Analytics Report</h1>
              <p className="text-sm font-medium opacity-70">Deep dive into your performance.</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Main Ring */}
          <motion.div variants={itemVariants} className={`${cardClasses} col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center relative overflow-hidden h-[300px]`}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#74313A]/5 to-[#D35C6D]/5 pointer-events-none" />
            <span className="absolute top-6 left-6 px-4 py-1.5 bg-[#74313A]/10 text-[#74313A] dark:bg-[#EED3CF]/10 dark:text-[#EED3CF] text-xs font-bold rounded-full tracking-widest backdrop-blur-md border border-[#74313A]/20">LIVE TELEMETRY</span>
            
          <div className="relative z-10 w-full h-full min-h-[300px]">
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
              <pointLight position={[-10, -10, -10]} intensity={0.5} />
              <GlowingRing percentage={overallPercentage} />
              <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={4} color="#74313A" />
              <Environment files="/potsdamer_platz_1k.hdr" />
              
            </Canvas>
          </div>
          </motion.div>

          {/* KPI Cards */}
          <motion.div variants={itemVariants} className={`\${cardClasses} flex flex-col justify-center`}>
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Past 7 Days</h3>
            <div className="text-4xl font-black text-[#74313A] dark:text-[#EED3CF] font-mono mb-1">{weeklyStats.pct}%</div>
            <p className="text-sm font-medium opacity-75">{weeklyStats.attended} attended / {weeklyStats.missed} missed</p>
          </motion.div>

          <motion.div variants={itemVariants} className={`\${cardClasses} flex flex-col justify-center`}>
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Past 30 Days</h3>
            <div className="text-4xl font-black text-[#74313A] dark:text-[#EED3CF] font-mono mb-1">{monthlyStats.pct}%</div>
            <p className="text-sm font-medium opacity-75">{monthlyStats.attended} attended / {monthlyStats.missed} missed</p>
          </motion.div>

          {/* Area Chart */}
          <motion.div variants={itemVariants} className={`\${cardClasses} col-span-1 md:col-span-2 lg:col-span-3`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#74313A]/10 text-[#74313A] dark:bg-[#EED3CF]/10 dark:text-[#EED3CF] flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Weekly Performance Trend</h2>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChart} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#74313A" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#74313A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="name" stroke="currentColor" className="opacity-50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" className="opacity-50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(116,49,58,0.2)', borderRadius: '16px', color: '#111827', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }} itemStyle={{ color: '#74313A', fontWeight: 'bold' }} cursor={{ stroke: '#74313A', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="attended" stroke="#74313A" strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" activeDot={{ r: 6, fill: '#74313A', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className={`\${cardClasses} col-span-1 md:col-span-2 lg:col-span-3`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#D35C6D]/10 text-[#D35C6D] flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Expected Remaining Classes</h2>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expectedClassesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="name" stroke="currentColor" className="opacity-50" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} interval={0} />
                  <YAxis stroke="currentColor" className="opacity-50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'currentColor', opacity: 0.05}} contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(116,49,58,0.2)', borderRadius: '16px', color: '#111827', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                  <Bar dataKey="attended" name="Attended So Far" stackId="a" fill="#74313A" radius={[0, 0, 8, 8]} />
                  <Bar dataKey="remaining" name="Expected Remaining" stackId="a" fill="#D35C6D" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className={`\${cardClasses} col-span-1 md:col-span-2 lg:col-span-3`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#EED3CF]/20 text-[#74313A] dark:bg-[#7E2430]/30 dark:text-[#EED3CF] flex items-center justify-center">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Events & Milestones</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Upcoming Events */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4 flex items-center gap-2"><Clock className="w-3 h-3"/> Upcoming Events</h3>
                <div className="space-y-3">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm opacity-50 italic">No upcoming events found.</p>
                  ) : (
                    upcomingEvents.slice(0, 5).map((e: any, index: number) => {
                      const daysAway = differenceInDays(parseISO(e.date), new Date());
                      return (
                        <motion.div whileHover={{ scale: 1.02 }} key={e.id || `upcoming-${index}`} className="p-4 rounded-[16px] bg-[#74313A]/5 border border-[#74313A]/10 dark:bg-black/20 dark:border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{e.title}</p>
                            <p className="text-xs font-mono opacity-60">{format(parseISO(e.date), 'MMM d, yyyy')}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold px-3 py-1 bg-[#74313A]/10 text-[#74313A] dark:bg-[#EED3CF]/10 dark:text-[#EED3CF] rounded-full">{daysAway === 0 ? 'Today' : `in ${daysAway} days`}</span>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Past Events */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4 flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> Happened Recently</h3>
                <div className="space-y-3">
                  {pastEvents.length === 0 ? (
                    <p className="text-sm opacity-50 italic">No past events in the last 30 days.</p>
                  ) : (
                    pastEvents.slice(0, 5).map((e: any, index: number) => {
                      const daysAgo = differenceInDays(new Date(), parseISO(e.date));
                      return (
                        <div key={e.id || `past-${index}`} className="p-4 rounded-[16px] bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 flex items-center justify-between opacity-80">
                          <div>
                            <p className="font-semibold line-through decoration-[#74313A]/30">{e.title}</p>
                            <p className="text-xs font-mono opacity-60">{format(parseISO(e.date), 'MMM d, yyyy')}</p>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#74313A] opacity-70 dark:text-[#EED3CF]">{daysAgo === 0 ? 'Earlier' : `${daysAgo}d ago`}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
          
        </motion.div>
      </div>
    </div>
  );
};
