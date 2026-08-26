import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Clock, ChevronDown, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
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

  const currentAvatar = formData.avatarUrl || getDefaultAvatar(formData.gender);

  const handleSave = async () => {
    let pwData = undefined;
    if (showPasswordSection && passwords.newPassword) {
      pwData = { ...passwords };
    }
    await onSave(formData, pwData);
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
            className="fixed inset-0 backdrop-blur-sm bg-background/50"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-4xl z-[101] my-auto pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
              className="pointer-events-auto w-full rounded-2xl shadow-2xl border border-border overflow-hidden bg-card flex flex-col md:flex-row"
            >
              
              {/* Left Side: Form */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/20">
                  <h2 className="text-xl font-bold text-foreground">Edit Profile</h2>
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
                          src={formData.avatarUrl || "https://api.dicebear.com/7.x/notionists/svg?seed=Felix"} 
                          alt="Avatar Preview" 
                          className="w-full h-full object-cover" 
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
                    <label className="text-sm font-semibold text-muted-foreground">Full Name</label>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-all text-base font-semibold bg-background border-border text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-muted-foreground">Email Address</label>
                    <input
                      name="email"
                      value={formData.email}
                      readOnly
                      disabled
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none font-medium transition-all text-base bg-muted border-border text-muted-foreground opacity-70 cursor-not-allowed"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-sm font-semibold text-muted-foreground">Gender</label>
                      <div className="relative">
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border-2 appearance-none outline-none text-base font-semibold bg-background border-border text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
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
                      <label className="text-sm font-semibold text-muted-foreground">Birthday</label>
                      <input
                        type="date"
                        name="birthday"
                        value={formData.birthday}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border-2 outline-none text-base font-semibold bg-background border-border text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={() => setShowPasswordSection(!showPasswordSection)}
                      className="flex items-center justify-between w-full text-left bg-primary/5 hover:bg-primary/10 border border-primary/20 p-4 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                          {initialData.hasPassword ? <Lock size={18} /> : <ShieldAlert size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">
                            {initialData.hasPassword ? "Change Password" : "Set Account Password"}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
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
                          <div className="p-4 mt-3 bg-muted/30 border border-border rounded-xl space-y-4">
                            {initialData.hasPassword && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                                <input
                                  type="password"
                                  name="oldPassword"
                                  value={passwords.oldPassword}
                                  onChange={handlePasswordChange}
                                  placeholder="Enter current password"
                                  className="w-full px-3 py-2.5 rounded-lg border-2 outline-none text-sm font-medium bg-background border-border focus:border-primary"
                                />
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                              <input
                                type="password"
                                name="newPassword"
                                value={passwords.newPassword}
                                onChange={handlePasswordChange}
                                placeholder="Enter new password"
                                className="w-full px-3 py-2.5 rounded-lg border-2 outline-none text-sm font-medium bg-background border-border focus:border-primary"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-6 py-5 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 mt-auto">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm border-2 font-bold transition-colors bg-muted border-border text-foreground hover:bg-muted/80 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Right Side: Preview */}
              <div className="hidden md:flex w-72 lg:w-80 border-l border-border bg-card flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                
                <span className="text-xs font-bold uppercase tracking-widest mb-8 text-muted-foreground z-10">Live Preview</span>
                
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
                        <img
                          src={currentAvatar}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
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
                <h3 className="text-xl font-extrabold text-foreground text-center line-clamp-1 w-full z-10">
                  {formData.fullName || "Your Name"}
                </h3>
                
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary z-10">
                  <CheckCircle2 size={12} />
                  <span>STUDENT</span>
                </div>

                {formData.birthday && new Date(formData.birthday).getMonth() === new Date().getMonth() && new Date(formData.birthday).getDate() === new Date().getDate() && (
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
