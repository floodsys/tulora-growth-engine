import { useEffect, useRef } from 'react';
import Typed from 'typed.js';

const TypewriterHero = () => {
  const el = useRef(null);

  useEffect(() => {
    const typed = new Typed(el.current, {
      strings: [
        "Build. 🚀",
        "Automate. 🤖", 
        "Scale. 📈"
      ],
      typeSpeed: 20,
      backSpeed: 20,
      loop: true
    });

    return () => {
      typed.destroy();
    };
  }, []);

  return (
    <div className="text-center py-16">
      <h1 className="text-3xl lg:text-5xl font-bold text-foreground">
        <span ref={el}></span>
      </h1>
    </div>
  );
};

export default TypewriterHero;