"use client";

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Turnstile } from '@marsidev/react-turnstile';

export default function FeedbackModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState('general');
  const [pandalName, setPandalName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!turnstileToken) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          pandalName: pandalName || null,
          turnstileToken,
        }),
      });

      if (!res.ok) {
        setStatus('error');
        setTurnstileToken('');
        return;
      }

      setStatus('success');
      setTurnstileToken('');
      setTimeout(() => {
        onClose();
        setCategory('general');
        setPandalName('');
        setMessage('');
        setStatus(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTurnstileToken('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'general', label: t('feedback_category_general') },
    { id: 'bug', label: t('feedback_category_bug') },
    { id: 'suggestion', label: t('feedback_category_suggestion') },
    { id: 'add_pandal', label: t('feedback_category_add_pandal') },
    { id: 'data', label: t('feedback_category_data') },
    { id: 'other', label: t('feedback_category_other') },
  ];

  const showPandalField = category === 'add_pandal' || category === 'data';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full h-auto max-h-[90vh] md:max-w-[480px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-900">{t('feedback_title')}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto bg-white">
          {status === 'success' ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center font-medium animate-in fade-in">
              {t('feedback_thanks')}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('feedback_category_label')}
                </label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {showPandalField && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('feedback_pandal_name_label')}
                  </label>
                  <input 
                    type="text"
                    value={pandalName}
                    onChange={(e) => setPandalName(e.target.value)}
                    placeholder={t('feedback_pandal_placeholder')}
                    maxLength={120}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('feedback_message_label')} <span className="text-red-500">*</span>
                </label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('feedback_message_placeholder')}
                  maxLength={500}
                  className="w-full min-h-[100px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 resize-none outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                />
              </div>

              {status === 'error' && (
                <div className="text-red-600 text-sm font-medium bg-red-50 px-3 py-2 rounded-lg">
                  {t('feedback_error')}
                </div>
              )}

              <div className="flex justify-center">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken('')}
                  onExpire={() => setTurnstileToken('')}
                  options={{ theme: 'light', size: 'flexible' }}
                />
              </div>

              <div className="flex flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full md:w-auto flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t('feedback_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || message.length === 0 || !turnstileToken}
                  className={`w-full md:w-auto flex-1 px-4 py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    isSubmitting || message.length === 0 || !turnstileToken
                      ? 'bg-red-700 text-white opacity-50 cursor-not-allowed'
                      : 'bg-red-700 text-white opacity-100 hover:bg-red-800'
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('feedback_submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
