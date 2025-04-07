import { useState, useEffect } from 'react';
import './App.css';
import { parseResponse, validateResponse } from './utils/responseParser';
import CodeBlock from './components/CodeBlock';

/**
 * Main application component for the RAG (Retrieval Augmented Generation) assistant
 * Provides an interface to query and display AI-generated responses about project repositories
 *
 * @component
 */
function App() {
  const [question, setQuestion] = useState('');
  const [parsedResponse, setParsedResponse] = useState(null);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('http://localhost:3001/config');
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('Failed to load configuration:', error);
        setError('Configuration loading failed. Please try again later.');
      }
    };

    loadConfig();
  }, []);

  /**
   * Handles the form submission and queries the RAG assistant
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Server error');
      }

      if (!data.answer) {
        throw new Error('Invalid server response: missing answer');
      }

      const parsed = parseResponse(data.answer);

      if (!validateResponse(parsed)) {
        throw new Error('Invalid response format');
      }

      setParsedResponse(parsed);
    } catch (error) {
      console.error('Query error:', error);
      setParsedResponse({
        error: true,
        answer: `An error occurred: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders content blocks, handling both text and code sections
   * @param {Array|string} content - Content to render
   * @returns {React.ReactNode} Rendered content
   */
  const renderContent = (content) => {
    if (!Array.isArray(content)) return content;

    return content.map((part, index) => {
      if (part.type === 'code') {
        return <CodeBlock key={index} code={part.content} language={part.language} />;
      }
      return <p key={index}>{part.content}</p>;
    });
  };

  return (
    <div className="app">
      <h1>DEMO - RAG Assistant for AV's Projects</h1>

      {/* Repository Information Section */}
      {config && (
        <div className="repos-info">
          <h3>Available Sources:</h3>
          <div className="repos-list">
            {config.repos.map((repo) => (
              <div key={repo.url} className="repo-item">
                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                  {repo.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && <div className="error-banner">{error}</div>}

      {/* Question Input Form */}
      <form onSubmit={handleSubmit} className="question-form">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your question here..."
          rows={4}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className={isLoading ? 'loading' : ''}
        >
          {isLoading ? 'Searching...' : 'Ask Question'}
        </button>
      </form>

      {/* Response Display Section */}
      {parsedResponse && (
        <div className="response-sections">
          {parsedResponse.error ? (
            <div className="error-section">
              <h2>Error:</h2>
              <div className="error-message">{parsedResponse.answer}</div>
            </div>
          ) : (
            <>
              {parsedResponse.answer && (
                <div className="answer-section">
                  <h2>Answer:</h2>
                  <div className="answer">{renderContent(parsedResponse.answer)}</div>
                </div>
              )}

              {parsedResponse.instructions && (
                <details className="section">
                  <summary>Instructions</summary>
                  <div>{renderContent(parsedResponse.instructions)}</div>
                </details>
              )}

              {parsedResponse.context && (
                <details className="context-section">
                  <summary>Context Used</summary>
                  <div className="context">{renderContent(parsedResponse.context)}</div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
