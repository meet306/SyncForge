import React from 'react';

export function CollaboratorAvatars({ collaborators = [] }) {
  if (!collaborators || collaborators.length === 0) return null;

  const visible = collaborators.slice(0, 5);
  const remaining = collaborators.length - 5;

  return (
    <div className="flex items-center -space-x-2 overflow-hidden py-1">
      {visible.map((collab, idx) => {
        const initials = (collab.name || 'User')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div
            key={collab.clientId || idx}
            className="relative group cursor-pointer"
            title={`${collab.name || 'User'} (${collab.role || 'Collaborator'})`}
          >
            <div
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-slate-200 transition-transform hover:scale-110 hover:z-10"
              style={{ backgroundColor: collab.color || '#3b82f6' }}
            >
              {initials}
            </div>

            {/* Glowing online dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>

            {/* Hover Tooltip Card */}
            <div className="absolute right-0 top-10 hidden group-hover:flex flex-col bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none">
              <span className="font-semibold">{collab.name || 'Anonymous'}</span>
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">{collab.role || 'Editor'}</span>
            </div>
          </div>
        );
      })}

      {remaining > 0 && (
        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
          +{remaining}
        </div>
      )}
    </div>
  );
}
