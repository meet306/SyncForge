import React from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  CodeSquare,
  Link as LinkIcon,
  Undo2,
  Redo2
} from 'lucide-react';

export function Toolbar({ editor, isReadOnly = false }) {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL:', previousUrl || 'https://');

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const btnClass = (isActive) =>
    `p-1.5 rounded text-sm transition-colors flex items-center justify-center ${
      isActive
        ? 'bg-brand-100 text-brand-700 font-medium'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    } ${isReadOnly ? 'opacity-40 cursor-not-allowed' : ''}`;

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={isReadOnly || !editor.can().undo()}
        className={btnClass(false)}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={isReadOnly || !editor.can().redo()}
        className={btnClass(false)}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Paragraph & Headings */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('paragraph'))}
        title="Normal text"
      >
        <Pilcrow className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('heading', { level: 3 }))}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Formatting Marks */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('underline'))}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('code'))}
        title="Inline Code"
      >
        <Code className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Lists & Blocks */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('bulletList'))}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('orderedList'))}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        <CodeSquare className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={setLink}
        disabled={isReadOnly}
        className={btnClass(editor.isActive('link'))}
        title="Insert Link"
      >
        <LinkIcon className="w-4 h-4" />
      </button>

      {isReadOnly && (
        <span className="ml-auto text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
          Viewing Only (Read-Only)
        </span>
      )}
    </div>
  );
}
