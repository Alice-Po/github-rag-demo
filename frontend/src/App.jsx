import { useState, useEffect } from 'react';
import './App.css';
import { parseResponse } from './utils/responseParser';
import CodeBlock from './components/CodeBlock';

function App() {
  const [question, setQuestion] = useState('');
  const [parsedResponse, setParsedResponse] = useState(null);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Charger la configuration au démarrage
  useEffect(() => {
    fetch('http://localhost:3001/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      // Vérifier si la réponse contient une erreur
      if (data.error) {
        throw new Error(data.details || data.error);
      }

      // Vérifier si data.answer existe
      if (!data.answer) {
        throw new Error('Réponse invalide du serveur');
      }

      const parsed = parseResponse(data.answer);
      setParsedResponse(parsed);
      console.log('Parsed response:', parsed);
    } catch (error) {
      console.error('Error:', error);
      setParsedResponse({
        error: true,
        answer: `Une erreur est survenue : ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      <h1>Assistant RAG GitHub</h1>
      {config && (
        <div className="repos-info">
          <h3>Sources :</h3>
          <div className="repos-list">
            {config.repos.map((repo, index) => (
              <div key={index} className="repo-item">
                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                  {repo.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="question-form">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question ici..."
          rows={4}
        />
        <button type="submit" disabled={isLoading || !question.trim()}>
          {isLoading ? 'Recherche en cours...' : 'Poser la question'}
        </button>
      </form>

      {parsedResponse && (
        <div className="response-sections">
          {parsedResponse.error ? (
            <div className="error-section">
              <h2>Erreur :</h2>
              <div className="error-message">{parsedResponse.answer}</div>
            </div>
          ) : (
            <>
              {parsedResponse.answer && (
                <div className="answer-section">
                  <h2>Réponse :</h2>
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
                  <summary>Contexte utilisé</summary>
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
