import { useEffect, useRef } from 'react';
import Typed from 'typed.js';
const TypewriterHero = () => {
  const el = useRef(null);
  useEffect(() => {
    const typed = new Typed(el.current, {
      strings: ["Build. 🚀", "Automate. 🤖", "Scale. 📈"],
      typeSpeed: 20,
      backSpeed: 20,
      loop: true
    });
    return () => {
      typed.destroy();
    };
  }, []);
  return (
    <span ref={el} className="text-primary font-bold"></span>
  );
};
export default TypewriterHero;