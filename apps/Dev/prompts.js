const findReplacePrompt = `app.api.updateFiles(\`\`\`
<index.js>
<search>
  return (
    <div className="flex h-screen items-center justify-center">
      Hello, world!
    </div>
  );
</search>
<replace>
  return (
    <div className="flex h-screen items-center justify-center font-bold">
      {\`Hello, \${name}!\`}
    </div>
  );
</replace>
</index.js>
\`\`\`);`;
