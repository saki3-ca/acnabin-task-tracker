import React, { useEffect, useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Task } from '../../types';
import { Modal } from '../ui/Modal';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  task
}) => {
  const { addManagerComment } = useTasks();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setComment(task.managerComment || '');
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await addManagerComment(task.id, comment);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manager Review & Comment">
      <div className="modal-body">
        <div className="form-field">
          <label>Task Particulars</label>
          <div className="comment-box" style={{ background: '#FAF8F5' }}>
            {task.particular}
          </div>
        </div>

        <div className="form-field">
          <label>Employee Remarks</label>
          <div className="comment-box" style={{ background: '#FAF8F5', borderLeftColor: 'var(--teal)' }}>
            {task.remarks || 'No remarks provided.'}
          </div>
        </div>

        <div className="form-field">
          <label>Your Review Comment / Directions</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="form-textarea"
            rows={4}
            placeholder="Write review instructions, corrections, or feedback for the team member..."
            autoFocus
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Comment'}
        </button>
      </div>
    </Modal>
  );
};
