import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  title?: string;
  description?: string;
  token: string | null;
}

export function PinModal({ isOpen, onClose, onSuccess, title = 'Security Verification', description = 'Please enter your 4-digit PIN to authorize this action', token }: PinModalProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Reset state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      setVerifying(false);
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [isOpen]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Only allow numbers

    const newPin = [...pin];
    // Keep only the last character if multiple are entered
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError(null);

    // Auto focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      const newPin = [...pin];
      newPin[index - 1] = '';
      setPin(newPin);
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async (enteredPin: string) => {
    setVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();
      if (response.ok && data.valid) {
        onSuccess(enteredPin);
        onClose();
      } else {
        setError('Incorrect security PIN. Please try again.');
        setPin(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Check if PIN is fully entered and verify
  useEffect(() => {
    const fullPin = pin.join('');
    if (fullPin.length === 4) {
      handleVerify(fullPin);
    }
  }, [pin]);

  const handleKeyPress = (num: string) => {
    const emptyIdx = pin.findIndex(val => val === '');
    if (emptyIdx !== -1) {
      handleChange(num, emptyIdx);
    }
  };

  const handleKeypadBackspace = () => {
    const lastFilledIdx = [...pin].reverse().findIndex(val => val !== '');
    if (lastFilledIdx !== -1) {
      const actualIdx = 3 - lastFilledIdx;
      const newPin = [...pin];
      newPin[actualIdx] = '';
      setPin(newPin);
      inputRefs[actualIdx].current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-6 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-slate-500 mb-6 text-center leading-relaxed">
            {description}
          </p>

          {/* PIN Input Dots */}
          <div className="flex justify-center gap-4 mb-6">
            {pin.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="password"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(e.target.value, idx)}
                onKeyDown={e => handleKeyDown(e, idx)}
                disabled={verifying}
                className={`w-12 h-12 text-center text-xl font-bold bg-slate-50 border-2 rounded-xl focus:outline-none focus:bg-white transition-all ${
                  error
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
                pattern="\d*"
                inputMode="numeric"
              />
            ))}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-rose-500 text-center font-medium mb-4"
            >
              {error}
            </motion.p>
          )}

          {/* Interactive Numerical Keypad (Great for Mobile Touch) */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={verifying}
                className="h-12 text-lg font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors focus:outline-none"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={verifying}
              className="h-12 text-lg font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors focus:outline-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              disabled={verifying}
              className="h-12 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-xl transition-colors focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414A2 2 0 0010.828 19h7.344a2 2 0 002-2V7a2 2 0 00-2-2h-7.344a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>

          {verifying && (
            <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-600">Verifying security lock...</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
