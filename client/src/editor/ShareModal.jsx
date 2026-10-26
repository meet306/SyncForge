import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Link as LinkIcon,
  Copy,
  Check,
  Trash2,
  Shield,
  Eye,
  Edit3,
  Clock
} from 'lucide-react';
import { api } from '../services/api.js';

export function ShareModal({
  isOpen,
  onClose,
  document,
  members = [],
  shareLinks = [],
  currentUserRole,
  onMembersUpdated
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [linkPermission, setLinkPermission] = useState('viewer');
  const [linkExpiryHours, setLinkExpiryHours] = useState('168'); // 7 days default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copiedLinkId, setCopiedLinkId] = useState(null);

  if (!isOpen) return null;

  const isOwner = currentUserRole === 'owner';

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await api.documents.addMember(document._id, inviteEmail.trim(), inviteRole);
      setSuccess(res?.message || `Invited ${inviteEmail} as ${inviteRole}!`);
      setInviteEmail('');
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || 'Failed to add collaborator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (targetUserId, newRole) => {
    try {
      await api.documents.updateMemberRole(document._id, targetUserId, newRole);
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Are you sure you want to remove this collaborator?')) return;
    try {
      await api.documents.removeMember(document._id, targetUserId);
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || 'Failed to remove collaborator.');
    }
  };

  const handleCreateShareLink = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const hours = linkExpiryHours ? parseInt(linkExpiryHours, 10) : null;
      const res = await api.documents.createShareLink(document._id, linkPermission, hours);
      setSuccess('New share link generated!');
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || 'Failed to create share link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeShareLink = async (linkId) => {
    try {
      await api.documents.revokeShareLink(document._id, linkId);
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || 'Failed to revoke link.');
    }
  };

  const copyToClipboard = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Share "{document.title}"</h3>
            <p className="text-xs text-slate-500">Collaborate with team members or create secure public links</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200">
              {success}
            </div>
          )}

          {/* Section 1: Invite Collaborator */}
          {isOwner && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-brand-600" />
                Add collaborators by email
              </label>
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  Invite
                </button>
              </form>
            </div>
          )}

          {/* Section 2: Current Collaborators */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-500" />
              People with access
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
              {/* Document Owner */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: document.ownerId?.avatarColor || '#3b82f6' }}
                  >
                    {(document.ownerId?.name || 'Owner')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{document.ownerId?.name}</p>
                    <p className="text-xs text-slate-500">{document.ownerId?.email}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Owner
                </span>
              </div>

              {/* Members */}
              {members
                .filter((m) => m.user && m.user._id !== document.ownerId?._id)
                .map((m) => (
                  <div key={m.id || m.user._id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: m.user.avatarColor || '#10b981' }}
                      >
                        {m.user.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{m.user.name}</p>
                        <p className="text-xs text-slate-500">{m.user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.user._id, e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="text-xs capitalize font-medium text-slate-600 px-2 py-0.5 bg-slate-100 rounded">
                          {m.role}
                        </span>
                      )}

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user._id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors"
                          title="Remove collaborator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Section 3: Shareable Links */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-sm font-medium text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-brand-600" />
                Shareable links
              </span>
              <button
                type="button"
                onClick={handleCreateShareLink}
                disabled={isSubmitting}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
              >
                + Generate new link
              </button>
            </h4>

            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-600">Permission:</span>
              <select
                value={linkPermission}
                onChange={(e) => setLinkPermission(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="viewer">Can View</option>
                <option value="editor">Can Edit</option>
              </select>

              <span className="text-slate-600 ml-2">Expires in:</span>
              <select
                value={linkExpiryHours}
                onChange={(e) => setLinkExpiryHours(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="24">24 Hours</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
                <option value="">Never</option>
              </select>
            </div>

            {/* Existing Share Links List */}
            {shareLinks.length > 0 && (
              <div className="space-y-2 mt-2">
                {shareLinks.map((link) => {
                  const shareUrl = `${window.location.origin}/share/${link.token || 'secret'}`;
                  const isRevoked = link.isRevoked;

                  return (
                    <div
                      key={link._id || link.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                        isRevoked
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium uppercase text-[10px] ${
                            link.permission === 'editor'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {link.permission}
                        </span>
                        <span className="text-slate-500 truncate">{shareUrl}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isRevoked ? (
                          <>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(shareUrl, link._id || link.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded flex items-center gap-1 transition-colors"
                            >
                              {copiedLinkId === (link._id || link.id) ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeShareLink(link._id || link.id)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Revoked</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
