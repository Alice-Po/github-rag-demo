import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('javascript', js);

const CodeBlock = ({ code, language = 'javascript' }) => {
  return (
    <div className="code-block">
      <SyntaxHighlighter
        language={language}
        style={vs}
        customStyle={{
          padding: '1em',
          borderRadius: '4px',
          margin: '1em 0',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
