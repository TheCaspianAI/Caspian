import { useRepositoryStore } from '../../stores/repositoryStore';
import { ChatTimeline } from './ChatTimeline';
import { HomeScreen } from '../HomeScreen';

export function ChatView() {
  // Note: activeNode no longer used here, ChatTimeline handles its own state
  const { activeRepoId } = useRepositoryStore();

  // Show home screen if no repository selected
  if (!activeRepoId) {
    return <HomeScreen />;
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
      {/* Full-height chat timeline */}
      <div className="flex-1 overflow-hidden">
        <ChatTimeline />
      </div>
    </div>
  );
}
