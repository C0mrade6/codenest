import { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';

export default function CollabEditor({ doc, provider }) {
  const bindingRef = useRef(null);

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
    };
  }, []);

  function handleEditorDidMount(editor) {
    const yText = doc.getText('codenest');
    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );
  }

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="python"
      theme="vs-dark"
      onMount={handleEditorDidMount}
      options={{
        fontSize: 14,
        fontFamily: '"Fira Code", "Cascadia Code", monospace',
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
      }}
    />
  );
}
