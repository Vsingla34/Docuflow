import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrimaryButton, Input, Field } from '../components/ui/FormControls';
import Icon from '../components/icons/Icon';
import { useToast } from '../components/ui/Toast';

const Login: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Note: a correct password alone is not the end of sign-in for an account with two-factor
      // enabled — it only gets the session to aal1. The second-factor challenge is handled by
      // App.tsx, which reacts to the session this creates (via supabase.auth.onAuthStateChange)
      // and checks the assurance level itself before ever rendering the signed-in app. See
      // App.tsx's MfaChallenge component and AUDIT backlog item "MFA".
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <Icon name="box" className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Docuflow</h1>
          <p className="text-sm text-slate-500 mt-1">Asset Lifecycle Management</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <Field label="Email Address">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          <PrimaryButton type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </PrimaryButton>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8">
          Secure access requires an active employee account.
        </p>
      </div>
    </div>
  );
};

export default Login;