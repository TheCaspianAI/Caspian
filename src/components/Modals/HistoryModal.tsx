import { useUIStore } from '../../stores/uiStore';
import { Modal } from '../ui/Modal';
import { HistoryTab } from '../MainPanel/HistoryTab';

export function HistoryModal() {
  const { historyModalOpen, setHistoryModalOpen } = useUIStore();

  return (
    <Modal
      isOpen={historyModalOpen}
      onClose={() => setHistoryModalOpen(false)}
      title="Workspace History"
      size="lg"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        <HistoryTab />
      </div>
    </Modal>
  );
}
