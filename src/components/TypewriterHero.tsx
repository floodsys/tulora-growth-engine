import { useEffect, useRef, useState } from 'react';
import Typed from 'typed.js';

const TypewriterHero = () => {
  const el = useRef(null);
  const typedRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const typed = new Typed(el.current, {
      strings: ["Build. 🚀", "Automate. 🤖", "Scale. 📈"],
      typeSpeed: 20,
      backSpeed: 20,
      loop: true
    });
    
    typedRef.current = typed;

    // Add keyboard event listeners
    const handleKeyPress = (event) => {
      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          if (isPaused) {
            typed.start();
            setIsPaused(false);
          } else {
            typed.stop();
            setIsPaused(true);
          }
          break;
        case 'Enter':
          event.preventDefault();
          typed.reset();
          break;
      }
    };

    // Make the component focusable and add event listener
    if (el.current) {
      el.current.parentElement.tabIndex = 0;
      el.current.parentElement.addEventListener('keydown', handleKeyPress);
      el.current.parentElement.style.outline = 'none';
    }

    return () => {
      typed.destroy();
      if (el.current && el.current.parentElement) {
        el.current.parentElement.removeEventListener('keydown', handleKeyPress);
      }
    };
  }, [isPaused]);

  return (
    <span 
      ref={el} 
      className="relative"
      title="Press Space to pause/resume, Enter to reset"
    />
  );
};

export default TypewriterHero;