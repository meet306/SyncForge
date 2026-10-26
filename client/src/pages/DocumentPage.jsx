import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Editor } from '../editor/Editor.jsx';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

export function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.documents.get(id);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [id]);

  const handleTitleChange = async (newTitle) => {
    try {
      await api.documents.update(id, { title: newTitle });
      setData((prev) => ({
        ...prev,
        document: { ...prev.document, title: newTitle }
      }));
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading document workspace...</p>
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
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied or Not Found</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <Editor
      documentId={id}
      document={data.document}
      userRole={data.document.userRole}
      members={data.members}
      shareLinks={data.shareLinks}
      onTitleChange={handleTitleChange}
      onMembersUpdated={loadDocument}
    />
  );
}
