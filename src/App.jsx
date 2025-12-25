import React, { useState } from 'react';
import Homepage from './components/Homepage';
import ArticlePage from './components/ArticlePage';

export default function App() {
  const [view, setView] = useState('home'); // 'home' or 'article'
  const [currentRepo, setCurrentRepo] = useState('');
  const [articleData, setArticleData] = useState(null);

  const handleGenerate = (url, article) => {
    setCurrentRepo(url);
    setArticleData(article);
    setView('article');
  };

  const handleBack = () => {
    setView('home');
    setCurrentRepo('');
    setArticleData(null);
  };

  return (
    <div>
      {view === 'home' && <Homepage onGenerate={handleGenerate} />}
      {view === 'article' && (
        <ArticlePage
          repoUrl={currentRepo}
          articleData={articleData}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
