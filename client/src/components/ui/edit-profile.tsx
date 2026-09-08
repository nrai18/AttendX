import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Clock, ChevronDown, CheckCircle2, Lock, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { Player } from '@lottiefiles/react-lottie-player';

export interface ProfileData {
  fullName: string;
  email: string;
  gender: string;
  birthday: string;
  avatarUrl: string;
  hasPassword?: boolean;
}

interface EditProfileProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ProfileData;
  onSave: (data: ProfileData, passwordData?: any) => Promise<void>;
  isLoading?: boolean;
}

export const EditProfile: React.FC<EditProfileProps> = ({ isOpen, onClose, initialData, onSave, isLoading }) => {
  const [formData, setFormData] = useState<ProfileData>(initialData);
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const AVATARS = [
    "https://api.dicebear.com/7.x/notionists/svg?seed=Felix",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Mia&beardProbability=0",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Oliver",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Lily&beardProbability=0",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Caleb",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Aneka&beardProbability=0",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Jack",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Jocelyn&beardProbability=0",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Max",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Sarah&beardProbability=0",
  ];

  // Ensures Google profile picture and newly uploaded avatars stay in the grid
  const selectableAvatars = Array.from(new Set([
    formData.avatarUrl,
    initialData.avatarUrl,
    ...AVATARS
  ].filter(Boolean)));


  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setPasswords({ oldPassword: '', newPassword: '' });
      setShowPasswordSection(false);
      setShowPasswords(false);
      setShowAvatarPicker(false);
    }
  }, [isOpen, initialData]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFormData((prev) => ({ ...prev, avatarUrl: dataUrl }));
        setShowAvatarPicker(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const getDefaultAvatar = (gender: string) => {
    if (gender === 'female') return 'https://api.dicebear.com/7.x/notionists/svg?seed=female&gender=female';
    if (gender === 'male') return 'https://api.dicebear.com/7.x/notionists/svg?seed=male&gender=male';
    return 'https://api.dicebear.com/7.x/notionists/svg?seed=user';
  };

  const currentAvatar = (formData.avatarUrl && formData.avatarUrl !== "null") ? formData.avatarUrl : getDefaultAvatar(formData.gender);

  const handleSave = async () => {
    // Password is now saved independently inside its own section
    await onSave(formData, undefined);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isLoading ? onClose : undefined}
            className="fixed inset-0 bg-[#0F0A09]/80 dark:bg-[#0F0A09]/90"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-4xl z-[101] my-auto pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
              className="pointer-events-auto w-full rounded-[32px] shadow-2xl border border-[#5A4A46]/30 dark:border-[#5A4A46]/50 overflow-hidden bg-[#E6E1D6] dark:bg-[#0F0A09] text-[#4A1711] dark:text-[#E6E1D6] flex flex-col md:flex-row"
            >
              
              {/* Left Side: Form */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-8 py-6 border-b border-[#5A4A46]/20 dark:border-[#5A4A46]/50">
                  <h2 className="text-2xl font-bold font-sans tracking-tight">Edit Profile</h2>
                  <button onClick={onClose} disabled={isLoading} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
                  
                  {/* Mobile Avatar & Picker (Hidden on Desktop) */}
                  <div className="flex md:hidden flex-col items-center pb-4 space-y-4">
                    <div 
                      className="relative group cursor-pointer"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-muted">
                        <img 
                          src={(formData.avatarUrl && formData.avatarUrl !== "null") ? formData.avatarUrl : "https://api.dicebear.com/7.x/notionists/svg?seed=Felix"} onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/notionists/svg?seed=Felix"; }} 
                          alt="Avatar Preview" 
                          className="w-full h-full object-cover" referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 active:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="w-6 h-6 text-white" />
                      </div>
                      <button
                        type="button"
                        className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {showAvatarPicker && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full overflow-hidden"
                        >
                          <div className="grid grid-cols-5 gap-3 pt-2">
                            {selectableAvatars.map((url, idx) => (
                              <div 
                                key={`m-avatar-${idx}`}
                                onClick={() => { setFormData(prev => ({ ...prev, avatarUrl: url })); setShowAvatarPicker(false); }}
                                className="aspect-square rounded-full overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer bg-white transition-all shadow-sm"
                              >
                                <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full mt-4 py-2.5 text-sm font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            Upload Custom Picture
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono tracking-wide uppercase text-[#4A1711]/80 dark:text-[#E6E1D6]/80">Full Name</label>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-2xl border-2 outline-none transition-all text-lg font-bold font-mono text-[#4A1711] dark:text-[#E6E1D6] bg-white/50 dark:bg-black/20 border-[#5A4A46]/20 dark:border-[#5A4A46]/50 focus:border-[#4A1711] dark:focus:border-[#E6E1D6]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono tracking-wide uppercase text-[#4A1711]/80 dark:text-[#E6E1D6]/80">Email Address</label>
                    <input
                      name="email"
                      value={formData.email}
                      readOnly
                      disabled
                      className="w-full px-4 py-3 rounded-2xl border-2 outline-none font-mono text-lg font-bold text-[#4A1711] dark:text-[#E6E1D6] bg-[#4A1711]/5 dark:bg-[#E6E1D6]/5 border-[#5A4A46]/20 dark:border-[#5A4A46]/30 cursor-not-allowed"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold font-mono tracking-wide uppercase text-[#4A1711]/80 dark:text-[#E6E1D6]/80">Gender</label>
                      <div className="relative">
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-2xl border-2 appearance-none outline-none transition-all text-base font-mono bg-white/50 dark:bg-black/20 border-[#5A4A46]/20 dark:border-[#5A4A46]/50 focus:border-[#4A1711] dark:focus:border-[#E6E1D6]"
                        >
                          <option value="unspecified">Prefer not to say</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40" />
                      </div>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold font-mono tracking-wide uppercase text-[#4A1711]/80 dark:text-[#E6E1D6]/80">Birthday</label>
                      <input
                        type="date"
                        name="birthday"
                        value={formData.birthday}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-2xl border-2 outline-none transition-all text-lg font-bold font-mono text-[#4A1711] dark:text-[#E6E1D6] bg-white/50 dark:bg-black/20 border-[#5A4A46]/20 dark:border-[#5A4A46]/50 focus:border-[#4A1711] dark:focus:border-[#E6E1D6]"
                      />
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={() => setShowPasswordSection(!showPasswordSection)}
                      className="flex items-center justify-between w-full text-left p-4 rounded-2xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                          {initialData.hasPassword ? <Lock size={18} /> : <ShieldAlert size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold font-sans">
                            {initialData.hasPassword ? "Change Password" : "Set Account Password"}
                          </h4>
                          <p className="text-xs font-mono opacity-70 mt-0.5">
                            {initialData.hasPassword ? "Update your existing password" : "You signed in with Google. Set a password here."}
                          </p>
                        </div>
                      </div>
                      <ChevronDown size={18} className={`text-muted-foreground transition-transform ${showPasswordSection ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showPasswordSection && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 mt-2 space-y-4 border-t border-[#5A4A46]/10 dark:border-[#5A4A46]/30">
                            {initialData.hasPassword && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                                <div className="relative">
                                  <input
                                    type={showPasswords ? "text" : "password"}
                                    name="oldPassword"
                                    value={passwords.oldPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full pl-4 pr-12 py-3 rounded-2xl border-2 outline-none transition-all text-lg font-bold font-mono text-[#4A1711] dark:text-[#E6E1D6] bg-white/50 dark:bg-black/20 border-[#5A4A46]/20 dark:border-[#5A4A46]/50 focus:border-[#4A1711] dark:focus:border-[#E6E1D6]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A4A46]/60 hover:text-[#5A4A46] dark:text-[#E6E1D6]/40 dark:hover:text-[#E6E1D6]/80 transition-colors"
                                  >
                                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                              <div className="relative">
                                <input
                                  type={showPasswords ? "text" : "password"}
                                  name="newPassword"
                                  value={passwords.newPassword}
                                  onChange={handlePasswordChange}
                                  className="w-full pl-4 pr-12 py-3 rounded-2xl border-2 outline-none transition-all text-lg font-bold font-mono text-[#4A1711] dark:text-[#E6E1D6] bg-white/50 dark:bg-black/20 border-[#5A4A46]/20 dark:border-[#5A4A46]/50 focus:border-[#4A1711] dark:focus:border-[#E6E1D6]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPasswords(!showPasswords)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A4A46]/60 hover:text-[#5A4A46] dark:text-[#E6E1D6]/40 dark:hover:text-[#E6E1D6]/80 transition-colors"
                                >
                                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                            <div className="pt-2">
                                <button type="button" onClick={async () => { if (passwords.newPassword) { await onSave(formData, passwords); setPasswords({oldPassword: '', newPassword: ''}); setShowPasswordSection(false); toast.success('Password updated successfully'); } }} className="px-6 py-2.5 rounded-2xl text-sm font-bold font-mono bg-[#4A1711] text-[#E6E1D6] hover:bg-[#4A1711]/90 dark:bg-[#E6E1D6] dark:text-[#0F0A09] dark:hover:bg-[#E6E1D6]/90 transition-colors">
                                  Save New Password
                                </button>
                              </div>
                            </div>
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                  <div className="mt-8 pt-6 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        toast("Are you absolutely sure you want to permanently delete your account?", {
                          action: {
                            label: "Delete Permanently",
                            onClick: async () => {
                              try {
                                await api.delete("/users/me");
                                useAuthStore.getState().logout();
                                toast.success("Account deleted permanently.");
                              } catch (e: any) {
                                toast.error(e.response?.data?.message || "Failed to delete account");
                              }
                            }
                          }
                        });
                      }}
                      className="w-full p-4 hover:bg-red-500/10 rounded-2xl flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-red-500">
                          <ShieldAlert size={20} />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold text-red-500 group-hover:text-red-600 transition-colors">
                            Delete Account
                          </h4>
                          <p className="text-xs text-red-500/80 mt-0.5">
                            Permanently delete your account and all data
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                {/* Footer Action */}
                <div className="px-8 py-6 border-t border-[#5A4A46]/20 dark:border-[#5A4A46]/50 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 mt-auto">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-bold font-mono transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-8 py-3 rounded-2xl text-sm font-bold font-mono transition-all bg-[#4A1711] text-[#E6E1D6] hover:bg-[#4A1711]/90 dark:bg-[#E6E1D6] dark:text-[#0F0A09] dark:hover:bg-[#E6E1D6]/90 disabled:opacity-50"
                  >
                    {isLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Right Side: Preview */}
              <div className="hidden md:flex w-72 lg:w-80 border-l border-[#5A4A46]/20 dark:border-[#5A4A46]/50 bg-black/5 dark:bg-white/5 flex-col items-center justify-center p-8 relative overflow-hidden">
                
                
                <span className="text-xs font-bold font-mono uppercase tracking-widest mb-8 opacity-50 z-10">Live Preview</span>
                
                <AnimatePresence mode="wait">
                  {showAvatarPicker ? (
                    <motion.div
                      key="picker"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mb-6 z-10 w-full flex flex-col items-center"
                    >
                      <div className="w-full px-2 mb-4 space-y-4 max-h-[300px] overflow-y-auto">
                        <div>
                          <div className="grid grid-cols-5 gap-3">
                            {selectableAvatars.map((url, idx) => (
                              <div 
                                key={`avatar-${idx}`}
                                onClick={() => { setFormData(prev => ({ ...prev, avatarUrl: url })); setShowAvatarPicker(false); }}
                                className="aspect-square rounded-full overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer bg-white transition-all hover:scale-105 shadow-sm"
                              >
                                <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full px-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAvatarPicker(false)}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="avatar"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative mb-6 z-10 group cursor-pointer"
                      onClick={() => setShowAvatarPicker(true)}
                    >
                      <div className="w-36 h-36 rounded-full overflow-hidden shadow-xl ring-4 ring-background border border-border/50 bg-muted">
                        <img src={currentAvatar} onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/notionists/svg?seed=Felix"; }} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="w-8 h-8 text-white" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <h3 className="text-2xl font-bold font-sans text-center line-clamp-1 w-full z-10">
                  {formData.fullName || "Your Name"}
                </h3>
                
                <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold font-mono bg-[#4A1711] text-[#E6E1D6] dark:bg-[#E6E1D6] dark:text-[#0F0A09] z-10">
                  <CheckCircle2 size={12} />
                  <span>STUDENT</span>
                </div>

                {formData.birthday && parseInt(formData.birthday.split('-')[1]) === new Date().getMonth() + 1 && parseInt(formData.birthday.split('-')[2]) === new Date().getDate() && (
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
                    <Player
                      autoplay
                      loop
                      src="/lottie/happy-birthday.json"
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};



