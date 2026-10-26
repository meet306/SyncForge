import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Toolbar } from './Toolbar.jsx';
import { DocumentHeader } from './DocumentHeader.jsx';
import { ShareModal } from './ShareModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Editor({
  documentId,
  document,
  userRole = 'viewer',
  members = [],
  shareLinks = [],
  shareToken = null,
  onTitleChange,
  onMembersUpdated
}) {
  const { user, token } = useAuth();
  const [saveStatus, setSaveStatus] = useState('saved');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [collaborators, setCollaborators] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [stats, setStats] = useState({ words: 0, characters: 0 });

  const isReadOnly = userRole === 'viewer';
  const saveTimeoutRef = useRef(null);

  // Initialize Yjs Doc & Provider
  const { ydoc, provider } = useMemo(() => {
    const doc = new Y.Doc();

    // Determine WebSocket host
    const isHttps = window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';
    // In dev, Vite proxies /collaboration to backend on port 5000
    const serverUrl = `${wsProtocol}//${window.location.host}/collaboration`;

    const wsParams = {};
    if (token) wsParams.token = token;
    if (shareToken) wsParams.shareToken = shareToken;

    const wsProvider = new WebsocketProvider(serverUrl, documentId, doc, {
      params: wsParams
    });

    return { ydoc: doc, provider: wsProvider };
  }, [documentId, token, shareToken]);

  // Set user awareness state (cursor, avatar color, name)
  useEffect(() => {
    if (!provider || !provider.awareness) return;

    const currentUserData = {
      name: user?.name || 'Guest Collaborator',
      color: user?.avatarColor || '#3b82f6',
      role: userRole,
      email: user?.email || ''
    };

    provider.awareness.setLocalStateField('user', currentUserData);

    // Track active collaborators in the room
    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      const list = [];
      states.forEach((state, clientId) => {
        if (state.user) {
          list.push({
            clientId,
            name: state.user.name,
            color: state.user.color,
            role: state.user.role,
            email: state.user.email
          });
        }
      });
      setCollaborators(list);
    };

    provider.awareness.on('change', updateCollaborators);

    // Track connection status
    const handleStatus = ({ status }) => {
      setConnectionStatus(status);
    };
    provider.on('status', handleStatus);

    return () => {
      provider.awareness.off('change', updateCollaborators);
      provider.off('status', handleStatus);
    };
  }, [provider, user, userRole]);

  // Setup Tiptap Editor
  const editor = useEditor(
    {
      editable: !isReadOnly,
      extensions: [
        StarterKit.configure({
          history: false // Yjs handles undo/redo
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-brand-600 underline font-medium hover:text-brand-800'
          }
        }),
        Placeholder.configure({
          placeholder: 'Start writing or collaborating with your team...'
        }),
        Collaboration.configure({
          document: ydoc,
          field: 'default'
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: user?.name || 'Guest',
            color: user?.avatarColor || '#3b82f6'
          }
        })
      ],
      onUpdate: ({ editor }) => {
        setSaveStatus('saving');

        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          setSaveStatus('saved');
        }, 1500);

        // Word count calculation
        const text = editor.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        setStats({
          words,
          characters: text.length
        });
      }
    },
    [ydoc, provider, isReadOnly]
  );

  // Teardown Yjs on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (provider) provider.destroy();
      if (ydoc) ydoc.destroy();
    };
  }, [provider, ydoc]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Top Header */}
      <DocumentHeader
        document={document}
        userRole={userRole}
        saveStatus={saveStatus}
        connectionStatus={connectionStatus}
        collaborators={collaborators}
        stats={stats}
        onTitleChange={onTitleChange}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      {/* Formatting Toolbar */}
      <Toolbar editor={editor} isReadOnly={isReadOnly} />

      {/* Editor Paper Canvas Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
        <div className="w-full max-w-4xl bg-white min-h-[900px] shadow-sm rounded-xl border border-slate-200/80 p-8 sm:p-14 transition-all">
          <EditorContent editor={editor} />
        </div>
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        document={document}
        members={members}
        shareLinks={shareLinks}
        currentUserRole={userRole}
        onMembersUpdated={onMembersUpdated}
      />
    </div>
  );
}
