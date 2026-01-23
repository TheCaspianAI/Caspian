import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { MainApp } from './components/MainApp';
import { WelcomeScreen } from './components/WelcomeScreen';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-text-secondary border-t-text-primary rounded-full animate-spin" />
        <span className="text-text-secondary text-sm">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  const { bootState, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading screen while initializing
  if (bootState === 'booting') {
    return <LoadingScreen />;
  }

  // Show welcome screen if not authenticated (require GitHub login)
  if (bootState !== 'authenticated') {
    return <WelcomeScreen />;
  }

  return <MainApp />;
}

export default App;
