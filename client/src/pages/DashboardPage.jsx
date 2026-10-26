import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Trash2,
  Share2,
  Clock,
  User,
  LogOut,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'owned' | 'shared'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchDocs = async () => {
    try {
      setIsLoading(true);
      const res = await api.documents.list({
        filter,
        search,
        sortBy,
        sortOrder,
        page,
        limit: 12
      });
      setDocuments(res.documents);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [filter, sortBy, sortOrder, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreateDocument = async () => {
    try {
      setIsCreating(true);
      const res = await api.documents.create('Untitled Document');
      navigate(`/document/${res.document._id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
      setIsCreating(false);
    }
  };

  const handleDeleteDocument = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    try {
      await api.documents.delete(id);
      fetchDocs();
    } catch (err) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-slate-900 to-brand-700 bg-clip-text text-transparent">
              SyncForge
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded border border-brand-200">
              CRDT v1.0
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="max-w-md w-full mx-4 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-brand-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white"
              style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
            >
              {(user?.name || 'User')[0]}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-900 leading-none">{user?.name}</p>
              <p className="text-[11px] text-slate-500 leading-none mt-1">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Banner CTA */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-brand-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              Real-Time Collaboration Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Create, Edit, and Collaborate in Real Time
            </h2>
            <p className="text-brand-100 text-sm max-w-xl">
              Conflict-free concurrent document editing with CRDTs, automatic presence tracking, and instant synchronization.
            </p>
          </div>

          <button
            onClick={handleCreateDocument}
            disabled={isCreating}
            className="px-5 py-3 bg-white text-brand-700 hover:bg-brand-50 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 hover:-translate-y-0.5 shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'New Document'}
          </button>
        </div>

        {/* Filter Tabs & Sort Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Documents
            </button>
            <button
              onClick={() => setFilter('owned')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'owned'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Owned by me
            </button>
            <button
              onClick={() => setFilter('shared')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'shared'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shared with me
            </button>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
            >
              <option value="updatedAt">Last modified</option>
              <option value="createdAt">Date created</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Document Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-44 bg-slate-200/70 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-4">
            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">No documents found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                {search ? 'Try clearing your search query.' : 'Get started by creating your first collaborative document.'}
              </p>
            </div>
            <button
              onClick={handleCreateDocument}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Create Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((doc) => {
              const isOwner = doc.userRole === 'owner';

              return (
                <div
                  key={doc._id}
                  onClick={() => navigate(`/document/${doc._id}`)}
                  className="group bg-white rounded-2xl border border-slate-200/90 hover:border-brand-400 hover:shadow-lg transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            doc.userRole === 'owner'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : doc.userRole === 'editor'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {doc.userRole}
                        </span>

                        {isOwner && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDocument(e, doc._id)}
                            className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Edited {formatTimeAgo(doc.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: doc.ownerId?.avatarColor || '#3b82f6' }}
                        title={`Owner: ${doc.ownerId?.name}`}
                      >
                        {doc.ownerId?.name ? doc.ownerId.name[0] : 'U'}
                      </div>
                      <span className="truncate max-w-[100px]">{doc.ownerId?.name || 'Owner'}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{doc.collaboratorCount || 1} users</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
