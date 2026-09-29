"use client";

import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export default function ReviewModal({ pandalId, pandalName, onClose }) {
  const [selectedTag, setSelectedTag] = useState('general');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const tags = [
    { id: 'long_line', label: 'দীর্ঘ লাইন' },
    { id: 'best_light', label: 'সেরা আলোকসজ্জা' },
    { id: 'worst_management', label: 'খারাপ ব্যবস্থাপনা' },
    { id: 'spacious', label: 'ভিড় কম' },
    { id: 'great_idol', label: 'সুন্দর প্রতিমা' },
    { id: 'general', label: 'সাধারণ' }
  ];

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
      await fetch(`${socketUrl}/api/pandals/${pandalId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: selectedTag,
          comment: comment.trim(),
          userName: 'দর্শনার্থী'
        })
      });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="font-bold text-gray-900 text-lg mb-1">টিপস / রিভিউ দিন</h3>
        <p className="text-xs text-gray-500 mb-4">{pandalName}</p>

        {!success ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTag(t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedTag === t.id 
                      ? 'bg-red-700 text-white' 
                      : 'bg-stone-100 text-stone-600 border border-stone-200 hover:border-red-300 hover:text-red-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            
            <textarea
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4 resize-none h-24"
              placeholder="আপনার অভিজ্ঞতা শেয়ার করুন..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !comment.trim()}
              className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {isSubmitting ? t('review_submitting') : (
                <>
                  <Send className="w-4 h-4" /> সাবমিট করুন
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
            <p className="font-bold text-gray-900">ধন্যবাদ!</p>
            <p className="text-sm text-gray-500">আপনার রিভিউ যুক্ত হয়েছে।</p>
          </div>
        )}
      </div>
    </div>
  );
}