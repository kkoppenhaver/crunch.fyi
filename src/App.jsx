import React, { useState } from 'react';
import Homepage from './components/Homepage';
import ArticlePage from './components/ArticlePage';

export default function App() {
  const [view, setView] = useState('home'); // 'home' or 'article'
  const [currentRepo, setCurrentRepo] = useState('');

  const handleGenerate = (url) => {
    setCurrentRepo(url);
    setView('article');
  };

  const handleBack = () => {
    setView('home');
    setCurrentRepo('');
  };

  return (
    <div>
      {view === 'home' && <Homepage onGenerate={handleGenerate} />}
      {view === 'article' && <ArticlePage repoUrl={currentRepo} onBack={handleBack} />}
    </div>
  );
}
