import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/data/ThemeContext';
import { User, Lock, Sparkles, ArrowRight, LogIn, Eye, EyeOff } from 'lucide-react';
import OceanBackground from '@/components/OceanBackground';

export default function LoginSignup() {
  const { theme } = useTheme();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const ok = await login(username.trim(), password);
        if (!ok) setError('Invalid username or password.');
      } else {
        if (!nickname.trim()) {
          setError('Please enter a nickname.');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        const err = await signup(username.trim(), password, nickname.trim());
        if (err) setError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError('');
    setUsername('');
    setPassword('');
    setNickname('');
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <OceanBackground />

      {/* Vignette */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}
        >
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#fff', letterSpacing: '4px', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            Palace
          </span>
        </motion.div>

        {/* Glass form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          style={{
            width: '380px',
            maxWidth: '100%',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Gloss */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)', borderRadius: '16px 16px 0 0', pointerEvents: 'none' }} />

          <div style={{ padding: '28px', position: 'relative', zIndex: 1 }}>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <button
                onClick={() => mode === 'signup' && toggleMode()}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '6px 6px 0 0', border: 'none',
                  background: mode === 'login' ? 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 100%)' : 'transparent',
                  color: mode === 'login' ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: '13px', fontWeight: mode === 'login' ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: mode === 'login' ? `2px solid ${theme.primary}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <LogIn style={{ width: '14px' }} /> Log In
                </span>
              </button>
              <button
                onClick={() => mode === 'login' && toggleMode()}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '6px 6px 0 0', border: 'none',
                  background: mode === 'signup' ? 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 100%)' : 'transparent',
                  color: mode === 'signup' ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: '13px', fontWeight: mode === 'signup' ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: mode === 'signup' ? `2px solid ${theme.primary}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Sparkles style={{ width: '14px' }} /> Sign Up
                </span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                {/* Username */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: focusedField === 'username' ? theme.primary : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter username"
                      style={{
                        width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px',
                        border: `1px solid ${focusedField === 'username' ? `${theme.primary}` : 'rgba(255,255,255,0.15)'}`,
                        background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '14px',
                        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: focusedField === 'username' ? `0 0 0 3px ${theme.primary}22` : 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: focusedField === 'password' ? theme.primary : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter password"
                      style={{
                        width: '100%', padding: '10px 38px 10px 38px', borderRadius: '8px',
                        border: `1px solid ${focusedField === 'password' ? `${theme.primary}` : 'rgba(255,255,255,0.15)'}`,
                        background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '14px',
                        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: focusedField === 'password' ? `0 0 0 3px ${theme.primary}22` : 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
                        padding: '2px', display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff style={{ width: '15px' }} /> : <Eye style={{ width: '15px' }} />}
                    </button>
                  </div>
                </div>

                {/* Nickname — signup only */}
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>Nickname</label>
                      <div style={{ position: 'relative' }}>
                        <Sparkles style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: focusedField === 'nickname' ? theme.primary : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                        <input
                          type="text"
                          value={nickname}
                          onChange={e => setNickname(e.target.value)}
                          onFocus={() => setFocusedField('nickname')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Choose a display name"
                          style={{
                            width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px',
                            border: `1px solid ${focusedField === 'nickname' ? `${theme.primary}` : 'rgba(255,255,255,0.15)'}`,
                            background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '14px',
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            boxShadow: focusedField === 'nickname' ? `0 0 0 3px ${theme.primary}22` : 'none',
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={{ fontSize: '12px', color: '#f56565', padding: '6px 10px', background: 'rgba(245,101,101,0.1)', borderRadius: '6px', border: '1px solid rgba(245,101,101,0.2)' }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={isSubmitting ? undefined : { scale: 1.02, y: -1 }}
                  whileTap={isSubmitting ? undefined : { scale: 0.98 }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: `linear-gradient(180deg, ${theme.primary}cc 0%, ${theme.primary}99 100%)`,
                    color: '#fff', fontSize: '14px', fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    boxShadow: `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    marginTop: '4px',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <span>Loading...</span>
                  ) : mode === 'login' ? (
                    <><LogIn style={{ width: '15px' }} /> Log In</>
                  ) : (
                    <><Sparkles style={{ width: '15px' }} /> Create Account</>
                  )}
                  {!isSubmitting && <ArrowRight style={{ width: '14px' }} />}
                </motion.button>
              </motion.form>
            </AnimatePresence>

            {/* Toggle hint */}
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <button
                onClick={toggleMode}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = theme.primary)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{ marginTop: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}
        >
          Palace · an Aswium product
        </motion.div>
      </div>
    </div>
  );
}
