import { useCallback, useEffect, useState } from 'react';
import type { DocumentPayload } from '../electron/contracts';
import { MarkdownView } from './markdown/MarkdownView';

interface DocState {
  path: string | null;
  content: string;
  fileName: string;
  documentId: string | null;
  error: string | null;
}

const emptyDoc: DocState = {
  path: null,
  content:
    '# MD Viewer\n\nبرای باز کردن یک فایل Markdown، از منوی **باز کردن فایل** استفاده کنید.\n\n```js\nconsole.log("Hello, World!"); // این بخش همیشه LTR نمایش داده می‌شود\n```\n\nمتن فارسی `inline code` و mixed **English** فقط در این حالت RTL/LTR درست نمایش داده می‌شود.',
  fileName: '',
  documentId: null,
  error: null,
};

function App() {
  const [doc, setDoc] = useState<DocState>(emptyDoc);
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('md-viewer-dark') === 'true';
    } catch {
      return false;
    }
  });

  const loadDocument = useCallback((document: DocumentPayload) => {
    setDoc({
      path: document.filePath,
      content: document.content,
      fileName: document.fileName,
      documentId: document.documentId,
      error: null,
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    return api.onDocumentOpened(loadDocument);
  }, [loadDocument]);

  const openDialog = async () => {
    try {
      const document = await window.electronAPI.selectDocument();
      if (document) loadDocument(document);
    } catch (err) {
      setDoc({ path: null, content: '', fileName: '', documentId: null, error: String(err) });
    }
  };

  const toggleDark = () => {
    setDark((d) => !d);
  };

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('md-viewer-dark', String(dark));
    } catch {
      /* ignore */
    }
  }, [dark]);

  return (
    <div
      className={`h-full flex flex-col ${dark ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors`}
    >
      <header
        className={`flex items-center justify-between px-4 py-2 border-b select-none ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">📄</span>
          <span className="font-semibold truncate">{doc.fileName || 'MD Viewer'}</span>
          {doc.error && <span className="text-red-500 text-sm">خطا: {doc.error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openDialog}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white"
          >
            باز کردن فایل...
          </button>
          <button
            onClick={toggleDark}
            title="تغییر حالت تیره/روشن"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              dark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
            }`}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <div className="markdown-body">
            <MarkdownView content={doc.content} documentId={doc.documentId} />
          </div>
        </div>
      </main>

      <footer
        className={`px-4 py-2 text-xs text-center border-t ${dark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}
      >
        MD Viewer — مشاهده‌گر Markdown با پشتیبانی RTL
      </footer>
    </div>
  );
}

export default App;
