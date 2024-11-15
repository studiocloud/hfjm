import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ValidationForm } from './components/ValidationForm';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Mail, LogOut } from 'lucide-react';

function Header({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-full">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Email Validator Pro</span>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse">
          <Mail className="h-8 w-8 text-blue-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-900 text-white">
              <Header onSignOut={handleSignOut} />
              <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                  <h1 className="text-4xl font-bold text-white mb-4">
                    Email Validation Dashboard
                  </h1>
                  <p className="text-lg text-gray-300">
                    Deep verification with MX, DNS, SPF, and mailbox checks
                  </p>
                </div>
                
                <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
                  <ValidationForm />
                </div>
              </div>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;