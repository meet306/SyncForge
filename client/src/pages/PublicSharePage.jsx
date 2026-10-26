import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Editor } from '../editor/Editor.jsx';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';

export function PublicSharePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPublicDocument() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.documents.getPublicShare(token);
        setData(res);
      } catch (err) {
        setError(err.message || 'Share link is invalid, expired, or revoked.');
      } finally {
        setIsLoading(false);
      }
    }
    loadPublicDocument();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Connecting to shared document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Share Link</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <Editor
      documentId={data.document._id}
      document={data.document}
      userRole={data.permission}
      shareToken={token}
      onTitleChange={() => {}}
      onMembersUpdated={() => {}}
    />
  );
}
