import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  WifiOff,
  Share2,
  FileText,
  Lock
} from 'lucide-react';
import { CollaboratorAvatars } from './CollaboratorAvatars.jsx';

export function DocumentHeader({
  document,
  userRole,
  saveStatus = 'saved', // 'saving' | 'saved' | 'offline'
  connectionStatus = 'connected', // 'connected' | 'connecting' | 'disconnected'
  collaborators = [],
  stats = { words: 0, characters: 0 },
  onTitleChange,
  onOpenShareModal
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(document?.title || 'Untitled Document');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (document?.title) {
      setTitle(document.title);
    }
  }, [document?.title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title.trim() && title !== document.title && userRole !== 'viewer') {
      onTitleChange(title.trim());
    } else {
      setTitle(document?.title || 'Untitled Document');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const isReadOnly = userRole === 'viewer';

  return (
    <header className="h-16 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 z-30">
      {/* Left: Back button + Title + Status */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
          title="Back to Documents"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Docs</span>
        </button>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            {isEditingTitle && !isReadOnly ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="text-base font-semibold text-slate-900 border-b border-brand-500 focus:outline-none px-1 py-0.5 rounded -ml-1"
              />
            ) : (
              <h1
                onClick={() => !isReadOnly && setIsEditingTitle(true)}
                className={`text-base font-semibold text-slate-900 truncate px-1 py-0.5 rounded cursor-pointer ${
                  !isReadOnly ? 'hover:bg-slate-100' : ''
                }`}
                title={!isReadOnly ? 'Click to rename' : 'Read-only'}
              >
                {title}
              </h1>
            )}

            {isReadOnly && (
              <span className="flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                <Lock className="w-3 h-3 text-slate-400" />
                Viewer
              </span>
            )}
          </div>

          {/* Sync & Connection Status */}
          <div className="flex items-center gap-2 text-xs">
            {connectionStatus === 'disconnected' ? (
              <span className="flex items-center gap-1 text-rose-600 font-medium">
                <WifiOff className="w-3 h-3" />
                Offline (Changes saved locally)
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium animate-pulse">
                <CloudUpload className="w-3 h-3" />
                Saving changes...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                All changes saved
              </span>
            )}

            <span className="text-slate-300">•</span>
            <span className="text-slate-400">
              {stats.words} {stats.words === 1 ? 'word' : 'words'}, {stats.characters} chars
            </span>
          </div>
        </div>
      </div>

      {/* Right: Presence + Share button */}
      <div className="flex items-center gap-3 shrink-0">
        <CollaboratorAvatars collaborators={collaborators} />

        <button
          type="button"
          onClick={onOpenShareModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
}
