import { useState, useEffect } from 'react'

const STREAK_KEY = "nutrinow_workout_streak";
const LAST_WORKOUT_KEY = "nutrinow_last_workout_date";

export function useStreak() {
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    // Para fins de demonstracao, se nao houver ofensiva salva, iniciamos com 3 dias
    const savedStreak = localStorage.getItem(STREAK_KEY);
    if (!savedStreak) {
      localStorage.setItem(STREAK_KEY, "3");
      setStreak(3);
    } else {
      setStreak(parseInt(savedStreak, 10));
    }
  }, []);

  const incrementStreak = () => {
    setStreak((prev: number) => {
      const newStreak = prev + 1;
      localStorage.setItem(STREAK_KEY, newStreak.toString());
      return newStreak;
    });
  };

  return { streak, incrementStreak };
}
