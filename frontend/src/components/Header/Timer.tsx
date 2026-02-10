import React from 'react';
import { useTimer } from '../../hooks/useTimer';

const Timer: React.FC = () => {
  const { formattedTime } = useTimer();

  return (
    <div className="timer" role="timer" aria-label={`Elapsed time: ${formattedTime}`}>
      <span className="timer-value">{formattedTime}</span>
      <span className="timer-icon" aria-hidden="true">⏸</span>
    </div>
  );
};

export default Timer;
