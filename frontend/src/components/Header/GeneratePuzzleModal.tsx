import React, { useState } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { puzzleApi } from '../../api/client';
import Modal from './Modal';
import styles from './GeneratePuzzleModal.module.css';

interface GeneratePuzzleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GeneratePuzzleModal: React.FC<GeneratePuzzleModalProps> = ({ isOpen, onClose }) => {
  const { dispatch } = usePuzzle();
  const [topics, setTopics] = useState('');
  const [title, setTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topics || !title) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await puzzleApi.generatePuzzle(topics, title);
      dispatch({
        type: 'SET_PUZZLE',
        payload: {
          puzzle: response.puzzle,
          puzzleId: response.puzzle_id,
        },
      });
      onClose();
      // Reset form
      setTopics('');
      setTitle('');
    } catch (err: any) {
      console.error('Failed to generate puzzle:', err);
      setError(err.response?.data?.detail || 'Failed to generate puzzle. Please try different topics.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="Generate AI Mini Crossword"
      onClose={onClose}
      variant="info"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.description}>
          Enter some topics and a title to create a custom 5x5 mini crossword puzzle using AI.
        </p>
        
        <div className={styles.field}>
          <label htmlFor="title">Puzzle Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Sunday Funday"
            required
            disabled={isGenerating}
            maxLength={100}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="topics">Topics (comma separated)</label>
          <textarea
            id="topics"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="e.g., football, UIUC, computer science"
            required
            disabled={isGenerating}
            rows={3}
            maxLength={200}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={styles.generateBtn}
            disabled={isGenerating || !topics || !title}
          >
            {isGenerating ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Generating...
              </span>
            ) : (
              '✨ Generate'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default GeneratePuzzleModal;
